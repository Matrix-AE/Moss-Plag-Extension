"use strict";

/**
 * Server/provider capability fixture for MOSS languages (mossnet @languages).
 * UI must consume this via normalizeCapabilities — never invent a private catalog
 * or hard-code protocol commands in React.
 *
 * Protocol codes (client-observed): c cc java ml pascal ada lisp scheme haskell
 * fortran ascii vhdl perl matlab python mips prolog spice vb csharp modula2
 * a8086 javascript plsql
 */

const MOSS_LANGUAGE_FIXTURE = Object.freeze([
  Object.freeze({ code: "c", label: "C", extensions: Object.freeze([".c", ".h"]) }),
  Object.freeze({
    code: "cc",
    label: "C++",
    extensions: Object.freeze([".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx"]),
  }),
  Object.freeze({ code: "java", label: "Java", extensions: Object.freeze([".java"]) }),
  Object.freeze({ code: "ml", label: "ML", extensions: Object.freeze([".ml", ".mli"]) }),
  Object.freeze({ code: "pascal", label: "Pascal", extensions: Object.freeze([".pas", ".pp", ".p"]) }),
  Object.freeze({ code: "ada", label: "Ada", extensions: Object.freeze([".adb", ".ads", ".ada"]) }),
  Object.freeze({ code: "lisp", label: "Lisp", extensions: Object.freeze([".lisp", ".lsp", ".cl"]) }),
  Object.freeze({ code: "scheme", label: "Scheme", extensions: Object.freeze([".scm", ".ss"]) }),
  Object.freeze({ code: "haskell", label: "Haskell", extensions: Object.freeze([".hs", ".lhs"]) }),
  Object.freeze({
    code: "fortran",
    label: "Fortran",
    extensions: Object.freeze([".f", ".for", ".f90", ".f95", ".f03"]),
  }),
  Object.freeze({ code: "ascii", label: "ASCII", extensions: Object.freeze([".txt", ".text"]) }),
  Object.freeze({ code: "vhdl", label: "VHDL", extensions: Object.freeze([".vhd", ".vhdl"]) }),
  Object.freeze({ code: "perl", label: "Perl", extensions: Object.freeze([".pl", ".pm"]) }),
  Object.freeze({ code: "matlab", label: "MATLAB", extensions: Object.freeze([".m"]) }),
  Object.freeze({ code: "python", label: "Python", extensions: Object.freeze([".py"]) }),
  Object.freeze({ code: "mips", label: "MIPS", extensions: Object.freeze([".s", ".asm"]) }),
  Object.freeze({ code: "prolog", label: "Prolog", extensions: Object.freeze([".pl", ".pro"]) }),
  Object.freeze({ code: "spice", label: "SPICE", extensions: Object.freeze([".cir", ".sp", ".spi"]) }),
  Object.freeze({ code: "vb", label: "VB", extensions: Object.freeze([".vb", ".bas", ".vbs"]) }),
  Object.freeze({ code: "csharp", label: "C#", extensions: Object.freeze([".cs"]) }),
  Object.freeze({
    code: "modula2",
    label: "Modula-2",
    extensions: Object.freeze([".mod", ".def"]),
  }),
  Object.freeze({ code: "a8086", label: "A8086", extensions: Object.freeze([".asm", ".a86"]) }),
  Object.freeze({
    code: "javascript",
    label: "JavaScript",
    extensions: Object.freeze([".js", ".jsx", ".mjs", ".cjs"]),
  }),
  Object.freeze({
    code: "plsql",
    label: "PL/SQL",
    extensions: Object.freeze([".sql", ".pls", ".pkb", ".pks"]),
  }),
]);

const MOSS_LANGUAGE_ALIASES = Object.freeze({
  "c++": "cc",
  cpp: "cc",
  "c#": "csharp",
  cs: "csharp",
  py: "python",
  js: "javascript",
  "modula-2": "modula2",
  modula: "modula2",
  "pl/sql": "plsql",
  "visual basic": "vb",
  visualbasic: "vb",
});

/** Screenshot / mossnet language codes in stable display order. */
const MOSS_LANGUAGE_CODES = Object.freeze(MOSS_LANGUAGE_FIXTURE.map((entry) => entry.code));

function createMossCapabilitiesFixture({ fetchedAt = new Date().toISOString() } = {}) {
  return Object.freeze({
    fetchedAt,
    languages: MOSS_LANGUAGE_FIXTURE,
    aliases: MOSS_LANGUAGE_ALIASES,
  });
}

module.exports = {
  MOSS_LANGUAGE_FIXTURE,
  MOSS_LANGUAGE_ALIASES,
  MOSS_LANGUAGE_CODES,
  createMossCapabilitiesFixture,
};
