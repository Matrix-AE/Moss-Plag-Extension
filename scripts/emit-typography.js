"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const typography = require(path.join(root, "packages/ui/typography"));
const icons = require(path.join(root, "packages/ui/icons"));

const typoOut = path.join(root, "packages/ui/typography/typography.css");
const css = typography.toTypographyCss();
fs.writeFileSync(typoOut, css, "utf8");

const typo = typography.validateTypography();
const ico = icons.validateIcons();
if (!typo.ok || !ico.ok) {
  console.error({ typo, ico });
  process.exit(1);
}

console.log(`Wrote typography.css (${css.length} bytes); icons=${Object.keys(icons.ICONS).length}`);
