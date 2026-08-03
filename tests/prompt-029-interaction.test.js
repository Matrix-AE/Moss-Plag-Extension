"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const interaction = require(path.join(root, "packages/ui/interaction"));
const doc = fs.readFileSync(path.join(root, "docs/design/interaction-tokens.md"), "utf8");
const cssPath = path.join(root, "packages/ui/interaction/interaction.css");

test("P029-T01 doc and validation", () => {
  assert.match(doc, /## Theme selection/);
  assert.match(doc, /## Motion/);
  assert.match(doc, /prefers-reduced-motion|Reduced-motion/i);
  assert.equal(interaction.validateInteraction().ok, true);
});

test("P029-T02 durations stay within 180–240ms continuity budget", () => {
  assert.equal(interaction.MOTION.duration.base, 180);
  assert.equal(interaction.MOTION.duration.deliberate, 240);
  assert.ok(interaction.MOTION.duration.fast <= 240);
  assert.equal(interaction.MOTION.duration.maxAllowed, 240);
});

test("P029-T03 theme resolution and reduced motion", () => {
  assert.deepEqual(interaction.resolveTheme("system", true), {
    ok: true,
    resolved: "dark",
    source: "system",
  });
  assert.equal(interaction.resolveTheme("light", true).resolved, "light");
  assert.equal(interaction.motionFor(true).durationMs, 0);
  assert.equal(interaction.motionFor(false).durationMs, 180);
  assert.equal(interaction.resolveTheme("neon", false).ok, false);
});

test("P029-T04 loading and progress never rely on color/percent alone", () => {
  assert.equal(interaction.INTERACTION_STATES.loading.requiresText, true);
  assert.equal(interaction.PROGRESS.allowDeterminatePercent, false);
  assert.equal(interaction.PROGRESS.announcePolite, true);
});

test("P029-T05 CSS artifact and extension import", () => {
  const css = fs.readFileSync(cssPath, "utf8");
  assert.equal(css, interaction.toInteractionCss());
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /--motion-base/);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "packages/ui/package.json"), "utf8"));
  assert.equal(pkg.exports["./interaction"], "./interaction/index.js");
  assert.equal(pkg.exports["./interaction.css"], "./interaction/interaction.css");
  for (const entry of ["popup", "workspace", "settings"]) {
    const main = fs.readFileSync(
      path.join(root, `apps/extension/src/entrypoints/${entry}/main.tsx`),
      "utf8",
    );
    assert.match(main, /@moss\/ui\/interaction\.css/);
  }
  assert.ok(fs.existsSync(path.join(root, "packages/ui/specimens/interaction.html")));
});
