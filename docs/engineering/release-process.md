# Supply Chain, Versioning, and Release Process

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 022 — Supply Chain, Versioning, and Release Policy |
| Status | Accepted |
| Applies to | `apps/*`, `packages/*`, extension store artifacts, backend deployments |
| Verification | `tests/prompt-022-release.test.js`, `npm run release:dry-run` |

## Release trains

| Train | Contents | Channel | Approval environment |
| --- | --- | --- | --- |
| `client` | `apps/extension` | `chrome-web-store` | `store-submission` |
| `server` | `apps/api`, `apps/worker-submit`, `apps/worker-cleanup` | `hosted-relay` | `production-backend` |
| `packages` | `packages/*` | `internal-only` | none |

Trains are disjoint. A store submission never promotes backend code, and a backend deploy never
publishes an extension build. Each train carries its own semantic version.

## Versioning

- Semantic versioning per train: `major` for breaking user or contract changes, `minor` for
  additive behaviour, `patch` for fixes.
- Every user-visible change ships a changeset in `.changes/` (see `.changes/README.md`).
- `bump: major` and `security: true` changesets must declare `approval: human-required`; the dry run
  reports `human-approval-required` and automated promotion is refused.
- Contract compatibility is versioned separately by `SCHEMA_VERSION` in `@moss/domain`; a schema
  change is a `major` bump on both the `client` and `server` trains.

## Dependency maintenance

| Control | Mechanism |
| --- | --- |
| Update automation | `.github/dependabot.yml` (npm + github-actions, weekly, minor/patch grouped) |
| Major upgrades | Never auto-merged; separate PR with human review |
| Dependency review | `npm run check:deps` — registry allowlist, integrity hashes, lockfile version, advisory blocklist |
| Advisory blocklist | `release/advisories.json` |
| License scan | `scripts/release/licenses.js` — permissive allowlist, copyleft/source-available denied |
| SBOM | `scripts/release/sbom.js` emits CycloneDX 1.5 `sbom.cdx.json` |

## Provenance

Every dry run emits an in-toto statement (`provenance.json`) with the SLSA provenance predicate:
subject digests (SHA-256), build type, source commit, train, and version transition. Artifacts also
get a `SHA256SUMS` manifest. Provenance carries a `signature` block; while it reads
`status: "unsigned"` with `publishBlocked: true`, promotion is refused. Signing target is keyless
sigstore/cosign, added when release credentials are provisioned.

## Staged rollout

1. Internal channel: unlisted store item / single backend canary instance.
2. 10% of users for at least 24 hours with error-rate and job-failure SLOs from
   `docs/product/nonfunctional-requirements.md` watched.
3. 50% for at least 24 hours.
4. 100%.

Any SLO breach halts the rollout at the current percentage and triggers rollback.

## Rollback

`dist/release/rollback.json` records, per train, the previous version, its commit, its artifact
digests, and the executable procedure. With no prior release the record states the abort path
(withdraw the draft, scale the new stack to zero, disable the feature flag) instead of inventing a
target. Backend rollback must verify queue drain and contract compatibility before completion; store
rollback resubmits the previously archived artifact by digest.

## Hotfix

A hotfix branches from the released tag, carries a `patch` changeset (`security: true` when it
closes a vulnerability), runs the full quality pipeline, and skips the staged rollout only for the
`server` train with a named approver recorded in `release/history.json`. Store hotfixes still obey
review latency and therefore always keep the staged rollout.

## Compatibility

- The API keeps N-1 extension versions working for at least 30 days.
- Job payload and status contracts change only through a `major` bump plus a documented migration.
- The extension refuses to start a job when the API reports an unsupported schema version and shows
  an upgrade prompt rather than failing silently.

## Deprecation

1. Announce in release notes and mark the surface deprecated in code and docs.
2. Keep the deprecated surface for at least one `minor` release and 30 days.
3. Emit a warning path (extension banner or API response field) during the window.
4. Remove in the next `major` bump, recording the removal in the release notes.

## Dry run

```bash
npm run release:dry-run
```

Writes to `dist/release/` (gitignored) and never publishes:

| Output | Purpose |
| --- | --- |
| `*.tgz` | Packed, unpublished artifacts |
| `SHA256SUMS` | Checksums for every artifact |
| `sbom.cdx.json` | CycloneDX SBOM |
| `provenance.json` | in-toto/SLSA statement with unsigned marker |
| `rollback.json` | Rollback evidence per train |
| `release-notes.md` | Notes generated from changesets |
| `dry-run.json` | Machine-readable summary with `published: false` and blocking reasons |

## Branch protection and approvals

`Quality gates` must pass before merge. `.github/workflows/release.yml` is manual
(`workflow_dispatch`) and its promotion jobs are gated by GitHub environments, so production,
breaking, and security-sensitive promotions require a human approval that is separate from CI.
