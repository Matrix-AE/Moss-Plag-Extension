"use strict";

/**
 * Language selection and detection (Prompt 040).
 * Languages come from server capabilities — never silent guesses.
 */

const {
  MOSS_LANGUAGE_FIXTURE,
  MOSS_LANGUAGE_ALIASES,
  MOSS_LANGUAGE_CODES,
  createMossCapabilitiesFixture,
} = require("./capabilities-fixture");

const LANGUAGE_VERSION = 1;

/** Fallback empty until capabilities arrive — UI must not invent a private catalog. */
const EMPTY_CAPABILITIES = Object.freeze({
  fetchedAt: null,
  languages: Object.freeze([]),
  aliases: Object.freeze({}),
});

function normalizeCapabilities(payload) {
  if (!payload || !Array.isArray(payload.languages)) {
    return { ok: false, error: "capabilities-missing", capabilities: EMPTY_CAPABILITIES };
  }
  const languages = payload.languages.map((entry) => ({
    code: String(entry.code || "").toLowerCase(),
    label: String(entry.label || entry.code || ""),
    extensions: Object.freeze((entry.extensions || []).map((ext) => String(ext).toLowerCase())),
  }));
  const aliases = {};
  for (const [alias, code] of Object.entries(payload.aliases || {})) {
    aliases[String(alias).toLowerCase()] = String(code).toLowerCase();
  }
  return {
    ok: true,
    capabilities: Object.freeze({
      fetchedAt: payload.fetchedAt || new Date().toISOString(),
      languages: Object.freeze(languages),
      aliases: Object.freeze(aliases),
    }),
  };
}

function isStale(capabilities, { maxAgeMs = 24 * 60 * 60 * 1000, now = Date.now() } = {}) {
  if (!capabilities?.fetchedAt) return true;
  const then = Date.parse(capabilities.fetchedAt);
  if (Number.isNaN(then)) return true;
  return now - then > maxAgeMs;
}

function extensionOf(name) {
  const base = String(name || "").toLowerCase();
  if (!base.includes(".")) return "";
  return `.${base.split(".").pop()}`;
}

function suggestLanguage(files, capabilities) {
  if (!capabilities?.languages?.length) {
    return {
      ok: false,
      error: "stale-or-missing-capabilities",
      suggestion: null,
      requiresConfirmation: true,
    };
  }
  const counts = new Map();
  const reasons = [];
  let extensionless = 0;
  for (const file of files || []) {
    const ext = extensionOf(file.displayName || file.name);
    if (!ext) {
      extensionless += 1;
      reasons.push({ file: file.displayName || file.name, reason: "extensionless" });
      continue;
    }
    const match = capabilities.languages.find((lang) => lang.extensions.includes(ext));
    if (!match) {
      reasons.push({ file: file.displayName || file.name, reason: "unsupported-extension", ext });
      continue;
    }
    counts.set(match.code, (counts.get(match.code) || 0) + 1);
    reasons.push({ file: file.displayName || file.name, reason: "extension-match", code: match.code, ext });
  }

  if (counts.size === 0) {
    return {
      ok: true,
      suggestion: null,
      confidence: "none",
      reasons,
      requiresConfirmation: true,
      guidance: extensionless
        ? "Some files have no extension. Choose a language manually."
        : "No supported extensions matched. Choose a language manually or remove unsupported files.",
    };
  }
  if (counts.size > 1) {
    return {
      ok: true,
      suggestion: null,
      confidence: "mixed",
      reasons,
      requiresConfirmation: true,
      guidance: "Mixed languages detected. Split into separate checks or remove mismatched files.",
      mixedCodes: [...counts.keys()],
    };
  }
  const code = [...counts.keys()][0];
  const lang = capabilities.languages.find((l) => l.code === code);
  const total = (files || []).length || 1;
  const matched = counts.get(code);
  const confidence = matched === total && extensionless === 0 ? "high" : "medium";
  return {
    ok: true,
    suggestion: { code, label: lang.label },
    confidence,
    reasons,
    requiresConfirmation: true,
    guidance: `Suggested ${lang.label} from file extensions. Confirm before continuing — guesses are never submitted silently.`,
  };
}

function resolveManualSelection(input, capabilities) {
  if (!capabilities?.languages?.length) {
    return { ok: false, error: "stale-or-missing-capabilities" };
  }
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return { ok: false, error: "empty-selection" };
  const aliased = capabilities.aliases[raw] || raw;
  const lang = capabilities.languages.find(
    (entry) => entry.code === aliased || entry.label.toLowerCase() === raw,
  );
  if (!lang) return { ok: false, error: "unsupported-language", input: raw };
  return { ok: true, code: lang.code, label: lang.label, confirmed: false };
}

function confirmLanguage(draft, code, capabilities) {
  const resolved = resolveManualSelection(code, capabilities);
  if (!resolved.ok) return resolved;
  const next = JSON.parse(JSON.stringify(draft || {}));
  next.language = resolved.code;
  next.languageConfirmed = true;
  next.languageLabel = resolved.label;
  return { ok: true, draft: next };
}

function searchLanguages(query, capabilities) {
  const q = String(query || "").trim().toLowerCase();
  const list = capabilities?.languages || [];
  if (!q) return list;
  return list.filter(
    (lang) => lang.code.includes(q) || lang.label.toLowerCase().includes(q),
  );
}

function buildLanguageSelectorHtml({ capabilities, selected = "", query = "" } = {}) {
  const options = searchLanguages(query, capabilities)
    .map(
      (lang) =>
        `<option value="${escape(lang.code)}" ${lang.code === selected ? "selected" : ""}>${escape(lang.label)}</option>`,
    )
    .join("");
  return {
    ok: true,
    html: [
      `<div class="language-selector">`,
      `<label class="type-label" for="language-search">Search languages</label>`,
      `<input id="language-search" class="focus-ring" type="search" value="${escape(query)}" aria-label="Search languages" />`,
      `<label class="type-label" for="language-select">Language</label>`,
      `<select id="language-select" class="focus-ring" aria-label="Programming language" required>`,
      `<option value="">Select a language…</option>`,
      options,
      `</select>`,
      `<p class="type-helper">Suggestions from extensions still need your confirmation.</p>`,
      `</div>`,
    ].join(""),
  };
}

function validateLanguageModule() {
  const errors = [];
  const caps = normalizeCapabilities({
    fetchedAt: new Date().toISOString(),
    languages: [
      { code: "python", label: "Python", extensions: [".py"] },
      { code: "java", label: "Java", extensions: [".java"] },
      { code: "javascript", label: "JavaScript", extensions: [".js"] },
    ],
    aliases: { py: "python", js: "javascript" },
  });
  if (!caps.ok) errors.push("normalize");

  const known = suggestLanguage([{ displayName: "Main.PY", name: "Main.PY" }], caps.capabilities);
  if (known.suggestion?.code !== "python" || known.confidence !== "high") errors.push("known");

  const ambiguous = suggestLanguage(
    [{ displayName: "a.py" }, { displayName: "b.java" }],
    caps.capabilities,
  );
  if (ambiguous.confidence !== "mixed") errors.push("mixed");

  const extensionless = suggestLanguage([{ displayName: "Makefile" }], caps.capabilities);
  if (extensionless.suggestion !== null) errors.push("extensionless");

  const unsupported = suggestLanguage([{ displayName: "x.xyz" }], caps.capabilities);
  if (unsupported.suggestion !== null) errors.push("unsupported");

  const manual = resolveManualSelection("PY", caps.capabilities);
  if (!manual.ok || manual.code !== "python") errors.push("alias");

  const confirmed = confirmLanguage({}, "python", caps.capabilities);
  if (!confirmed.draft.languageConfirmed) errors.push("confirm");

  const stale = isStale({ fetchedAt: "2000-01-01T00:00:00.000Z" });
  if (!stale) errors.push("stale");

  const missing = suggestLanguage([{ displayName: "a.py" }], EMPTY_CAPABILITIES);
  if (missing.error !== "stale-or-missing-capabilities") errors.push("missing-caps");

  // Never auto-confirm a guess
  if (known.requiresConfirmation !== true) errors.push("must-confirm");

  const fixture = normalizeCapabilities(createMossCapabilitiesFixture());
  if (!fixture.ok) errors.push("moss-fixture");
  if (fixture.capabilities.languages.length !== MOSS_LANGUAGE_CODES.length) {
    errors.push("moss-count");
  }
  for (const code of [
    "c",
    "cc",
    "java",
    "ml",
    "pascal",
    "ada",
    "lisp",
    "scheme",
    "haskell",
    "fortran",
    "ascii",
    "vhdl",
    "perl",
    "matlab",
    "python",
    "mips",
    "prolog",
    "spice",
    "vb",
    "csharp",
    "modula2",
    "a8086",
    "javascript",
    "plsql",
  ]) {
    if (!fixture.capabilities.languages.some((lang) => lang.code === code)) {
      errors.push(`missing-${code}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function escape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

module.exports = {
  LANGUAGE_VERSION,
  EMPTY_CAPABILITIES,
  MOSS_LANGUAGE_FIXTURE,
  MOSS_LANGUAGE_ALIASES,
  MOSS_LANGUAGE_CODES,
  createMossCapabilitiesFixture,
  normalizeCapabilities,
  isStale,
  suggestLanguage,
  resolveManualSelection,
  confirmLanguage,
  searchLanguages,
  buildLanguageSelectorHtml,
  validateLanguageModule,
};
