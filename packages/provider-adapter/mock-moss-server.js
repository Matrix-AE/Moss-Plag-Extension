"use strict";

/**
 * Deterministic mock MOSS protocol TCP server (Prompt 055).
 * Loopback/ephemeral only — never contacts external MOSS.
 */

const net = require("node:net");
const { EventEmitter } = require("node:events");

const MOCK_SERVER_VERSION = 1;

function createMockMossServer({
  script = "valid",
  delayMs = 0,
  chunkSize = 0,
} = {}) {
  const transcripts = [];
  let server = null;
  let connections = [];
  let externalBlocked = true;

  const api = new EventEmitter();

  function start() {
    return new Promise((resolve, reject) => {
      server = net.createServer((socket) => {
        connections.push(socket);
        const remote = `${socket.remoteAddress}:${socket.remotePort}`;
        if (externalBlocked && socket.remoteAddress && !isLoopback(socket.remoteAddress)) {
          socket.destroy();
          return;
        }
        let buf = Buffer.alloc(0);
        socket.on("data", (chunk) => {
          buf = Buffer.concat([buf, chunk]);
          transcripts.push({ dir: "in", remote, bytes: chunk.toString("utf8") });
          void handleBuffer();
        });

        async function handleBuffer() {
          // Process complete lines
          while (true) {
            const idx = buf.indexOf(0x0a);
            if (idx < 0) break;
            const line = buf.subarray(0, idx).toString("utf8").replace(/\r$/, "");
            buf = buf.subarray(idx + 1);
            const response = await scriptedResponse(line, script);
            await sleep(delayMs);
            await writeChunked(socket, response, chunkSize);
            transcripts.push({ dir: "out", remote, bytes: response });
          }
        }

        socket.on("close", () => {
          connections = connections.filter((s) => s !== socket);
        });
      });

      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        resolve({ host: "127.0.0.1", port: addr.port });
      });
      server.on("error", reject);
    });
  }

  async function teardown() {
    for (const socket of connections) {
      socket.destroy();
    }
    connections = [];
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      server = null;
    }
    return { ok: true, transcripts: [...transcripts] };
  }

  return {
    start,
    teardown,
    getTranscripts: () => [...transcripts],
    MOCK_SERVER_VERSION,
  };
}

function isLoopback(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

async function scriptedResponse(line, script) {
  if (script === "reject") return "Error: rejected\n";
  if (script === "reset") return ""; // peer will reset separately
  if (script === "malformed-url") return "http://not-a-valid-moss-result\n";
  if (script === "ambiguous") return "TRY AGAIN LATER\n";
  if (script === "backpressure") {
    return `${"X".repeat(1024)}\n`;
  }
  // valid session
  if (/^moss\s+/i.test(line) || line.startsWith("userid")) return "OK\n";
  if (line.startsWith("query") || line === "query") return "https://mock.local/results/synthetic-1\n";
  return "OK\n";
}

function writeChunked(socket, text, chunkSize) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(text, "utf8");
    if (!chunkSize || chunkSize <= 0) {
      socket.write(buf, (err) => (err ? reject(err) : resolve()));
      return;
    }
    let offset = 0;
    const writeNext = () => {
      if (offset >= buf.length) return resolve();
      const end = Math.min(offset + chunkSize, buf.length);
      const ok = socket.write(buf.subarray(offset, end));
      offset = end;
      if (!ok) socket.once("drain", writeNext);
      else setImmediate(writeNext);
    };
    writeNext();
  });
}

function sleep(ms) {
  return ms ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}

async function validateMockServerModule() {
  const errors = [];
  const server = createMockMossServer({ script: "valid", chunkSize: 3, delayMs: 1 });
  const addr = await server.start();
  if (addr.host !== "127.0.0.1") errors.push("bind");

  await new Promise((resolve, reject) => {
    const client = net.connect(addr.port, addr.host, () => {
      client.write("userid 12345\n");
      client.write("query\n");
    });
    let data = "";
    client.on("data", (c) => {
      data += c.toString("utf8");
      if (data.includes("https://mock.local")) {
        client.end();
        resolve();
      }
    });
    client.on("error", reject);
    setTimeout(() => reject(new Error("timeout")), 3000);
  });

  const torn = await server.teardown();
  if (!torn.ok || torn.transcripts.length < 2) errors.push("transcript");

  // parallel servers
  const s1 = createMockMossServer({ script: "reject" });
  const s2 = createMockMossServer({ script: "ambiguous" });
  const a1 = await s1.start();
  const a2 = await s2.start();
  if (a1.port === a2.port) errors.push("ephemeral");
  await s1.teardown();
  await s2.teardown();

  // prove no external connection attempted by construction (loopback only)
  if (addr.host !== "127.0.0.1") errors.push("external");

  return { ok: errors.length === 0, errors };
}

module.exports = {
  MOCK_SERVER_VERSION,
  createMockMossServer,
  validateMockServerModule,
};
