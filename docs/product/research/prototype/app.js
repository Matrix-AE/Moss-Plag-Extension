(function runResearchPrototype() {
  "use strict";

  const model = globalThis.MossResearchPrototype;
  if (!model) {
    throw new Error("Research prototype model failed to load.");
  }

  const root = document.querySelector("#prototype-root");
  const announcer = document.querySelector("#announcer");
  const facilitatorPanel = document.querySelector("#facilitator-panel");
  const scenarioSelect = document.querySelector("#scenario-select");
  const parameters = new URLSearchParams(globalThis.location.search);
  const requestedScenario = parameters.get("scenario") || "empty";
  const facilitatorMode = parameters.get("facilitator") === "1";
  let state = model.createScenario(
    model.SCENARIO_IDS.includes(requestedScenario) ? requestedScenario : "empty",
  );

  facilitatorPanel.hidden = !facilitatorMode;
  scenarioSelect.value = state.scenarioId;

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatBytes(bytes) {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  function announce(message) {
    announcer.textContent = "";
    globalThis.requestAnimationFrame(() => {
      announcer.textContent = message;
    });
  }

  function currentStep(screen) {
    if (["pricing", "error"].includes(screen)) {
      return screen === "pricing" ? "review" : "processing";
    }
    return model.SCREEN_ORDER.includes(screen) ? screen : "group";
  }

  function renderSteps() {
    const steps = [
      ["group", "Group code"],
      ["configure", "Configure"],
      ["review", "Review & consent"],
      ["processing", "Progress"],
      ["result", "Result"],
    ];
    const selected = currentStep(state.screen);
    return `
      <ol class="step-list" aria-label="Comparison progress">
        ${steps
          .map(
            ([id, label], index) => `
              <li${selected === id ? ' aria-current="step"' : ""}>
                <span class="step-number" aria-hidden="true">${index + 1}</span>
                <span>${escapeHtml(label)}</span>
              </li>
            `,
          )
          .join("")}
      </ol>
    `;
  }

  function renderShell(content) {
    return `
      <div class="workspace-shell" data-scenario="${escapeHtml(state.scenarioId)}" data-screen="${escapeHtml(state.screen)}">
        <aside class="sidebar" aria-label="Workflow steps">
          <p class="eyebrow">New check</p>
          <h2>${escapeHtml(state.title || "Untitled comparison")}</h2>
          ${renderSteps()}
          <div class="sidebar-note">
            This research build uses filenames and counts only. It cannot read, store, or submit source code.
          </div>
        </aside>
        <section class="workspace">
          ${content}
        </section>
      </div>
    `;
  }

  function renderHeading(eyebrow, title, description) {
    return `
      <header class="page-heading">
        <div>
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(description)}</p>
        </div>
      </header>
    `;
  }

  function renderSummary() {
    const summary = model.summarize(state);
    return `
      <div class="summary-strip" aria-label="Comparison summary">
        <div><strong>${summary.groupCount}</strong><span>Submission groups</span></div>
        <div><strong>${summary.fileCount}</strong><span>Source files</span></div>
        <div><strong>${formatBytes(summary.totalBytes)}</strong><span>Total selected size</span></div>
        <div><strong>${summary.languages.length || "—"}</strong><span>Detected languages</span></div>
      </div>
    `;
  }

  function renderFiles(entry) {
    if (entry.files.length === 0) {
      return `
        <div class="empty-group">
          <p>No source files yet.</p>
          <button type="button" data-action="add-sample-file" data-group="${escapeHtml(entry.id)}">
            Add a synthetic source file
          </button>
        </div>
      `;
    }
    return `
      <ul class="file-list" aria-label="Files in ${escapeHtml(entry.label)}">
        ${entry.files
          .map(
            (candidate) => `
              <li class="file-row${candidate.issue ? " invalid" : ""}">
                <div>
                  <strong>${escapeHtml(candidate.name)}</strong>
                  <small>${escapeHtml(candidate.virtualPath)}</small>
                </div>
                <span>${formatBytes(candidate.bytes)}</span>
              </li>
            `,
          )
          .join("")}
      </ul>
    `;
  }

  function renderGroups() {
    return `
      <div class="group-grid">
        ${state.groups
          .map(
            (entry, index) => `
              <article class="group-card" aria-labelledby="group-${escapeHtml(entry.id)}">
                <header class="group-header">
                  <div>
                    <h3 id="group-${escapeHtml(entry.id)}">${escapeHtml(entry.label)}</h3>
                    <span>Logical submission ${index + 1} · ${entry.files.length} file${entry.files.length === 1 ? "" : "s"}</span>
                  </div>
                </header>
                ${renderFiles(entry)}
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderErrors(errors) {
    if (errors.length === 0) {
      return '<div class="notice success" role="status">This local draft is ready to configure. Nothing has been uploaded.</div>';
    }
    const unique = [...new Map(errors.map((error) => [error.code, error])).values()];
    return `
      <ul class="error-list" aria-label="Items to fix">
        ${unique.map((error) => `<li>${escapeHtml(error.message)}</li>`).join("")}
      </ul>
    `;
  }

  function renderGroupScreen() {
    const errors = model.validateDraft(state);
    const ready = model.canReview(state);
    return renderShell(`
      ${renderHeading(
        "Step 1 of 5",
        "What should be compared?",
        "Keep each work or project in its own submission group. A project can contain several source files.",
      )}
      <div class="mode-switch" role="group" aria-label="Comparison mode">
        <button type="button" data-action="set-mode" data-mode="pair" aria-pressed="${state.mode === "pair"}">Pair</button>
        <button type="button" data-action="set-mode" data-mode="batch" aria-pressed="${state.mode === "batch"}">Batch</button>
      </div>
      ${renderSummary()}
      ${renderGroups()}
      ${renderErrors(errors)}
      <div class="actions">
        <button type="button" class="button-quiet" data-action="load-projects">Load two synthetic projects</button>
        <span class="spacer"></span>
        <button type="button" class="button-primary" data-action="continue"${ready ? "" : " disabled"}>Continue to configuration</button>
      </div>
    `);
  }

  function renderConfigureScreen() {
    const summary = model.summarize(state);
    return renderShell(`
      ${renderHeading(
        "Step 2 of 5",
        "Confirm analysis settings",
        "One supported language is used for the entire comparison. Detection is a suggestion, never a silent choice.",
      )}
      ${renderSummary()}
      <div class="panel">
        <label class="field" for="language-select">
          Source-code language
          <select id="language-select">
            <option value="">Choose a language</option>
            ${model.SUPPORTED_LANGUAGES.map(
              (language) => `<option value="${language}"${state.selectedLanguage === language ? " selected" : ""}>${escapeHtml(language)}</option>`,
            ).join("")}
          </select>
          <span class="help-text">Research subset only; Prompt 004 must verify the provider’s current language registry.</span>
        </label>
      </div>
      <div class="panel">
        <h2>Optional base code</h2>
        <p class="help-text">
          Shared starter code would be listed separately and would not count as a submission. Provider-supported handling cannot guarantee that every expected match is removed.
        </p>
        <button type="button" disabled>Choose base code (not active in prototype)</button>
      </div>
      <div class="actions">
        <button type="button" class="button-quiet" data-action="back">Back</button>
        <span class="spacer"></span>
        <button type="button" class="button-primary" data-action="continue"${state.selectedLanguage ? "" : " disabled"}>Review comparison</button>
      </div>
    `);
  }

  function renderReviewScreen() {
    const summary = model.summarize(state);
    const canAttempt =
      model.canReview(state) && state.authorityConfirmed && state.processingConfirmed;
    return renderShell(`
      ${renderHeading(
        "Step 3 of 5",
        "Review before anything leaves your device",
        "Confirm this exact corpus and the external processing disclosure. Changing files, groups, language, or provider resets confirmation.",
      )}
      ${renderSummary()}
      <div class="panel">
        <h2>What would be sent</h2>
        <p>${summary.groupCount} logical submissions · ${summary.fileCount} source files · ${formatBytes(summary.totalBytes)} · ${escapeHtml(state.selectedLanguage || "No language")}</p>
        <p class="help-text">This research prototype never sends these synthetic entries.</p>
      </div>
      <div class="notice warning">
        After review and consent, source code would be sent to an external similarity provider. A result link may allow anyone holding it to view submitted code. Similarity is not proof of plagiarism, intent, or misconduct.
      </div>
      <div class="choice-grid">
        <label class="choice-card">
          <input type="checkbox" data-consent="authority"${state.authorityConfirmed ? " checked" : ""}>
          <span>
            <strong>I have authority for this exact corpus</strong>
            <span>I own or am explicitly authorized to submit every listed file. No minor-authored or institution-managed data is included.</span>
          </span>
        </label>
        <label class="choice-card">
          <input type="checkbox" data-consent="processing"${state.processingConfirmed ? " checked" : ""}>
          <span>
            <strong>I understand the external processing</strong>
            <span>Code would leave this device, and the provider-hosted report link would be a sensitive bearer secret.</span>
          </span>
        </label>
      </div>
      ${state.notice ? `<div class="notice warning" role="alert">${escapeHtml(state.notice)}</div>` : ""}
      <div class="actions">
        <button type="button" class="button-quiet" data-action="back">Back</button>
        <button type="button" data-action="show-pricing">Review $15 research concept</button>
        <span class="spacer"></span>
        <button type="button" class="button-primary" data-action="submit"${canAttempt ? "" : " disabled"}>Submit synthetic check</button>
      </div>
    `);
  }

  function renderProcessingScreen() {
    return renderShell(`
      ${renderHeading(
        "Step 4 of 5",
        "Waiting for a provider result",
        "Progress labels represent confirmed states only. This prototype does not estimate a percentage or contact a provider.",
      )}
      <div class="panel" role="status" aria-live="polite">
        <p class="eyebrow">Synthetic stage</p>
        <h2>Waiting for similarity analysis</h2>
        <div class="progress-track" aria-hidden="true"><span></span></div>
        <p class="help-text">Uploading → validating → queued → submitting → waiting → ready</p>
      </div>
      ${state.notice ? `<div class="notice success">${escapeHtml(state.notice)}</div>` : ""}
      <div class="actions">
        <button type="button" class="button-primary" data-action="complete">Complete synthetic job</button>
      </div>
    `);
  }

  function renderErrorScreen() {
    return renderShell(`
      ${renderHeading(
        "Recovery state",
        "The result is not known yet",
        "A timeout is not the same as no matches. Ambiguous submissions must not be retried until status is safe.",
      )}
      <div class="notice warning" role="alert">${escapeHtml(state.notice || "The provider outcome is unknown.")}</div>
      <div class="panel">
        <h2>Safe next action</h2>
        <p>Keep this job identity, check its latest confirmed state, and retry only if the product confirms that no provider submission occurred.</p>
      </div>
      <div class="actions">
        <button type="button" data-action="return-review">Return to review</button>
        <button type="button" class="button-primary" data-action="check-status">Check synthetic status</button>
      </div>
    `);
  }

  function renderPricingScreen() {
    return renderShell(`
      ${renderHeading(
        "Research concept — not an offer",
        "Would this workflow be worth a one-time purchase?",
        "Pricing is shown last to avoid biasing workflow feedback. No checkout exists and no commercial provider use is authorized.",
      )}
      <article class="price-card" aria-labelledby="price-title">
        <p class="eyebrow">Hypothesis only</p>
        <h2 id="price-title">Personal workflow entitlement</h2>
        <p class="price">$15 <small>one-time concept</small></p>
        <ul class="feature-list">
          <li>Pair and multi-project grouping workflow</li>
          <li>Local draft review and responsible result guidance</li>
          <li>Core purchased feature set on the approved device count</li>
        </ul>
        <div class="notice warning">
          Provider access, numeric submission allowance, devices, updates, refunds, hosted-service period, and shutdown remedy are not approved yet. This card cannot measure final willingness to pay until Prompt 006 fixes those terms.
        </div>
      </article>
      ${state.notice ? `<div class="notice" role="status">${escapeHtml(state.notice)}</div>` : ""}
      <div class="actions" aria-label="Research response">
        <button type="button" data-price-response="buy">Potentially worth $15</button>
        <button type="button" data-price-response="current">Keep my current method</button>
        <button type="button" data-price-response="none">I would not run this comparison</button>
        <span class="spacer"></span>
        <button type="button" class="button-primary" data-action="return-review">Return to review</button>
      </div>
    `);
  }

  function renderResultScreen() {
    const result = state.result || model.createScenario("result").result;
    return renderShell(`
      ${renderHeading(
        "Step 5 of 5",
        "Your similarity report link is ready",
        "The provider-hosted report supports human review. It does not determine plagiarism, intent, or misconduct.",
      )}
      <article class="result-card" aria-labelledby="result-title">
        <p class="eyebrow">Synthetic result</p>
        <h2 id="result-title">Review the provider report deliberately</h2>
        <p class="result-link-preview">${escapeHtml(result.reportUrl)}</p>
        <div class="notice warning">
          Anyone with this report link may be able to view submitted code. Opening or copying it may save the URL in browser history, sync, or the clipboard.
        </div>
        <p class="help-text">${escapeHtml(result.availabilityLabel)}. The provider may remove a real report earlier or later.</p>
      </article>
      ${state.notice ? `<div class="notice success" role="status">${escapeHtml(state.notice)}</div>` : ""}
      <div class="actions">
        <button type="button" data-action="forget-link">Forget saved link</button>
        <span class="spacer"></span>
        <button type="button" data-action="copy-result">Copy synthetic link</button>
        <button type="button" class="button-primary" data-action="open-result">Open synthetic report</button>
      </div>
    `);
  }

  function render() {
    const screens = {
      configure: renderConfigureScreen,
      error: renderErrorScreen,
      group: renderGroupScreen,
      pricing: renderPricingScreen,
      processing: renderProcessingScreen,
      result: renderResultScreen,
      review: renderReviewScreen,
    };
    root.innerHTML = (screens[state.screen] || renderGroupScreen)();
  }

  function resetConsents() {
    state.authorityConfirmed = false;
    state.processingConfirmed = false;
  }

  function loadScenario(id) {
    state = model.createScenario(id);
    scenarioSelect.value = id;
    const nextParameters = new URLSearchParams(globalThis.location.search);
    nextParameters.set("scenario", id);
    globalThis.history.replaceState(null, "", `${globalThis.location.pathname}?${nextParameters.toString()}`);
    render();
    announce(`Loaded ${id.replaceAll("-", " ")} research scenario.`);
  }

  scenarioSelect.addEventListener("change", (event) => {
    loadScenario(event.target.value);
  });

  root.addEventListener("change", (event) => {
    if (event.target.matches("#language-select")) {
      state.selectedLanguage = event.target.value || null;
      resetConsents();
      render();
      announce(state.selectedLanguage ? `Language set to ${state.selectedLanguage}.` : "Language cleared.");
      return;
    }
    if (event.target.matches('[data-consent="authority"]')) {
      state.authorityConfirmed = event.target.checked;
      render();
      announce(event.target.checked ? "Authority confirmed for this synthetic corpus." : "Authority confirmation removed.");
      return;
    }
    if (event.target.matches('[data-consent="processing"]')) {
      state.processingConfirmed = event.target.checked;
      render();
      announce(event.target.checked ? "External processing acknowledged." : "Processing acknowledgement removed.");
    }
  });

  root.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    const priceResponse = button.dataset.priceResponse;
    if (priceResponse) {
      const responseLabels = {
        buy: "Potential $15 interest recorded only in this screen.",
        current: "Current-method preference recorded only in this screen.",
        none: "No-comparison preference recorded only in this screen.",
      };
      state.notice = `${responseLabels[priceResponse]} The response is not stored or transmitted.`;
      render();
      announce(state.notice);
      return;
    }

    const action = button.dataset.action;
    if (!action) {
      return;
    }

    if (action === "set-mode") {
      state.mode = button.dataset.mode;
      resetConsents();
      render();
      announce(`${state.mode} mode selected.`);
      return;
    }
    if (action === "add-sample-file") {
      const replacement = model.createScenario("two-files");
      const targetIndex = state.groups.findIndex((entry) => entry.id === button.dataset.group);
      if (targetIndex >= 0) {
        state.groups[targetIndex].files = replacement.groups[targetIndex].files;
      }
      state.selectedLanguage = "python";
      resetConsents();
      render();
      announce("Synthetic Python file added. Nothing was read from your device.");
      return;
    }
    if (action === "load-projects") {
      loadScenario("two-projects");
      return;
    }
    if (action === "continue") {
      if (state.screen === "group" && model.canReview(state)) {
        state.screen = "configure";
      } else if (state.screen === "configure" && state.selectedLanguage) {
        state.screen = "review";
      }
      state.notice = null;
      render();
      document.querySelector("#prototype-main").focus();
      return;
    }
    if (action === "back") {
      state.screen = state.screen === "review" ? "configure" : "group";
      state.notice = null;
      render();
      return;
    }
    if (action === "show-pricing") {
      state.screen = "pricing";
      state.notice = "Research concept only. Nothing is for sale and exact service limits are not approved.";
      render();
      return;
    }
    if (action === "return-review") {
      state.screen = "review";
      state.notice = null;
      render();
      return;
    }
    if (action === "submit") {
      state = model.submit(state);
      render();
      announce(state.notice || "Synthetic submission state changed.");
      return;
    }
    if (action === "check-status") {
      state.notice = "Status is still unknown in this scenario. A retry remains blocked.";
      render();
      announce(state.notice);
      return;
    }
    if (action === "complete") {
      const completed = model.createScenario("result");
      state.screen = "result";
      state.result = completed.result;
      state.notice = "Synthetic completion only. No provider request occurred.";
      render();
      announce("Synthetic similarity report link is ready.");
      return;
    }
    if (action === "copy-result") {
      state.notice = "Copy simulated. The synthetic link was not placed on the clipboard.";
      render();
      announce(state.notice);
      return;
    }
    if (action === "open-result") {
      state.notice = "Open simulated. No browser navigation or provider request occurred.";
      render();
      announce(state.notice);
      return;
    }
    if (action === "forget-link") {
      state.result = null;
      state.notice = "Saved synthetic URL forgotten. This action would not revoke a provider report or erase external copies.";
      render();
      announce(state.notice);
    }
  });

  render();
})();
