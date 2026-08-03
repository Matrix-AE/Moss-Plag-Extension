"use strict";

/** Local-dev entry: enable gated public MOSS TCP before starting the loopback API. */
process.env.ALLOW_PUBLIC_MOSS_TCP = "1";

const { createServer } = require("./server");

createServer()
  .listen()
  .then((info) => {
    // eslint-disable-next-line no-console
    console.log(
      `[moss-local-api] listening on ${info.url} (submitMode=${info.submitMode})`,
    );
    // eslint-disable-next-line no-console
    console.warn(
      "[moss-local-api] LIVE public MOSS TCP enabled — consumes real userid quota; cleartext TCP.",
    );
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[moss-local-api] failed to start", error.message || error);
    process.exit(1);
  });
