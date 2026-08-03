/**
 * NEGATIVE FIXTURE — must never be imported by production code.
 * Used by Prompt 015 boundary tests to prove detection of forbidden imports.
 */
"use strict";

// eslint-disable-next-line no-unused-vars
const net = require("node:net");
// eslint-disable-next-line no-unused-vars
const adapter = require("@moss/provider-adapter");

module.exports = { net, adapter };
