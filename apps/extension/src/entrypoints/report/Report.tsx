import * as runLifecycle from "@moss/ui/run-lifecycle";

function readRef(): string {
  const hash = window.location.hash.replace(/^#/, "");
  const value = new URLSearchParams(hash).get("ref");
  return value && /^[a-z0-9-]{4,64}$/i.test(value) ? value : "";
}

export function Report() {
  const reference = readRef();

  return (
    <main className="shell shell--page">
      <header className="row">
        <h1>Local demo similarity report</h1>
        <span className="badge badge--info">{runLifecycle.LOCAL_DEMO_LABEL}</span>
      </header>

      <section className="card" aria-labelledby="demo-notice">
        <h2 id="demo-notice">What this page is</h2>
        <p className="status--notice">{runLifecycle.LOCAL_DEMO_NOTICE}</p>
        <p>
          The popup produced this page so the full progress → result flow can be exercised before the
          hosted relay is available. It contains no similarity measurements, because no comparison was
          performed.
        </p>
      </section>

      <section className="card" aria-labelledby="demo-run">
        <h2 id="demo-run">Run reference</h2>
        {reference ? (
          <p>
            <code>{reference}</code>
          </p>
        ) : (
          <p>
            No run reference was supplied in the link. Open the report from the popup result card to
            see the reference for a specific run.
          </p>
        )}
        <p>
          The reference is opaque: it is not a provider job id, and it cannot be used to look anything
          up outside this browser profile.
        </p>
      </section>

      <section className="card" aria-labelledby="demo-next">
        <h2 id="demo-next">When the hosted relay is live</h2>
        <ul>
          <li>
            A real run returns a provider-hosted report link. That link is a bearer secret — anyone
            holding the URL can view the submitted code.
          </li>
          <li>
            Similarity highlights support human review. They are not a plagiarism verdict, and matched
            regions still need judgment in context.
          </li>
          <li>
            This local link works only in this browser profile while the extension is installed, so it
            is not a substitute for a MOSS result.
          </li>
        </ul>
      </section>
    </main>
  );
}
