# Account authentication

## Supported sign-in methods

- Google OAuth
- Microsoft OAuth (work/school and personal Outlook accounts)
- Email + password with a **6-digit OTP** sent by Resend

Email account creation requires 10+ characters, uppercase, lowercase, number, symbol, no
whitespace, and matching confirmation. The API independently enforces the same strength rules.

## Session and account behavior

- API emails a **6-digit OTP** via Resend
- After verify, session tokens are stored on the device
- Users are stored server-side in `AUTH_STORE_PATH` (JSON file)
- A verified Google/Microsoft email links to an existing account with the same normalized email
- Provider client secrets stay on Railway and never ship in the extension

The private admin stats website is a later, separate application — not part of the extension.

## What you must configure

### 1. Resend — send from `team@matrix-ae.com`

1. Resend dashboard → **Domains** → add **`matrix-ae.com`**
2. Add the DNS records Resend shows (DKIM / SPF / etc.) at your DNS host
3. Wait until the domain shows **Verified**
4. Only then will `team@matrix-ae.com` send to real inboxes

Until the domain is verified, Resend will reject sends from that address.

### 2. Railway `@moss/api` variables

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | your Resend key |
| `RESEND_FROM_EMAIL` | `team@matrix-ae.com` |
| `AUTH_STORE_PATH` | `/data/auth-store.json` (if you attach a Railway volume at `/data`) |
| `OAUTH_STATE_SECRET` | 32+ random bytes |
| `GOOGLE_CLIENT_ID` | Google OAuth web client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth web client secret |
| `MICROSOFT_CLIENT_ID` | Microsoft Entra application ID |
| `MICROSOFT_CLIENT_SECRET` | Microsoft Entra client secret value |
| `MICROSOFT_TENANT` | `common` |

Redeploy after saving variables.

### 3. Google Cloud setup

1. Google Cloud Console → APIs & Services → OAuth consent screen
2. Configure the app name/support email; add test users while the app is in Testing
3. Credentials → Create credentials → OAuth client ID → **Web application**
4. Authorized redirect URI:
   `https://mossapi-production.up.railway.app/v1/auth/oauth/google/callback`
5. Put the generated client ID and secret on Railway `@moss/api`

### 4. Microsoft Entra setup

1. Microsoft Entra admin center → App registrations → New registration
2. Supported account types: organizational directories **and personal Microsoft accounts**
3. Web redirect URI:
   `https://mossapi-production.up.railway.app/v1/auth/oauth/microsoft/callback`
4. Certificates & secrets → New client secret; copy the **Value** immediately
5. Put the application ID and secret value on Railway `@moss/api`

### 5. Local `.env` (`apps/api/.env`)

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=team@matrix-ae.com
OAUTH_STATE_SECRET=replace-with-32-plus-random-characters
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT=common
```

### 6. Durable users on Railway

JSON on the container disk is wiped on redeploy unless you add a **Railway Volume** mounted at `/data` and set `AUTH_STORE_PATH=/data/auth-store.json`. Postgres comes later with the admin dashboard.

## Test flow

1. API online (`/health` shows `"auth":"email-password-otp"`)
2. Reload extension
3. Test email create-account → matching passwords → OTP
4. Test Google and Microsoft buttons after their Railway variables are configured
5. Continue (paywall remains simulated until Paddle)

## Smoke OTP email only

```powershell
node apps/api/scripts/smoke-resend.js you@your-inbox.com
```
