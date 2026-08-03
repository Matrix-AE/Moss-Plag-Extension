import { useCallback, useEffect, useState } from "react";

import { sendShellMessage } from "../../shared/shell-client";
import type { PersistedState } from "../../shared/state-types";

const STAGES = [
  "Select",
  "Group",
  "Configure",
  "Review",
  "Paywall",
  "Progress",
  "Result",
] as const;

export function Workspace() {
  const [state, setState] = useState<PersistedState | null>(null);
  const [note, setNote] = useState("Loading recoverable state…");
  const [stageIndex, setStageIndex] = useState(0);
  const [ownership, setOwnership] = useState(false);
  const [sensitiveLink, setSensitiveLink] = useState(false);
  const [entitled, setEntitled] = useState(false);
  const [gateMessage, setGateMessage] = useState(
    "Local preview is free through Review. Upload requires purchase and both consents.",
  );

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
      setStageIndex(5);
    } else if (next?.draft) {
      setNote(`Recovered draft ${next.draft.draftId} (${next.draft.mode}). Reselect files after restart.`);
      setStageIndex(0);
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
    setStageIndex(0);
    setOwnership(false);
    setSensitiveLink(false);
    await refresh();
  }, [refresh]);

  const goReview = () => {
    setStageIndex(3);
    setGateMessage("Review the groups. Payment appears only after both consents.");
  };

  const tryPaywall = () => {
    if (!ownership || !sensitiveLink) {
      setGateMessage("Paywall blocked — grant both consents on Review first.");
      return;
    }
    setStageIndex(4);
    setGateMessage("Paywall — files have not been uploaded yet.");
  };

  const tryStartJob = () => {
    if (!entitled) {
      setGateMessage("Entitlement required before upload/job creation.");
      return;
    }
    if (!ownership || !sensitiveLink) {
      setGateMessage("Consents required before upload.");
      return;
    }
    setStageIndex(5);
    setGateMessage("Job started locally in the progress phase. No fabricated percent is shown.");
  };

  return (
    <div className="shell shell--page">
      <header className="row" role="banner">
        <h1>Similarity workspace</h1>
        <span className="badge" role="status">
          {entitled ? "Entitled" : "Local preview"}
        </span>
      </header>

      <nav className="rail" aria-label="Workspace steps" role="navigation">
        {STAGES.map((step, index) => (
          <span key={step} aria-current={index === stageIndex ? "step" : undefined}>
            {step}
          </span>
        ))}
      </nav>

      <main role="main">
        <p>
          Free synthetic/local preview runs through Review. Ordinary <code>File</code> objects do not
          survive restart — reselect files after reopen. Only approved 24-hour draft fields persist.
          Upload and job creation stay behind entitlement plus consent. Information architecture
          keeps payment on Review → Paywall only.
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
                Mode: {state.draft.mode}, groups: {state.draft.groupCount}, language:{" "}
                {state.draft.language}
              </li>
            </ol>
          ) : null}
        </section>

        <section className="card" aria-labelledby="review-gate">
          <h2 id="review-gate">Review consents</h2>
          <p className="status">{gateMessage}</p>
          <label className="row">
            <input
              type="checkbox"
              checked={ownership}
              onChange={(event) => setOwnership(event.target.checked)}
            />
            <span>I confirm I have the right to submit these files.</span>
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={sensitiveLink}
              onChange={(event) => setSensitiveLink(event.target.checked)}
            />
            <span>I understand the report link is sensitive like a password.</span>
          </label>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="secondary" onClick={goReview}>
              Go to Review
            </button>
            <button type="button" className="secondary" onClick={tryPaywall}>
              Open paywall
            </button>
            <button type="button" className="secondary" onClick={() => setEntitled(true)}>
              Simulate purchase
            </button>
            <button type="button" onClick={tryStartJob}>
              Start job
            </button>
          </div>
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
      <footer role="contentinfo" className="row" style={{ marginTop: 16 }}>
        <button type="button" onClick={goReview}>
          Continue
        </button>
        <button type="button" className="secondary" onClick={() => void discard()}>
          Discard draft
        </button>
      </footer>
    </div>
  );
}
