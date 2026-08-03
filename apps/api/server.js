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
 * - POST /v1/jobs
 * - POST /v1/jobs/:id/credentials
 * - POST /v1/jobs/:id/uploads
 * - POST /v1/jobs/:id/finalize
 * - GET  /v1/jobs/:id
 * - POST /v1/jobs/:id/result/reveal
 * - POST /v1/jobs/:id/result/forget
 */

const http = require("node:http");
const { URL } = require("node:url");
const { createPairService } = require("./live/pair-service");
const { submitPairToMoss } = require("@moss/provider-adapter/live-submit");

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = "127.0.0.1";

function resolveSubmitMode(env = process.env) {
  if (env.NODE_ENV === "production") return "mock-loopback";
  if (env.ALLOW_PUBLIC_MOSS_TCP === "1") return "public-raw-tcp";
  return "mock-loopback";
}

function createServer(options = {}) {
  const env = options.env || process.env;
  const host = options.host || DEFAULT_HOST;
  const port = Number(options.port || env.MOSS_API_PORT || DEFAULT_PORT);
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

  const server = http.createServer(async (req, res) => {
    try {
      await handleRequest(req, res, { service, corsOrigins, submitMode });
    } catch (error) {
      writeJson(res, 500, { ok: false, error: "internal", message: "Request failed." });
    }
  });

  return {
    host,
    port,
    submitMode,
    service,
    listen() {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.removeListener("error", reject);
          resolve({ host, port, submitMode, url: `http://${host}:${port}` });
        });
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
      service: "moss-local-api",
      submitMode: ctx.submitMode,
      livePublicTcp: ctx.submitMode === "public-raw-tcp",
    });
    return;
  }

  const ownerUserId = String(req.headers["x-owner-user-id"] || "").trim();
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
    "Content-Type, X-Owner-User-Id, X-Idempotency-Key",
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
  const api = createServer();
  const info = await api.listen();
  // eslint-disable-next-line no-console
  console.log(
    `[moss-local-api] listening on ${info.url} (submitMode=${info.submitMode})`,
  );
  if (info.submitMode === "public-raw-tcp") {
    // eslint-disable-next-line no-console
    console.warn(
      "[moss-local-api] LIVE public MOSS TCP enabled — consumes real userid quota; cleartext TCP.",
    );
  }
}

if (require.main === module) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[moss-local-api] failed to start", error.message || error);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_HOST,
  DEFAULT_PORT,
  resolveSubmitMode,
  createServer,
};
