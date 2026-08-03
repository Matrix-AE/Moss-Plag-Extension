"use strict";

/**
 * Accessible component primitive contracts (Prompt 030).
 * Headless behavior + semantic HTML builders — no inaccessible custom controls.
 */

const PRIMITIVES_VERSION = 1;

const PRIMITIVES = Object.freeze([
  "button",
  "link",
  "input",
  "select",
  "switch",
  "tabs",
  "dialog",
  "tooltip",
  "badge",
  "progress",
  "toast",
  "disclosure",
]);

const KEYBOARD = Object.freeze({
  button: Object.freeze({ activate: ["Enter", " "], roles: ["button"] }),
  link: Object.freeze({ activate: ["Enter"], roles: ["link"] }),
  input: Object.freeze({ activate: [], roles: ["textbox"] }),
  select: Object.freeze({ activate: ["Enter", " ", "ArrowDown"], roles: ["combobox", "listbox"] }),
  switch: Object.freeze({ activate: ["Enter", " "], roles: ["switch"] }),
  tabs: Object.freeze({ activate: ["ArrowLeft", "ArrowRight", "Home", "End"], roles: ["tab", "tablist", "tabpanel"] }),
  dialog: Object.freeze({ activate: ["Escape"], roles: ["dialog"], focusTrap: true }),
  tooltip: Object.freeze({ activate: ["Escape"], roles: ["tooltip"] }),
  badge: Object.freeze({ activate: [], roles: ["status"] }),
  progress: Object.freeze({ activate: [], roles: ["progressbar"] }),
  toast: Object.freeze({ activate: ["Escape"], roles: ["status", "alert"] }),
  disclosure: Object.freeze({ activate: ["Enter", " "], roles: ["button"] }),
});

function buildButton({ label, variant = "primary", disabled = false, loading = false, type = "button" }) {
  if (!label || !String(label).trim()) {
    return { ok: false, error: "Button requires a visible label." };
  }
  if (loading && !label) {
    return { ok: false, error: "Loading button still needs a text label." };
  }
  const classes = ["ui-button", `ui-button--${variant}`, disabled ? "is-disabled" : "", loading ? "is-loading" : ""]
    .filter(Boolean)
    .join(" ");
  const attrs = [
    `type="${type}"`,
    `class="${classes} focus-ring type-action"`,
    disabled || loading ? "disabled" : "",
    loading ? 'aria-busy="true"' : "",
  ]
    .filter(Boolean)
    .join(" ");
  return { ok: true, html: `<button ${attrs}>${escape(label)}</button>` };
}

function buildInput({ id, label, value = "", type = "text", error = "", required = false }) {
  if (!id || !label) {
    return { ok: false, error: "Input requires id and label." };
  }
  const describedBy = error ? `aria-describedby="${id}-error"` : "";
  const err = error
    ? `<p id="${id}-error" class="type-helper" role="alert">${escape(error)}</p>`
    : "";
  return {
    ok: true,
    html: `<label class="type-label" for="${id}">${escape(label)}</label><input id="${id}" class="ui-input focus-ring" type="${type}" value="${escape(value)}" ${required ? "required" : ""} ${describedBy} />${err}`,
  };
}

function buildSwitch({ id, label, checked = false }) {
  if (!id || !label) return { ok: false, error: "Switch requires id and label." };
  return {
    ok: true,
    html: `<button type="button" id="${id}" class="ui-switch focus-ring" role="switch" aria-checked="${checked ? "true" : "false"}" aria-label="${escape(label)}"><span class="type-label">${escape(label)}</span></button>`,
  };
}

function buildDialog({ title, body, labelledBy = "dialog-title" }) {
  if (!title) return { ok: false, error: "Dialog requires a title." };
  return {
    ok: true,
    html: `<div class="ui-dialog" role="dialog" aria-modal="true" aria-labelledby="${labelledBy}"><h2 id="${labelledBy}" class="type-subtitle">${escape(title)}</h2><div class="type-body">${escape(body || "")}</div><button type="button" class="ui-button focus-ring" data-dialog-close>Close</button></div>`,
  };
}

function buildBadge({ label, tone = "info" }) {
  if (!label) return { ok: false, error: "Badge requires a text label (color is never the only signal)." };
  return {
    ok: true,
    html: `<span class="badge badge--${tone} type-caption" role="status">${escape(label)}</span>`,
  };
}

function buildProgress({ label, value = null }) {
  if (!label) return { ok: false, error: "Progress requires an accessible label." };
  // Provider waits are indeterminate — never invent a percent.
  const valuetext = value == null ? 'aria-valuetext="In progress"' : `aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100"`;
  return {
    ok: true,
    html: `<div class="ui-progress" role="progressbar" aria-label="${escape(label)}" ${valuetext}></div><p class="type-helper">${escape(label)}</p>`,
  };
}

function buildToast({ message, tone = "info", assertive = false }) {
  if (!message) return { ok: false, error: "Toast requires a message." };
  const role = assertive ? "alert" : "status";
  return {
    ok: true,
    html: `<div class="ui-toast ui-toast--${tone} type-body" role="${role}">${escape(message)}</div>`,
  };
}

function buildDisclosure({ id, summary, content, open = false }) {
  if (!id || !summary) return { ok: false, error: "Disclosure requires id and summary." };
  return {
    ok: true,
    html: `<details class="ui-disclosure" id="${id}" ${open ? "open" : ""}><summary class="type-label focus-ring">${escape(summary)}</summary><div class="type-body">${escape(content || "")}</div></details>`,
  };
}

function buildTabs({ id, tabs }) {
  if (!id || !Array.isArray(tabs) || tabs.length < 2) {
    return { ok: false, error: "Tabs require an id and at least two tabs." };
  }
  const list = tabs
    .map(
      (tab, index) =>
        `<button type="button" class="focus-ring type-label" role="tab" id="${id}-tab-${index}" aria-selected="${index === 0 ? "true" : "false"}" aria-controls="${id}-panel-${index}">${escape(tab.label)}</button>`,
    )
    .join("");
  const panels = tabs
    .map(
      (tab, index) =>
        `<div role="tabpanel" id="${id}-panel-${index}" aria-labelledby="${id}-tab-${index}" ${index === 0 ? "" : "hidden"}>${escape(tab.content || "")}</div>`,
    )
    .join("");
  return {
    ok: true,
    html: `<div class="ui-tabs"><div role="tablist" aria-label="${escape(id)}">${list}</div>${panels}</div>`,
  };
}

function escape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function validatePrimitives() {
  const errors = [];
  for (const name of PRIMITIVES) {
    if (!KEYBOARD[name]) errors.push(`missing keyboard contract for ${name}`);
  }
  const samples = [
    buildButton({ label: "Save" }),
    buildInput({ id: "a", label: "Name" }),
    buildSwitch({ id: "s", label: "Notify" }),
    buildDialog({ title: "Confirm", body: "OK" }),
    buildBadge({ label: "Idle" }),
    buildProgress({ label: "Uploading" }),
    buildToast({ message: "Saved" }),
    buildDisclosure({ id: "d", summary: "More", content: "Details" }),
    buildTabs({
      id: "t",
      tabs: [
        { label: "One", content: "A" },
        { label: "Two", content: "B" },
      ],
    }),
  ];
  for (const sample of samples) {
    if (!sample.ok) errors.push(sample.error);
  }
  if (buildButton({ label: "" }).ok) errors.push("empty button label should fail");
  if (buildProgress({ label: "" }).ok) errors.push("empty progress label should fail");
  if (buildBadge({ label: "" }).ok) errors.push("empty badge should fail");
  return { ok: errors.length === 0, errors };
}

module.exports = {
  PRIMITIVES_VERSION,
  PRIMITIVES,
  KEYBOARD,
  buildButton,
  buildInput,
  buildSwitch,
  buildDialog,
  buildBadge,
  buildProgress,
  buildToast,
  buildDisclosure,
  buildTabs,
  validatePrimitives,
};
