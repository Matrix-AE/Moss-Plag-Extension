import { useEffect, useState } from "react";

import { sendShellMessage } from "../../shared/shell-client";

export function Workspace() {
  const [installedAt, setInstalledAt] = useState<number | null>(null);

  useEffect(() => {
    void sendShellMessage("shell/status").then((response) => {
      setInstalledAt(response.ok ? Number(response.payload?.["installedAt"] ?? 0) : null);
    });
  }, []);

  return (
    <main className="shell shell--page">
      <header className="row">
        <h1>Similarity workspace</h1>
        <span className="badge">Shell preview</span>
      </header>

      <p>
        This surface will host file selection, grouping, and results. The shell only proves the
        window, service worker, and storage wiring behave under Manifest V3.
      </p>

      <section className="card" aria-labelledby="next-steps">
        <h2 id="next-steps">Coming next</h2>
        <ol>
          <li>Select submissions and group them into comparison sets.</li>
          <li>Review the check summary and give explicit consent before anything leaves the device.</li>
          <li>Track job progress and open the result reference when the check completes.</li>
        </ol>
      </section>

      <section className="card" aria-labelledby="worker-state">
        <h2 id="worker-state">Service worker</h2>
        <p className="status">
          {installedAt === null
            ? "Waiting for the background worker to answer."
            : `Background worker responded; shell installed at ${new Date(installedAt).toISOString()}.`}
        </p>
      </section>
    </main>
  );
}
