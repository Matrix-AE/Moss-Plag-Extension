"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const docPath = path.join(root, "docs/design/design-tokens.md");
const tokensDir = path.join(root, "packages/ui/tokens");
const specimensDir = path.join(root, "packages/ui/specimens");
const brand = require(path.join(root, "docs/design/brand/brand-model.js"));
const ui = require(path.join(root, "packages/ui"));
const tokens = require(path.join(root, "packages/ui/tokens"));

const doc = fs.readFileSync(docPath, "utf8");
const tokenCss = fs.readFileSync(path.join(tokensDir, "tokens.css"), "utf8");
const specimenHtml = fs.readFileSync(path.join(specimensDir, "index.html"), "utf8");
const specimenCss = fs.readFileSync(path.join(specimensDir, "specimen.css"), "utf8");
const specimenJs = fs.readFileSync(path.join(specimensDir, "specimen.js"), "utf8");

test("P027-T01 design tokens doc covers required dimensions", () => {
  for (const heading of [
    "## Layers",
    "## Naming",
    "## 8-pixel spacing system",
    "## Density",
    "## Accent rule",
    "## Contrast",
    "## Unused-token reporting",
    "## Exports",
    "## Extension wiring",
    "## Specimens and snapshot matrix",
    "## Verification",
  ]) {
    assert.ok(doc.includes(heading), `missing ${heading}`);
  }
  assert.match(doc, /TOKEN_VERSION/);
  assert.match(doc, /@moss\/ui/);
});

test("P027-T02 packages/ui exports versioned tokens API", () => {
  assert.equal(tokens.TOKEN_VERSION, 1);
  assert.equal(ui.TOKEN_VERSION, 1);
  assert.equal(typeof tokens.toCss, "function");
  assert.equal(typeof tokens.validateTokens, "function");
  assert.ok(tokens.SEMANTIC.light);
  assert.ok(tokens.SEMANTIC.dark);
  assert.ok(tokens.COMPONENTS.button.primary.background);

  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./tokens"], "./tokens/index.js");
  assert.equal(pkg.exports["./tokens.css"], "./tokens/tokens.css");
});

test("P027-T03 schema validation passes and rejects literal component values", () => {
  const { schema } = tokens.validateTokens();
  assert.equal(schema.ok, true);
  assert.deepEqual(schema.errors, []);

  // Guard: component values must be semantic paths, not hex.
  for (const { componentPath, semanticPath } of tokens.components.flattenComponentPaths()) {
    assert.equal(semanticPath.includes("#"), false, componentPath);
    assert.match(semanticPath, /^[a-z]+\.[a-zA-Z0-9.]+$/);
  }
});

test("P027-T04 contrast checks pass and match brand palette roles", () => {
  const { contrast, ok } = tokens.validateTokens();
  assert.equal(contrast.ok, true);
  assert.equal(ok, true);
  assert.equal(contrast.results.filter((r) => !r.pass).length, 0);

  for (const theme of ["light", "dark"]) {
    for (const [role, hex] of Object.entries(brand.PALETTE[theme])) {
      assert.equal(
        tokens.SEMANTIC[theme].color[role],
        hex,
        `${theme}.${role} must match brand palette`,
      );
    }
  }
});

test("P027-T05 spacing system is 8px-based with 4px half-steps only", () => {
  const { SPACE, isAllowedSpace, isMajorSpace } = tokens.primitives;
  for (const [key, value] of Object.entries(SPACE)) {
    assert.equal(isAllowedSpace(value), true, `space.${key}`);
  }
  assert.equal(SPACE[1], 8);
  assert.equal(SPACE[2], 16);
  assert.equal(SPACE["0.5"], 4);
  assert.equal(isMajorSpace(8), true);
  assert.equal(isMajorSpace(4), false);
  assert.equal(isAllowedSpace(6), false);
});

test("P027-T06 accent fill is purposeful and unique", () => {
  const fills = tokens.components
    .flattenComponentPaths()
    .filter(
      (entry) =>
        entry.semanticPath === "color.accent" && /background$/i.test(entry.componentPath),
    );
  assert.deepEqual(
    fills.map((e) => e.componentPath),
    ["button.primary.background"],
  );
});

test("P027-T07 unused-token report flags brand gaps and lists reserved semantic roles", () => {
  const report = tokens.reportUnusedTokens();
  assert.deepEqual(
    report.unusedPrimitives.filter((p) => p.startsWith("color.")),
    [],
  );
  assert.ok(report.unusedSemantic.includes("color.surfaceElevated"));
  assert.ok(report.usedSemanticCount > 0);
  assert.ok(report.semanticCount > report.usedSemanticCount);
});

test("P027-T08 committed tokens.css matches toCss() output", () => {
  assert.equal(tokenCss, tokens.toCss());
  assert.match(tokenCss, /@moss\/ui design tokens v1/);
  assert.match(tokenCss, /prefers-color-scheme: dark/);
  assert.match(tokenCss, /\[data-theme="dark"\]/);
  assert.match(tokenCss, /\[data-theme="light"\]/);
});

test("P027-T09 extension consumes tokens without hex literals", () => {
  const baseCss = fs.readFileSync(
    path.join(root, "apps/extension/src/styles/base.css"),
    "utf8",
  );
  assert.equal((baseCss.match(/#[0-9a-f]{3,8}\b/gi) || []).length, 0);
  assert.match(baseCss, /var\(--surface\)/);
  assert.match(baseCss, /var\(--space-md\)/);
  assert.match(baseCss, /var\(--radius-card\)/);

  for (const entry of ["sidepanel", "workspace", "settings"]) {
    const main = fs.readFileSync(
      path.join(root, `apps/extension/src/entrypoints/${entry}/main.tsx`),
      "utf8",
    );
    assert.match(main, /@moss\/ui\/tokens\.css/);
  }
});

test("P027-T10 specimens cover popup/workspace and zoom matrix", () => {
  assert.match(specimenHtml, /Token specimens/);
  assert.match(specimenHtml, /href="\.\.\/tokens\/tokens\.css"/);
  assert.match(specimenJs, /320/);
  assert.match(specimenJs, /880/);
  assert.match(specimenJs, /1\.25/);
  assert.match(specimenJs, /1\.5/);
  assert.match(specimenJs, /data-theme/);

  // Product frame rules must not hardcode hex; facilitator chrome may.
  const productStart = specimenCss.indexOf("/* Product UI");
  const matrixStart = specimenCss.indexOf(".matrix {");
  assert.ok(productStart >= 0 && matrixStart > productStart);
  const productBlock = specimenCss.slice(productStart, matrixStart);
  assert.equal((productBlock.match(/#[0-9a-f]{3,8}\b/gi) || []).length, 0);
  assert.match(productBlock, /var\(--accent\)/);
  assert.match(productBlock, /var\(--space-sm\)/);
});

test("P027-T11 typed declaration and naming rules are documented", () => {
  const dts = fs.readFileSync(path.join(tokensDir, "index.d.ts"), "utf8");
  assert.match(dts, /declare module "@moss\/ui\/tokens"/);
  assert.match(dts, /TOKEN_VERSION/);
  assert.match(dts, /ColorRole/);
  assert.match(doc, /Components and extension stylesheets may reference \*\*semantic CSS variables\*\*/);
  assert.match(doc, /Never imported by components/);
});

test("P027-T12 both themes define identical semantic role sets", () => {
  const light = Object.keys(tokens.SEMANTIC.light.color).sort();
  const dark = Object.keys(tokens.SEMANTIC.dark.color).sort();
  assert.deepEqual(dark, light);
  for (const category of ["space", "radius", "size", "border", "shadow", "layer"]) {
    assert.deepEqual(
      Object.keys(tokens.SEMANTIC.dark[category]).sort(),
      Object.keys(tokens.SEMANTIC.light[category]).sort(),
      category,
    );
  }
});
