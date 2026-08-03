"use strict";

const MESSAGE_ACTIONS = Object.freeze([
  "shell/ping",
  "shell/open-workspace",
  "shell/status",
  "state/get",
  "state/save-draft",
  "state/discard-draft",
  "state/bind-job",
  "state/update-job",
  "state/purge",
]);

function isMessageAction(value) {
  return MESSAGE_ACTIONS.includes(value);
}

function parseMessage(value) {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "malformed-message" };
  }
  const candidate = value;
  if (typeof candidate.requestId !== "string" || candidate.requestId.length < 1) {
    return { ok: false, error: "malformed-message" };
  }
  if (typeof candidate.action !== "string" || !isMessageAction(candidate.action)) {
    return { ok: false, error: "unknown-action" };
  }

  const action = candidate.action;
  const requestId = candidate.requestId;
  const payload = candidate.payload;

  if (action === "state/save-draft" || action === "state/bind-job" || action === "state/update-job") {
    if (!payload || typeof payload !== "object") {
      return { ok: false, error: "malformed-message" };
    }
  }

  return { ok: true, message: { action, requestId, payload } };
}

function createRouter({ store, openWorkspace }) {
  return async function handleMessage(raw) {
    const parsed = parseMessage(raw);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    const { action, requestId, payload } = parsed.message;

    switch (action) {
      case "shell/ping":
        return { ok: true, action, requestId };
      case "shell/open-workspace":
        if (openWorkspace) {
          await openWorkspace();
        }
        return { ok: true, action, requestId };
      case "shell/status": {
        const loaded = await store.load();
        if (!loaded.ok) {
          return { ok: false, action, requestId, error: "malformed-message" };
        }
        return {
          ok: true,
          action,
          requestId,
          payload: {
            installedAt: loaded.value.shell.installedAt,
            hasDraft: Boolean(loaded.value.draft),
            hasActiveJob: Boolean(loaded.value.activeJob),
          },
        };
      }
      case "state/get": {
        const loaded = await store.load();
        if (!loaded.ok) {
          return { ok: false, action, requestId, error: loaded.code };
        }
        return {
          ok: true,
          action,
          requestId,
          payload: {
            state: loaded.value,
            migrated: loaded.migrated,
            purged: loaded.purged,
          },
        };
      }
      case "state/save-draft": {
        const saved = await store.saveDraft(payload);
        if (!saved.ok) {
          return { ok: false, action, requestId, error: saved.code };
        }
        return { ok: true, action, requestId, payload: { state: saved.value } };
      }
      case "state/discard-draft": {
        const discarded = await store.discardDraft();
        if (!discarded.ok) {
          return { ok: false, action, requestId, error: discarded.code };
        }
        return { ok: true, action, requestId, payload: { state: discarded.value } };
      }
      case "state/bind-job": {
        const bound = await store.bindJob(payload);
        if (!bound.ok) {
          return { ok: false, action, requestId, error: bound.code };
        }
        return {
          ok: true,
          action,
          requestId,
          payload: { state: bound.value, rebound: bound.rebound, duplicated: bound.duplicated },
        };
      }
      case "state/update-job": {
        const updated = await store.updateJob(payload);
        if (!updated.ok) {
          return { ok: false, action, requestId, error: updated.code };
        }
        return { ok: true, action, requestId, payload: { state: updated.value } };
      }
      case "state/purge": {
        const purged = await store.forcePurge();
        if (!purged.ok) {
          return { ok: false, action, requestId, error: purged.code };
        }
        return { ok: true, action, requestId, payload: { state: purged.value, purged: purged.purged } };
      }
      default:
        return { ok: false, error: "unknown-action" };
    }
  };
}

module.exports = { MESSAGE_ACTIONS, isMessageAction, parseMessage, createRouter };
