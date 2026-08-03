"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const language = require(path.join(root, "packages/ui/language"));
const doc = fs.readFileSync(path.join(root, "docs/product/language-selection.md"), "utf8");

const caps = language.normalizeCapabilities({
  fetchedAt: new Date().toISOString(),
  languages: [
    { code: "python", label: "Python", extensions: [".py"] },
    { code: "java", label: "Java", extensions: [".java"] },
    { code: "cpp", label: "C++", extensions: [".cpp", ".cc", ".cxx", ".h", ".hpp"] },
  ],
  aliases: { py: "python", "c++": "cpp" },
}).capabilities;

test("P040-T01 module validation and capability source", () => {
  assert.equal(language.validateLanguageModule().ok, true);
  assert.equal(language.normalizeCapabilities(null).ok, false);
  assert.match(doc, /server capabilities/i);
});

test("P040-T02 suggestions: known, uppercase, mixed, extensionless, unsupported", () => {
  const known = language.suggestLanguage([{ displayName: "Sol.PY" }], caps);
  assert.equal(known.suggestion.code, "python");
  assert.equal(known.requiresConfirmation, true);

  const mixed = language.suggestLanguage(
    [{ displayName: "a.py" }, { displayName: "b.java" }],
    caps,
  );
  assert.equal(mixed.confidence, "mixed");
  assert.match(mixed.guidance, /Split/i);

  const none = language.suggestLanguage([{ displayName: "README" }], caps);
  assert.equal(none.suggestion, null);

  const unsupported = language.suggestLanguage([{ displayName: "x.zzz" }], caps);
  assert.equal(unsupported.suggestion, null);
});

test("P040-T03 manual override, confirm, stale capabilities", () => {
  assert.equal(language.resolveManualSelection("PY", caps).code, "python");
  assert.equal(language.resolveManualSelection("nope", caps).ok, false);
  const confirmed = language.confirmLanguage({ mode: "pair" }, "java", caps);
  assert.equal(confirmed.draft.languageConfirmed, true);
  assert.equal(confirmed.draft.language, "java");
  assert.equal(language.isStale({ fetchedAt: "1999-01-01T00:00:00.000Z" }), true);
  assert.equal(
    language.suggestLanguage([{ displayName: "a.py" }], language.EMPTY_CAPABILITIES).error,
    "stale-or-missing-capabilities",
  );
});

test("P040-T04 search UI and workspace wiring", () => {
  assert.equal(language.searchLanguages("py", caps).some((l) => l.code === "python"), true);
  const html = language.buildLanguageSelectorHtml({ capabilities: caps, selected: "python" });
  assert.match(html.html, /Select a language/);
  assert.match(html.html, /confirmation/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./language"], "./language/index.js");
  const workspace = fs.readFileSync(
    path.join(root, "apps/extension/src/entrypoints/workspace/Workspace.tsx"),
    "utf8",
  );
  assert.match(workspace, /language|Language/);
  assert.ok(fs.existsSync(path.join(root, "packages/ui/specimens/language.html")));
});
