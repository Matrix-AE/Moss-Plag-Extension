import { API_ORIGIN, UPLOAD_ORIGIN } from "../../shared/origins";

export function Settings() {
  return (
    <main className="shell shell--page">
      <header className="row">
        <h1>Settings</h1>
        <span className="badge">Side Panel account</span>
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
            <strong>storage</strong>: keeps drafts and active job references on this device only
            (<code>storage.local</code>, never sync).
          </li>
          <li>
            <strong>alarms</strong>: re-checks purge and job status after the service worker is
            suspended.
          </li>
          <li>
            <strong>sidePanel</strong>: hosts the complete comparison workflow beside the browser.
          </li>
        </ol>
      </section>

      <section className="card" aria-labelledby="persistence">
        <h2 id="persistence">What is persisted</h2>
        <p>
          Draft shells keep mode, language, group count, and a random id for at most 24 hours. Active
          jobs keep an opaque id and status; terminal jobs purge within 24 hours. Titles, labels,
          names, paths, hashes, source, and <code>File</code> objects are never written. Provider IDs
          stay masked in memory for vault wiring and are never synced.
        </p>
      </section>

      <section className="card" aria-labelledby="account">
        <h2 id="account">Similarity account</h2>
        <p>
          After purchase, connect your own numeric provider account from the Side Panel Account
          section (ADR-0005B). The ID is never used as extension authentication.
        </p>
      </section>
    </main>
  );
}
