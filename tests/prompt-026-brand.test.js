"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const brandDir = path.join(root, "docs/design/brand");
const docPath = path.join(root, "docs/design/art-direction.md");
const brand = require(path.join(brandDir, "brand-model.js"));

const doc = fs.readFileSync(docPath, "utf8");
const moodBoardHtml = fs.readFileSync(path.join(brandDir, "index.html"), "utf8");
const moodBoardJs = fs.readFileSync(path.join(brandDir, "mood-board.js"), "utf8");

test("P026-T01 art direction doc covers every required dimension", () => {
  for (const heading of [
    "## Naming Placeholders",
    "## Mood",
    "## Color",
    "### Contrast Targets",
    "### Neon Exclusion",
    "## Shape, Illustration, Motion",
    "## Voice and Microcopy",
    "## Theme Behavior",
    "## Surface Application",
    "## Non-Affiliation",
    "## Verification",
  ]) {
    assert.ok(doc.includes(heading), `missing section: ${heading}`);
  }
});

test("P026-T02 contrast targets pass in both themes", () => {
  const { ok, results } = brand.checkAllThemes();
  const failures = results.filter((entry) => !entry.pass);
  assert.deepEqual(
    failures.map((entry) => `${entry.theme}/${entry.name} ${entry.ratio}<${entry.min}`),
    [],
  );
  assert.equal(ok, true);
  // Both themes must be measured, not just the default one.
  assert.ok(results.some((entry) => entry.theme === "light"));
  assert.ok(results.some((entry) => entry.theme === "dark"));
});

test("P026-T03 contrast math matches known WCAG reference values", () => {
  assert.equal(Math.round(brand.contrastRatio("#000000", "#ffffff") * 100) / 100, 21);
  assert.equal(Math.round(brand.contrastRatio("#ffffff", "#ffffff") * 100) / 100, 1);
  // #767676 on white is the canonical 4.5:1 boundary color.
  assert.ok(brand.contrastRatio("#767676", "#ffffff") >= 4.5);
  assert.ok(brand.contrastRatio("#777777", "#ffffff") < 4.6);
});

test("P026-T04 neon detector rejects channel-blown colors and accepts pale tints", () => {
  for (const neon of ["#39ff14", "#ff00ff", "#00ffff", "#ffff00", "#ff007f"]) {
    assert.equal(brand.isNeon(neon), true, `${neon} should be rejected`);
  }
  for (const usable of ["#9db6ff", "#2f4fd8", "#14161a", "#7a4a05", "#89d6a8"]) {
    assert.equal(brand.isNeon(usable), false, `${usable} should be allowed`);
  }
  assert.deepEqual(brand.checkNeon(), { ok: true, offenders: [] });
});

test("P026-T05 both themes define the same semantic roles", () => {
  const light = Object.keys(brand.PALETTE.light).sort();
  const dark = Object.keys(brand.PALETTE.dark).sort();
  assert.deepEqual(dark, light);
  for (const role of ["surface", "text", "textMuted", "accent", "focus", "danger", "success"]) {
    assert.ok(light.includes(role), `missing role: ${role}`);
  }
});

test("P026-T06 palette hex values in the doc match the model", () => {
  for (const [theme, colors] of Object.entries(brand.PALETTE)) {
    for (const [role, hex] of Object.entries(colors)) {
      assert.ok(doc.includes(`\`${hex}\``), `${theme}.${role} ${hex} missing from doc`);
    }
  }
});

test("P026-T07 naming placeholders avoid affiliation and accusation", () => {
  assert.deepEqual(brand.checkNaming(), { ok: true, offenders: [] });
  const rejected = brand.checkNaming([
    "MossPro",
    "Stanford Similarity",
    "PlagiarismDetector",
    "Cheat Catcher",
    "Official Code Judge",
  ]);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.offenders.length, 5);
  assert.ok(brand.NAMING_PLACEHOLDERS.length >= 3);
  for (const entry of brand.NAMING_PLACEHOLDERS) {
    assert.ok(entry.rationale.length > 20, `${entry.placeholder} needs a rationale`);
    assert.ok(doc.includes(entry.placeholder), `${entry.placeholder} missing from doc`);
  }
});

test("P026-T08 microcopy passes the charter terminology screen", () => {
  assert.deepEqual(brand.checkCopy(), { ok: true, offenders: [] });
  const rejected = brand.checkCopy([
    "Our plagiarism detector proves cheating.",
    "You were caught copying.",
    "Official Stanford extension.",
    "Share this secure link.",
    "100% private results.",
  ]);
  assert.equal(rejected.ok, false);
  assert.ok(rejected.offenders.length >= 5);
});

test("P026-T09 microcopy covers every surface the acceptance criteria names", () => {
  const covered = new Set(brand.VOICE.microcopy.map((entry) => entry.surface));
  for (const surface of ["popup", "workspace", "settings", "checkout", "store", "support"]) {
    assert.ok(covered.has(surface), `no microcopy for ${surface}`);
  }
  const guidance = brand.surfaceGuidance();
  for (const surface of brand.SURFACES) {
    assert.ok(guidance[surface], `no guidance for ${surface}`);
    assert.ok(doc.includes(`| ${surface} |`), `${surface} missing from surface table`);
  }
});

test("P026-T10 the direction bans institutional and accusatory imagery", () => {
  for (const banned of ["crest", "gavel", "handcuffs", "red stamp", "magnifying glass"]) {
    assert.match(doc, new RegExp(banned, "i"), `doc should ban ${banned}`);
  }
  for (const effect of ["parallax", "glassmorphism", "confetti"]) {
    assert.match(doc, new RegExp(effect, "i"), `doc should ban ${effect}`);
  }
  assert.match(doc, /Stanford ownership|MOSS endorsement/i);
  for (const anti of brand.MOOD.antiKeywords) {
    assert.ok(brand.MOOD.keywords.includes(anti) === false, `${anti} cannot be both`);
  }
});

test("P026-T11 danger color is bound to workflow failure, never to a person", () => {
  assert.match(brand.STATUS_MEANING.danger, /never an accusation/i);
  assert.match(brand.STATUS_MEANING.success, /not a similarity judgement/i);
  assert.match(doc, /never the only signal|Never the Only Signal/i);
  assert.deepEqual(brand.checkCopy(Object.values(brand.STATUS_MEANING)), { ok: true, offenders: [] });
});

test("P026-T12 the mood board renders the model rather than duplicating it", () => {
  assert.match(moodBoardHtml, /src="\.\/brand-model\.js"/);
  assert.match(moodBoardHtml, /src="\.\/mood-board\.js"/);
  assert.match(moodBoardJs, /checkContrast|checkAllThemes/);
  assert.match(moodBoardJs, /checkNeon/);
  assert.match(moodBoardJs, /PALETTE\[theme\]/);
  // Theme toggle proves both themes are exercised live.
  assert.match(moodBoardJs, /theme === "dark" \? "light" : "dark"/);
  for (const surface of ["popup", "workspace", "checkout"]) {
    assert.ok(moodBoardHtml.includes(`spec-${surface}`), `no ${surface} specimen`);
  }
  // Specimens must read palette roles through variables, not literal hexes.
  assert.equal(/#[0-9a-f]{6}/i.test(moodBoardJs), false, "mood-board.js should not hardcode hex");
});

test("P026-T14 approved palette ships through @moss/ui tokens used by the extension", () => {
  const tokenCss = fs.readFileSync(
    path.join(root, "packages/ui/tokens/tokens.css"),
    "utf8",
  );
  const baseCss = fs.readFileSync(
    path.join(root, "apps/extension/src/styles/base.css"),
    "utf8",
  );
  const kebab = (role) => `--${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

  for (const [role, hex] of Object.entries(brand.PALETTE.light)) {
    assert.ok(tokenCss.includes(`${kebab(role)}: ${hex};`), `light ${role} should be ${hex}`);
  }
  for (const [role, hex] of Object.entries(brand.PALETTE.dark)) {
    assert.ok(tokenCss.includes(`${kebab(role)}: ${hex};`), `dark ${role} should be ${hex}`);
  }

  // Extension component CSS consumes variables only — no hex literals.
  assert.equal((baseCss.match(/#[0-9a-f]{3,8}\b/gi) || []).length, 0);
  for (const entry of ["sidepanel", "workspace", "settings"]) {
    const main = fs.readFileSync(
      path.join(root, `apps/extension/src/entrypoints/${entry}/main.tsx`),
      "utf8",
    );
    assert.match(main, /@moss\/ui\/tokens\.css/);
  }
});

test("P026-T13 doc records the live walkthrough and defers tokens to Prompt 027", () => {
  assert.match(doc, /### Live Walkthrough Record/);
  assert.match(doc, /Prompt 027/);
  assert.match(doc, /no hex may reach a component/i);
});
