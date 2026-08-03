"use strict";

(function () {
  const POPUP_HTML = `
    <div class="shell" data-density="compact">
      <h1>Popup</h1>
      <p>No active check. Open the workspace to start.</p>
      <div class="card">
        <div class="row">
          <span>No active job</span>
          <span class="badge badge--info">Idle</span>
        </div>
      </div>
      <button class="primary" type="button">Open workspace</button>
    </div>
  `;

  const WORKSPACE_HTML = `
    <div class="shell shell--page" data-density="comfortable">
      <h1>Workspace</h1>
      <div class="rail" aria-label="Steps">
        <span>Select</span>
        <span aria-current="step">Group</span>
        <span>Review</span>
        <span>Result</span>
      </div>
      <p>Review these groups before anything leaves this device.</p>
      <div class="card">
        <div class="row">
          <span>2 groups ready</span>
          <span class="badge badge--caution">Needs review</span>
        </div>
      </div>
      <div class="card">
        <div class="row">
          <span>Last job</span>
          <span class="badge badge--danger">Failed</span>
        </div>
      </div>
      <div class="card">
        <div class="row">
          <span>Report</span>
          <span class="badge badge--success">Ready</span>
        </div>
      </div>
      <div class="row">
        <button class="primary" type="button">Continue</button>
        <button class="secondary" type="button">Discard draft</button>
      </div>
    </div>
  `;

  const VIEWPORTS = {
    popup: { width: 320, height: 520, specimen: "popup", html: POPUP_HTML },
    workspace: { width: 880, height: 720, specimen: "workspace", html: WORKSPACE_HTML },
  };
  const ZOOMS = [1, 1.25, 1.5];

  const themeSelect = document.getElementById("theme");
  const viewportSelect = document.getElementById("viewport");
  const zoomSelect = document.getElementById("zoom");
  const frame = document.getElementById("frame");
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const matrixBody = document.getElementById("matrix-body");

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function renderSpecimen() {
    const vp = VIEWPORTS[viewportSelect.value];
    const zoom = Number(zoomSelect.value);
    frame.dataset.specimen = vp.specimen;
    frame.innerHTML = vp.html;
    frame.style.transform = `scale(${zoom})`;
    stage.dataset.viewport = viewportSelect.value;
    status.textContent = `${vp.specimen} · ${vp.width}×${vp.height} @ ${Math.round(zoom * 100)}% · theme ${themeSelect.value}`;
    status.dataset.viewport = viewportSelect.value;
    status.dataset.zoom = String(zoom);
    status.dataset.theme = themeSelect.value;
  }

  function buildMatrix() {
    matrixBody.innerHTML = "";
    for (const [name, vp] of Object.entries(VIEWPORTS)) {
      const tr = document.createElement("tr");
      const label = document.createElement("td");
      label.textContent = `${name} ${vp.width}×${vp.height}`;
      tr.append(label);
      for (const zoom of ZOOMS) {
        const td = document.createElement("td");
        td.dataset.viewport = name;
        td.dataset.zoom = String(zoom);
        td.dataset.ok = "true";
        td.textContent = `ready · scale ${zoom}`;
        tr.append(td);
      }
      matrixBody.append(tr);
    }
  }

  themeSelect.addEventListener("change", () => {
    applyTheme(themeSelect.value);
    renderSpecimen();
  });
  viewportSelect.addEventListener("change", renderSpecimen);
  zoomSelect.addEventListener("change", renderSpecimen);

  applyTheme(themeSelect.value);
  buildMatrix();
  renderSpecimen();

  window.MossTokenSpecimens = {
    VIEWPORTS,
    ZOOMS,
    current() {
      return {
        theme: themeSelect.value,
        viewport: viewportSelect.value,
        zoom: Number(zoomSelect.value),
      };
    },
  };
})();
