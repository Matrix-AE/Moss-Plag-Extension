"use strict";

/**
 * Bounded protocol line parser (Prompt 056).
 * Never equate one TCP event with one response; always deadline/abort aware.
 */

const PARSER_VERSION = 1;

function createLineParser({
  maxLineLength = 8 * 1024,
  maxBuffer = 64 * 1024,
  encoding = "utf8",
  deadlineMs = 5_000,
  now = () => Date.now(),
} = {}) {
  let buffer = Buffer.alloc(0);
  let waiter = null;
  let closed = false;
  let errored = null;

  function push(chunk) {
    if (closed) return { ok: false, error: "closed" };
    if (errored) return { ok: false, error: errored };
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    if (buffer.length > maxBuffer) {
      errored = "buffer-oversize";
      failWaiter(errored);
      return { ok: false, error: errored };
    }
    tryResolve();
    return { ok: true };
  }

  function tryResolve() {
    if (!waiter) return;
    const lf = buffer.indexOf(0x0a);
    if (lf < 0) {
      if (buffer.length > maxLineLength) {
        errored = "line-oversize";
        failWaiter(errored);
      }
      return;
    }
    const raw = buffer.subarray(0, lf);
    buffer = buffer.subarray(lf + 1); // preserve surplus
    let line;
    try {
      line = raw.toString(encoding).replace(/\r$/, "");
    } catch {
      errored = "invalid-encoding";
      failWaiter(errored);
      return;
    }
    const resolve = waiter.resolve;
    clearTimeout(waiter.timer);
    waiter = null;
    resolve({ ok: true, line });
  }

  function readLine({ signal, timeoutMs = deadlineMs } = {}) {
    if (waiter) return Promise.reject(Object.assign(new Error("one waiter"), { code: "waiter-busy" }));
    if (errored) return Promise.resolve({ ok: false, error: errored });
    if (closed && buffer.length === 0) return Promise.resolve({ ok: false, error: "closed" });

    return new Promise((resolve) => {
      const started = now();
      const timer = setTimeout(() => {
        if (waiter) {
          waiter = null;
          resolve({ ok: false, error: "deadline" });
        }
      }, timeoutMs);

      const onAbort = () => {
        if (waiter) {
          clearTimeout(timer);
          waiter = null;
          resolve({ ok: false, error: "abort" });
        }
      };
      if (signal) {
        if (signal.aborted) {
          clearTimeout(timer);
          resolve({ ok: false, error: "abort" });
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }

      waiter = {
        resolve: (value) => {
          if (signal) signal.removeEventListener("abort", onAbort);
          resolve(value);
        },
        timer,
        started,
      };
      tryResolve();
      if (closed && waiter) {
        failWaiter("closed");
      }
    });
  }

  function failWaiter(error) {
    if (!waiter) return;
    clearTimeout(waiter.timer);
    const resolve = waiter.resolve;
    waiter = null;
    resolve({ ok: false, error });
  }

  function onClose() {
    closed = true;
    failWaiter("closed");
  }

  function onError(code = "socket-error") {
    errored = code;
    failWaiter(code);
  }

  function getSurplus() {
    return Buffer.from(buffer);
  }

  return { push, readLine, onClose, onError, getSurplus, PARSER_VERSION };
}

async function validateParserModule() {
  const errors = [];

  // one-byte chunks
  {
    const p = createLineParser();
    const pending = p.readLine();
    for (const ch of Buffer.from("OK\n")) p.push(Buffer.from([ch]));
    const r = await pending;
    if (!r.ok || r.line !== "OK") errors.push("one-byte");
  }

  // multi-line chunk
  {
    const p = createLineParser();
    p.push(Buffer.from("A\nB\n"));
    const a = await p.readLine();
    const b = await p.readLine();
    if (a.line !== "A" || b.line !== "B") errors.push("multi");
  }

  // CRLF
  {
    const p = createLineParser();
    const pending = p.readLine();
    p.push(Buffer.from("X\r\n"));
    if ((await pending).line !== "X") errors.push("crlf");
  }

  // missing newline → deadline
  {
    const p = createLineParser({ deadlineMs: 20, now: () => Date.now() });
    p.push(Buffer.from("NOEOL"));
    const r = await p.readLine({ timeoutMs: 20 });
    if (r.error !== "deadline") errors.push("deadline");
  }

  // oversize
  {
    const p = createLineParser({ maxLineLength: 5, maxBuffer: 100 });
    p.push(Buffer.from("ABCDEF"));
    const r = await p.readLine({ timeoutMs: 50 });
    if (r.error !== "line-oversize") errors.push("oversize");
  }

  // close
  {
    const p = createLineParser();
    const pending = p.readLine({ timeoutMs: 200 });
    p.onClose();
    if ((await pending).error !== "closed") errors.push("close");
  }

  // abort
  {
    const p = createLineParser();
    const ac = new AbortController();
    const pending = p.readLine({ signal: ac.signal, timeoutMs: 500 });
    ac.abort();
    if ((await pending).error !== "abort") errors.push("abort");
  }

  // surplus preserved
  {
    const p = createLineParser();
    p.push(Buffer.from("ONE\nTWO"));
    await p.readLine();
    if (p.getSurplus().toString() !== "TWO") errors.push("surplus");
  }

  return { ok: errors.length === 0, errors };
}

module.exports = {
  PARSER_VERSION,
  createLineParser,
  validateParserModule,
};
