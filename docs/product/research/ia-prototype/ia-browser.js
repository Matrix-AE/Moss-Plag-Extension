"use strict";

const ia = window.MossIA;
let session = ia.createSession("first-use");

const scenarioSelect = document.getElementById("scenario");
const statusEl = document.getElementById("status");
const frame = document.getElementById("frame");
const frameTitle = document.getElementById("frame-title");
const frameSize = document.getElementById("frame-size");
const frameBody = document.getElementById("frame-body");
const primaryBtn = document.getElementById("primary-btn");
const secondaryBtn = document.getElementById("secondary-btn");
const checklist = document.getElementById("checklist");

for (const id of Object.keys(ia.SCENARIOS)) {
  const option = document.createElement("option");
  option.value = id;
  option.textContent = `${id} (${ia.SCENARIOS[id].wireframe})`;
  scenarioSelect.appendChild(option);
}

for (const item of ia.walkChecklist()) {
  const li = document.createElement("li");
  li.innerHTML = `<input type="checkbox" data-id="${item.id}" /> <span><strong>${item.id}</strong> · ${item.wireframe} · ${item.size.width}×${item.size.height}<br/><span class="meta">entry: ${item.entry} · recovery: ${item.recovery}</span></span>`;
  checklist.appendChild(li);
}

function render() {
  const { scenario, size } = session;
  frame.style.width = `${size.width}px`;
  frame.style.height = `${size.height}px`;
  frameTitle.textContent = `${scenario.wireframe} · ${scenario.surface}`;
  frameSize.textContent = `${size.width}×${size.height}`;
  primaryBtn.textContent = scenario.primaryAction;
  primaryBtn.disabled = scenario.primaryAction === "Working…";

  const rail =
    scenario.surface === "workspace"
      ? `<div class="rail">${ia.STEPS.map((step) => {
          const current = session.step === step ? ' aria-current="step"' : "";
          return `<span${current}>${step}</span>`;
        }).join(" → ")}</div>`
      : "";

  const consent =
    scenario.requiresConsent || session.step === "review"
      ? `<div class="consent">
          <label><input type="checkbox" id="c1" ${session.consentAuthority ? "checked" : ""}/> I have authority to submit these files</label>
          <label><input type="checkbox" id="c2" ${session.consentProcessing ? "checked" : ""}/> I understand files leave this device</label>
        </div>`
      : "";

  const destructive =
    scenario.wireframe === "WF-11"
      ? `<p><button type="button" class="secondary" id="forget">Forget link</button> <span class="warn">Does not revoke provider-hosted content.</span></p>`
      : scenario.localOnly
        ? `<p><button type="button" class="secondary" id="discard">Discard draft</button></p>`
        : "";

  frameBody.innerHTML = `
    ${rail}
    <p>${scenario.body || ""}</p>
    ${scenario.card ? `<div class="card">${scenario.card}</div>` : ""}
    <div class="card">
      <div><strong>Entry</strong>: ${scenario.entry}</div>
      <div><strong>Recovery</strong>: ${scenario.recovery}</div>
      <div><strong>Payment allowed here</strong>: ${scenario.allowsPayment ? "yes (pre-upload)" : "no"}</div>
    </div>
    ${consent}
    ${destructive}
    ${session.step === "paywall" ? `<p class="warn">Files have not been uploaded yet.</p>` : ""}
  `;

  const c1 = document.getElementById("c1");
  const c2 = document.getElementById("c2");
  if (c1 && c2) {
    const sync = () => {
      session.consentAuthority = c1.checked;
      session.consentProcessing = c2.checked;
      primaryBtn.disabled = !(c1.checked && c2.checked);
    };
    c1.addEventListener("change", sync);
    c2.addEventListener("change", sync);
    primaryBtn.disabled = !(c1.checked && c2.checked);
  }

  statusEl.textContent = `Primary “${scenario.primaryAction}” visible. Paywall only after consent.`;
}

scenarioSelect.addEventListener("change", () => {
  session = ia.createSession(scenarioSelect.value);
  const box = checklist.querySelector(`input[data-id="${scenarioSelect.value}"]`);
  if (box) {
    box.checked = true;
  }
  render();
});

document.getElementById("grant").addEventListener("click", () => {
  const result = ia.advance(session, "grant-consent");
  session = result.session;
  statusEl.textContent = "Both consents granted on Review.";
  render();
});

document.getElementById("to-pay").addEventListener("click", () => {
  const result = ia.advance(session, "continue-to-payment");
  if (!result.ok) {
    statusEl.textContent = `Blocked: ${result.code}`;
    return;
  }
  session = result.session;
  scenarioSelect.value = "paywall";
  session = ia.createSession("paywall");
  statusEl.textContent = "Entered paywall. Upload still blocked until pay completes.";
  render();
});

document.getElementById("early-pay").addEventListener("click", () => {
  const result = ia.advance(session, "open-paywall-early");
  statusEl.textContent = `Blocked as expected: ${result.code}`;
});

render();
