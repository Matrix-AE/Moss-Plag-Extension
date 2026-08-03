"use strict";

/**
 * Offline fake provider transport for CI/unit tests.
 * Never opens sockets to moss.stanford.edu.
 */

function createFakeProviderTransport(options = {}) {
  const calls = [];
  const mode = options.mode || "success";
  return {
    kind: "fake",
    calls,
    async submit(job) {
      if (job && job.egressHost === "moss.stanford.edu") {
        const error = new Error("CI harness blocked external MOSS egress.");
        error.code = "egress-blocked";
        throw error;
      }
      calls.push({ type: "submit", jobId: job && job.jobId });
      if (mode === "timeout") {
        return { status: "ambiguous", reportUrlRef: null };
      }
      if (mode === "reject") {
        return { status: "failed", errorCode: "provider-reject" };
      }
      return { status: "succeeded", reportUrlRef: "res_fake_001" };
    },
  };
}

function createHarnessSuite() {
  return {
    unit: { runOffline: true, requiresLiveMoss: false },
    contract: { runOffline: true, requiresLiveMoss: false },
    component: { runOffline: true, requiresLiveMoss: false },
    extensionE2E: { runOffline: true, requiresLiveMoss: false },
    apiIntegration: { runOffline: true, requiresLiveMoss: false },
    worker: { runOffline: true, requiresLiveMoss: false },
    protocolHarness: {
      runOffline: true,
      requiresLiveMoss: false,
      implementation: "fake-transport-placeholder",
      fullMockTcpDeferredToPrompt: 55,
    },
  };
}

function assertNoLiveMossDependency(env = process.env) {
  if (env.MOSS_LIVE_SMOKE === "1" && env.CI === "true") {
    const error = new Error("Live MOSS smoke tests are forbidden in CI.");
    error.code = "live-moss-in-ci";
    throw error;
  }
  return true;
}

module.exports = {
  assertNoLiveMossDependency,
  createFakeProviderTransport,
  createHarnessSuite,
};
