[CmdletBinding()]
param(
    [string]$Document = "docs/product/product-charter.md"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$documentPath = if ([System.IO.Path]::IsPathRooted($Document)) {
    $Document
} else {
    Join-Path $repoRoot $Document
}

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Read-StrictUtf8Text {
    param([string]$Path)

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $offset = 0
    if (($bytes.Length -ge 3) -and
        ($bytes[0] -eq 0xEF) -and
        ($bytes[1] -eq 0xBB) -and
        ($bytes[2] -eq 0xBF)) {
        $offset = 3
    }

    $decoder = [System.Text.UTF8Encoding]::new($false, $true)
    try {
        $text = $decoder.GetString($bytes, $offset, $bytes.Length - $offset)
    } catch {
        throw "File is not valid UTF-8: $Path"
    }

    Assert-True ($text.IndexOf([char]0xFFFD) -lt 0) "Unicode replacement character found: $Path"
    $text
}

function Invoke-GitText {
    param([string[]]$Arguments)

    $output = @(& git -C $repoRoot @Arguments 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed."
    }
    ($output -join "`n").TrimEnd()
}

function Assert-ExactNames {
    param(
        [string[]]$Actual,
        [string[]]$Expected,
        [string]$Context
    )

    $actualSorted = @($Actual | Sort-Object)
    $expectedSorted = @($Expected | Sort-Object)
    Assert-True (($actualSorted -join "`n") -ceq ($expectedSorted -join "`n")) "$Context has missing, duplicate, or unexpected names."
}

function Get-Sha256Hex {
    param([string]$Text)

    $encoder = [System.Text.UTF8Encoding]::new($false, $true)
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        -join ($algorithm.ComputeHash($encoder.GetBytes($Text)) | ForEach-Object { $_.ToString("x2") })
    } finally {
        $algorithm.Dispose()
    }
}

function Test-BinaryBytes {
    param([byte[]]$Bytes)

    if ($Bytes.Length -eq 0) {
        return $false
    }
    if ($Bytes -contains 0) {
        return $true
    }
    if (($Bytes.Length -ge 4) -and
        ((($Bytes[0] -eq 0x89) -and ($Bytes[1] -eq 0x50) -and ($Bytes[2] -eq 0x4E) -and ($Bytes[3] -eq 0x47)) -or
         (($Bytes[0] -eq 0xFF) -and ($Bytes[1] -eq 0xD8) -and ($Bytes[2] -eq 0xFF)) -or
         (($Bytes[0] -eq 0x47) -and ($Bytes[1] -eq 0x49) -and ($Bytes[2] -eq 0x46) -and ($Bytes[3] -eq 0x38)) -or
         (($Bytes[0] -eq 0x50) -and ($Bytes[1] -eq 0x4B) -and ($Bytes[2] -in @(0x03, 0x05, 0x07)) -and ($Bytes[3] -in @(0x04, 0x06, 0x08))))) {
        return $true
    }

    $controlCount = 0
    foreach ($byte in $Bytes) {
        if (($byte -lt 0x20) -and ($byte -notin @(0x09, 0x0A, 0x0D))) {
            $controlCount++
        }
    }
    $controlCount -gt [Math]::Max(1, [Math]::Floor($Bytes.Length * 0.01))
}

function Get-Utf16Kind {
    param([byte[]]$Bytes)

    if (($Bytes.Length -ge 2) -and ($Bytes[0] -eq 0xFF) -and ($Bytes[1] -eq 0xFE)) {
        return "LE"
    }
    if (($Bytes.Length -ge 2) -and ($Bytes[0] -eq 0xFE) -and ($Bytes[1] -eq 0xFF)) {
        return "BE"
    }

    $pairCount = [Math]::Min([Math]::Floor($Bytes.Length / 2), 256)
    if ($pairCount -lt 4) {
        return $null
    }
    $evenZeros = 0
    $oddZeros = 0
    for ($i = 0; $i -lt $pairCount; $i++) {
        if ($Bytes[$i * 2] -eq 0) {
            $evenZeros++
        }
        if ($Bytes[($i * 2) + 1] -eq 0) {
            $oddZeros++
        }
    }
    if ((($oddZeros / $pairCount) -ge 0.30) -and (($evenZeros / $pairCount) -le 0.05)) {
        return "LE"
    }
    if ((($evenZeros / $pairCount) -ge 0.30) -and (($oddZeros / $pairCount) -le 0.05)) {
        return "BE"
    }
    $null
}

function Get-MarkdownModel {
    param([string]$Text)

    $lines = @($Text -split "`r?`n")
    $visible = New-Object System.Collections.Generic.List[string]
    $records = New-Object System.Collections.Generic.List[object]
    $inFence = $false
    $fenceCharacter = ""
    $fenceLength = 0
    $fenceCount = 0

    foreach ($line in $lines) {
        $insideBefore = $inFence
        $fence = [regex]::Match($line, '^\s*(?<marker>`{3,}|~{3,})')
        if ($fence.Success) {
            $marker = $fence.Groups["marker"].Value
            $markerCharacter = $marker.Substring(0, 1)
            if (-not $inFence) {
                $inFence = $true
                $fenceCharacter = $markerCharacter
                $fenceLength = $marker.Length
                $fenceCount++
                $records.Add([pscustomobject]@{ Line = $line; InsideBefore = $insideBefore; IsFence = $true })
                continue
            }
            $suffix = $line.Substring($fence.Index + $fence.Length)
            if (($markerCharacter -ceq $fenceCharacter) -and
                ($marker.Length -ge $fenceLength) -and
                ($suffix -match '^\s*$')) {
                $inFence = $false
                $fenceCharacter = ""
                $fenceLength = 0
                $fenceCount++
                $records.Add([pscustomobject]@{ Line = $line; InsideBefore = $insideBefore; IsFence = $true })
                continue
            }
        }

        $records.Add([pscustomobject]@{ Line = $line; InsideBefore = $insideBefore; IsFence = $false })
        if (-not $inFence) {
            $visible.Add($line)
        }
    }

    Assert-True (-not $inFence) "Markdown contains an unclosed fenced block."
    [pscustomobject]@{
        Lines = @($visible)
        VisibleText = (@($visible) -join "`n")
        FenceCount = $fenceCount
        Records = $records.ToArray()
    }
}

function Get-SectionText {
    param(
        [string[]]$Lines,
        [string]$Heading
    )

    $index = [array]::IndexOf($Lines, $Heading)
    Assert-True ($index -ge 0) "Section was not found: $Heading"
    $headingMatch = [regex]::Match($Heading, '^(?<hash>#{1,6}) ')
    $level = $headingMatch.Groups["hash"].Value.Length
    $body = New-Object System.Collections.Generic.List[string]

    for ($i = $index + 1; $i -lt $Lines.Count; $i++) {
        $nextHeading = [regex]::Match($Lines[$i], '^(?<hash>#{1,6}) ')
        if ($nextHeading.Success -and ($nextHeading.Groups["hash"].Value.Length -le $level)) {
            break
        }
        $body.Add($Lines[$i])
    }
    @($body) -join "`n"
}

Assert-True (Test-Path -LiteralPath $documentPath -PathType Leaf) "Product charter not found: $documentPath"
$documentText = Read-StrictUtf8Text $documentPath
$markdown = Get-MarkdownModel $documentText
$initialStatus = Invoke-GitText -Arguments @("status", "--porcelain=v1", "--untracked-files=all")

$approvedSectionMatch = [regex]::Match(
    $documentText,
    '(?ms)^### Approved UI Copy Baseline[ \t]*\r?\n(?<body>.*?)(?=^### [^\r\n]+[ \t]*\r?$|^## [^\r\n]+[ \t]*\r?$|\z)'
)
$copyStartMarker = "<!-- approved-ui-copy:start -->"
$copyEndMarker = "<!-- approved-ui-copy:end -->"
$copyPattern = '(?s)<!-- approved-ui-copy:start -->\s*```json\s*(?<json>\{.*?\})\s*```\s*<!-- approved-ui-copy:end -->'
$copyMatches = @()
if ($approvedSectionMatch.Success) {
    $copyMatches = @([regex]::Matches($approvedSectionMatch.Groups["body"].Value, $copyPattern))
}
$rawCopyJson = if ($copyMatches.Count -eq 1) {
    $copyMatches[0].Groups["json"].Value
} else {
    ""
}
$copy = $null
if ($rawCopyJson -ne "") {
    try {
        $copy = $rawCopyJson | ConvertFrom-Json
    } catch {
        $copy = $null
    }
}

$emDash = [char]0x2014
$expectedMessages = [ordered]@{
    primaryPromise = "Compare authorized code submissions and get a provider-hosted similarity report link${emDash}without command-line setup."
    primaryAction = "New similarity check"
    pairMode = "Compare two submissions"
    batchMode = "Compare multiple submissions"
    authorityNotice = "Only upload code you own or are authorized to submit."
    processingNotice = "After your review and consent, your code will be sent to an external similarity provider."
    reviewAction = "Review files and processing details"
    uploadProgress = "Uploading authorized code"
    providerProgress = "Submitting for similarity analysis"
    resultReady = "Your similarity report link is ready."
    resultGuidance = "Similarity highlights matching code; it does not determine plagiarism, intent, or misconduct. A person must review the highlighted code and context."
    reportScope = "This check compared only the submission groups you supplied."
    linkWarning = "Anyone with this report link may be able to view submitted code. Treat it like a password."
    externalCopyWarning = "Opening or copying the link may save it in browser history, sync, or the system clipboard."
    availabilityNotice = "Availability is estimated and the provider may remove the report earlier or later."
    forgetLinkNotice = "Forget link removes our saved URL only. It does not revoke the provider report or erase external copies."
    unsupportedFormat = "Choose supported source-code files. Essays, PDFs, Word documents, images, and executables are not supported."
    singleGroupError = "Add at least two submissions to run a meaningful comparison."
    noMatches = "No matches were reported within this supplied corpus under the selected settings. This is not proof of originality."
    highSimilarity = "High similarity was reported. Review the highlighted passages; the report does not establish authorship, copying direction, or intent."
    sameAuthorNotice = "Revisions or code by the same author can produce high similarity. Review the surrounding context."
    baseCodeNotice = "Expected shared code was identified as base code where provider support applies. This does not guarantee that every expected match is removed."
    mixedLanguageError = "This check cannot run with mixed languages. Create a separate check for each supported language."
    reportUnavailable = "The report is unavailable or past its estimated availability. We cannot confirm that the provider deleted it."
    providerNotSent = "The provider is unavailable and this check was not sent. No similarity conclusion was produced."
    providerSentNoResult = "The check was sent, but the provider returned no report. The submission outcome is incomplete; do not retry until the product marks it safe."
    providerStatusUnknown = "We cannot confirm whether the provider received this check. No similarity conclusion was produced; do not retry until the product marks it safe."
}

$expectedMetricHashes = [ordered]@{
    "M-01" = "4eac0866c8423830faf5b5327dfbabf8537c64213d99e95f2f10294501bcf3df"
    "M-02" = "86ad447a0ce03925d1804143f9dfacdbef1283ab0bb7b89e053eb094850c8fa5"
    "M-03" = "f8ecc083ef877e68568d9093f22b54c3a73399229adefaae7a40c7e078ccb70d"
    "M-04" = "0d7669bb0e98d5948d87fd33fe3cbc1e082161524acc75b8fa11a486552d4b8c"
    "M-05" = "0b0f183ef262afc48bb16e607724bc5e5b1b9c9d6f9a2a6a29b2759944032418"
    "M-06" = "1ae4a4a9df4a136ab396f4b0d654ef3b351c38d147b3ad7e37304d9213c0d3b7"
    "M-07" = "9295b0720afd1152b7c7bbdfdffbf1a2a41128756ec0819c0d7239e62c55229a"
    "M-08" = "02cab4ce16c3bc7cb8c17853d57c28b4b0fd090baa6b41c71b20fbc03422f1c7"
    "M-09" = "1cf7eb45bb5de5420fc639d67d49d2d03cf1444c9cb0704d57152aa27f792df6"
    "M-10" = "1fdb3e94e17408df756663b0f78045e3b746a32e1f53c9f803a6e527d5008d60"
    "M-11" = "75135acfc839b912f4656ea7f7bab6a846623182e9deb573b7a4a0860a682bc0"
}

$tests = @(
    [pscustomobject]@{
        Id = "P002-T01"
        Name = "required charter sections are unique and ordered outside fences"
        Body = {
            $requiredHeadings = @(
                "# Product Charter and Responsible Terminology",
                "## Document Control",
                "## Charter Statement",
                "## Launch Audience and Personas",
                "## Jobs to Be Done",
                "## Supported MVP Scenarios",
                "## Product Definitions",
                "## Explicit Exclusions",
                "## Responsible Terminology Standard",
                "### Approved UI Copy Baseline",
                "### Required Interpretation Guidance",
                "### Controlled Edge-Case Language",
                "## Ethical and Trust Boundaries",
                "## Commercial Boundary",
                "## Success Metrics and Initial Outcomes",
                "## Assumptions Requiring Validation",
                "## Product Decision Rules",
                "## Traceability and Acceptance",
                "## Verification Record"
            )

            $lastIndex = -1
            foreach ($heading in $requiredHeadings) {
                $matches = [regex]::Matches($markdown.VisibleText, "(?m)^$([regex]::Escape($heading))$")
                Assert-True ($matches.Count -eq 1) "Required heading must appear exactly once: $heading"
                Assert-True ($matches[0].Index -gt $lastIndex) "Required heading is out of order: $heading"
                $lastIndex = $matches[0].Index
            }
            Assert-True ([regex]::Matches($markdown.VisibleText, '(?m)^# [^#].+$').Count -eq 1) "Charter must have exactly one H1."
        }
    },
    [pscustomobject]@{
        Id = "P002-T02"
        Name = "approved UI copy has strict UTF-8 closed JSON schema"
        Body = {
            Assert-True ($approvedSectionMatch.Success) "Approved UI Copy Baseline section could not be parsed."
            Assert-True ([regex]::Matches($documentText, '(?m)^### Approved UI Copy Baseline[ \t]*\r?$').Count -eq 1) "Approved UI heading must occur exactly once in raw Markdown."
            Assert-True ([regex]::Matches($documentText, [regex]::Escape($copyStartMarker)).Count -eq 1) "Approved UI start marker must occur exactly once."
            Assert-True ([regex]::Matches($documentText, [regex]::Escape($copyEndMarker)).Count -eq 1) "Approved UI end marker must occur exactly once."
            $startRecords = @($markdown.Records | Where-Object { $_.Line -ceq $copyStartMarker })
            $endRecords = @($markdown.Records | Where-Object { $_.Line -ceq $copyEndMarker })
            Assert-True (($startRecords.Count -eq 1) -and (-not $startRecords[0].InsideBefore)) "Approved UI start marker must be outside every Markdown fence."
            Assert-True (($endRecords.Count -eq 1) -and (-not $endRecords[0].InsideBefore)) "Approved UI end marker must be outside every Markdown fence."
            Assert-True ($copyMatches.Count -eq 1) "Approved UI JSON block must occur exactly once inside its section."
            Assert-True ($null -ne $copy) "Approved UI copy must contain valid JSON."

            $expectedRawKeys = @("schemaVersion", "locale", "defaultReportTerm", "messages") + @($expectedMessages.Keys)
            $rawKeyMatches = [regex]::Matches($rawCopyJson, '(?<!\\)"(?<key>(?:\\.|[^"\\])*)"\s*:')
            foreach ($rawKeyMatch in $rawKeyMatches) {
                Assert-True ($rawKeyMatch.Groups["key"].Value -notmatch '\\') "Escapes are forbidden in closed-schema JSON property names."
            }
            $rawKeys = @($rawKeyMatches | ForEach-Object { $_.Groups["key"].Value })
            Assert-ExactNames $rawKeys $expectedRawKeys "Raw approved UI JSON"

            Assert-ExactNames @($copy.PSObject.Properties.Name) @("schemaVersion", "locale", "defaultReportTerm", "messages") "Approved UI root"
            Assert-True ($copy.schemaVersion -is [int]) "schemaVersion must be an integer, not a numeric string or decimal."
            Assert-True ($copy.schemaVersion -eq 1) "schemaVersion must equal 1."
            Assert-True ($copy.locale -ceq "en-US") "locale must equal en-US."
            Assert-True ($copy.defaultReportTerm -ceq "similarity report") "defaultReportTerm must equal similarity report."
            Assert-ExactNames @($copy.messages.PSObject.Properties.Name) @($expectedMessages.Keys) "Approved UI messages"

            foreach ($property in $copy.messages.PSObject.Properties) {
                Assert-True ($property.Value -is [string]) "Approved UI value must be a string: $($property.Name)"
                Assert-True ($property.Value -ceq $expectedMessages[$property.Name]) "Approved UI copy changed without updating its reviewed contract: $($property.Name)"
            }
        }
    },
    [pscustomobject]@{
        Id = "P002-T03"
        Name = "similarity is default and unsafe accusation claims are blocked"
        Body = {
            Assert-True ($null -ne $copy) "Approved UI copy is unavailable."
            $properties = @($copy.messages.PSObject.Properties)
            $plagiarismProperties = @($properties | Where-Object { $_.Value -match '(?i)\bplagiarism\b' })
            Assert-True ($plagiarismProperties.Count -eq 1) "Plagiarism may occur in exactly one negating UI disclaimer."
            Assert-True ($plagiarismProperties[0].Name -ceq "resultGuidance") "Plagiarism may occur only in resultGuidance."
            Assert-True ($copy.messages.resultGuidance -match '(?i)does not determine plagiarism, intent, or misconduct') "Result guidance must negate a verdict."
            Assert-True ($copy.messages.resultGuidance -match '(?i)person must review') "Result guidance must require human review."

            $joined = @($properties | ForEach-Object { [string]$_.Value }) -join "`n"
            $forbiddenPatterns = @(
                '\bplagiarism[- ]?(?:checker|detector|result|score|percentage|free)\b',
                '\bcheating[- ]?(?:checker|detector|detected)\b',
                '\b(?:caught|guilty|verdict|definitive|conclusive evidence)\b',
                '\b(?:the student cheated|stolen code|no copied code found)\b',
                '\b(?:100%|guaranteed)\s+accurate\b',
                '\boriginality score\b'
            )
            foreach ($pattern in $forbiddenPatterns) {
                Assert-True ($joined -notmatch "(?i)$pattern") "Forbidden claim found in approved UI copy: $pattern"
            }

            foreach ($property in $properties | Where-Object { $_.Name -ne "resultGuidance" }) {
                $unsafePredicate = '(?i)\b(?:detect|detected|prove|proven|confirm|confirmed|identify|identified|catch|caught|determine|determined)\w*\b.{0,40}\b(?:plagiarism|cheating|misconduct|copied|copying)\b'
                Assert-True ($property.Value -notmatch $unsafePredicate) "Verdict-like predicate found: $($property.Name)"
            }
        }
    },
    [pscustomobject]@{
        Id = "P002-T04"
        Name = "audience jobs scenarios definitions and exclusions are section-correct"
        Body = {
            $audience = Get-SectionText $markdown.Lines "## Launch Audience and Personas"
            $jobs = Get-SectionText $markdown.Lines "## Jobs to Be Done"
            $scenarios = Get-SectionText $markdown.Lines "## Supported MVP Scenarios"
            $definitions = Get-SectionText $markdown.Lines "## Product Definitions"
            $exclusions = Get-SectionText $markdown.Lines "## Explicit Exclusions"

            Assert-True ($audience -match '(?i)adults aged 18 or older') "Adult launch audience is missing."
            Assert-True ($audience -match '(?i)own or have explicit authority') "Upload-authority boundary is missing."
            Assert-True ($audience -match '(?i)does not accept minor-authored code') "Minor-authored code exclusion is missing."
            Assert-True ([regex]::Matches($audience, '(?m)^\| P-[0-9]{2} \|').Count -eq 4) "Exactly four charter personas are required."
            Assert-True ([regex]::Matches($jobs, '(?m)^\| J-[0-9]{2} \|').Count -eq 8) "Exactly eight jobs-to-be-done are required."
            Assert-True ([regex]::Matches($scenarios, '(?m)^\| S-[0-9]{2} \|').Count -eq 8) "Exactly eight supported scenarios are required."

            foreach ($term in @("Logical submission", "Pair Check", "Batch Check", "Base code", "Similarity report", "Bearer report link")) {
                Assert-True ($definitions -match "(?m)^\| $([regex]::Escape($term)) \|") "Controlled definition is missing: $term"
            }
            Assert-True ($exclusions -match '(?i)The MVP does not support') "Exclusions must use explicit negative semantics."
            foreach ($concept in @("single file checked against the Internet", "PDFs", "DOC/DOCX", "automatic plagiarism", "minor-authored code/data", "account pooling", "quota-evasion rotation", "report scraping")) {
                Assert-True ($exclusions -match [regex]::Escape($concept)) "Required exclusion is missing: $concept"
            }
        }
    },
    [pscustomobject]@{
        Id = "P002-T05"
        Name = "provider disclosure bearer-link safety and brand gating are explicit"
        Body = {
            Assert-True ($copy.messages.processingNotice -match '(?i)code will be sent to an external similarity provider') "External-provider disclosure is incomplete."
            Assert-True ($copy.messages.reportScope -match '(?i)only the submission groups you supplied') "Supplied-corpus scope is incomplete."
            Assert-True ($copy.messages.linkWarning -match '(?i)anyone with this report link') "Bearer-link warning is incomplete."
            Assert-True ($copy.messages.externalCopyWarning -match '(?i)browser history.*clipboard') "External-copy warning is incomplete."
            Assert-True ($copy.messages.forgetLinkNotice -match '(?i)does not revoke the provider report') "Forget-link limitation is incomplete."
            Assert-True ($copy.messages.reportUnavailable -match '(?i)cannot confirm that the provider deleted it') "Unavailable-report limitation is incomplete."
            Assert-True ($copy.messages.providerNotSent -match '(?i)check was not sent.*No similarity conclusion was produced') "Provider not-sent state is incomplete."
            Assert-True ($copy.messages.providerSentNoResult -match '(?i)check was sent.*returned no report.*do not retry') "Provider sent/no-result state is incomplete."
            Assert-True ($copy.messages.providerStatusUnknown -match '(?i)cannot confirm whether the provider received.*do not retry') "Provider unknown-transfer state is incomplete."

            $approvedText = @($copy.messages.PSObject.Properties.Value) -join "`n"
            Assert-True ($approvedText -notmatch '(?i)\bMOSS\b|Stanford|official|endorsed|partnered|powered by') "Provider-specific brand or affiliation language entered baseline UI copy."
            Assert-True ($approvedText -notmatch '(?i)fully secure|private report|secure report|end-to-end encrypted|anonymous') "Unsupported security/privacy claim entered baseline UI copy."
            $terminology = Get-SectionText $markdown.Lines "## Responsible Terminology Standard"
            Assert-True ($terminology -match '(?i)conditional legal/brand template, not approved baseline UI copy') "Conditional non-affiliation policy is missing."
            Assert-True ($terminology -match '(?i)Prompt 005') "Brand naming must remain gated by Prompt 005."
        }
    },
    [pscustomobject]@{
        Id = "P002-T06"
        Name = "the fifteen-dollar commercial boundary remains conditional"
        Body = {
            $commercial = Get-SectionText $markdown.Lines "## Commercial Boundary"
            Assert-True ($commercial -match 'USD \$15') 'USD $15 hypothesis is missing.'
            Assert-True ($commercial -match '(?i)one-time purchase') "One-time purchase hypothesis is missing."
            Assert-True ($commercial -match '(?i)commercial hypothesis') "Price must be labeled a hypothesis."
            Assert-True ($commercial -match '(?i)Prompt 005.*lawful provider') "Commercial authorization gate is missing."
            Assert-True ($commercial -match '(?i)Prompt 006.*exact entitlement') "Offer/economics gate is missing."
            Assert-True ($commercial -match '(?i)approved encrypted provider route') "Encrypted provider-route gate is missing."
            Assert-True ($commercial -match '(?i)no checkout, paid beta, presale') "No-sale-before-gates rule is missing."
            Assert-True ($documentText -match '(?i)pivot or stop') "Commercial failure must retain a pivot/stop path."

            $approvedText = @($copy.messages.PSObject.Properties.Value) -join "`n"
            Assert-True ($approvedText -notmatch '(?i)\$15|buy now|unlimited|lifetime|always available|guaranteed report') "Unapproved commercial promise entered UI copy."
        }
    },
    [pscustomobject]@{
        Id = "P002-T07"
        Name = "all initial outcomes are unique measurable and provisional"
        Body = {
            $metrics = Get-SectionText $markdown.Lines "## Success Metrics and Initial Outcomes"
            Assert-True ($metrics -match 'provisional \*\*targets\*\*, not achieved results') "Metrics must be labeled provisional targets."
            Assert-True ($metrics -match '(?m)^\| ID \| Target outcome \| Measure and cohort \| Initial target \| Failure response \|$') "Metric table header changed unexpectedly."

            $rows = @([regex]::Matches($metrics, '(?m)^\| M-[0-9]{2} \|.*\|$'))
            Assert-True ($rows.Count -eq 11) "Exactly eleven metric rows are required."
            $metricMap = @{}
            foreach ($row in $rows) {
                $columns = @($row.Value.Trim('|').Split('|') | ForEach-Object { $_.Trim() })
                Assert-True ($columns.Count -eq 5) "Metric row must contain exactly five columns."
                foreach ($column in $columns) {
                    Assert-True (-not [string]::IsNullOrWhiteSpace($column)) "Metric row contains an empty cell."
                }
                Assert-True (-not $metricMap.ContainsKey($columns[0])) "Duplicate metric ID: $($columns[0])"
                $metricMap[$columns[0]] = $columns
                Assert-True ($columns[3] -match '(?:[0-9]+%|Greater than 0)') "Metric lacks a measurable target: $($columns[0])"
                Assert-True ($columns[3] -notmatch '(?i)\bTBD\b|best-in-class|as (?:high|fast|easy) as possible') "Metric uses a vague target: $($columns[0])"
                Assert-True ($expectedMetricHashes.Contains($columns[0])) "Unexpected metric ID: $($columns[0])"
                Assert-True ((Get-Sha256Hex $row.Value) -ceq $expectedMetricHashes[$columns[0]]) "Approved metric row changed without updating its reviewed contract: $($columns[0])"
            }

            $expectedIds = @($expectedMetricHashes.Keys)
            Assert-ExactNames @($metricMap.Keys) $expectedIds "Metric IDs"
            $expectedOutcomeTerms = @{
                "M-01" = "product category"; "M-02" = "verdict"; "M-03" = "external processing";
                "M-04" = "bearer-link"; "M-05" = "Pair workflow"; "M-06" = "Batch grouping";
                "M-07" = "result"; "M-08" = "language"; "M-09" = "value";
                "M-10" = "supportable"; "M-11" = "accessible"
            }
            foreach ($id in $expectedIds) {
                Assert-True ($metricMap[$id][1] -match [regex]::Escape($expectedOutcomeTerms[$id])) "Metric outcome changed category: $id"
            }
            Assert-True ($metricMap["M-09"][3] -match 'At least 60%') "Pricing research requires a provisional rate threshold."
            Assert-True ($metricMap["M-09"][3] -match 'Prompt 003 fixes sample, method, and confidence') "Prompt 003 must own research design."
            Assert-True ($metricMap["M-09"][2] -notmatch '(?i)forced-choice') "Prompt 002 must not preselect the pricing-research method."
            Assert-True ($metricMap["M-10"][3] -match 'Greater than 0 approved three-year contribution margin') "Economics target must be an explicit greater-than-zero threshold."
        }
    },
    [pscustomobject]@{
        Id = "P002-T08"
        Name = "Markdown UTF-8 and local-reference hygiene pass"
        Body = {
            Assert-True ($markdown.FenceCount -eq 2) "Charter must contain exactly one properly closed JSON fence."
            Assert-True ($documentText -notmatch '(?m)[ \t]+$') "Trailing whitespace was found."
            Assert-True ($documentText -notmatch "`t") "Tab character was found."
            Assert-True ($documentText.EndsWith("`n")) "Document must end with a newline."
            Assert-True ($markdown.VisibleText -notmatch '/blob/(?:main|master)/') "Mutable branch evidence link found."

            $rootBoundary = $repoRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
            $localLinks = [regex]::Matches($markdown.VisibleText, '\]\((?!https?://|mailto:|#)(?<path>[^)#]+)(?:#[^)]*)?\)')
            foreach ($link in $localLinks) {
                $relative = [System.Uri]::UnescapeDataString($link.Groups["path"].Value)
                $candidate = Join-Path (Split-Path -Parent $documentPath) $relative
                Assert-True (Test-Path -LiteralPath $candidate) "Unresolved local link: $relative"
                $resolved = (Resolve-Path -LiteralPath $candidate).Path
                $insideRoot = $resolved.StartsWith($rootBoundary, [System.StringComparison]::OrdinalIgnoreCase)
                Assert-True ($insideRoot) "Local link escapes repository: $relative"
            }
        }
    },
    [pscustomobject]@{
        Id = "P002-T09"
        Name = "all proposed text is secret-safe and verification is read-only"
        Body = {
            $fileListText = Invoke-GitText -Arguments @("ls-files", "--cached", "--others", "--exclude-standard")
            $files = @(($fileListText -split "`r?`n") | Where-Object { $_ -ne "" } | Sort-Object -Unique)
            $forbiddenNames = '(?i)(^|/)(\.env($|\.)|[^/]+\.pem$|id_rsa[^/]*$|credentials?[^/]*$)'
            foreach ($relative in $files) {
                Assert-True (($relative -replace '\\', '/') -notmatch $forbiddenNames) "Forbidden secret-bearing filename is proposed: $relative"
            }

            $rules = @(
                @{ Name = "private-key-header"; Pattern = '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----' },
                @{ Name = "github-token"; Pattern = '(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}' },
                @{ Name = "npm-token"; Pattern = 'npm_[A-Za-z0-9]{36}' },
                @{ Name = "slack-token"; Pattern = 'xox[baprs]-[A-Za-z0-9-]{20,}' },
                @{ Name = "google-api-key"; Pattern = 'AIza[0-9A-Za-z_-]{35}' },
                @{ Name = "aws-access-key"; Pattern = 'AKIA[0-9A-Z]{16}' },
                @{ Name = "stripe-secret"; Pattern = 'sk_(?:live|test)_[A-Za-z0-9]{16,}' },
                @{ Name = "bearer-token"; Pattern = '(?i)Authorization\s*:\s*Bearer\s+[A-Za-z0-9._~+/=-]{16,}' },
                @{ Name = "moss-result-url"; Pattern = 'https?://moss\.stanford\.edu/results/[0-9]+' },
                @{ Name = "numeric-moss-id"; Pattern = '(?i)(?:moss|user)[ _-]?id\s*[:=]\s*["'']?[0-9]{4,}' }
            )

            foreach ($relative in $files) {
                $absolute = Join-Path $repoRoot $relative
                if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) {
                    continue
                }
                $item = Get-Item -LiteralPath $absolute
                Assert-True ($item.Length -le 5MB) "Proposed file exceeds the 5 MiB secret-scan limit: $relative"
                $bytes = [System.IO.File]::ReadAllBytes($absolute)
                $asciiText = [System.Text.Encoding]::ASCII.GetString($bytes)
                foreach ($rule in $rules) {
                    Assert-True ($asciiText -notmatch $rule.Pattern) "Secret rule '$($rule.Name)' matched $relative."
                }
                $utf16Kind = Get-Utf16Kind $bytes
                if ($null -ne $utf16Kind) {
                    $offset = 0
                    if (($bytes.Length -ge 2) -and
                        ((($bytes[0] -eq 0xFF) -and ($bytes[1] -eq 0xFE)) -or
                         (($bytes[0] -eq 0xFE) -and ($bytes[1] -eq 0xFF)))) {
                        $offset = 2
                    }
                    Assert-True ((($bytes.Length - $offset) % 2) -eq 0) "Malformed UTF-16 file is proposed: $relative"
                    $bigEndian = $utf16Kind -ceq "BE"
                    $utf16Decoder = [System.Text.UnicodeEncoding]::new($bigEndian, $false, $true)
                    try {
                        $utf16Text = $utf16Decoder.GetString($bytes, $offset, $bytes.Length - $offset)
                    } catch {
                        throw "Malformed UTF-16 file is proposed: $relative"
                    }
                    foreach ($rule in $rules) {
                        Assert-True ($utf16Text -notmatch $rule.Pattern) "Secret rule '$($rule.Name)' matched $relative."
                    }
                    throw "Text files must use UTF-8, not UTF-16: $relative"
                }
                if (-not (Test-BinaryBytes $bytes)) {
                    $text = Read-StrictUtf8Text $absolute
                    foreach ($rule in $rules) {
                        Assert-True ($text -notmatch $rule.Pattern) "Secret rule '$($rule.Name)' matched $relative."
                    }
                }
            }

            $currentStatus = Invoke-GitText -Arguments @("status", "--porcelain=v1", "--untracked-files=all")
            Assert-True ($currentStatus -ceq $initialStatus) "Verifier changed the Git worktree."
        }
    }
)

$failures = 0
foreach ($test in $tests) {
    try {
        & $test.Body
        Write-Host "PASS $($test.Id) $($test.Name)"
    } catch {
        $failures++
        Write-Host "FAIL $($test.Id) $($test.Name)"
        Write-Host "     $($_.Exception.Message)"
    }
}

if ($failures -gt 0) {
    Write-Host "Prompt 002 verification failed: $failures of $($tests.Count) test cases failed."
    exit 1
}

Write-Host "Prompt 002 verification passed: $($tests.Count) of $($tests.Count) test cases passed."
exit 0
