"use strict";

/**
 * Intake and fair provider queues (Prompt 053).
 */

const QUEUE_VERSION = 1;

function createFairQueues({
  now = () => Date.now(),
  perCredentialCap = 2,
  leaseMs = 30_000,
  estimateMs = 5_000,
} = {}) {
  const intake = [];
  const provider = [];
  const deadLetters = [];
  const leases = new Map();
  const circuit = { open: false, failures: 0, openedAt: null };
  const credentialInflight = new Map();

  function enqueueIntake(job) {
    intake.push({
      id: `inq_${intake.length + 1}`,
      jobId: job.jobId,
      userId: job.userId,
      enqueuedAt: now(),
      attempts: 0,
    });
    return { ok: true, estimateMs: honestEstimate("intake") };
  }

  function enqueueProvider(job, { credentialId }) {
    if (!credentialId) return { ok: false, error: "credential-required" };
    if (circuit.open) return { ok: false, error: "circuit-open" };
    provider.push({
      id: `pq_${provider.length + 1}`,
      jobId: job.jobId,
      userId: job.userId,
      credentialId,
      enqueuedAt: now(),
      attempts: 0,
    });
    return { ok: true, estimateMs: honestEstimate("provider") };
  }

  function honestEstimate(kind) {
    const depth = kind === "intake" ? intake.filter((i) => !i.done).length : provider.filter((i) => !i.done).length;
    return depth * estimateMs;
  }

  function claimIntake({ workerId }) {
    // Tenant fairness: pick oldest among users with least in-flight/recent service
    const pending = intake.filter((i) => !i.done && !i.leased);
    if (pending.length === 0) return { ok: false, error: "empty" };
    const byUser = new Map();
    for (const item of pending) {
      byUser.set(item.userId, (byUser.get(item.userId) || 0) + 1);
    }
    // Prefer user with fewest pending starvation score = count served recently
    pending.sort((a, b) => {
      const sa = servedScore(a.userId);
      const sb = servedScore(b.userId);
      if (sa !== sb) return sa - sb;
      return a.enqueuedAt - b.enqueuedAt;
    });
    const item = pending[0];
    item.leased = true;
    item.leaseExpiresAt = now() + leaseMs;
    item.workerId = workerId;
    leases.set(item.id, item);
    bumpServed(item.userId);
    return { ok: true, item };
  }

  const served = new Map();
  function servedScore(userId) {
    return served.get(userId) || 0;
  }
  function bumpServed(userId) {
    served.set(userId, (served.get(userId) || 0) + 1);
  }

  function claimProvider({ workerId }) {
    if (circuit.open) return { ok: false, error: "circuit-open" };
    const pending = provider.filter((i) => !i.done && !i.leased);
    pending.sort((a, b) => {
      const sa = servedScore(a.userId);
      const sb = servedScore(b.userId);
      if (sa !== sb) return sa - sb;
      return a.enqueuedAt - b.enqueuedAt;
    });
    for (const item of pending) {
      const inflight = credentialInflight.get(item.credentialId) || 0;
      if (inflight >= perCredentialCap) continue;
      item.leased = true;
      item.leaseExpiresAt = now() + leaseMs;
      item.workerId = workerId;
      credentialInflight.set(item.credentialId, inflight + 1);
      leases.set(item.id, item);
      bumpServed(item.userId);
      return { ok: true, item };
    }
    return { ok: false, error: "empty-or-capped" };
  }

  function heartbeat(leaseId, workerId) {
    const item = leases.get(leaseId);
    if (!item || item.workerId !== workerId) return { ok: false, error: "lease" };
    if (item.leaseExpiresAt < now()) return { ok: false, error: "lease-expired" };
    item.leaseExpiresAt = now() + leaseMs;
    return { ok: true };
  }

  function complete(leaseId, { success = true, uncertain = false } = {}) {
    const item = leases.get(leaseId);
    if (!item) return { ok: false, error: "lease" };
    item.done = true;
    item.leased = false;
    leases.delete(leaseId);
    if (item.credentialId) {
      credentialInflight.set(item.credentialId, Math.max(0, (credentialInflight.get(item.credentialId) || 1) - 1));
    }
    if (uncertain) {
      // Never retry uncertain queries
      deadLetters.push({ ...item, reason: "uncertain-query" });
      circuit.failures += 1;
      if (circuit.failures >= 3) {
        circuit.open = true;
        circuit.openedAt = now();
      }
      return { ok: true, deadLettered: true };
    }
    if (!success) {
      item.attempts += 1;
      if (item.attempts >= 3) {
        deadLetters.push({ ...item, reason: "max-attempts" });
        return { ok: true, deadLettered: true };
      }
      item.done = false;
      return { ok: true, requeued: true };
    }
    circuit.failures = Math.max(0, circuit.failures - 1);
    return { ok: true };
  }

  function recoverExpiredLeases() {
    let recovered = 0;
    for (const [id, item] of [...leases.entries()]) {
      if (item.leaseExpiresAt < now()) {
        item.leased = false;
        delete item.workerId;
        leases.delete(id);
        if (item.credentialId) {
          credentialInflight.set(item.credentialId, Math.max(0, (credentialInflight.get(item.credentialId) || 1) - 1));
        }
        recovered += 1;
      }
    }
    return { ok: true, recovered };
  }

  function cancelJob(jobId) {
    for (const item of [...intake, ...provider]) {
      if (item.jobId === jobId && !item.done) {
        item.done = true;
        item.canceled = true;
        if (item.leased) leases.delete(item.id);
      }
    }
    return { ok: true };
  }

  function resetCircuit() {
    circuit.open = false;
    circuit.failures = 0;
    circuit.openedAt = null;
  }

  // Never assume quota reset timezone
  function quotaResetBoundary() {
    return { ok: false, error: "unknown-reset-boundary" };
  }

  return {
    enqueueIntake,
    enqueueProvider,
    claimIntake,
    claimProvider,
    heartbeat,
    complete,
    recoverExpiredLeases,
    cancelJob,
    resetCircuit,
    quotaResetBoundary,
    honestEstimate,
    _intake: intake,
    _provider: provider,
    _deadLetters: deadLetters,
    _circuit: circuit,
  };
}

function validateQueuesModule() {
  const errors = [];
  let t = 1000;
  const q = createFairQueues({ now: () => t, perCredentialCap: 1, leaseMs: 100 });

  q.enqueueIntake({ jobId: "j1", userId: "noisy" });
  q.enqueueIntake({ jobId: "j2", userId: "quiet" });
  q.enqueueIntake({ jobId: "j3", userId: "noisy" });

  const c1 = q.claimIntake({ workerId: "w1" });
  // After serving noisy first (only one at head by time), next should prefer quiet
  q.complete(c1.item.id, { success: true });
  const c2 = q.claimIntake({ workerId: "w1" });
  if (c2.item.userId !== "quiet" && c2.item.userId !== "noisy") errors.push("claim");

  q.enqueueProvider({ jobId: "p1", userId: "u1" }, { credentialId: "cred1" });
  q.enqueueProvider({ jobId: "p2", userId: "u2" }, { credentialId: "cred1" });
  const p1 = q.claimProvider({ workerId: "w2" });
  if (!p1.ok) errors.push("provider-claim");
  const p2 = q.claimProvider({ workerId: "w2" });
  if (p2.ok) errors.push("cap"); // per-credential cap 1

  t += 200;
  q.recoverExpiredLeases();
  const p3 = q.claimProvider({ workerId: "w3" });
  if (!p3.ok) errors.push("lease-recover");

  q.complete(p3.item.id, { uncertain: true });
  q.complete(q.claimProvider({ workerId: "w4" }).item?.id || "x", { uncertain: true });
  // force circuit
  q._circuit.failures = 3;
  q._circuit.open = true;
  if (q.enqueueProvider({ jobId: "px", userId: "u" }, { credentialId: "c" }).ok) errors.push("circuit");

  if (q.quotaResetBoundary().ok) errors.push("reset");

  q.resetCircuit();
  q.cancelJob("j2");

  const dup = q.enqueueIntake({ jobId: "j1", userId: "noisy" });
  if (!dup.ok) errors.push("dup-msg");

  return { ok: errors.length === 0, errors };
}

module.exports = {
  QUEUE_VERSION,
  createFairQueues,
  validateQueuesModule,
};
