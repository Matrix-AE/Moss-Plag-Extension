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

module.exports = {
  escapeText,
  tokens,
  TOKEN_VERSION: tokens.TOKEN_VERSION,
  SEMANTIC: tokens.SEMANTIC,
  COMPONENTS: tokens.COMPONENTS,
  toCss: tokens.toCss,
  validateTokens: tokens.validateTokens,
};
