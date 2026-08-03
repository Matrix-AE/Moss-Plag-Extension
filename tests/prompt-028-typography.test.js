"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const doc = fs.readFileSync(path.join(root, "docs/design/typography-iconography.md"), "utf8");
const typography = require(path.join(root, "packages/ui/typography"));
const icons = require(path.join(root, "packages/ui/icons"));
const typoCss = fs.readFileSync(path.join(root, "packages/ui/typography/typography.css"), "utf8");
const specimen = fs.readFileSync(path.join(root, "packages/ui/specimens/typography.html"), "utf8");

test("P028-T01 doc covers fonts, roles, icons, and verification", () => {
  for (const h of ["## Fonts", "## Type scale and roles", "## Icons", "## Verification"]) {
    assert.ok(doc.includes(h), h);
  }
  assert.match(doc, /Local system stacks only/);
  assert.match(doc, /icon-only/i);
});

test("P028-T02 typography validation passes and caps display size", () => {
  const result = typography.validateTypography();
  assert.equal(result.ok, true);
  for (const role of Object.values(typography.TYPE_ROLES)) {
    assert.ok(role.sizePx <= typography.MAX_DISPLAY_SIZE_PX);
    assert.ok(role.sizePx >= 11);
  }
  assert.ok(Object.keys(typography.TYPE_ROLES).length >= 8);
});

test("P028-T03 emitted CSS matches generator and bans remote fonts", () => {
  assert.equal(typoCss, typography.toTypographyCss());
  for (const pattern of typography.FORBIDDEN_FONT_PATTERNS) {
    assert.equal(pattern.test(typoCss), false, String(pattern));
  }
  assert.match(typoCss, /--font-ui/);
  assert.match(typoCss, /\.type-numeric/);
  assert.match(typoCss, /tabular-nums/);
});

test("P028-T04 every planned content role appears in specimens", () => {
  const browserJs = fs.readFileSync(
    path.join(root, "packages/ui/specimens/typo-browser.js"),
    "utf8",
  );
  for (const role of Object.keys(typography.TYPE_ROLES)) {
    assert.ok(
      specimen.includes(`type-${role}`) ||
        browserJs.includes(`"${role}"`) ||
        browserJs.includes(`type-${role}`),
      role,
    );
  }
  for (const sample of Object.values(typography.STRESS_STRINGS)) {
    assert.ok(browserJs.includes(sample), sample);
  }
});

test("P028-T05 icons have accessible names and reject icon-only critical actions", () => {
  assert.equal(icons.validateIcons().ok, true);
  for (const [name, icon] of Object.entries(icons.ICONS)) {
    assert.ok(icon.label.length >= 2, name);
    const svg = icons.renderIcon(name);
    assert.match(svg, /aria-label=/);
    assert.match(svg, new RegExp(icon.label));
  }
  assert.equal(icons.renderIcon("check", { decorative: true }).includes("aria-hidden"), true);
  assert.equal(
    icons.assertLabeledAction("delete", { hasIcon: true, hasTextLabel: false }).ok,
    false,
  );
  assert.equal(
    icons.assertLabeledAction("upload", { hasIcon: true, hasTextLabel: true }).ok,
    true,
  );
});

test("P028-T06 package exports and extension wiring", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./typography"], "./typography/index.js");
  assert.equal(pkg.exports["./typography.css"], "./typography/typography.css");
  assert.equal(pkg.exports["./icons"], "./icons/index.js");
  for (const entry of ["sidepanel", "workspace", "settings"]) {
    const main = fs.readFileSync(
      path.join(root, `apps/extension/src/entrypoints/${entry}/main.tsx`),
      "utf8",
    );
    assert.match(main, /@moss\/ui\/typography\.css/);
  }
  const base = fs.readFileSync(path.join(root, "apps/extension/src/styles/base.css"), "utf8");
  assert.match(base, /var\(--font-ui/);
});

test("P028-T07 no emoji icons and sizes stay on 16/20/24", () => {
  assert.deepEqual(Object.values(icons.ICON_SIZES).sort((a, b) => a - b), [16, 20, 24]);
  assert.equal(/[\u{1F300}-\u{1FAFF}]/u.test(JSON.stringify(icons.ICONS)), false);
});
