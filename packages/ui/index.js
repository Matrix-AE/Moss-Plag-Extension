"use strict";

/** Browser-safe presentation helpers — must never import Node net/fs or provider transport. */
function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

module.exports = { escapeText };
