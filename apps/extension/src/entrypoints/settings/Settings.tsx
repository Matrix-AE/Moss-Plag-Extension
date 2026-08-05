import { API_ORIGIN, UPLOAD_ORIGIN } from "../../shared/origins";

export function Settings() {
  return (
    <main className="shell shell--page">
      <header className="row">
        <h1>Settings</h1>
        <span className="badge">Popup account</span>
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
            <strong>storage</strong>: keeps drafts, active job references, and local demo entitlement on this device
            only (<code>storage.local</code>, never sync).
          </li>
          <li>
            <strong>alarms</strong>: re-checks purge and job status after the service worker is
            suspended.
          </li>
        </ol>
      </section>

      <section className="card" aria-labelledby="persistence">
        <h2 id="persistence">What is persisted</h2>
        <p>
          Draft shells keep mode, language, group count, and a random id for at most 24 hours. Active
          jobs keep an opaque id and status; terminal jobs purge within 24 hours. Titles, labels,
          names, paths, hashes, source, and <code>File</code> objects are never written. Provider IDs
          stay masked in memory for vault wiring and are never synced. Demo account and remaining-run
          counters are local-only until billing is live.
        </p>
      </section>

      <section className="card" aria-labelledby="account">
        <h2 id="account">Similarity account</h2>
        <p>
          Create or sign in from the toolbar popup, then unlock Pair Check ($15 / 15 runs / max 2
          files). After purchase, complete **Connect Moss User ID** (BYO registration instructions,
          then numeric userid only — ADR-0005B). The ID is never used as extension authentication.
          Sign in with email + password; a verification code is emailed from Matrix AE.
          Paywall purchase is still simulated until Paddle is connected.
        </p>
      </section>
    </main>
  );
}
