"use strict";

/**
 * Stream-based provider adapter contract (Prompt 054).
 * Single-use, immutable, DI-friendly — no globals, no filesystem paths.
 */

const { assertEncryptedTransport, assertNumericUserId } = require("./index");

const ADAPTER_VERSION = 1;

function createAdapter(implName, factory) {
  return {
    name: implName,
    version: ADAPTER_VERSION,
    create(config) {
      return factory(config);
    },
  };
}

function createMockAdapter() {
  return createAdapter("mock", (config) => {
    validateConfig(config, { allowDisabled: true });
    let used = false;
    let canceled = false;
    return {
      name: "mock",
      async submit({ manifest, streams, signal }) {
        if (used) throw Object.assign(new Error("single-use"), { code: "single-use" });
        used = true;
        if (!manifest || !streams) throw Object.assign(new Error("invalid"), { code: "invalid-input" });
        if (signal?.aborted || canceled) throw Object.assign(new Error("canceled"), { code: "canceled" });
        const chunks = [];
        for (const stream of streams) {
          for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        }
        return {
          ok: true,
          result: {
            reportUrlRef: `ref_mock_${chunks.length}`,
            bytesSent: chunks.reduce((n, c) => n + c.length, 0),
            provider: "mock",
          },
        };
      },
      cancel() {
        canceled = true;
      },
      async cleanup() {
        used = true;
        return { ok: true };
      },
      capabilities() {
        return { languages: ["python", "java"], experimental: false };
      },
    };
  });
}

function createDisabledAdapter() {
  return createAdapter("disabled", () => ({
    name: "disabled",
    async submit() {
      return { ok: false, error: "provider-disabled" };
    },
    cancel() {},
    async cleanup() {
      return { ok: true };
    },
    capabilities() {
      return { languages: [], experimental: false };
    },
  }));
}

function createCommercialMossAdapter() {
  return createAdapter("commercial-moss", (config) => {
    assertEncryptedTransport(config);
    assertNumericUserId(config.userId);
    let used = false;
    return {
      name: "commercial-moss",
      async submit() {
        if (used) throw Object.assign(new Error("single-use"), { code: "single-use" });
        used = true;
        // Transport happens via injected socket — not here
        return { ok: false, error: "requires-transport-binding" };
      },
      cancel() {},
      async cleanup() {
        return { ok: true };
      },
      capabilities() {
        return { languages: config.languages || ["python", "java", "cc"], experimental: false };
      },
    };
  });
}

function validateConfig(config, { allowDisabled = false } = {}) {
  if (!config || typeof config !== "object") {
    throw Object.assign(new Error("config"), { code: "invalid-config" });
  }
  if (!allowDisabled && config.transport !== "encrypted-allowlisted" && config.transport !== "mock-loopback") {
    throw Object.assign(new Error("transport"), { code: "invalid-config" });
  }
}

async function* bufferToStream(buffer) {
  yield Buffer.from(buffer);
}

function validateAdapterModule() {
  const errors = [];
  const mock = createMockAdapter().create({ transport: "mock-loopback" });
  const disabled = createDisabledAdapter().create({});

  return (async () => {
    const a = await mock.submit({
      manifest: { groups: 2 },
      streams: [bufferToStream("hello"), bufferToStream("world")],
    });
    if (!a.ok || !a.result.reportUrlRef.startsWith("ref_")) errors.push("mock");
    try {
      await mock.submit({ manifest: {}, streams: [] });
      errors.push("single-use");
    } catch (e) {
      if (e.code !== "single-use") errors.push("single-use-code");
    }

    const m1 = createMockAdapter().create({ transport: "mock-loopback" });
    const m2 = createMockAdapter().create({ transport: "mock-loopback" });
    await Promise.all([
      m1.submit({ manifest: {}, streams: [bufferToStream("a")] }),
      m2.submit({ manifest: {}, streams: [bufferToStream("b")] }),
    ]);

    try {
      createMockAdapter().create(null);
      errors.push("invalid-config");
    } catch (e) {
      if (e.code !== "invalid-config") errors.push("invalid-config-code");
    }

    const c = createMockAdapter().create({ transport: "mock-loopback" });
    c.cancel();
    try {
      await c.submit({ manifest: {}, streams: [bufferToStream("x")], signal: { aborted: true } });
      errors.push("cancel");
    } catch (e) {
      if (e.code !== "canceled") errors.push("cancel-code");
    }

    if (disabled.capabilities().languages.length !== 0) errors.push("disabled-caps");
    if (createCommercialMossAdapter().create({
      transport: "encrypted-allowlisted",
      userId: "12345",
      host: "provider.example",
      port: 443,
    }).capabilities().experimental) {
      errors.push("experimental");
    }

    await mock.cleanup();
    return { ok: errors.length === 0, errors };
  })();
}

module.exports = {
  ADAPTER_VERSION,
  createAdapter,
  createMockAdapter,
  createDisabledAdapter,
  createCommercialMossAdapter,
  bufferToStream,
  validateAdapterModule,
};
