"use strict";

/**
 * Safe provider socket transport and lifecycle (Prompt 058).
 */

const net = require("node:net");
const tls = require("node:tls");
const { createLineParser } = require("./line-parser");

const TRANSPORT_VERSION = 1;

const APPROVED = Object.freeze({
  "mock-loopback": { transport: "tcp", allowUnencrypted: true, hosts: ["127.0.0.1", "::1"] },
  "encrypted-allowlisted": { transport: "tls", allowUnencrypted: false, hosts: null },
});

function createTransport({
  mode = "mock-loopback",
  host,
  port,
  connectTimeoutMs = 2_000,
  readTimeoutMs = 5_000,
  writeTimeoutMs = 5_000,
  overallTimeoutMs = 30_000,
  production = false,
  allowlistHosts = [],
  now = () => Date.now(),
} = {}) {
  const profile = APPROVED[mode];
  if (!profile) throw Object.assign(new Error("mode"), { code: "unapproved-endpoint" });
  if (production && mode !== "encrypted-allowlisted") {
    throw Object.assign(new Error("prod requires encrypted"), { code: "unencrypted-forbidden" });
  }
  if (mode === "encrypted-allowlisted") {
    if (!allowlistHosts.includes(host)) {
      throw Object.assign(new Error("host"), { code: "unapproved-endpoint" });
    }
  } else if (!profile.hosts.includes(host)) {
    throw Object.assign(new Error("host"), { code: "unapproved-endpoint" });
  }

  let socket = null;
  let parser = null;
  let destroyed = false;
  let cleaned = false;
  const timers = new Set();
  const startedAt = now();

  function arm(ms, code) {
    return new Promise((_, reject) => {
      const t = setTimeout(() => reject(Object.assign(new Error(code), { code })), ms);
      timers.add(t);
    });
  }

  function clearTimers() {
    for (const t of timers) clearTimeout(t);
    timers.clear();
  }

  async function connect() {
    if (destroyed) throw Object.assign(new Error("destroyed"), { code: "destroyed" });
    const overall = arm(overallTimeoutMs, "overall-timeout");
    const connectRace = new Promise((resolve, reject) => {
      const connectTimer = setTimeout(() => reject(Object.assign(new Error("connect-timeout"), { code: "connect-timeout" })), connectTimeoutMs);
      timers.add(connectTimer);
      const onConnect = () => {
        clearTimeout(connectTimer);
        parser = createLineParser({ deadlineMs: readTimeoutMs, now });
        socket.on("data", (c) => parser.push(c));
        socket.on("error", (err) => parser.onError(err.code || "socket-error"));
        socket.on("close", () => parser.onClose());
        resolve();
      };
      if (mode === "encrypted-allowlisted") {
        socket = tls.connect({ host, port, servername: host }, onConnect);
      } else {
        socket = net.connect({ host, port }, onConnect);
      }
      socket.on("error", reject);
    });
    try {
      await Promise.race([connectRace, overall]);
      return { ok: true };
    } catch (error) {
      await cleanup();
      return { ok: false, error: error.code || "connect-failed" };
    }
  }

  async function writeLine(line) {
    if (destroyed || !socket) throw Object.assign(new Error("destroyed"), { code: "destroyed" });
    const payload = Buffer.from(`${line}\n`, "utf8");
    await Promise.race([
      new Promise((resolve, reject) => {
        const ok = socket.write(payload, (err) => (err ? reject(err) : resolve()));
        if (!ok) socket.once("drain", resolve);
      }),
      arm(writeTimeoutMs, "write-timeout"),
      arm(Math.max(0, overallTimeoutMs - (now() - startedAt)), "overall-timeout"),
    ]);
    return { ok: true };
  }

  async function readLine(opts) {
    if (destroyed || !parser) throw Object.assign(new Error("destroyed"), { code: "destroyed" });
    return parser.readLine({ timeoutMs: readTimeoutMs, ...opts });
  }

  async function abort() {
    destroyed = true;
    clearTimers();
    if (socket) {
      socket.destroy();
      socket = null;
    }
    return { ok: true };
  }

  async function cleanup() {
    if (cleaned) return { ok: true, once: true };
    cleaned = true;
    destroyed = true;
    clearTimers();
    if (parser) parser.onClose();
    if (socket) {
      socket.removeAllListeners();
      socket.destroy();
      socket = null;
    }
    return { ok: true, once: false };
  }

  return {
    connect,
    writeLine,
    readLine,
    abort,
    cleanup,
    get destroyed() {
      return destroyed;
    },
    TRANSPORT_VERSION,
  };
}

async function validateTransportModule() {
  const errors = [];
  const { createMockMossServer } = require("./mock-moss-server");
  const server = createMockMossServer({ script: "valid" });
  const addr = await server.start();

  try {
    createTransport({ mode: "mock-loopback", host: "evil.com", port: 1 });
    errors.push("host");
  } catch (e) {
    if (e.code !== "unapproved-endpoint") errors.push("host-code");
  }

  try {
    createTransport({ mode: "mock-loopback", host: "127.0.0.1", port: 1, production: true });
    errors.push("prod");
  } catch (e) {
    if (e.code !== "unencrypted-forbidden") errors.push("prod-code");
  }

  const t = createTransport({ mode: "mock-loopback", host: addr.host, port: addr.port, connectTimeoutMs: 1000 });
  const c = await t.connect();
  if (!c.ok) errors.push("connect");
  await t.writeLine("userid 12345");
  const line = await t.readLine();
  if (!line.ok) errors.push("read");
  const clean1 = await t.cleanup();
  const clean2 = await t.cleanup();
  if (!clean2.once) errors.push("cleanup-once");

  // refusal
  const bad = createTransport({ mode: "mock-loopback", host: "127.0.0.1", port: 1, connectTimeoutMs: 200 });
  const refused = await bad.connect();
  if (refused.ok) errors.push("refusal");
  await bad.cleanup();

  // abort
  const t2 = createTransport({ mode: "mock-loopback", host: addr.host, port: addr.port });
  await t2.connect();
  await t2.abort();
  try {
    await t2.writeLine("x");
    errors.push("write-destroyed");
  } catch (e) {
    if (e.code !== "destroyed") errors.push("write-destroyed-code");
  }
  await t2.cleanup();

  await server.teardown();
  return { ok: errors.length === 0, errors };
}

module.exports = {
  TRANSPORT_VERSION,
  APPROVED,
  createTransport,
  validateTransportModule,
};
