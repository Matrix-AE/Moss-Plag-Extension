"use strict";

/**
 * Route helpers for email/password + OTP auth.
 */

function createAuthRouter(auth, oauth = null) {
  return {
    async handle(req, res, { path, method, url, readJson, writeJson }) {
      const oauthStart = /^\/v1\/auth\/oauth\/(google|microsoft)\/start$/.exec(path);
      if (oauth && method === "POST" && oauthStart) {
        const body = await readJson(req);
        const result = oauth.start({
          provider: oauthStart[1],
          redirectUri: body.redirectUri,
          deviceId: body.deviceId,
        });
        writeJson(res, result.ok ? 200 : result.status || 400, result);
        return true;
      }

      const oauthCallback = /^\/v1\/auth\/oauth\/(google|microsoft)\/callback$/.exec(path);
      if (oauth && method === "GET" && oauthCallback) {
        const result = await oauth.completeCallback({
          provider: oauthCallback[1],
          code: url.searchParams.get("code"),
          state: url.searchParams.get("state"),
        });
        if (!result.ok) {
          writeJson(res, result.status || 401, result);
          return true;
        }
        res.writeHead(302, {
          Location: result.redirectUri,
          "Cache-Control": "no-store",
        });
        res.end();
        return true;
      }

      if (oauth && method === "POST" && path === "/v1/auth/oauth/exchange") {
        const body = await readJson(req);
        const result = oauth.exchange({ code: body.code, deviceId: body.deviceId });
        writeJson(res, result.ok ? 200 : result.status || 400, result);
        return true;
      }

      if (method === "POST" && path === "/v1/auth/register") {
        const body = await readJson(req);
        const result = await auth.register({
          email: body.email,
          password: body.password,
        });
        writeJson(res, result.ok ? 200 : result.status || 400, result);
        return true;
      }

      if (method === "POST" && path === "/v1/auth/login") {
        const body = await readJson(req);
        const result = await auth.login({
          email: body.email,
          password: body.password,
        });
        writeJson(res, result.ok ? 200 : result.status || 400, result);
        return true;
      }

      if (method === "POST" && path === "/v1/auth/forgot-password") {
        const body = await readJson(req);
        const result = await auth.requestPasswordReset({ email: body.email });
        writeJson(res, result.ok ? 200 : result.status || 400, result);
        return true;
      }

      if (method === "POST" && path === "/v1/auth/reset-password") {
        const body = await readJson(req);
        const result = auth.resetPassword({
          nonce: body.nonce,
          code: body.code,
          newPassword: body.newPassword,
        });
        writeJson(res, result.ok ? 200 : result.status || 400, result);
        return true;
      }

      if (method === "POST" && path === "/v1/auth/verify-otp") {
        const body = await readJson(req);
        const result = auth.verifyOtp({
          nonce: body.nonce,
          code: body.code,
          deviceId: body.deviceId,
        });
        writeJson(res, result.ok ? 200 : result.status || 400, result);
        return true;
      }

      if (method === "POST" && path === "/v1/auth/refresh") {
        const body = await readJson(req);
        const result = auth.refresh({
          refreshToken: body.refreshToken,
          deviceId: body.deviceId,
        });
        writeJson(res, result.ok ? 200 : result.status || 400, result);
        return true;
      }

      if (method === "POST" && path === "/v1/auth/logout") {
        const accessToken = bearer(req);
        if (!accessToken) {
          writeJson(res, 401, { ok: false, error: "unauthorized" });
          return true;
        }
        const authed = auth.authorize({ accessToken });
        if (!authed.ok) {
          writeJson(res, 401, authed);
          return true;
        }
        writeJson(res, 200, auth.logoutAll(authed.userId));
        return true;
      }

      if (method === "GET" && path === "/v1/auth/me") {
        const accessToken = bearer(req);
        if (!accessToken) {
          writeJson(res, 401, { ok: false, error: "unauthorized" });
          return true;
        }
        const authed = auth.authorize({ accessToken });
        if (!authed.ok) {
          writeJson(res, 401, authed);
          return true;
        }
        writeJson(res, 200, {
          ok: true,
          userId: authed.userId,
          email: authed.email,
        });
        return true;
      }

      return false;
    },
  };
}

function bearer(req) {
  const header = String(req.headers.authorization || "");
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : "";
}

module.exports = { createAuthRouter, bearer };
