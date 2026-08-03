import { API_ORIGIN, UPLOAD_ORIGIN } from "../../shared/origins";

export function Settings() {
  return (
    <main className="shell shell--page">
      <header className="row">
        <h1>Settings</h1>
        <span className="badge">Shell preview</span>
      </header>

      <section className="card" aria-labelledby="connections">
        <h2 id="connections">Network</h2>
        <p>The extension only contacts these origins. Provider transport happens server side.</p>
        <ol>
          <li>{API_ORIGIN}</li>
          <li>{UPLOAD_ORIGIN}</li>
        </ol>
      </section>

      <section className="card" aria-labelledby="permissions">
        <h2 id="permissions">Permissions in use</h2>
        <ol>
          <li>
            <strong>storage</strong>: keeps drafts and active job references on this device only.
          </li>
          <li>
            <strong>alarms</strong>: re-checks job status after the service worker is suspended.
          </li>
        </ol>
      </section>

      <section className="card" aria-labelledby="account">
        <h2 id="account">Similarity account</h2>
        <p>
          After purchase you connect your own provider account (ADR-0005B). Nothing is stored here
          yet; the connection form ships with the account flow.
        </p>
      </section>
    </main>
  );
}
