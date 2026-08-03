"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const { TRAINS } = require(path.join(root, "scripts/release/trains.js"));
const changesets = require(path.join(root, "scripts/release/changesets.js"));
const { buildSbom } = require(path.join(root, "scripts/release/sbom.js"));
const { classify, scanLicenses } = require(path.join(root, "scripts/release/licenses.js"));
const { checkDependencies } = require(path.join(root, "scripts/check-dependencies.js"));
const { runDryRun } = require(path.join(root, "scripts/release/dry-run.js"));

const doc = fs.readFileSync(path.join(root, "docs/engineering/release-process.md"), "utf8");
const releaseWorkflow = fs.readFileSync(path.join(root, ".github/workflows/release.yml"), "utf8");

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function fakePacker({ outDir, workspaces, train }) {
  return workspaces.map((workspace) => {
    const file = path.join(outDir, `${train}-${path.basename(workspace)}-0.0.0.tgz`);
    fs.writeFileSync(file, `fake artifact for ${workspace}`);
    return file;
  });
}

test("P022-T01 release doc covers provenance, rollout, rollback, hotfix, compatibility, deprecation", () => {
  const lines = doc.split(/\r?\n/);
  const required = [
    "## Release trains",
    "## Versioning",
    "## Dependency maintenance",
    "## Provenance",
    "## Staged rollout",
    "## Rollback",
    "## Hotfix",
    "## Compatibility",
    "## Deprecation",
  ];
  let previous = -1;
  for (const heading of required) {
    const index = lines.indexOf(heading);
    assert.ok(index > -1, `missing section: ${heading}`);
    assert.ok(index > previous, `out of order: ${heading}`);
    previous = index;
  }
  assert.match(doc, /SBOM/);
  assert.match(doc, /sigstore/i);
});

test("P022-T02 store submission and backend deployment are separate trains and approvals", () => {
  const clientWorkspaces = new Set(TRAINS.client.workspaces);
  for (const workspace of TRAINS.server.workspaces) {
    assert.equal(clientWorkspaces.has(workspace), false, `${workspace} shared across trains`);
  }
  assert.notEqual(TRAINS.client.approvalEnvironment, TRAINS.server.approvalEnvironment);
  assert.match(releaseWorkflow, /on:\s*\n\s*workflow_dispatch:/);
  assert.match(releaseWorkflow, /environment: store-submission/);
  assert.match(releaseWorkflow, /environment: production-backend/);
  assert.doesNotMatch(releaseWorkflow, /actions\/(?:checkout|setup-node|upload-artifact)@v4/);
  // A single dispatch can never satisfy both promotion conditions.
  assert.match(releaseWorkflow, /inputs\.train == 'client' && inputs\.confirm == 'PUBLISH'/);
  assert.match(releaseWorkflow, /inputs\.train == 'server' && inputs\.confirm == 'PUBLISH'/);
});

test("P022-T03 changeset validation enforces semver and human approval", () => {
  const good = changesets.parseChangeset(
    "---\ntrain: server\nbump: patch\n---\n\nFix job status polling.\n",
    "a.md",
  );
  assert.deepEqual(good.errors, []);
  assert.equal(good.bump, "patch");

  const breaking = changesets.parseChangeset(
    "---\ntrain: client\nbump: major\n---\n\nDrop legacy payload.\n",
    "b.md",
  );
  assert.ok(breaking.errors.some((e) => e.code === "missing-approval"));

  const security = changesets.parseChangeset(
    "---\ntrain: server\nbump: patch\nsecurity: true\n---\n\nPatch SSRF guard.\n",
    "c.md",
  );
  assert.ok(security.errors.some((e) => e.code === "missing-approval"));

  assert.ok(
    changesets
      .parseChangeset("---\ntrain: nope\nbump: huge\n---\n\n\n", "d.md")
      .errors.map((e) => e.code)
      .includes("unknown-train"),
  );
  assert.ok(changesets.parseChangeset("no front matter", "e.md").errors[0].code === "malformed");

  assert.equal(changesets.bumpVersion("1.2.3", "major"), "2.0.0");
  assert.equal(changesets.bumpVersion("1.2.3", "minor"), "1.3.0");
  assert.equal(changesets.bumpVersion("1.2.3", "patch"), "1.2.4");
  assert.equal(changesets.highestBump(["patch", "major", "minor"]), "major");
});

test("P022-T04 committed changesets are valid and plan a semantic bump", () => {
  const parsed = changesets.readChangesets(path.join(root, ".changes"));
  assert.ok(parsed.length > 0, "at least one changeset expected");
  const plan = changesets.planReleases(parsed, { client: "0.0.0", server: "0.0.0", packages: "0.0.0" });
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.ok, true);
  assert.ok(plan.plans.length > 0);
  for (const entry of plan.plans) {
    assert.notEqual(entry.from, entry.to);
  }
});

test("P022-T05 SBOM covers workspaces and dependencies with licenses", () => {
  const sbom = buildSbom({ root, timestamp: "2026-08-03T00:00:00.000Z", commit: "deadbeef" });
  assert.equal(sbom.bomFormat, "CycloneDX");
  assert.equal(sbom.specVersion, "1.5");
  const names = sbom.components.map((component) => component.name);
  for (const workspace of Object.values(TRAINS).flatMap((train) => train.workspaces)) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, workspace, "package.json"), "utf8"));
    assert.ok(names.includes(manifest.name), `SBOM missing ${manifest.name}`);
  }
  assert.ok(names.includes("typescript"));
  for (const component of sbom.components) {
    assert.ok(component.licenses[0].license.id, `${component.name} has no license id`);
    assert.match(component.purl, /^pkg:npm\//);
  }
  assert.deepEqual(scanLicenses(sbom), { ok: true, violations: [] });
});

test("P022-T06 license policy rejects copyleft and unknown third-party terms", () => {
  assert.equal(classify("MIT"), "allowed");
  assert.equal(classify("(MIT OR Apache-2.0)"), "allowed");
  assert.equal(classify("GPL-3.0-only"), "denied");
  assert.equal(classify("AGPL-3.0"), "denied");
  assert.equal(classify("SSPL-1.0"), "denied");
  assert.equal(classify("Weird-Custom-1.0"), "unknown");

  const sbom = {
    components: [
      {
        name: "copyleft-lib",
        version: "1.0.0",
        licenses: [{ license: { id: "GPL-3.0-only" } }],
        properties: [{ name: "moss:origin", value: "registry" }],
      },
      {
        name: "mystery-lib",
        version: "2.0.0",
        licenses: [{ license: { id: "UNKNOWN" } }],
        properties: [{ name: "moss:origin", value: "registry" }],
      },
      {
        name: "@moss/api",
        version: "0.0.0",
        licenses: [{ license: { id: "UNLICENSED" } }],
        properties: [{ name: "moss:origin", value: "workspace" }],
      },
    ],
  };
  const result = scanLicenses(sbom);
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.violations.map((violation) => violation.code).sort(),
    ["denied-license", "unknown-license"],
  );
});

test("P022-T07 dependency policy passes and detects blocked advisories", () => {
  assert.deepEqual(checkDependencies({ root }), { ok: true, violations: [] });
  const blocked = checkDependencies({
    root,
    advisories: { blocked: [{ name: "typescript", reason: "synthetic advisory" }] },
  });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.violations.some((violation) => violation.code === "blocked-advisory"));
});

test("P022-T08 dry run emits checksums, SBOM, provenance, notes, and never publishes", () => {
  const outDir = tempDir("moss-release-");
  const result = runDryRun({
    root,
    outDir,
    packer: fakePacker,
    timestamp: "2026-08-03T00:00:00.000Z",
    commit: "deadbeef",
  });

  assert.equal(result.published, false);
  assert.ok(result.artifacts.length > 0);
  for (const artifact of result.artifacts) {
    assert.match(artifact.sha256, /^[0-9a-f]{64}$/);
  }
  const sums = fs.readFileSync(path.join(outDir, "SHA256SUMS"), "utf8");
  for (const artifact of result.artifacts) {
    assert.ok(sums.includes(`${artifact.sha256}  ${artifact.name}`));
  }

  const provenance = JSON.parse(fs.readFileSync(path.join(outDir, "provenance.json"), "utf8"));
  assert.ok(provenance.length > 0);
  for (const statement of provenance) {
    assert.equal(statement._type, "https://in-toto.io/Statement/v1");
    assert.match(statement.predicateType, /slsa\.dev\/provenance/);
    assert.equal(statement.predicate.buildDefinition.externalParameters.commit, "deadbeef");
    assert.equal(statement.signature.publishBlocked, true);
    assert.ok(statement.subject.every((subject) => /^[0-9a-f]{64}$/.test(subject.digest.sha256)));
  }

  assert.ok(fs.existsSync(path.join(outDir, "sbom.cdx.json")));
  assert.match(fs.readFileSync(path.join(outDir, "release-notes.md"), "utf8"), /Release dry run/);
  assert.ok(result.blockedReasons.includes("unsigned-dry-run"));

  fs.rmSync(outDir, { recursive: true, force: true });
});

test("P022-T09 rollback evidence follows release history", () => {
  const historyDir = tempDir("moss-history-");
  const historyPath = path.join(historyDir, "history.json");

  const outDirEmpty = tempDir("moss-release-empty-");
  const fresh = runDryRun({ root, outDir: outDirEmpty, packer: fakePacker, historyPath });
  assert.ok(fresh.rollback.length > 0);
  assert.equal(fresh.rollback[0].target, null);
  assert.match(fresh.rollback[0].reason, /no prior release/);

  fs.writeFileSync(
    historyPath,
    JSON.stringify({
      schemaVersion: 1,
      releases: [
        {
          train: "packages",
          version: "0.1.0",
          commit: "cafebabe",
          releasedAt: "2026-07-01T00:00:00.000Z",
          artifacts: [{ name: "moss-packages-0.1.0.tgz", sha256: "a".repeat(64) }],
        },
      ],
    }),
  );

  const outDirWithHistory = tempDir("moss-release-history-");
  const withHistory = runDryRun({ root, outDir: outDirWithHistory, packer: fakePacker, historyPath });
  const record = withHistory.rollback.find((entry) => entry.train === "packages");
  assert.equal(record.target.version, "0.1.0");
  assert.equal(record.target.commit, "cafebabe");
  assert.ok(record.procedure.length > 0);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(outDirWithHistory, "rollback.json"), "utf8")),
    withHistory.rollback,
  );

  for (const dir of [historyDir, outDirEmpty, outDirWithHistory]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("P022-T10 invalid changesets and license failures block promotion", () => {
  const changesetDir = tempDir("moss-changes-");
  fs.writeFileSync(path.join(changesetDir, "0001-bad.md"), "---\ntrain: client\nbump: major\n---\n\nBreaking.\n");
  const outDir = tempDir("moss-release-bad-");
  const result = runDryRun({ root, outDir, changesetDir, packer: fakePacker });
  assert.equal(result.published, false);
  assert.ok(result.blockedReasons.includes("invalid-changeset"));
  assert.equal(result.artifacts.length, 0, "invalid changesets must not produce artifacts");
  assert.ok(result.changesetErrors.some((error) => error.code === "missing-approval"));

  for (const dir of [changesetDir, outDir]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("P022-T11 dependabot automation is configured for npm and actions", () => {
  const config = fs.readFileSync(path.join(root, ".github/dependabot.yml"), "utf8");
  assert.match(config, /package-ecosystem: npm/);
  assert.match(config, /package-ecosystem: github-actions/);
  assert.match(config, /interval: weekly/);
  assert.match(config, /update-types:\s*\n\s*- minor\s*\n\s*- patch/);
  assert.doesNotMatch(config, /automerge|auto-merge/i);
});

test("P022-T12 CI runs dependency policy and the unpublished dry run", () => {
  const ci = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
  assert.match(ci, /npm run check:deps/);
  assert.match(ci, /npm run release:dry-run/);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok(pkg.scripts["check:deps"]);
  assert.ok(pkg.scripts["release:dry-run"]);
});
