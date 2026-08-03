"use strict";

(function () {
  // Inline the role catalog so the specimen does not need a bundler.
  const ROLES = [
    "title",
    "subtitle",
    "body",
    "helper",
    "label",
    "caption",
    "code",
    "numeric",
    "warning",
    "action",
  ];
  const STRESS = {
    title: "Vergleichsauftrag für Programmierabgaben prüfen und fortsetzen",
    filename: "estudiante_proyecto_final_versión_2_revisión_última.cpp",
    helper: "Los archivos aún no se han cargado. Revise los grupos antes de continuar.",
    numeric: "1,234 / 40",
    action: "Continuar al pago",
  };
  const ICONS = [
    ["check", "Complete"],
    ["warning", "Needs attention"],
    ["error", "Failed"],
    ["info", "Information"],
    ["upload", "Upload"],
    ["folder", "Folder"],
    ["file", "File"],
    ["settings", "Settings"],
    ["external", "Open external link"],
    ["copy", "Copy"],
    ["close", "Close"],
    ["chevronRight", "Next"],
  ];

  function iconSvg(label) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${label}"><circle cx="12" cy="12" r="8"/></svg>`;
  }

  const roles = document.getElementById("roles");
  for (const name of ROLES) {
    const p = document.createElement("p");
    p.className = `type-${name}`;
    p.dataset.role = name;
    p.textContent = `${name}: The quick brown fox — 0123456789`;
    roles.append(p);
  }

  document.getElementById("stress-title").textContent = STRESS.title;
  document.getElementById("stress-file").textContent = STRESS.filename;
  document.getElementById("stress-helper").textContent = STRESS.helper;
  document.getElementById("stress-numeric").textContent = STRESS.numeric;

  const icons = document.getElementById("icons");
  for (const [name, label] of ICONS) {
    const cell = document.createElement("span");
    cell.className = "icon-cell type-caption";
    cell.dataset.icon = name;
    cell.innerHTML = `${iconSvg(label)} <span>${name}</span>`;
    icons.append(cell);
  }

  const action = document.getElementById("labeled-action");
  action.innerHTML = `${iconSvg("Upload")} <span>${STRESS.action}</span>`;
  action.dataset.hasTextLabel = "true";

  document.getElementById("theme").addEventListener("change", (e) => {
    document.body.setAttribute("data-theme", e.target.value);
    document.documentElement.setAttribute("data-theme", e.target.value);
  });
  document.documentElement.setAttribute("data-theme", "light");
})();
