import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";

import { getPersistedState, sendShellMessage } from "../../shared/shell-client";
import type { PersistedState } from "../../shared/state-types";

type WorkerState = "checking" | "ready" | "unreachable";

function summarize(state: PersistedState | null): string {
  if (!state) {
    return "Job history and results open in the workspace.";
  }
  if (state.activeJob) {
    return `Active check ${state.activeJob.jobId.slice(0, 8)}… — ${state.activeJob.status}`;
  }
  if (state.draft) {
    return `Local draft (${state.draft.mode}, ${state.draft.groupCount} groups) ready to resume.`;
  }
  return "No active check. Open the workspace to start.";
}

export function Popup() {
  const [worker, setWorker] = useState<WorkerState>("checking");
  const [state, setState] = useState<PersistedState | null>(null);

  const refresh = useCallback(async () => {
    setWorker("checking");
    const ping = await sendShellMessage("shell/ping");
    if (!ping.ok) {
      setWorker("unreachable");
      return;
    }
    setWorker("ready");
    setState(await getPersistedState());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openWorkspace = useCallback(async () => {
    await sendShellMessage("shell/open-workspace");
    window.close();
  }, []);

  return (
    <main className="shell shell--popup">
      <div className="row">
        <h1>Code Similarity Workflow</h1>
        <span className="badge" role="status">
          {worker === "checking" ? "Checking" : worker === "ready" ? "Ready" : "Reconnecting"}
        </span>
      </div>

      <p>Group submissions in the workspace, then run a similarity check through the hosted relay.</p>

      <div className="card">
        <h2>{state?.activeJob ? "In progress" : state?.draft ? "Draft saved" : "No active check"}</h2>
        <p className="status">{summarize(state)}</p>
      </div>

      <button type="button" onClick={openWorkspace}>
        Open workspace
      </button>

      <button
        type="button"
        className="secondary"
        onClick={() => {
          void browser.runtime.openOptionsPage();
        }}
      >
        Settings
      </button>

      {worker === "unreachable" ? (
        <button type="button" className="secondary" onClick={() => void refresh()}>
          Retry connection
        </button>
      ) : null}
    </main>
  );
}
