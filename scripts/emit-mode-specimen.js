"use strict";

const fs = require("node:fs");
const path = require("node:path");
const mode = require("../packages/ui/mode-selector");

const result = mode.validateModeSelector();
if (!result.ok) {
  console.error(result);
  process.exit(1);
}

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Mode selector — Prompt 038</title>
    <link rel="stylesheet" href="../tokens/tokens.css" />
    <link rel="stylesheet" href="../typography/typography.css" />
    <style>
      body { margin: 16px; font-family: var(--font-ui); background: var(--surface); color: var(--text); }
      .mode-card { display: block; border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin: 8px 0; }
      input { margin-right: 8px; }
      #status { margin-top: 12px; }
    </style>
  </head>
  <body data-theme="light">
    <h1 class="type-title">Choose a comparison mode</h1>
    ${mode.buildModeSelectorHtml({ selected: "pair" }).html}
    <p id="status" class="type-helper" role="status"></p>
    <script>
      const status = document.getElementById("status");
      const copy = {
        pair: "Exactly two groups required before continue.",
        batch: "At least two groups required before continue.",
      };
      function sync() {
        const value = document.querySelector("input[name=comparison-mode]:checked").value;
        status.textContent = copy[value];
      }
      document.querySelectorAll("input[name=comparison-mode]").forEach((input) => {
        input.addEventListener("change", sync);
      });
      sync();
    </script>
  </body>
</html>
`;

fs.writeFileSync(path.join(__dirname, "../packages/ui/specimens/mode-selector.html"), page);
console.log("mode selector ok; specimen written");
