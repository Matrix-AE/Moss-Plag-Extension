"use strict";

(function () {
  const brand = window.MossBrand;
  let theme = "dark";

  const contrastBody = document.getElementById("contrast-body");
  const neonStatus = document.getElementById("neon-status");
  const toggle = document.getElementById("theme-toggle");

  function applyTheme(next) {
    theme = next;
    const colors = brand.PALETTE[theme];
    const root = document.documentElement.style;
    root.setProperty("--surface", colors.surface);
    root.setProperty("--surface-muted", colors.surfaceMuted);
    root.setProperty("--border", colors.border);
    root.setProperty("--text", colors.text);
    root.setProperty("--text-muted", colors.textMuted);
    root.setProperty("--accent", colors.accent);
    root.setProperty("--accent-text", colors.accentText);
    root.setProperty("--focus", colors.focus);
    document.getElementById("pill-info").style.color = colors.info;
    document.getElementById("pill-caution").style.color = colors.caution;
    toggle.textContent = theme === "dark" ? "Switch to light" : "Switch to dark";
    toggle.dataset.theme = theme;
    renderContrast();
  }

  function renderContrast() {
    const rows = brand.checkContrast(theme);
    const colors = brand.PALETTE[theme];
    contrastBody.innerHTML = "";
    for (const row of rows) {
      const target = brand.CONTRAST_TARGETS.find((entry) => entry.name === row.name);
      const tr = document.createElement("tr");
      tr.dataset.pass = String(row.pass);

      const label = document.createElement("td");
      const chip = document.createElement("span");
      chip.className = "swatch";
      chip.style.background = colors[target.fg];
      label.append(chip, document.createTextNode(row.name));

      const ratio = document.createElement("td");
      ratio.textContent = row.ratio.toFixed(2);

      const min = document.createElement("td");
      min.textContent = `${row.min}:1`;

      const result = document.createElement("td");
      result.className = row.pass ? "pass" : "fail";
      result.textContent = row.pass ? "pass" : "fail";

      tr.append(label, ratio, min, result);
      contrastBody.append(tr);
    }
    const neon = brand.checkNeon();
    neonStatus.textContent = neon.ok
      ? "No channel-blown neon values in either theme."
      : `Neon values present: ${neon.offenders.map((o) => `${o.theme}.${o.name}`).join(", ")}`;
    neonStatus.className = neon.ok ? "sub pass" : "sub fail";
  }

  function fill(id, items) {
    const list = document.getElementById(id);
    list.innerHTML = "";
    for (const item of items) {
      const li = document.createElement("li");
      li.textContent = item;
      list.append(li);
    }
  }

  document.getElementById("mood").textContent = brand.MOOD.statement;
  fill(
    "shape-list",
    Object.entries(brand.SHAPE_LANGUAGE).map(([key, value]) => `${key}: ${value}`),
  );
  fill(
    "voice-list",
    brand.VOICE.microcopy.map((entry) => `${entry.surface}: “${entry.text}”`),
  );
  fill("anti-list", brand.MOOD.antiKeywords);

  toggle.addEventListener("click", () => applyTheme(theme === "dark" ? "light" : "dark"));
  applyTheme(theme);
})();
