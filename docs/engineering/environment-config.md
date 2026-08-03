# Environment Configuration and Secrets Contract

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 019 |
| Module | `packages/config/env.js` |
| Status | Accepted |

## Classification

| Class | Examples | Rules |
| --- | --- | --- |
| Secret | `SESSION_SECRET`, storage keys, webhook secrets, KMS ids | Never commit; never log raw values; rotate on incident |
| Server config | `DATABASE_URL`, queue URLs, provider host | Server/worker only |
| Public extension | `PUBLIC_*` allowlist only | Safe to embed in MV3 bundle |

## Startup behavior

- API/worker startup calls `validateApiEnv` and exits non-zero on errors.
- Extension build reads only `validateExtensionPublicEnv`.
- Production rejects raw Moss TCP, weak secrets, and `ALLOW_INSECURE_DEFAULTS=true`.

## Rotation guidance

1. Issue new secret in KMS/secret manager.
2. Deploy readers that accept old+new during overlap window.
3. Revoke old secret; audit access logs.
4. Never paste secrets into tickets, chat, or git.

## Verification

`tests/prompt-019-config.test.js` plus canary scan of tracked files.
