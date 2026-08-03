# Extension app (scaffold)

Manifest V3 workspace. Must depend only on browser-safe packages (`@moss/domain`, `@moss/ui`, `@moss/contracts`).

Forbidden: `@moss/provider-adapter` concrete transport, Node `net`/`fs`, provider secrets.
