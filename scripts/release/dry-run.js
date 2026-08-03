"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { buildSbom } = require("./sbom.js");
const { scanLicenses } = require("./licenses.js");
const { planReleases, readChangesets } = require("./changesets.js");
const { TRAINS } = require("./trains.js");

const PROVENANCE_TYPE = "https://in-toto.io/Statement/v1";
const PREDICATE_TYPE = "https://slsa.dev/provenance/v1";

function currentVersions(root) {
  const versions = {};
  for (const [train, config] of Object.entries(TRAINS)) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, config.workspaces[0], "package.json"), "utf8"),
    );
    versions[train] = manifest.version;
  }
  return versions;
}

function quoteArg(value) {
  return /\s/.test(value) ? `"${value}"` : value;
}

function npmPacker({ root, workspaces, outDir }) {
  // Node refuses to spawn .cmd shims without a shell, and shell mode needs the args quoted.
  const isWindows = process.platform === "win32";
  const args = ["pack", "--pack-destination", outDir, "--json"];
  for (const workspace of workspaces) {
    args.push("--workspace", workspace);
  }
  const result = spawnSync(isWindows ? "npm.cmd" : "npm", isWindows ? args.map(quoteArg) : args, {
    cwd: root,
    encoding: "utf8",
    shell: isWindows,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`npm pack failed: ${result.stderr || result.stdout}`);
  }
  const jsonStart = result.stdout.indexOf("[");
  const parsed = JSON.parse(result.stdout.slice(jsonStart));
  return parsed.map((entry) => path.join(outDir, entry.filename));
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function gitCommit(root) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function readHistory(historyPath) {
  if (!fs.existsSync(historyPath)) {
    return { schemaVersion: 1, releases: [] };
  }
  return JSON.parse(fs.readFileSync(historyPath, "utf8"));
}

function rollbackFor(train, plan, history) {
  const previous = [...history.releases].reverse().find((entry) => entry.train === train);
  const config = TRAINS[train];
  if (!previous) {
    return {
      train,
      target: null,
      reason: "no prior release recorded",
      procedure: [
        config.channel === "chrome-web-store"
          ? "withdraw the unpublished store draft"
          : "scale the new deployment to zero and keep the previous stack serving",
        "disable the feature flag guarding the change",
        "record the aborted attempt in release/history.json",
      ],
    };
  }
  return {
    train,
    target: { version: previous.version, commit: previous.commit, artifacts: previous.artifacts },
    reason: `roll back ${plan.from} -> ${previous.version}`,
    procedure:
      config.channel === "chrome-web-store"
        ? [
            `resubmit archived artifact ${previous.artifacts[0]?.name} (sha256 ${previous.artifacts[0]?.sha256})`,
            "halt the staged rollout percentage at 0",
            "publish a rollback release note",
          ]
        : [
            `redeploy image built from commit ${previous.commit}`,
            "verify queue drain and job status contract compatibility",
            "publish a rollback release note",
          ],
  };
}

function runDryRun(options = {}) {
  const root = options.root || path.resolve(__dirname, "../..");
  const outDir = options.outDir || path.join(root, "dist/release");
  const changesetDir = options.changesetDir || path.join(root, ".changes");
  const historyPath = options.historyPath || path.join(root, "release/history.json");
  const packer = options.packer || npmPacker;
  const timestamp = options.timestamp || new Date().toISOString();
  const commit = options.commit || gitCommit(root);

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const changesets = readChangesets(changesetDir);
  const plan = planReleases(changesets, currentVersions(root));
  const history = readHistory(historyPath);
  const sbom = buildSbom({ root, timestamp, commit });
  const licenses = scanLicenses(sbom);

  const artifacts = [];
  const provenance = [];
  const rollback = [];

  // An invalid changeset invalidates the whole version plan, so nothing gets packed.
  for (const entry of plan.ok ? plan.plans : []) {
    const files = packer({ root, workspaces: TRAINS[entry.train].workspaces, outDir, train: entry.train });
    const trainArtifacts = files.map((file) => ({
      train: entry.train,
      name: path.basename(file),
      sha256: sha256(file),
      bytes: fs.statSync(file).size,
    }));
    artifacts.push(...trainArtifacts);
    provenance.push({
      _type: PROVENANCE_TYPE,
      predicateType: PREDICATE_TYPE,
      subject: trainArtifacts.map((artifact) => ({
        name: artifact.name,
        digest: { sha256: artifact.sha256 },
      })),
      predicate: {
        buildDefinition: {
          buildType: "https://matrix-ae.dev/moss/release-dry-run/v1",
          externalParameters: {
            train: entry.train,
            channel: TRAINS[entry.train].channel,
            fromVersion: entry.from,
            toVersion: entry.to,
            commit,
          },
          resolvedDependencies: [{ uri: "git+https://github.com/Matrix-AE/Moss-Plag-Extension", digest: { sha1: commit } }],
        },
        runDetails: {
          builder: { id: "https://matrix-ae.dev/moss/local-dry-run" },
          metadata: { invocationId: `${entry.train}-${timestamp}`, startedOn: timestamp, finishedOn: timestamp },
        },
      },
      signature: {
        status: "unsigned",
        requiredAlgorithm: "sigstore-cosign-keyless",
        publishBlocked: true,
      },
    });
    rollback.push(rollbackFor(entry.train, entry, history));
  }

  const blockedReasons = [];
  if (!plan.ok) {
    blockedReasons.push("invalid-changeset");
  }
  if (!licenses.ok) {
    blockedReasons.push("license-policy");
  }
  if (plan.plans.some((entry) => entry.humanApprovalRequired)) {
    blockedReasons.push("human-approval-required");
  }
  blockedReasons.push("unsigned-dry-run");

  const summary = {
    mode: "dry-run",
    published: false,
    timestamp,
    commit,
    plans: plan.plans,
    changesetErrors: plan.errors,
    artifacts,
    licenses,
    rollback,
    blockedReasons,
    sbomFile: "sbom.cdx.json",
    checksumFile: "SHA256SUMS",
  };

  const notes = [`# Release dry run ${timestamp}`, ""];
  for (const entry of plan.plans) {
    notes.push(`## ${TRAINS[entry.train].label} ${entry.from} -> ${entry.to} (${entry.bump})`, "");
    for (const note of entry.notes) {
      notes.push(`- ${note.summary}${note.security ? " (security)" : ""} [${note.id}]`);
    }
    notes.push("");
  }

  fs.writeFileSync(path.join(outDir, "sbom.cdx.json"), `${JSON.stringify(sbom, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "rollback.json"), `${JSON.stringify(rollback, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "dry-run.json"), `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "release-notes.md"), `${notes.join("\n").trim()}\n`);
  fs.writeFileSync(
    path.join(outDir, "SHA256SUMS"),
    artifacts.map((artifact) => `${artifact.sha256}  ${artifact.name}`).join("\n") + "\n",
  );

  return { ...summary, outDir, sbom, provenance };
}

if (require.main === module) {
  const result = runDryRun();
  console.log(
    `Release dry run wrote ${result.artifacts.length} artifact(s) to ${result.outDir}; published=false; blocked by ${result.blockedReasons.join(", ")}`,
  );
  const fatal = result.blockedReasons.filter((reason) => reason !== "unsigned-dry-run" && reason !== "human-approval-required");
  if (fatal.length) {
    console.error(`Release policy failures: ${fatal.join(", ")}`);
    process.exit(1);
  }
}

module.exports = { currentVersions, npmPacker, runDryRun, sha256 };
