[CmdletBinding()]
param(
    [string]$Document = "docs/discovery/repository-baseline.md",
    [switch]$CheckNetwork
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$documentPath = if ([System.IO.Path]::IsPathRooted($Document)) {
    $Document
} else {
    Join-Path $repoRoot $Document
}

$targetRepository = "https://github.com/Matrix-AE/Moss-Plag-Extension"
$targetSnapshot = "88630cd711f1d6ab93696674ba23fcc43360752b"
$upstreamRepository = "https://github.com/abdelhalimyasser/node-moss"
$upstreamSnapshot = "07c6bf18aeefe1e6bb84bf77cbe777d5bf4a0e2f"

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

function Invoke-Git {
    param(
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    $output = @(& git -C $repoRoot @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
    if (($exitCode -ne 0) -and (-not $AllowFailure)) {
        throw "git $($Arguments -join ' ') failed with exit code $exitCode."
    }

    [pscustomobject]@{
        ExitCode = $exitCode
        Output = ($output -join "`n").TrimEnd()
    }
}

function Get-OrdinalSortedLines {
    param([string]$Text)

    @(
        $Text -split "`r?`n" |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ -ne "" } |
            Sort-Object
    )
}

function Assert-SequenceEqual {
    param(
        [string[]]$Expected,
        [string[]]$Actual,
        [string]$Message
    )

    $expectedText = $Expected -join "`n"
    $actualText = $Actual -join "`n"
    Assert-True ($expectedText -ceq $actualText) $Message
}

function Test-RemoteUrl {
    param([string]$Url)

    $parameters = @{
        Uri = $Url
        Method = "Head"
        MaximumRedirection = 5
        TimeoutSec = 15
        UseBasicParsing = $true
        Headers = @{ "User-Agent" = "Moss-Plag-Extension-Prompt-001-Verifier" }
    }

    try {
        $response = Invoke-WebRequest @parameters
    } catch {
        $parameters.Method = "Get"
        $response = Invoke-WebRequest @parameters
    }

    $status = [int]$response.StatusCode
    Assert-True (($status -ge 200) -and ($status -lt 400)) "Evidence URL returned HTTP $status."
}

Assert-True (Test-Path -LiteralPath $documentPath -PathType Leaf) "Baseline document was not found: $documentPath"
$documentText = Read-StrictUtf8Text $documentPath
$initialStatus = (Invoke-Git -Arguments @("status", "--porcelain=v1", "--untracked-files=all")).Output

$tests = @(
    [pscustomobject]@{
        Id = "P001-T01"
        Name = "required sections are unique and ordered"
        Body = {
            $requiredHeadings = @(
                "# Repository Baseline and Evidence Map",
                "## Document Control",
                "## Scope and Evidence Rules",
                "## Target Product Repository",
                "### Snapshot and File Inventory",
                "### Existing Capabilities",
                "### Missing Product Layers",
                "### License State",
                '## Upstream `node-moss` Integration Reference',
                "### Provenance",
                "### API and Protocol",
                "### Build and Package",
                "### Tests and Quality Evidence",
                "### Known Defects and Risks",
                "### Reusable Assets",
                "## Assumptions Requiring Validation",
                "## Evidence Map",
                "## Verification Record",
                "### Test Cases",
                "### Execution Results"
            )

            $lastIndex = -1
            foreach ($heading in $requiredHeadings) {
                $matches = [regex]::Matches(
                    $documentText,
                    "(?m)^$([regex]::Escape($heading))$"
                )
                Assert-True ($matches.Count -eq 1) "Required heading must appear exactly once: $heading"
                Assert-True ($matches[0].Index -gt $lastIndex) "Required heading is out of order: $heading"
                $lastIndex = $matches[0].Index
            }

            $h1Count = [regex]::Matches($documentText, "(?m)^# [^#].+$").Count
            Assert-True ($h1Count -eq 1) "The document must contain exactly one H1."
        }
    },
    [pscustomobject]@{
        Id = "P001-T02"
        Name = "declared target inventory matches pinned Git tree"
        Body = {
            $markerPattern = '(?s)<!-- target-inventory:start -->\s*```text\s*\r?\n(?<files>.*?)\r?\n```\s*<!-- target-inventory:end -->'
            $inventoryMatch = [regex]::Match($documentText, $markerPattern)
            Assert-True $inventoryMatch.Success "Machine-readable target inventory block is missing."

            $declared = Get-OrdinalSortedLines $inventoryMatch.Groups["files"].Value
            $treeResult = Invoke-Git -Arguments @("ls-tree", "-r", "--name-only", $targetSnapshot)
            $actual = Get-OrdinalSortedLines $treeResult.Output
            Assert-SequenceEqual $actual $declared "Declared target inventory differs from the pinned Git tree."

            $expected = Get-OrdinalSortedLines "100-prompts.md`nREADME.md`nplan.md"
            Assert-SequenceEqual $expected $actual "Pinned target tree is not the expected three-file planning baseline."
        }
    },
    [pscustomobject]@{
        Id = "P001-T03"
        Name = "target and upstream license states remain separate"
        Body = {
            $targetTree = (Invoke-Git -Arguments @("ls-tree", "-r", "--name-only", $targetSnapshot)).Output -split "`r?`n"
            $targetLicenseFiles = @($targetTree | Where-Object {
                [System.IO.Path]::GetFileName($_) -match '^(LICENSE|COPYING|NOTICE)(\..*)?$'
            })
            Assert-True ($targetLicenseFiles.Count -eq 0) "Target snapshot unexpectedly contains a license-like file."

            $upstreamObject = Invoke-Git -Arguments @("cat-file", "-e", "${upstreamSnapshot}:LICENSE") -AllowFailure
            Assert-True ($upstreamObject.ExitCode -eq 0) "Pinned upstream LICENSE object is unavailable."
            $upstreamLicense = (Invoke-Git -Arguments @("show", "${upstreamSnapshot}:LICENSE")).Output
            Assert-True ($upstreamLicense -match '(?m)^MIT License$') "Pinned upstream LICENSE is not identified as MIT."

            Assert-True ($documentText -match 'target snapshot has no `LICENSE`') "Target license absence is not documented."
            Assert-True ($documentText -match 'upstream MIT license does not automatically become') "License separation is not documented."
        }
    },
    [pscustomobject]@{
        Id = "P001-T04"
        Name = "evidence links are scoped and immutable"
        Body = {
            Assert-True ($documentText -notmatch '/blob/(main|master)/') "Mutable branch-based blob evidence link found."
            Assert-True ($documentText -notmatch '/tree/(main|master)(?:[/?#)]|$)') "Mutable branch-based tree evidence link found."

            $targetFiles = @("README.md", "plan.md", "100-prompts.md")
            foreach ($file in $targetFiles) {
                $url = "$targetRepository/blob/$targetSnapshot/$file"
                Assert-True ($documentText.Contains($url)) "Required target evidence link is missing: $file"
            }

            $upstreamFiles = @(
                ".gitignore",
                ".npmignore",
                "LICENSE",
                "README.md",
                "package-lock.json",
                "package.json",
                "src/MOSS.ts",
                "tsconfig.json",
                "tsup.config.ts"
            )
            foreach ($file in $upstreamFiles) {
                $url = "$upstreamRepository/blob/$upstreamSnapshot/$file"
                Assert-True ($documentText.Contains($url)) "Required upstream evidence link is missing: $file"
            }

            $wrongTarget = "$upstreamRepository/blob/$targetSnapshot/"
            $wrongUpstream = "$targetRepository/blob/$upstreamSnapshot/"
            Assert-True (-not $documentText.Contains($wrongTarget)) "Target snapshot is attached to the upstream repository."
            Assert-True (-not $documentText.Contains($wrongUpstream)) "Upstream snapshot is attached to the target repository."
        }
    },
    [pscustomobject]@{
        Id = "P001-T05"
        Name = "Markdown structure and local links are valid"
        Body = {
            $fenceCount = [regex]::Matches($documentText, '(?m)^```').Count
            Assert-True (($fenceCount % 2) -eq 0) "Markdown code fences are unbalanced."
            Assert-True ($documentText -notmatch '(?m)[ \t]+$') "Trailing whitespace was found."
            Assert-True ($documentText -notmatch "`t") "Tab characters were found."

            $localLinks = [regex]::Matches(
                $documentText,
                '\]\((?!https?://|mailto:|#)(?<path>[^)#]+)(?:#[^)]*)?\)'
            )
            foreach ($link in $localLinks) {
                $relativePath = [System.Uri]::UnescapeDataString($link.Groups["path"].Value)
                $resolvedPath = Join-Path (Split-Path -Parent $documentPath) $relativePath
                Assert-True (Test-Path -LiteralPath $resolvedPath) "Unresolved local link: $relativePath"
            }
        }
    },
    [pscustomobject]@{
        Id = "P001-T06"
        Name = "tracked files contain no high-signal secrets"
        Body = {
            $forbiddenNames = '(?i)(^|/)(\.env($|\.)|[^/]+\.pem$|id_rsa[^/]*$|credentials?[^/]*$)'
            $tracked = @((Invoke-Git -Arguments @("ls-files")).Output -split "`r?`n" | Where-Object { $_ -ne "" })
            foreach ($relativePath in $tracked) {
                $normalized = $relativePath -replace '\\', '/'
                Assert-True ($normalized -notmatch $forbiddenNames) "Forbidden secret-bearing filename is tracked: $relativePath"
            }

            $pathsToScan = @($tracked + @(
                (Resolve-Path -LiteralPath $documentPath).Path.Substring($repoRoot.Length + 1),
                (Resolve-Path -LiteralPath $PSCommandPath).Path.Substring($repoRoot.Length + 1)
            ) | Sort-Object -Unique)
            $textExtensions = @(".css", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".ps1", ".ts", ".tsx", ".txt", ".yaml", ".yml")
            $secretRules = @(
                @{ Name = "private-key-header"; Pattern = '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----' },
                @{ Name = "github-token"; Pattern = '(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}' },
                @{ Name = "aws-access-key"; Pattern = 'AKIA[0-9A-Z]{16}' },
                @{ Name = "stripe-secret"; Pattern = 'sk_(?:live|test)_[A-Za-z0-9]{16,}' },
                @{ Name = "bearer-token"; Pattern = '(?i)Authorization\s*:\s*Bearer\s+[A-Za-z0-9._~+/=-]{16,}' },
                @{ Name = "moss-result-url"; Pattern = 'https?://moss\.stanford\.edu/results/[0-9]+' },
                @{ Name = "numeric-moss-id"; Pattern = '(?i)(?:moss|user)[ _-]?id\s*[:=]\s*["'']?[0-9]{4,}' }
            )

            foreach ($relativePath in $pathsToScan) {
                $absolutePath = Join-Path $repoRoot $relativePath
                if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
                    continue
                }
                $item = Get-Item -LiteralPath $absolutePath
                $extension = [System.IO.Path]::GetExtension($absolutePath).ToLowerInvariant()
                if (($textExtensions -notcontains $extension) -or ($item.Length -gt 5MB)) {
                    continue
                }
                $bytes = [System.IO.File]::ReadAllBytes($absolutePath)
                if ($bytes -contains 0) {
                    continue
                }
                $text = Read-StrictUtf8Text $absolutePath
                foreach ($rule in $secretRules) {
                    Assert-True ($text -notmatch $rule.Pattern) "Secret rule '$($rule.Name)' matched $relativePath."
                }
            }
        }
    },
    [pscustomobject]@{
        Id = "P001-T07"
        Name = "public upstream evidence links are reachable when requested"
        Body = {
            if (-not $CheckNetwork) {
                return
            }

            $urlMatches = [regex]::Matches(
                $documentText,
                "https://github\.com/abdelhalimyasser/node-moss/(?:blob|commit)/$upstreamSnapshot/[^)\s#]*|https://github\.com/abdelhalimyasser/node-moss/commit/$upstreamSnapshot"
            )
            $urls = @($urlMatches | ForEach-Object { $_.Value.TrimEnd('/') } | Sort-Object -Unique)
            Assert-True ($urls.Count -ge 7) "Expected upstream evidence URLs were not discovered."
            foreach ($url in $urls) {
                Test-RemoteUrl $url
            }
        }
    },
    [pscustomobject]@{
        Id = "P001-T08"
        Name = "verification leaves the worktree unchanged"
        Body = {
            $currentStatus = (Invoke-Git -Arguments @("status", "--porcelain=v1", "--untracked-files=all")).Output
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
    Write-Host "Prompt 001 verification failed: $failures of $($tests.Count) test cases failed."
    exit 1
}

Write-Host "Prompt 001 verification passed: $($tests.Count) of $($tests.Count) test cases passed."
exit 0
