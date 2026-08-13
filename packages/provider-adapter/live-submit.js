"use strict";

/**
 * Live / mock MOSS pair submission (dev-gated public TCP).
 * Protocol sequence from docs/compliance/moss-service-research.md.
 */

const net = require("node:net");
const { createLineParser } = require("./line-parser");
const { createMockMossServer } = require("./mock-moss-server");
const failures = require("./failures");

const LIVE_SUBMIT_VERSION = 1;
const PUBLIC_HOST = "moss.stanford.edu";
const PUBLIC_PORT = 7690;

// Classic public MOSS returns http://moss.stanford.edu/results/... (not https).
const URL_ALLOW = Object.freeze([
  /^https:\/\/mock\.local\/.+/i,
  /^https:\/\/([a-z0-9.-]+\.)?moss\.stanford\.edu\/.+/i,
  /^http:\/\/([a-z0-9.-]+\.)?moss\.stanford\.edu\/.+/i,
]);

function assertPublicMossAllowed({
  env = process.env,
  production = false,
} = {}) {
  const hostedOptIn =
    env.ALLOW_HOSTED_PUBLIC_MOSS_TCP === "1";

  if (
    (production ||
      env.NODE_ENV === "production") &&
    !hostedOptIn
  ) {
    const error = Object.assign(
      new Error(
        "public-raw-tcp forbidden in production",
      ),
      {
        code: "unencrypted-forbidden",
      },
    );

    throw error;
  }

  if (
    env.ALLOW_PUBLIC_MOSS_TCP !== "1"
  ) {
    const error = Object.assign(
      new Error(
        "Set ALLOW_PUBLIC_MOSS_TCP=1 for public MOSS TCP",
      ),
      {
        code:
          "public-tcp-flag-required",
      },
    );

    throw error;
  }

  return true;
}

function isAllowedResultUrl(url) {
  return URL_ALLOW.some((re) =>
    re.test(
      String(url || "").trim(),
    ),
  );
}

function sanitizeFilename(name) {
  return String(
    name || "file",
  )
    .replace(
      /[\u0000-\u001f\u007f]/g,
      "",
    )
    .replace(/[\\/]/g, "_")
    .slice(0, 128) || "file";
}

/**
 * @param {object} job
 * @param {string} job.mossUserId
 * @param {string} job.language protocol code (python, c, java, …)
 * @param {Array<{displayName:string, bytes:Buffer|Uint8Array|string, submissionId?:number}>} job.files
 * @param {"pair"|"batch"} [job.mode]
 * @param {0|1} [job.directoryMode]
 * @param {object} [job.settings]
 * @param {string} [job.comment]
 * @param {object} [options]
 */
async function submitPairToMoss(
  job,
  options = {},
) {
  const {
    mode = "mock-loopback",
    env = process.env,
    production = false,

    connectTimeoutMs = 15_000,

    // MOSS can take several minutes after accepting a query.
    readTimeoutMs = 300_000,

    overallTimeoutMs = 600_000,

    onStage = () => {},

    mockServerFactory =
      createMockMossServer,
  } = options;

  if (
    !/^[0-9]{3,}$/.test(
      String(
        job.mossUserId || "",
      ),
    )
  ) {
    return classify(
      "before-connect",
      "credential",
      "invalid userid",
    );
  }

  if (!job.language) {
    return classify(
      "before-connect",
      "language",
      "missing language",
    );
  }

  const files =
    job.files || [];

  const maxFiles =
    job.mode === "batch"
      ? 50
      : 2;

  if (
    files.length < 2 ||
    files.length > maxFiles
  ) {
    return classify(
      "before-connect",
      "generic-failure",
      job.mode === "batch"
        ? "batch requires 2–50 files"
        : "pair requires exactly two files",
    );
  }

  if (
    job.mode !== "batch" &&
    files.length !== 2
  ) {
    return classify(
      "before-connect",
      "generic-failure",
      "pair requires exactly two files",
    );
  }

  let mock = null;
  let host = "127.0.0.1";
  let port = 0;
  let transportMode =
    "mock-loopback";

  try {
    onStage("connecting");

    if (
      mode ===
      "public-raw-tcp"
    ) {
      assertPublicMossAllowed({
        env,
        production,
      });

      host =
        PUBLIC_HOST;

      port =
        PUBLIC_PORT;

      transportMode =
        "public-raw-tcp";
    } else {
      mock =
        mockServerFactory({
          script: "protocol",
        });

      const addr =
        await mock.start();

      host =
        addr.host;

      port =
        addr.port;
    }

    console.log(
      `[moss-pair-api] opening MOSS session host=${host} port=${port} mode=${transportMode}`,
    );

    const session =
      await openSession({
        host,
        port,
        mode:
          transportMode,
        connectTimeoutMs,
        readTimeoutMs,
        overallTimeoutMs,
      });

    if (!session.ok) {
      await teardownMock(
        mock,
      );

      console.log(
        `[moss-pair-api] MOSS session failed before authentication error=${session.error || "unknown"}`,
      );

      return classify(
        "before-connect",
        session.error ||
          "timeout",
        session.error ||
          "connect",
      );
    }

    console.log(
      "[moss-pair-api] MOSS TCP session connected",
    );

    const {
      writeLine,
      writeBytes,
      readLine,
      cleanup,
    } = session;

    try {
      await writeLine(
        `moss ${job.mossUserId}`,
      );

      onStage(
        "authenticated",
      );

      const directoryMode =
        job.directoryMode ===
          1 ||
        files.some(
          (
            file,
            _i,
            arr,
          ) => {
            const id =
              Number(
                file.submissionId,
              ) || 0;

            return (
              id > 0 &&
              arr.filter(
                (other) =>
                  Number(
                    other.submissionId,
                  ) === id,
              ).length > 1
            );
          },
        )
          ? 1
          : 0;

      await writeLine(
        `directory ${directoryMode}`,
      );

      await writeLine(
        "X 0",
      );

      const maxmatches =
        clamp(
          job.settings
            ?.commonMatchThreshold ??
            10,
          1,
          1000,
        );

      const show =
        clamp(
          job.settings
            ?.resultCount ??
            250,
          1,
          1000,
        );

      await writeLine(
        `maxmatches ${maxmatches}`,
      );

      await writeLine(
        `show ${show}`,
      );

      await writeLine(
        `language ${job.language}`,
      );

      console.log(
        `[moss-pair-api] waiting for language acknowledgement language=${job.language}`,
      );

      const langAck =
        await readLine();

      if (!langAck.ok) {
        console.log(
          `[moss-pair-api] language acknowledgement failed code=${langAck.error || "unknown"}`,
        );

        return classify(
          "authenticated",
          langAck.error ||
            "timeout",
          langAck.error ||
            "",
        );
      }

      if (
        !/^yes$/i.test(
          String(
            langAck.line || "",
          ).trim(),
        )
      ) {
        console.log(
          `[moss-pair-api] MOSS rejected language acknowledgement response=${String(
            langAck.line || "",
          ).slice(0, 80)}`,
        );

        return classify(
          "authenticated",
          "language",
          langAck.line ||
            "language rejected",
        );
      }

      onStage(
        "language-accepted",
      );

      for (
        let i = 0;
        i < files.length;
        i += 1
      ) {
        const file =
          files[i];

        const body =
          Buffer.isBuffer(
            file.bytes,
          )
            ? file.bytes
            : Buffer.from(
                file.bytes == null
                  ? ""
                  : String(
                      file.bytes,
                    ),
                "utf8",
              );

        const name =
          sanitizeFilename(
            file.displayName ||
              `file${i + 1}`,
          );

        const submissionId =
          Number.isInteger(
            Number(
              file.submissionId,
            ),
          ) &&
          Number(
            file.submissionId,
          ) >= 1
            ? Number(
                file.submissionId,
              )
            : i + 1;

        console.log(
          `[moss-pair-api] uploading file ${i + 1}/${files.length} bytes=${body.length} submissionId=${submissionId}`,
        );

        await writeLine(
          `file ${submissionId} ${job.language} ${body.length} ${name}`,
        );

        await writeBytes(
          body,
        );

        onStage(
          `uploaded-${i + 1}-of-${files.length}`,
        );
      }

      const comment =
        sanitizeComment(
          job.comment ||
            (job.mode ===
            "batch"
              ? "batch-check"
              : "pair-check"),
        );

      console.log(
        `[moss-pair-api] sending MOSS query files=${files.length} language=${job.language}`,
      );

      await writeLine(
        `query 0 ${comment}`,
      );

      onStage(
        "query-sent",
      );

      console.log(
        "[moss-pair-api] MOSS query sent; waiting for result URL",
      );

      onStage(
        "awaiting-report",
      );

      const result =
        await readLine();

      console.log(
        `[moss-pair-api] MOSS result read ok=${Boolean(
          result.ok,
        )} error=${result.error || "none"}`,
      );

      if (!result.ok) {
        return classify(
          "query-sent",
          result.error ||
            "timeout",
          result.error ||
            "",
        );
      }

      const url =
        String(
          result.line ||
            "",
        ).trim();

      console.log(
        `[moss-pair-api] MOSS returned result URL allowed=${isAllowedResultUrl(
          url,
        )}`,
      );

      if (
        !isAllowedResultUrl(
          url,
        )
      ) {
        return classify(
          "awaiting-url",
          "invalid-url",
          url,
        );
      }

      await writeLine(
        "end",
      ).catch(
        () => {},
      );

      onStage(
        "report-received",
      );

      console.log(
        "[moss-pair-api] MOSS report received successfully",
      );

      return {
        ok: true,

        reportUrl:
          url,

        phase:
          "completed",

        transport:
          transportMode,
      };
    } finally {
      await cleanup();
      await teardownMock(
        mock,
      );
    }
  } catch (error) {
    await teardownMock(
      mock,
    );

    if (
      error.code ===
        "unencrypted-forbidden" ||
      error.code ===
        "public-tcp-flag-required"
    ) {
      return {
        ok: false,
        code:
          error.code,
        message:
          error.message,
        retryable: false,
      };
    }

    console.error(
      "[moss-pair-api] MOSS submission exception",
      error,
    );

    return classify(
      "before-connect",
      "generic-failure",
      error.message ||
        "submit failed",
    );
  }
}

function classify(
  phase,
  cause,
  raw,
) {
  const mapped =
    failures.classifyFailure({
      phase,
      cause,
      rawMessage:
        String(
          raw || "",
        ),
    });

  return {
    ok: false,

    code:
      mapped.code,

    message:
      mapped.message,

    phase:
      mapped.phase,

    retryable:
      mapped.retryable,

    quotaAction:
      mapped.quotaAction,

    requiresDeliberateResubmit:
      mapped.requiresDeliberateResubmit,
  };
}

function sanitizeComment(
  value,
) {
  return String(
    value || "",
  )
    .replace(
      /[\u0000-\u001f\u007f]/g,
      "",
    )
    .replace(
      /[;`|$<>]/g,
      "",
    )
    .trim()
    .slice(0, 80) ||
    "untitled";
}

function clamp(
  n,
  min,
  max,
) {
  const v =
    Number(n);

  if (
    !Number.isFinite(v)
  ) {
    return min;
  }

  return Math.min(
    max,
    Math.max(
      min,
      Math.trunc(v),
    ),
  );
}

async function teardownMock(
  mock,
) {
  if (mock) {
    await mock.teardown();
  }
}

function openSession({
  host,
  port,
  mode,
  connectTimeoutMs,
  readTimeoutMs,
  overallTimeoutMs,
}) {
  return new Promise(
    (resolve) => {
      const startedAt =
        Date.now();

      const timers =
        new Set();

      let socket = null;

      let parser =
        createLineParser({
          deadlineMs:
            readTimeoutMs,
        });

      let cleaned =
        false;

      let destroyed =
        false;

      const arm =
        (
          ms,
          code,
        ) =>
          new Promise(
            (
              _,
              reject,
            ) => {
              const t =
                setTimeout(
                  () =>
                    reject(
                      Object.assign(
                        new Error(
                          code,
                        ),
                        {
                          code,
                        },
                      ),
                    ),
                  ms,
                );

              timers.add(
                t,
              );
            },
          );

      const clearTimers =
        () => {
          for (
            const t of timers
          ) {
            clearTimeout(t);
          }

          timers.clear();
        };

      const cleanup =
        async () => {
          if (cleaned) {
            return {
              ok: true,
            };
          }

          cleaned =
            true;

          destroyed =
            true;

          clearTimers();

          parser.onClose();

          if (socket) {
            socket.removeAllListeners();
            socket.destroy();
            socket = null;
          }

          return {
            ok: true,
          };
        };

      const connectTimer =
        setTimeout(
          () => {
            void cleanup();

            resolve({
              ok: false,
              error:
                "connect-timeout",
            });
          },
          connectTimeoutMs,
        );

      timers.add(
        connectTimer,
      );

      socket =
        net.connect(
          {
            host,
            port,
          },
          () => {
            clearTimeout(
              connectTimer,
            );

            socket.on(
              "data",
              (chunk) =>
                parser.push(
                  chunk,
                ),
            );

            socket.on(
              "error",
              () =>
                parser.onError(
                  "socket-error",
                ),
            );

            socket.on(
              "close",
              () =>
                parser.onClose(),
            );

            resolve({
              ok: true,

              async writeLine(
                line,
              ) {
                if (
                  destroyed ||
                  !socket
                ) {
                  throw Object.assign(
                    new Error(
                      "destroyed",
                    ),
                    {
                      code:
                        "destroyed",
                    },
                  );
                }

                const payload =
                  Buffer.from(
                    `${line}\n`,
                    "utf8",
                  );

                await Promise.race(
                  [
                    new Promise(
                      (
                        res,
                        rej,
                      ) => {
                        socket.write(
                          payload,
                          (
                            err,
                          ) =>
                            err
                              ? rej(
                                  err,
                                )
                              : res(),
                        );
                      },
                    ),

                    arm(
                      Math.max(
                        0,
                        overallTimeoutMs -
                          (Date.now() -
                            startedAt),
                      ),
                      "overall-timeout",
                    ),
                  ],
                );
              },

              async writeBytes(
                buf,
              ) {
                if (
                  destroyed ||
                  !socket
                ) {
                  throw Object.assign(
                    new Error(
                      "destroyed",
                    ),
                    {
                      code:
                        "destroyed",
                    },
                  );
                }

                await Promise.race(
                  [
                    new Promise(
                      (
                        res,
                        rej,
                      ) => {
                        socket.write(
                          Buffer.from(
                            buf,
                          ),
                          (
                            err,
                          ) =>
                            err
                              ? rej(
                                  err,
                                )
                              : res(),
                        );
                      },
                    ),

                    arm(
                      Math.max(
                        0,
                        overallTimeoutMs -
                          (Date.now() -
                            startedAt),
                      ),
                      "overall-timeout",
                    ),
                  ],
                );
              },

              readLine:
                (opts) =>
                  parser.readLine({
                    timeoutMs:
                      readTimeoutMs,
                    ...opts,
                  }),

              cleanup,
              mode,
            });
          },
        );

      socket.on(
        "error",
        () => {
          clearTimeout(
            connectTimer,
          );

          void cleanup();

          resolve({
            ok: false,
            error:
              "connect-failed",
          });
        },
      );
    },
  );
}

async function validateLiveSubmitModule() {
  const errors = [];

  try {
    assertPublicMossAllowed({
      env: {
        NODE_ENV:
          "production",
        ALLOW_PUBLIC_MOSS_TCP:
          "1",
      },
      production: true,
    });

    errors.push(
      "prod-gate",
    );
  } catch (e) {
    if (
      e.code !==
      "unencrypted-forbidden"
    ) {
      errors.push(
        "prod-code",
      );
    }
  }

  try {
    assertPublicMossAllowed(
      {
        env: {},
        production: false,
      },
    );

    errors.push(
      "flag-gate",
    );
  } catch (e) {
    if (
      e.code !==
      "public-tcp-flag-required"
    ) {
      errors.push(
        "flag-code",
      );
    }
  }

  try {
    assertPublicMossAllowed({
      env: {
        NODE_ENV:
          "production",

        ALLOW_PUBLIC_MOSS_TCP:
          "1",

        ALLOW_HOSTED_PUBLIC_MOSS_TCP:
          "1",
      },

      production: true,
    });
  } catch {
    errors.push(
      "hosted-opt-in",
    );
  }

  const result =
    await submitPairToMoss(
      {
        mossUserId:
          "12345",

        language:
          "python",

        files: [
          {
            displayName:
              "a.py",

            bytes:
              Buffer.from(
                "print(1)\n",
              ),
          },

          {
            displayName:
              "b.py",

            bytes:
              Buffer.from(
                "print(2)\n",
              ),
          },
        ],

        settings: {
          commonMatchThreshold:
            10,

          resultCount:
            250,
        },

        comment:
          "test",
      },

      {
        mode:
          "mock-loopback",
      },
    );

  if (
    !result.ok ||
    !isAllowedResultUrl(
      result.reportUrl,
    )
  ) {
    errors.push(
      "mock-submit",
    );
  }

  const bad =
    await submitPairToMoss(
      {
        mossUserId:
          "12345",

        language:
          "python",

        files: [
          {
            displayName:
              "a.py",

            bytes:
              "x",
          },
        ],
      },

      {
        mode:
          "mock-loopback",
      },
    );

  if (bad.ok) {
    errors.push(
      "pair-count",
    );
  }

  return {
    ok:
      errors.length ===
      0,

    errors,
  };
}

module.exports = {
  LIVE_SUBMIT_VERSION,
  PUBLIC_HOST,
  PUBLIC_PORT,
  assertPublicMossAllowed,
  isAllowedResultUrl,
  submitPairToMoss,
  validateLiveSubmitModule,
};