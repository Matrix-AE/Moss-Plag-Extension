"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const prototypeDirectory = path.join(
  repositoryRoot,
  "docs",
  "product",
  "research",
  "prototype",
);
const modelPath = path.join(prototypeDirectory, "prototype-model.js");
const model = require(modelPath);

function readPrototypeFile(name) {
  return fs.readFileSync(path.join(prototypeDirectory, name), "utf8");
}

test("P003-P01 exposes every required research scenario", () => {
  assert.deepEqual(model.SCENARIO_IDS, [
    "empty",
    "two-files",
    "twenty-files",
    "two-projects",
    "invalid-input",
    "mixed-language",
    "offline",
    "timeout",
    "consent",
    "pricing",
    "result",
  ]);
});

test("P003-P02 models two individual files as two logical submissions", () => {
  const state = model.createScenario("two-files");
  assert.deepEqual(model.summarize(state), {
    groupCount: 2,
    fileCount: 2,
    totalBytes: 3970,
    languages: ["python"],
    baseFileCount: 0,
  });
  assert.equal(model.validateDraft(state).length, 0);
  assert.equal(model.canReview(state), true);
});

test("P003-P03 models twenty files as five intact four-file projects", () => {
  const state = model.createScenario("twenty-files");
  const summary = model.summarize(state);
  assert.equal(state.mode, "batch");
  assert.equal(summary.groupCount, 5);
  assert.equal(summary.fileCount, 20);
  assert.ok(state.groups.every((entry) => entry.files.length === 4));
  state.groups.forEach((entry) => {
    assert.ok(entry.files.every((candidate) => candidate.virtualPath.startsWith(`${entry.id}/`)));
  });
  assert.equal(model.validateDraft(state).length, 0);
});

test("P003-P04 preserves two multi-file projects instead of flattening files", () => {
  const state = model.createScenario("two-projects");
  assert.equal(state.groups.length, 2);
  assert.deepEqual(
    state.groups.map((entry) => entry.files.length),
    [4, 4],
  );
  assert.ok(state.groups[0].files.every((candidate) => candidate.virtualPath.startsWith("project-atlas/")));
  assert.ok(state.groups[1].files.every((candidate) => candidate.virtualPath.startsWith("project-nova/")));
});

test("P003-P05 blocks every empty submission group", () => {
  const errors = model.validateDraft(model.createScenario("empty"));
  assert.equal(errors.filter((entry) => entry.code === "empty-group").length, 2);
  assert.equal(errors.some((entry) => entry.code === "group-count"), false);
});

test("P003-P06 rejects unsupported documents without implying analysis", () => {
  const state = model.createScenario("invalid-input");
  const errors = model.validateDraft(state);
  assert.equal(errors.some((entry) => entry.code === "unsupported-file"), true);
  assert.match(
    errors.find((entry) => entry.code === "unsupported-file").message,
    /PDFs, Word documents, images, and executables are not supported/,
  );
  assert.equal(model.canReview(state), false);
});

test("P003-P07 blocks mixed-language jobs and recommends separate checks", () => {
  const state = model.createScenario("mixed-language");
  const errors = model.validateDraft(state);
  assert.deepEqual(model.summarize(state).languages, ["python", "javascript"]);
  assert.equal(errors.some((entry) => entry.code === "mixed-language"), true);
  assert.match(
    errors.find((entry) => entry.code === "mixed-language").message,
    /separate check for each supported language/,
  );
});

test("P003-P08 requires corpus-specific authority and processing confirmation", () => {
  const state = model.createScenario("consent");
  assert.equal(model.canSubmit(state), false);
  const attempted = model.submit(state);
  assert.equal(attempted.screen, "review");
  assert.match(attempted.notice, /Confirm authority and external processing for this exact comparison/);
});

test("P003-P09 distinguishes offline-before-send from a provider outcome", () => {
  const state = model.createScenario("offline");
  const attempted = model.submit(state);
  assert.equal(attempted.screen, "review");
  assert.match(attempted.notice, /No files were sent/);
  assert.doesNotMatch(attempted.notice, /no matches/i);
});

test("P003-P10 blocks blind retry after sent-without-result timeout", () => {
  const state = model.createScenario("timeout");
  const attempted = model.submit(state);
  assert.equal(attempted.screen, "error");
  assert.match(attempted.notice, /check was sent/);
  assert.match(attempted.notice, /Do not retry until the product marks it safe/);
  assert.doesNotMatch(attempted.notice, /no matches/i);
});

test("P003-P11 advances a valid consented synthetic job without producing a result", () => {
  const state = model.createScenario("two-files");
  state.screen = "review";
  state.authorityConfirmed = true;
  state.processingConfirmed = true;
  const attempted = model.submit(state);
  assert.equal(attempted.screen, "processing");
  assert.match(attempted.notice, /no code was uploaded/i);
  assert.equal(attempted.result, null);
});

test("P003-P12 uses only a reserved invalid domain for the synthetic report", () => {
  const state = model.createScenario("result");
  const parsed = new URL(state.result.reportUrl);
  assert.equal(parsed.protocol, "https:");
  assert.equal(parsed.hostname, "example.invalid");
  assert.match(parsed.pathname, /similarity-report/);
});

test("P003-P13 labels pricing as research-only and not a purchase offer", () => {
  const state = model.createScenario("pricing");
  assert.equal(state.screen, "pricing");
  assert.equal(state.researchOnly, true);
  assert.match(state.notice, /Research concept only/);
  assert.match(state.notice, /Nothing is for sale/);
});

test("P003-P14 scenario instances do not share mutable state", () => {
  const first = model.createScenario("two-files");
  const second = model.createScenario("two-files");
  first.groups[0].files.length = 0;
  assert.equal(second.groups[0].files.length, 1);
});

test("P003-P15 exposes only the deliberately limited research language registry", () => {
  assert.deepEqual(model.SUPPORTED_LANGUAGES, ["c", "cc", "java", "javascript", "python"]);
  assert.deepEqual(model.SUPPORTED_EXTENSIONS.python, [".py"]);
  assert.ok(Object.isFrozen(model.SUPPORTED_LANGUAGES));
  assert.ok(Object.isFrozen(model.SUPPORTED_EXTENSIONS));
});

test("P003-P16 static prototype has a restrictive CSP and local assets only", () => {
  const html = readPrototypeFile("index.html");
  assert.match(html, /default-src 'self'/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /object-src 'none'/);
  assert.match(html, /base-uri 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i);
  assert.doesNotMatch(html, /<link[^>]+href=["']https?:/i);
});

test("P003-P17 prototype cannot perform network, storage, or clipboard writes", () => {
  const sources = [readPrototypeFile("app.js"), readPrototypeFile("prototype-model.js")].join("\n");
  const forbiddenApis = [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /\bsendBeacon\b/,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /clipboard\.write/,
  ];
  forbiddenApis.forEach((pattern) => assert.doesNotMatch(sources, pattern));
});

test("P003-P18 prototype includes keyboard, live-region, zoom, motion, theme, and forced-color hooks", () => {
  const html = readPrototypeFile("index.html");
  const css = readPrototypeFile("styles.css");
  assert.match(html, /class="skip-link"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /id="prototype-main" tabindex="-1"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /prefers-color-scheme: light/);
  assert.match(css, /forced-colors: active/);
  assert.match(html, /width=device-width, initial-scale=1/);
});

test("P003-P19 prototype source contains no live credential, result, or provider endpoint", () => {
  const sources = [
    readPrototypeFile("index.html"),
    readPrototypeFile("app.js"),
    readPrototypeFile("prototype-model.js"),
    readPrototypeFile("styles.css"),
  ].join("\n");
  assert.doesNotMatch(sources, /moss\.stanford\.edu/i);
  assert.doesNotMatch(sources, /\/results\/[0-9]+/i);
  assert.doesNotMatch(sources, /(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}/);
  assert.doesNotMatch(sources, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
});

test("P003-P20 workflow order is deterministic", () => {
  assert.equal(model.nextScreen(model.createScenario("two-files")), "configure");
  const configured = model.createScenario("two-files");
  configured.screen = "configure";
  assert.equal(model.nextScreen(configured), "review");
  const result = model.createScenario("result");
  assert.equal(model.nextScreen(result), "result");
});
