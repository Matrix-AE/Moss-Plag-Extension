"use strict";

/** Browser-safe presentation helpers — must never import Node net/fs or provider transport. */
function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const tokens = require("./tokens");
const typography = require("./typography");
const icons = require("./icons");

module.exports = {
  escapeText,
  tokens,
  typography,
  icons,
  TOKEN_VERSION: tokens.TOKEN_VERSION,
  TYPO_VERSION: typography.TYPO_VERSION,
  ICON_VERSION: icons.ICON_VERSION,
  SEMANTIC: tokens.SEMANTIC,
  COMPONENTS: tokens.COMPONENTS,
  toCss: tokens.toCss,
  validateTokens: tokens.validateTokens,
};
