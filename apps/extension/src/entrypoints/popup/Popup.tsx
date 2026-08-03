import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";

import { sendShellMessage } from "../../shared/shell-client";

type WorkerState = "checking" | "ready" | "unreachable";

export function Popup() {
  const [worker, setWorker] = useState<WorkerState>("checking");

  const ping = useCallback(async () => {
    setWorker("checking");
    const response = await sendShellMessage("shell/ping");
    setWorker(response.ok ? "ready" : "unreachable");
  }, []);

  useEffect(() => {
    void ping();
  }, [ping]);

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
        <h2>No active check</h2>
        <p className="status">Job history and results open in the workspace.</p>
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
        <button type="button" className="secondary" onClick={() => void ping()}>
          Retry connection
        </button>
      ) : null}
    </main>
  );
}
