"use strict";
const fs = require("node:fs");
const path = require("node:path");
const shell = require("../packages/ui/shell");
const progress = require("../packages/ui/progress");
const files = require("../packages/ui/file-selection");

const body =
  `<p>${progress.viewModel("wait").detail}</p>` +
  `<ul role="list">${files.buildFileRow({ displayName: "a.py", status: "accepted" }).html}</ul>`;

const page =
  `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Shell live</title>` +
  `<link rel="stylesheet" href="../tokens/tokens.css" /></head><body data-theme="light">` +
  shell.buildShell({
    surface: "workspace",
    context: "Live check",
    stickyActionsHtml: "<button type='button'>Continue</button>",
    bodyHtml: body,
  }).html +
  `</body></html>`;

fs.writeFileSync(path.join(__dirname, "../packages/ui/specimens/shell-progress.html"), page);
console.log("wrote shell-progress.html");
