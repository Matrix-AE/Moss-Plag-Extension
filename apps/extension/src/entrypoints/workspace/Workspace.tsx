import { useCallback, useEffect, useState } from "react";

import { sendShellMessage } from "../../shared/shell-client";
import type { PersistedState } from "../../shared/state-types";

export function Workspace() {
  const [state, setState] = useState<PersistedState | null>(null);
  const [note, setNote] = useState("Loading recoverable state…");

  const refresh = useCallback(async () => {
    const response = await sendShellMessage("state/get");
    if (!response.ok) {
      setNote("Waiting for the background worker to answer.");
      setState(null);
      return;
    }
    const next = (response.payload?.["state"] as PersistedState) ?? null;
    setState(next);
    if (response.payload?.["migrated"]) {
      setNote("Storage migrated to the current schema.");
    } else if (Array.isArray(response.payload?.["purged"]) && (response.payload["purged"] as unknown[]).length) {
      setNote("Expired draft or job references were purged.");
    } else if (next?.activeJob) {
      setNote(`Recovered active job ${next.activeJob.jobId} (${next.activeJob.status}).`);
    } else if (next?.draft) {
      setNote(`Recovered draft ${next.draft.draftId} (${next.draft.mode}).`);
    } else {
      setNote("No draft or active job on this device.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const seedDemoDraft = useCallback(async () => {
    await sendShellMessage("state/save-draft", {
      draftId: crypto.randomUUID(),
      mode: "pair",
      language: "python",
      groupCount: 2,
      flags: { includeBaseCode: false },
    });
    await refresh();
  }, [refresh]);

  const discard = useCallback(async () => {
    await sendShellMessage("state/discard-draft");
    await refresh();
  }, [refresh]);

  return (
    <main className="shell shell--page">
      <header className="row">
        <h1>Similarity workspace</h1>
        <span className="badge">Shell + state</span>
      </header>

      <nav className="rail" aria-label="Workspace steps">
        {[
          "Select",
          "Group",
          "Configure",
          "Review",
          "Paywall",
          "Progress",
          "Result",
        ].map((step, index) => (
          <span key={step} aria-current={index === 0 ? "step" : undefined}>
            {step}
          </span>
        ))}
      </nav>

      <p>
        File selection and grouping land next. This surface already recovers drafts and active opaque
        job ids from <code>storage.local</code> after the popup closes or the service worker suspends.
        Information architecture (Prompt 025) keeps payment on Review → Paywall only.
      </p>

      <section className="card" aria-labelledby="recoverable">
        <h2 id="recoverable">Recoverable state</h2>
        <p className="status">{note}</p>
        {state?.activeJob ? (
          <ol>
            <li>Job id: {state.activeJob.jobId}</li>
            <li>Status: {state.activeJob.status}</li>
            <li>Idempotency key: {state.activeJob.submissionIdempotencyKey}</li>
          </ol>
        ) : null}
        {state?.draft ? (
          <ol>
            <li>Draft id: {state.draft.draftId}</li>
            <li>
              Mode: {state.draft.mode}, groups: {state.draft.groupCount}, language: {state.draft.language}
            </li>
          </ol>
        ) : null}
      </section>

      <section className="card" aria-labelledby="demo-controls">
        <h2 id="demo-controls">Local draft controls</h2>
        <p>Demo only — no titles, paths, hashes, or source are persisted.</p>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" onClick={() => void seedDemoDraft()}>
            Save demo draft
          </button>
          <button type="button" className="secondary" onClick={() => void discard()}>
            Discard draft
          </button>
          <button type="button" className="secondary" onClick={() => void refresh()}>
            Reload state
          </button>
        </div>
      </section>
    </main>
  );
}
