# Changesets

One file per user-visible change, named `NNNN-short-slug.md`:

```md
---
train: client
bump: minor
security: false
approval: standard
---

Summary line used verbatim in the release notes.
```

Rules enforced by `scripts/release/changesets.js`:

- `train` must be `client`, `server`, or `packages`
- `bump` must be `major`, `minor`, or `patch`
- `bump: major` or `security: true` requires `approval: human-required`
- the summary body cannot be empty

Files are consumed by `npm run release:dry-run` and deleted when a release is promoted.
