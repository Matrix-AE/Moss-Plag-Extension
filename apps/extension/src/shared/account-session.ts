/**
 * Server-backed account session (email/password + OTP).
 * Tokens stay in chrome.storage.local — never sync.
 */

import { browser } from "wxt/browser";
import { API_ORIGIN, isAllowedOrigin } from "./origins";

const SESSION_KEY = "moss.auth.session";
const DEVICE_KEY = "moss.auth.deviceId";

export type AuthSession = {
  email: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  signedInAt: number;
};

type Json = Record<string, unknown>;

export async function ensureDeviceId(): Promise<string> {
  const bag = await browser.storage.local.get(DEVICE_KEY);
  const existing = bag[DEVICE_KEY];
  if (typeof existing === "string" && existing.length > 8) return existing;
  const id = `dev_${crypto.randomUUID()}`;
  await browser.storage.local.set({ [DEVICE_KEY]: id });
  return id;
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  const bag = await browser.storage.local.get(SESSION_KEY);
  const raw = bag[SESSION_KEY] as AuthSession | undefined;
  if (!raw?.accessToken || !raw?.email) return null;
  return raw;
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await browser.storage.local.set({ [SESSION_KEY]: session });
}

export async function clearAuthSession(): Promise<void> {
  await browser.storage.local.remove(SESSION_KEY);
}

async function authFetch(
  path: string,
  {
    method = "POST",
    body,
    accessToken,
  }: { method?: string; body?: unknown; accessToken?: string } = {},
): Promise<{ ok: boolean; status: number; data: Json }> {
  const origin = API_ORIGIN;
  if (!isAllowedOrigin(`${origin}/`)) {
    return { ok: false, status: 0, data: { error: "origin-forbidden" } };
  }
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    const response = await fetch(`${origin}${path}`, init);
    const data = (await response.json().catch(() => ({}))) as Json;
    return { ok: response.ok && data.ok !== false, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "network" } };
  }
}

function mapAuthError(data: Json, fallback: string): string {
  const code = String(data.error || "");
  switch (code) {
    case "invalid-email":
      return "Enter a valid email address.";
    case "password-too-short":
    case "weak-password":
      return "Password does not meet all security requirements.";
    case "email-taken":
      return "That email already has an account. Sign in instead.";
    case "invalid-credentials":
      return "Email or password is incorrect.";
    case "otp-email-failed":
      return "Could not send the verification email. Check Resend / domain setup.";
    case "bad-code":
      return "That code is incorrect.";
    case "expired":
      return "That code expired. Request a new one.";
    case "network":
      return "Cannot reach the API. Is Railway online?";
    case "owner-required":
    case "not-found":
      return "The hosted API is running an older build without accounts. Redeploy the API, then try again.";
    case "no-account":
      return "No account uses that email. Create one instead.";
    case "unknown-nonce":
    case "wrong-purpose":
      return "That reset request is no longer valid. Start again.";
    case "replay":
      return "That code was already used. Request a new one.";
    default:
      return fallback;
  }
}

/** Create account → OTP emailed. */
export async function registerAccount(email: string, password: string) {
  const result = await authFetch("/v1/auth/register", {
    body: { email, password },
  });
  if (!result.ok) {
    return { ok: false as const, error: mapAuthError(result.data, "Could not create account.") };
  }
  return {
    ok: true as const,
    nonce: String(result.data.nonce || ""),
    email: String(result.data.email || email),
    message: String(result.data.message || "Check your email for the code."),
  };
}

/** Sign in with password → OTP emailed. */
export async function loginAccount(email: string, password: string) {
  const result = await authFetch("/v1/auth/login", {
    body: { email, password },
  });
  if (!result.ok) {
    return { ok: false as const, error: mapAuthError(result.data, "Could not sign in.") };
  }
  return {
    ok: true as const,
    nonce: String(result.data.nonce || ""),
    email: String(result.data.email || email),
    message: String(result.data.message || "Check your email for the code."),
  };
}

/** Confirm OTP → store session. */
export async function verifyAccountOtp(input: {
  nonce: string;
  code: string;
  email: string;
}) {
  const deviceId = await ensureDeviceId();
  const result = await authFetch("/v1/auth/verify-otp", {
    body: { nonce: input.nonce, code: input.code, deviceId },
  });
  if (!result.ok) {
    return { ok: false as const, error: mapAuthError(result.data, "Could not verify code.") };
  }
  const session = sessionFromData(result.data, input.email);
  if (!session) {
    return { ok: false as const, error: "Server did not return a session." };
  }
  await saveAuthSession(session);
  return { ok: true as const, session };
}

/** Forgot password → OTP emailed to the account address. */
export async function requestPasswordReset(email: string) {
  const result = await authFetch("/v1/auth/forgot-password", {
    body: { email },
  });
  if (!result.ok) {
    return { ok: false as const, error: mapAuthError(result.data, "Could not start a password reset.") };
  }
  return {
    ok: true as const,
    nonce: String(result.data.nonce || ""),
    email: String(result.data.email || email),
    message: String(result.data.message || "Check your email for the code."),
  };
}

/** Completes a reset: OTP + new password. Existing sessions are revoked server-side. */
export async function resetPassword(input: {
  nonce: string;
  code: string;
  newPassword: string;
}) {
  const result = await authFetch("/v1/auth/reset-password", {
    body: { nonce: input.nonce, code: input.code, newPassword: input.newPassword },
  });
  if (!result.ok) {
    return { ok: false as const, error: mapAuthError(result.data, "Could not update the password.") };
  }
  return {
    ok: true as const,
    email: String(result.data.email || ""),
    message: String(result.data.message || "Password updated. Sign in with your new password."),
  };
}

export type SocialProvider = "google" | "microsoft";

/** Open provider auth in Chrome and exchange the callback code for our API session. */
export async function loginWithSocialProvider(provider: SocialProvider) {
  const deviceId = await ensureDeviceId();
  const redirectUri = browser.identity.getRedirectURL("oauth");
  const started = await authFetch(`/v1/auth/oauth/${provider}/start`, {
    body: { redirectUri, deviceId },
  });
  if (!started.ok) {
    return {
      ok: false as const,
      error: mapAuthError(started.data, `${provider} sign-in is not configured yet.`),
    };
  }
  const authorizationUrl = String(started.data.authorizationUrl || "");
  if (!authorizationUrl) {
    return { ok: false as const, error: "Server did not return an authorization URL." };
  }

  try {
    const callbackUrl = await browser.identity.launchWebAuthFlow({
      url: authorizationUrl,
      interactive: true,
    });
    if (!callbackUrl) return { ok: false as const, error: "Sign-in was cancelled." };
    const callback = new URL(callbackUrl);
    const providerError = callback.searchParams.get("oauth_error");
    if (providerError) {
      return { ok: false as const, error: "Social sign-in was cancelled or could not be completed." };
    }
    const code = callback.searchParams.get("oauth_code");
    if (!code) return { ok: false as const, error: "Provider did not return a sign-in code." };
    const exchanged = await authFetch("/v1/auth/oauth/exchange", {
      body: { code, deviceId },
    });
    if (!exchanged.ok) {
      return {
        ok: false as const,
        error: mapAuthError(exchanged.data, "Could not finish social sign-in."),
      };
    }
    const session = sessionFromData(exchanged.data, "");
    if (!session) return { ok: false as const, error: "Server did not return a session." };
    await saveAuthSession(session);
    return { ok: true as const, session };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Sign-in was cancelled.",
    };
  }
}

export async function refreshAuthSession(): Promise<AuthSession | null> {
  const current = await loadAuthSession();
  if (!current?.refreshToken) return null;
  const deviceId = await ensureDeviceId();
  const result = await authFetch("/v1/auth/refresh", {
    body: { refreshToken: current.refreshToken, deviceId },
  });
  if (!result.ok) {
    await clearAuthSession();
    return null;
  }
  const session: AuthSession = {
    email: String(result.data.email || current.email),
    userId: String(result.data.userId || current.userId),
    accessToken: String(result.data.accessToken || ""),
    refreshToken: String(result.data.refreshToken || ""),
    signedInAt: Date.now(),
  };
  await saveAuthSession(session);
  return session;
}

export async function logoutAccount(): Promise<void> {
  const current = await loadAuthSession();
  if (current?.accessToken) {
    await authFetch("/v1/auth/logout", {
      accessToken: current.accessToken,
    });
  }
  await clearAuthSession();
}

export function sessionToAccount(session: AuthSession): { email: string; signedInAt: number } {
  return { email: session.email, signedInAt: session.signedInAt };
}

function sessionFromData(data: Json, fallbackEmail: string): AuthSession | null {
  const session: AuthSession = {
    email: String(data.email || fallbackEmail),
    userId: String(data.userId || ""),
    accessToken: String(data.accessToken || ""),
    refreshToken: String(data.refreshToken || ""),
    signedInAt: Date.now(),
  };
  return session.accessToken && session.refreshToken && session.userId ? session : null;
}
