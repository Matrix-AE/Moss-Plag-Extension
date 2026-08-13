"use strict";

/**
 * Local loopback HTTP API for live / mock BYO MOSS pair checks.
 *
 * Defaults:
 * - Bind 127.0.0.1 only
 * - Mock MOSS loopback unless public TCP is explicitly enabled
 *
 * Endpoints:
 * - GET  /health
 * - POST /v1/auth/register
 * - POST /v1/auth/login
 * - POST /v1/auth/verify-otp
 * - POST /v1/auth/forgot-password
 * - POST /v1/auth/reset-password
 * - POST /v1/auth/refresh
 * - POST /v1/auth/logout
 * - GET  /v1/auth/me
 * - POST /v1/admin/login
 * - GET  /v1/admin/dashboard
 * - POST /v1/checkout/session
 * - POST /v1/checkout/mock-complete
 * - POST /v1/webhooks/entitlements
 * - POST /v1/jobs
 * - ...
 */

const http = require("node:http");
const { URL } = require("node:url");

const {
  createPairService,
} = require("./live/pair-service");

const {
  submitPairToMoss,
} = require(
  "@moss/provider-adapter/live-submit",
);

const {
  createPasswordAuthService,
} = require("./auth/password-auth");

const {
  createAuthRouter,
  bearer,
} = require("./auth/http-routes");

const {
  createOAuthBroker,
} = require("./auth/oauth-broker");

const {
  createEntitlementService,
} = require(
  "./commerce/entitlements",
);

const {
  createCheckoutService,
} = require(
  "./commerce/checkout",
);

const {
  createAdminDashboardService,
} = require("./admin/dashboard");

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = "127.0.0.1";

function resolveSubmitMode(
  env = process.env,
) {
  const wantPublic =
    env.ALLOW_PUBLIC_MOSS_TCP === "1";

  if (!wantPublic) {
    return "mock-loopback";
  }

  if (
    env.NODE_ENV === "production" &&
    env.ALLOW_HOSTED_PUBLIC_MOSS_TCP !== "1"
  ) {
    return "mock-loopback";
  }

  return "public-raw-tcp";
}

function resolveListenHost(
  env = process.env,
) {
  if (env.MOSS_API_HOST) {
    return env.MOSS_API_HOST;
  }

  if (
    env.PORT ||
    env.RAILWAY_ENVIRONMENT ||
    env.RAILWAY_STATIC_URL
  ) {
    return "0.0.0.0";
  }

  return DEFAULT_HOST;
}

function resolveListenPort(
  env = process.env,
) {
  const port = Number(
    env.PORT ||
      env.MOSS_API_PORT ||
      DEFAULT_PORT,
  );

  return Number.isFinite(port) && port > 0
    ? port
    : DEFAULT_PORT;
}

function createServer(
  options = {},
) {
  const env =
    options.env || process.env;

  const host =
    options.host ||
    resolveListenHost(env);

  const port = Number(
    options.port ||
      resolveListenPort(env),
  );

  const submitMode =
    options.submitMode ||
    resolveSubmitMode(env);

  const corsOrigins =
    new Set(
      options.corsOrigins || [
        `http://${host}:${port}`,
        "http://127.0.0.1:8787",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
        env.ADMIN_WEB_ORIGIN,
      ].filter(Boolean),
    );

  const service =
    options.service ||
    createPairService({
      submitPair: (job) =>
        submitPairToMoss(
          job,
          {
            mode: submitMode,
            env,
            production:
              env.NODE_ENV === "production",
          },
        ),
    });

  const auth =
    options.auth ||
    createPasswordAuthService({
      production:
        env.NODE_ENV === "production",

      storePath:
        env.AUTH_STORE_PATH,
    });

  const oauth =
    options.oauth ||
    createOAuthBroker({
      auth,
      env,
    });

  const authRouter =
    createAuthRouter(
      auth,
      oauth,
    );

  const entitlementSecret =
    env.ENTITLEMENT_WEBHOOK_SECRET ||
    (
      env.NODE_ENV === "production"
        ? ""
        : "development-only-entitlement-secret-rotate-me"
    );

  const entitlements =
    options.entitlements ||
    createEntitlementService({
      webhookSecret:
        entitlementSecret,

      storePath:
        env.ENTITLEMENT_STORE_PATH,
    });

  /*
   * Checkout return origins are configured server-side.
   *
   * Example:
   * CHECKOUT_RETURN_ORIGINS=https://your-site.example,chrome-extension://...
   *
   * Keep this empty until the actual hosted return origin
   * is known. The checkout service will reject unknown origins
   * when an allowlist is configured.
   */
  const checkoutReturnOrigins =
    String(
      env.CHECKOUT_RETURN_ORIGINS || "",
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

  const checkout =
    options.checkout ||
    createCheckoutService({
      webhookSecret:
        entitlementSecret,

      entitlementService:
        entitlements,

      returnOrigins:
        checkoutReturnOrigins,
    });

  const adminDashboard =
    options.adminDashboard ||
    createAdminDashboardService({
      auth,
      entitlements,
      adminEmails:
        env.ADMIN_EMAILS || "",
    });

  const server =
    http.createServer(
      async (req, res) => {
        try {
          await handleRequest(
            req,
            res,
            {
              service,
              corsOrigins,
              submitMode,
              auth,
              oauth,
              authRouter,
              entitlements,
              checkout,
              adminDashboard,
            },
          );
        } catch (error) {
          console.error(
            "[moss-pair-api] request failed",
            error,
          );

          writeJson(
            res,
            500,
            {
              ok: false,
              error: "internal",
              message:
                "Request failed.",
            },
          );
        }
      },
    );

  return {
    host,
    port,
    submitMode,

    service,
    auth,
    oauth,
    entitlements,
    checkout,
    adminDashboard,

    listen() {
      return new Promise(
        (
          resolve,
          reject,
        ) => {
          server.once(
            "error",
            reject,
          );

          const onListening =
            () => {
              server.removeListener(
                "error",
                reject,
              );

              const address =
                server.address();

              resolve({
                host:
                  typeof address ===
                    "object" &&
                  address
                    ? address.address
                    : host,

                port:
                  typeof address ===
                    "object" &&
                  address
                    ? address.port
                    : port,

                submitMode,

                url:
                  `http://${host}:${port}`,
              });
            };

          if (
            host === "0.0.0.0" ||
            host === "::"
          ) {
            server.listen(
              port,
              onListening,
            );
          } else {
            server.listen(
              port,
              host,
              onListening,
            );
          }
        },
      );
    },

    close() {
      return new Promise(
        (resolve) =>
          server.close(
            () => resolve(),
          ),
      );
    },

    server,
  };
}

async function handleRequest(
  req,
  res,
  ctx,
) {
  applyCors(
    req,
    res,
    ctx.corsOrigins,
  );

  if (
    req.method === "OPTIONS"
  ) {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(
    req.url || "/",
    `http://${req.headers.host || "127.0.0.1"}`,
  );

  const path =
    url.pathname;

  if (
    req.method === "GET" &&
    path === "/health"
  ) {
    writeJson(
      res,
      200,
      {
        ok: true,
        service:
          "moss-pair-api",
        submitMode:
          ctx.submitMode,
        livePublicTcp:
          ctx.submitMode ===
          "public-raw-tcp",
        auth:
          "email-password-otp",
      },
    );

    return;
  }

  /*
   * Auth routes.
   */
  if (ctx.authRouter) {
    const handled =
      await ctx.authRouter.handle(
        req,
        res,
        {
          path,
          method:
            req.method,
          url,
          readJson,
          writeJson,
        },
      );

    if (handled) {
      return;
    }
  }

  /*
   * Admin login.
   */
  if (
    req.method === "POST" &&
    path === "/v1/admin/login"
  ) {
    const body =
      await readJson(req);

    const result =
      ctx.auth.adminLogin({
        email:
          body.email,
        password:
          body.password,
        deviceId:
          body.deviceId,
        adminEmails:
          process.env
            .ADMIN_EMAILS || "",
      });

    writeJson(
      res,
      result.ok
        ? 200
        : result.status || 401,
      result,
    );

    return;
  }

  /*
   * Admin dashboard.
   */
  if (
    req.method === "GET" &&
    path ===
      "/v1/admin/dashboard"
  ) {
    const result =
      ctx.adminDashboard.snapshot({
        accessToken:
          bearer(req),
      });

    writeJson(
      res,
      result.ok
        ? 200
        : result.status || 401,
      result,
    );

    return;
  }

  /*
   * Create a checkout session.
   */
  if (
    req.method === "POST" &&
    path ===
      "/v1/checkout/session"
  ) {
    const accessToken =
      bearer(req);

    if (!accessToken) {
      writeJson(
        res,
        401,
        {
          ok: false,
          error: "unauthorized",
        },
      );

      return;
    }

    const authed =
      ctx.auth.authorize({
        accessToken,
      });

    if (!authed.ok) {
      writeJson(
        res,
        401,
        authed,
      );

      return;
    }

    const body =
      await readJson(req);

    const planId =
      String(
        body.planId || "",
      )
        .trim()
        .toLowerCase();

    const returnOrigin =
      String(
        body.returnOrigin || "",
      ).trim();

    const reviewDraftId =
      String(
        body.reviewDraftId || "",
      ).trim();

    if (!planId) {
      writeJson(
        res,
        400,
        {
          ok: false,
          error: "plan-required",
        },
      );

      return;
    }

    if (!returnOrigin) {
      writeJson(
        res,
        400,
        {
          ok: false,
          error:
            "return-origin-required",
        },
      );

      return;
    }

    if (!reviewDraftId) {
      writeJson(
        res,
        400,
        {
          ok: false,
          error:
            "review-draft-required",
        },
      );

      return;
    }

    const result =
      ctx.checkout.createSession({
        userId:
          authed.userId,

        planId,

        returnOrigin,

        reviewDraftId,
      });

    writeJson(
      res,
      result.ok
        ? 200
        : result.status || 400,
      result,
    );

    return;
  }

  /*
   * Development-only mock checkout completion.
   *
   * This lets us test the complete:
   *
   * Pair / Batch
   *   -> checkout session
   *   -> purchase completion
   *   -> Supabase subscription
   *   -> Supabase entitlement
   *
   * In production this route is disabled unless
   * ALLOW_MOCK_CHECKOUT=1 is explicitly set.
   *
   * Do NOT keep ALLOW_MOCK_CHECKOUT=1 in Railway after
   * the real payment gateway is integrated.
   */
  if (
    req.method === "POST" &&
    path ===
      "/v1/checkout/mock-complete"
  ) {
    if (
      process.env.NODE_ENV ===
        "production" &&
      process.env.ALLOW_MOCK_CHECKOUT !==
        "1"
    ) {
      writeJson(
        res,
        404,
        {
          ok: false,
          error: "not-found",
        },
      );

      return;
    }

    const accessToken =
      bearer(req);

    if (!accessToken) {
      writeJson(
        res,
        401,
        {
          ok: false,
          error: "unauthorized",
        },
      );

      return;
    }

    const authed =
      ctx.auth.authorize({
        accessToken,
      });

    if (!authed.ok) {
      writeJson(
        res,
        401,
        authed,
      );

      return;
    }

    const body =
      await readJson(req);

    const sessionId =
      String(
        body.sessionId || "",
      ).trim();

    const requestedPlanId =
      String(
        body.planId || "",
      )
        .trim()
        .toLowerCase();

    if (!sessionId) {
      writeJson(
        res,
        400,
        {
          ok: false,
          error:
            "session-required",
        },
      );

      return;
    }

    const session =
      ctx.checkout.getSession({
        sessionId,
      });

    if (!session.ok) {
      writeJson(
        res,
        404,
        session,
      );

      return;
    }

    /*
     * Prevent user A from completing user B's checkout.
     */
    if (
      session.session.userId !==
      authed.userId
    ) {
      writeJson(
        res,
        403,
        {
          ok: false,
          error:
            "checkout-owner-mismatch",
        },
      );

      return;
    }

    /*
     * The server-created session is authoritative.
     */
    if (
      requestedPlanId &&
      requestedPlanId !==
        session.session.planId
    ) {
      writeJson(
        res,
        400,
        {
          ok: false,
          error:
            "plan-mismatch",
        },
      );

      return;
    }

    /*
     * Don't allow a session to be "paid" twice.
     */
    if (
      session.session.entitlementGranted
    ) {
      const existing =
        ctx.entitlements.getEntitlement(
          authed.userId,
        );

      writeJson(
        res,
        200,
        {
          ok: true,
          alreadyCompleted:
            true,
          sessionId,
          planId:
            session.session.planId,
          entitlement:
            existing,
          checkout:
            session.session,
        },
      );

      return;
    }

    const result =
      await ctx.entitlements.completeMockPurchase({
        userId:
          authed.userId,

        sessionId,

        planId:
          session.session.planId,
      });

    if (!result.ok) {
      writeJson(
        res,
        result.status || 400,
        result,
      );

      return;
    }

    /*
     * Mark the checkout session as completed.
     */
    const returned =
      ctx.checkout.handleReturn({
        sessionId,
        status: "success",
      });

    writeJson(
      res,
      200,
      {
        ok: true,

        sessionId,

        planId:
          session.session.planId,

        entitlement:
          result.entitlement,

        subscription:
          result.subscription ||
          null,

        supabaseEntitlement:
          result.supabaseEntitlement ||
          null,

        checkout:
          returned,
      },
    );

    return;
  }

  /*
   * Entitlement/payment webhook.
   *
   * handleWebhook() is async because confirmed purchases
   * are now synchronized to Supabase.
   */
  if (
    req.method === "POST" &&
    path ===
      "/v1/webhooks/entitlements"
  ) {
    const signature =
      String(
        req.headers[
          "x-webhook-signature"
        ] || "",
      );

    const timestamp =
      String(
        req.headers[
          "x-webhook-timestamp"
        ] || "",
      );

    const body =
      await readRaw(req);

    const result =
      await ctx.entitlements.handleWebhook({
        body,
        signature,
        timestamp,
      });

    writeJson(
      res,
      result.ok
        ? 200
        : result.status || 400,
      result,
    );

    return;
  }

  /*
   * Everything below this point is owner-scoped API
   * functionality.
   */
  let ownerUserId =
    String(
      req.headers[
        "x-owner-user-id"
      ] || "",
    ).trim();

  const accessToken =
    bearer(req);

  if (
    accessToken &&
    ctx.auth
  ) {
    const authed =
      ctx.auth.authorize({
        accessToken,
      });

    if (authed.ok) {
      ownerUserId =
        authed.userId;
    } else if (!ownerUserId) {
      writeJson(
        res,
        401,
        {
          ok: false,
          error:
            authed.error ||
            "unauthorized",
        },
      );

      return;
    }
  }

  if (
    !ownerUserId &&
    path.startsWith("/v1/")
  ) {
    writeJson(
      res,
      401,
      {
        ok: false,
        error:
          "owner-required",
      },
    );

    return;
  }

  /*
   * Create job.
   */
  if (
    req.method === "POST" &&
    path === "/v1/jobs"
  ) {
    const body =
      await readJson(req);

    const result =
      ctx.service.createJob({
        ownerUserId,

        idempotencyKey:
          body.idempotencyKey,

        language:
          body.language,

        mode:
          body.mode || "pair",

        settings:
          body.settings || {},
      });

    writeJson(
      res,
      result.ok
        ? 200
        : result.status || 400,
      result,
    );

    return;
  }

  const jobMatch =
    /^\/v1\/jobs\/([^/]+)(?:\/(credentials|uploads|finalize|result\/reveal|result\/forget))?$/
      .exec(path);

  if (!jobMatch) {
    writeJson(
      res,
      404,
      {
        ok: false,
        error: "not-found",
      },
    );

    return;
  }

  const jobId =
    decodeURIComponent(
      jobMatch[1],
    );

  const action =
    jobMatch[2] || null;

  /*
   * Get job.
   */
  if (
    req.method === "GET" &&
    !action
  ) {
    const result =
      ctx.service.getJob({
        jobId,
        ownerUserId,
      });

    writeJson(
      res,
      result.ok
        ? 200
        : result.status || 404,
      result,
    );

    return;
  }

  /*
   * Attach Moss credential.
   */
  if (
    req.method === "POST" &&
    action === "credentials"
  ) {
    const body =
      await readJson(req);

    const result =
      ctx.service.attachCredential({
        jobId,
        ownerUserId,
        mossUserId:
          body.mossUserId,
      });

    writeJson(
      res,
      result.ok
        ? 200
        : result.status || 400,
      result,
    );

    return;
  }

  /*
   * Upload files.
   */
  if (
    req.method === "POST" &&
    action === "uploads"
  ) {
    const body =
      await readJson(req);

    const result =
      ctx.service.uploadFiles({
        jobId,
        ownerUserId,
        files:
          body.files || [],
      });

    writeJson(
      res,
      result.ok
        ? 200
        : result.status || 400,
      result,
    );

    return;
  }

  /*
   * Finalize job.
   */
  if (
    req.method === "POST" &&
    action === "finalize"
  ) {
    const result =
      await ctx.service.finalize({
        jobId,
        ownerUserId,
      });

    writeJson(
      res,
      result.ok
        ? 200
        : result.status || 400,
      result,
    );

    return;
  }

  /*
   * Reveal result.
   */
  if (
    req.method === "POST" &&
    action === "result/reveal"
  ) {
    const result =
      ctx.service.revealResult({
        jobId,
        ownerUserId,
      });

    writeJson(
      res,
      result.ok
        ? 200
        : result.status || 400,
      result,
    );

    return;
  }

  /*
   * Forget result.
   */
  if (
    req.method === "POST" &&
    action === "result/forget"
  ) {
    const result =
      ctx.service.forgetResult({
        jobId,
        ownerUserId,
      });

    writeJson(
      res,
      result.ok
        ? 200
        : result.status || 400,
      result,
    );

    return;
  }

  writeJson(
    res,
    405,
    {
      ok: false,
      error:
        "method-not-allowed",
    },
  );
}

function applyCors(
  req,
  res,
  corsOrigins,
) {
  const origin =
    String(
      req.headers.origin || "",
    );

  const allowed =
    !origin ||
    corsOrigins.has(origin) ||
    origin.startsWith(
      "chrome-extension://",
    ) ||
    origin.startsWith(
      "moz-extension://",
    ) ||
    /^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(
      origin,
    ) ||
    /^http:\/\/localhost(?::\d+)?$/.test(
      origin,
    );

  if (
    allowed &&
    origin
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin,
    );

    res.setHeader(
      "Vary",
      "Origin",
    );
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS",
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    [
      "Content-Type",
      "Authorization",
      "X-Owner-User-Id",
      "X-Idempotency-Key",
      "X-Webhook-Signature",
      "X-Webhook-Timestamp",
    ].join(", "),
  );
}

function writeJson(
  res,
  status,
  body,
) {
  const payload =
    JSON.stringify(body);

  res.writeHead(
    status,
    {
      "Content-Type":
        "application/json; charset=utf-8",

      "Content-Length":
        Buffer.byteLength(
          payload,
        ),

      "Cache-Control":
        "no-store",
    },
  );

  res.end(payload);
}

async function readJson(
  req,
) {
  const chunks = [];

  for await (
    const chunk of req
  ) {
    chunks.push(chunk);
  }

  if (
    chunks.length === 0
  ) {
    return {};
  }

  const raw =
    Buffer.concat(
      chunks,
    ).toString(
      "utf8",
    );

  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function readRaw(
  req,
) {
  const chunks = [];

  for await (
    const chunk of req
  ) {
    chunks.push(
      Buffer.from(chunk),
    );
  }

  return Buffer.concat(
    chunks,
  ).toString("utf8");
}

async function main() {
  const env =
    process.env;

  const host =
    resolveListenHost(env);

  const port =
    resolveListenPort(env);

  console.log(
    `[moss-pair-api] starting host=${host} port=${port} nodeEnv=${env.NODE_ENV || ""} railway=${Boolean(env.RAILWAY_ENVIRONMENT)}`,
  );

  const api =
    createServer({
      host,
      port,
      env,
    });

  const info =
    await api.listen();

  console.log(
    `[moss-pair-api] listening on ${info.url} (submitMode=${info.submitMode})`,
  );

  if (
    info.submitMode ===
    "public-raw-tcp"
  ) {
    console.warn(
      "[moss-pair-api] LIVE public MOSS TCP enabled — consumes real userid quota; cleartext TCP.",
    );
  }
}

if (
  require.main === module
) {
  main().catch(
    (error) => {
      console.error(
        "[moss-pair-api] failed to start",
        error.message ||
          error,
      );

      process.exit(1);
    },
  );
}

module.exports = {
  DEFAULT_HOST,
  DEFAULT_PORT,
  resolveSubmitMode,
  resolveListenHost,
  resolveListenPort,
  createServer,
};