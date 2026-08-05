"use strict";

/**
 * Local loopback HTTP API for live / mock BYO MOSS pair checks.
 *
 * Defaults:
 * - Bind 127.0.0.1 only
 * - Mock MOSS loopback (no public TCP) unless ALLOW_PUBLIC_MOSS_TCP=1 and not production
 *
 * Endpoints:
 * - GET  /health
 * - POST /v1/auth/register|login|verify-otp|refresh|logout
 * - GET  /v1/auth/me
 * - POST /v1/jobs …
 */

const http = require("node:http");
const { URL } = require("node:url");
const { createPairService } = require("./live/pair-service");
const { submitPairToMoss } = require("@moss/provider-adapter/live-submit");
const { createPasswordAuthService } = require("./auth/password-auth");
const { createAuthRouter, bearer } = require("./auth/http-routes");
const { createOAuthBroker } = require("./auth/oauth-broker");

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = "127.0.0.1";

/**
 * Submit mode selection:
 * - public-raw-tcp: requires ALLOW_PUBLIC_MOSS_TCP=1
 * - in NODE_ENV=production also requires ALLOW_HOSTED_PUBLIC_MOSS_TCP=1 (Railway/BYO hosted opt-in)
 * - otherwise mock-loopback
 */
function resolveSubmitMode(env = process.env) {
  const wantPublic = env.ALLOW_PUBLIC_MOSS_TCP === "1";
  if (!wantPublic) return "mock-loopback";
  if (env.NODE_ENV === "production" && env.ALLOW_HOSTED_PUBLIC_MOSS_TCP !== "1") {
    return "mock-loopback";
  }
  return "public-raw-tcp";
}

function resolveListenHost(env = process.env) {
  if (env.MOSS_API_HOST) return env.MOSS_API_HOST;
  // Railway / cloud: listen on all interfaces; local default stays loopback.
  if (env.PORT || env.RAILWAY_ENVIRONMENT || env.RAILWAY_STATIC_URL) return "0.0.0.0";
  return DEFAULT_HOST;
}

function resolveListenPort(env = process.env) {
  const port = Number(env.PORT || env.MOSS_API_PORT || DEFAULT_PORT);
  return Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT;
}

function createServer(options = {}) {
  const env = options.env || process.env;
  const host = options.host || resolveListenHost(env);
  const port = Number(options.port || resolveListenPort(env));
  const submitMode = options.submitMode || resolveSubmitMode(env);
  const corsOrigins = new Set(
    options.corsOrigins || [
      `http://${host}:${port}`,
      "http://127.0.0.1:8787",
      "chrome-extension://",
    ],
  );

  const service = options.service || createPairService({
    submitPair: (job) =>
      submitPairToMoss(job, {
        mode: submitMode,
        env,
        production: env.NODE_ENV === "production",
      }),
  });

  const auth =
    options.auth ||
    createPasswordAuthService({
      production: env.NODE_ENV === "production",
      storePath: env.AUTH_STORE_PATH,
    });
  const oauth = options.oauth || createOAuthBroker({ auth, env });
  const authRouter = createAuthRouter(auth, oauth);

  const server = http.createServer(async (req, res) => {
    try {
      await handleRequest(req, res, { service, corsOrigins, submitMode, auth, oauth, authRouter });
    } catch (error) {
      writeJson(res, 500, { ok: false, error: "internal", message: "Request failed." });
    }
  });

  return {
    host,
    port,
    submitMode,
    service,
    auth,
    oauth,
    listen() {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        // On cloud hosts, omit the host arg so Node binds dual-stack / all interfaces.
        const onListening = () => {
          server.removeListener("error", reject);
          const address = server.address();
          resolve({
            host: typeof address === "object" && address ? address.address : host,
            port: typeof address === "object" && address ? address.port : port,
            submitMode,
            url: `http://${host}:${port}`,
          });
        };
        if (host === "0.0.0.0" || host === "::") {
          server.listen(port, onListening);
        } else {
          server.listen(port, host, onListening);
        }
      });
    },
    close() {
      return new Promise((resolve) => server.close(() => resolve()));
    },
    server,
  };
}

async function handleRequest(req, res, ctx) {
  applyCors(req, res, ctx.corsOrigins);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  const path = url.pathname;

  if (req.method === "GET" && path === "/health") {
    writeJson(res, 200, {
      ok: true,
      service: "moss-pair-api",
      submitMode: ctx.submitMode,
      livePublicTcp: ctx.submitMode === "public-raw-tcp",
      auth: "email-password-otp",
    });
    return;
  }

  if (ctx.authRouter) {
    const handled = await ctx.authRouter.handle(req, res, {
      path,
      method: req.method,
      url,
      readJson,
      writeJson,
    });
    if (handled) return;
  }

  let ownerUserId = String(req.headers["x-owner-user-id"] || "").trim();
  const accessToken = bearer(req);
  if (accessToken && ctx.auth) {
    const authed = ctx.auth.authorize({ accessToken });
    if (authed.ok) {
      ownerUserId = authed.userId;
    } else if (!ownerUserId) {
      writeJson(res, 401, { ok: false, error: authed.error || "unauthorized" });
      return;
    }
  }

  if (!ownerUserId && path.startsWith("/v1/")) {
    writeJson(res, 401, { ok: false, error: "owner-required" });
    return;
  }

  if (req.method === "POST" && path === "/v1/jobs") {
    const body = await readJson(req);
    const result = ctx.service.createJob({
      ownerUserId,
      idempotencyKey: body.idempotencyKey,
      language: body.language,
      mode: body.mode || "pair",
      settings: body.settings || {},
    });
    writeJson(res, result.ok ? 200 : result.status || 400, result);
    return;
  }

  const jobMatch = /^\/v1\/jobs\/([^/]+)(?:\/(credentials|uploads|finalize|result\/reveal|result\/forget))?$/.exec(
    path,
  );
  if (!jobMatch) {
    writeJson(res, 404, { ok: false, error: "not-found" });
    return;
  }

  const jobId = decodeURIComponent(jobMatch[1]);
  const action = jobMatch[2] || null;

  if (req.method === "GET" && !action) {
    const result = ctx.service.getJob({ jobId, ownerUserId });
    writeJson(res, result.ok ? 200 : result.status || 404, result);
    return;
  }

  if (req.method === "POST" && action === "credentials") {
    const body = await readJson(req);
    const result = ctx.service.attachCredential({
      jobId,
      ownerUserId,
      mossUserId: body.mossUserId,
    });
    writeJson(res, result.ok ? 200 : result.status || 400, result);
    return;
  }

  if (req.method === "POST" && action === "uploads") {
    const body = await readJson(req);
    const result = ctx.service.uploadFiles({
      jobId,
      ownerUserId,
      files: body.files || [],
    });
    writeJson(res, result.ok ? 200 : result.status || 400, result);
    return;
  }

  if (req.method === "POST" && action === "finalize") {
    const result = await ctx.service.finalize({ jobId, ownerUserId });
    writeJson(res, result.ok ? 200 : result.status || 400, result);
    return;
  }

  if (req.method === "POST" && action === "result/reveal") {
    const result = ctx.service.revealResult({ jobId, ownerUserId });
    writeJson(res, result.ok ? 200 : result.status || 400, result);
    return;
  }

  if (req.method === "POST" && action === "result/forget") {
    const result = ctx.service.forgetResult({ jobId, ownerUserId });
    writeJson(res, result.ok ? 200 : result.status || 400, result);
    return;
  }

  writeJson(res, 405, { ok: false, error: "method-not-allowed" });
}

function applyCors(req, res, corsOrigins) {
  const origin = String(req.headers.origin || "");
  const allowed =
    !origin ||
    corsOrigins.has(origin) ||
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://") ||
    /^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin) ||
    /^http:\/\/localhost(?::\d+)?$/.test(origin);
  if (allowed && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Owner-User-Id, X-Idempotency-Key",
  );
}

function writeJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function main() {
  const env = process.env;
  const host = resolveListenHost(env);
  const port = resolveListenPort(env);
  // eslint-disable-next-line no-console
  console.log(
    `[moss-pair-api] starting host=${host} port=${port} nodeEnv=${env.NODE_ENV || ""} railway=${Boolean(env.RAILWAY_ENVIRONMENT)}`,
  );
  const api = createServer({ host, port, env });
  const info = await api.listen();
  // eslint-disable-next-line no-console
  console.log(
    `[moss-pair-api] listening on ${info.url} (submitMode=${info.submitMode})`,
  );
  if (info.submitMode === "public-raw-tcp") {
    // eslint-disable-next-line no-console
    console.warn(
      "[moss-pair-api] LIVE public MOSS TCP enabled — consumes real userid quota; cleartext TCP.",
    );
  }
}

if (require.main === module) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[moss-pair-api] failed to start", error.message || error);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_HOST,
  DEFAULT_PORT,
  resolveSubmitMode,
  resolveListenHost,
  resolveListenPort,
  createServer,
};
