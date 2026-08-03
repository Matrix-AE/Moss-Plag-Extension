"use strict";

/**
 * Extension shell layout contracts (Prompt 031).
 * Popup and workspace share identity chrome with density-specific navigation.
 */

const SHELL_VERSION = 1;

const VIEWPORTS = Object.freeze({
  popup: Object.freeze({ width: 320, height: 520, density: "compact", nav: "summary" }),
  workspace: Object.freeze({ width: 880, height: 720, density: "comfortable", nav: "rail" }),
  settings: Object.freeze({ width: 880, height: 720, density: "comfortable", nav: "sections" }),
});

const LANDMARKS = Object.freeze(["banner", "main", "contentinfo", "navigation"]);

function buildShell({
  surface = "popup",
  title = "Code Similarity Workflow",
  context = "",
  licenseState = "unknown",
  connectionState = "idle",
  offline = false,
  bodyHtml = "",
  stickyActionsHtml = "",
}) {
  const vp = VIEWPORTS[surface];
  if (!vp) return { ok: false, error: `Unknown surface: ${surface}` };

  const header = `
<header class="shell-header" role="banner">
  <div class="row">
    <h1 class="type-title">${escape(title)}</h1>
    <span class="badge type-caption" role="status" data-license="${escape(licenseState)}">${escape(licenseState)}</span>
  </div>
  <p class="type-helper" data-connection="${escape(connectionState)}">${escape(context || connectionLabel(connectionState, offline))}</p>
  ${vp.nav === "rail" ? `<nav class="rail" aria-label="Workflow steps" role="navigation"></nav>` : ""}
</header>`;

  const main = `<main class="shell-main" role="main" data-density="${vp.density}" style="max-width:${vp.width}px">${bodyHtml}</main>`;
  const footer = stickyActionsHtml
    ? `<footer class="shell-footer sticky-actions" role="contentinfo">${stickyActionsHtml}</footer>`
    : `<footer class="shell-footer" role="contentinfo"></footer>`;

  return {
    ok: true,
    viewport: vp,
    html: `<div class="shell shell--${surface}" data-offline="${offline ? "true" : "false"}">${header}${main}${footer}</div>`,
  };
}

function connectionLabel(state, offline) {
  if (offline) return "Offline — local draft only; nothing will upload.";
  switch (state) {
    case "connected":
      return "Provider account connected.";
    case "disconnected":
      return "Provider account not connected.";
    default:
      return "Ready.";
  }
}

function validateShell() {
  const errors = [];
  for (const surface of Object.keys(VIEWPORTS)) {
    const built = buildShell({ surface, bodyHtml: "<p>Body</p>", stickyActionsHtml: "<button type='button'>Continue</button>" });
    if (!built.ok) errors.push(built.error);
    for (const landmark of ["role=\"banner\"", "role=\"main\"", "role=\"contentinfo\""]) {
      if (!built.html.includes(landmark)) errors.push(`${surface} missing ${landmark}`);
    }
  }
  // Sticky actions must remain in the footer landmark so they are not clipped by scroll.
  const sticky = buildShell({
    surface: "workspace",
    stickyActionsHtml: "<button type='button'>Continue</button>",
  });
  if (!/contentinfo[\s\S]*Continue/.test(sticky.html)) {
    errors.push("sticky actions must live in contentinfo footer");
  }
  return { ok: errors.length === 0, errors };
}

function escape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

module.exports = {
  SHELL_VERSION,
  VIEWPORTS,
  LANDMARKS,
  buildShell,
  validateShell,
};
