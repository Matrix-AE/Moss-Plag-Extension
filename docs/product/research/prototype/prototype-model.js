(function attachPrototypeModel(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.MossResearchPrototype = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createPrototypeModel() {
  "use strict";

  const SUPPORTED_LANGUAGES = Object.freeze([
    "c",
    "cc",
    "java",
    "javascript",
    "python",
  ]);

  const SUPPORTED_EXTENSIONS = Object.freeze({
    c: Object.freeze([".c", ".h"]),
    cc: Object.freeze([".cc", ".cpp", ".cxx", ".h", ".hpp"]),
    java: Object.freeze([".java"]),
    javascript: Object.freeze([".js", ".jsx", ".mjs", ".cjs"]),
    python: Object.freeze([".py"]),
  });

  const SCREEN_ORDER = Object.freeze([
    "group",
    "configure",
    "review",
    "processing",
    "result",
  ]);

  const ERROR_MESSAGES = Object.freeze({
    "empty-group": "Each submission needs at least one supported source-code file.",
    "group-count": "Add at least two submissions to run a meaningful comparison.",
    "mixed-language": "This check cannot run with mixed languages. Create a separate check for each supported language.",
    offline: "You are offline. No files were sent. Reconnect before trying again.",
    "provider-timeout": "The check was sent, but the provider returned no report. Do not retry until the product marks it safe.",
    "unsupported-file": "Choose supported source-code files. Essays, PDFs, Word documents, images, and executables are not supported.",
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function file(name, language, bytes, virtualPath, issue) {
    return {
      id: `${name}-${bytes}-${virtualPath || "root"}`,
      name,
      language,
      bytes,
      virtualPath: virtualPath || name,
      issue: issue || null,
    };
  }

  function group(id, label, files) {
    return { id, label, files };
  }

  function pythonPair() {
    return [
      group("submission-a", "Submission A", [file("solution_a.py", "python", 1840)]),
      group("submission-b", "Submission B", [file("solution_b.py", "python", 2130)]),
    ];
  }

  function javaBatch() {
    const groups = [];
    for (let submission = 1; submission <= 5; submission += 1) {
      const files = [];
      for (let index = 1; index <= 4; index += 1) {
        files.push(
          file(
            `Class${index}.java`,
            "java",
            900 + submission * 100 + index * 17,
            `student-${submission}/src/Class${index}.java`,
          ),
        );
      }
      groups.push(group(`student-${submission}`, `Project ${submission}`, files));
    }
    return groups;
  }

  function javascriptProjects() {
    return [
      group("project-atlas", "Project Atlas", [
        file("index.js", "javascript", 1300, "project-atlas/src/index.js"),
        file("router.js", "javascript", 1120, "project-atlas/src/router.js"),
        file("store.js", "javascript", 980, "project-atlas/src/store.js"),
        file("format.js", "javascript", 640, "project-atlas/src/lib/format.js"),
      ]),
      group("project-nova", "Project Nova", [
        file("index.js", "javascript", 1420, "project-nova/src/index.js"),
        file("router.js", "javascript", 1050, "project-nova/src/router.js"),
        file("store.js", "javascript", 1010, "project-nova/src/store.js"),
        file("format.js", "javascript", 610, "project-nova/src/lib/format.js"),
      ]),
    ];
  }

  const BASE_STATE = Object.freeze({
    scenarioId: "empty",
    title: "",
    mode: "pair",
    screen: "group",
    groups: [],
    baseFiles: [],
    selectedLanguage: null,
    authorityConfirmed: false,
    processingConfirmed: false,
    online: true,
    providerOutcome: "ready",
    notice: null,
    result: null,
    researchOnly: true,
  });

  function scenario(overrides) {
    return Object.assign(clone(BASE_STATE), overrides);
  }

  const SCENARIO_FACTORIES = Object.freeze({
    empty: () =>
      scenario({
        scenarioId: "empty",
        title: "Untitled comparison",
        groups: [group("submission-a", "Submission A", []), group("submission-b", "Submission B", [])],
      }),
    "two-files": () =>
      scenario({
        scenarioId: "two-files",
        title: "Python exercise comparison",
        groups: pythonPair(),
        selectedLanguage: "python",
      }),
    "twenty-files": () =>
      scenario({
        scenarioId: "twenty-files",
        title: "Five Java projects",
        mode: "batch",
        groups: javaBatch(),
        selectedLanguage: "java",
      }),
    "two-projects": () =>
      scenario({
        scenarioId: "two-projects",
        title: "Two JavaScript projects",
        groups: javascriptProjects(),
        selectedLanguage: "javascript",
      }),
    "invalid-input": () =>
      scenario({
        scenarioId: "invalid-input",
        title: "Unsupported input example",
        groups: [
          group("submission-a", "Submission A", [file("solution.py", "python", 1200)]),
          group("submission-b", "Submission B", [
            file("assignment.pdf", null, 54000, "assignment.pdf", "unsupported-file"),
          ]),
        ],
        selectedLanguage: "python",
      }),
    "mixed-language": () =>
      scenario({
        scenarioId: "mixed-language",
        title: "Mixed-language example",
        groups: [
          group("submission-a", "Submission A", [file("solution.py", "python", 1200)]),
          group("submission-b", "Submission B", [file("solution.js", "javascript", 1500)]),
        ],
      }),
    offline: () =>
      scenario({
        scenarioId: "offline",
        title: "Offline submission example",
        groups: pythonPair(),
        selectedLanguage: "python",
        screen: "review",
        authorityConfirmed: true,
        processingConfirmed: true,
        online: false,
      }),
    timeout: () =>
      scenario({
        scenarioId: "timeout",
        title: "Provider timeout example",
        groups: pythonPair(),
        selectedLanguage: "python",
        screen: "review",
        authorityConfirmed: true,
        processingConfirmed: true,
        providerOutcome: "timeout",
      }),
    consent: () =>
      scenario({
        scenarioId: "consent",
        title: "Consent comprehension example",
        groups: pythonPair(),
        selectedLanguage: "python",
        screen: "review",
      }),
    pricing: () =>
      scenario({
        scenarioId: "pricing",
        title: "Pricing concept",
        groups: pythonPair(),
        selectedLanguage: "python",
        screen: "pricing",
        notice: "Research concept only. Nothing is for sale and exact service limits are not approved.",
      }),
    result: () =>
      scenario({
        scenarioId: "result",
        title: "Completed synthetic comparison",
        groups: pythonPair(),
        selectedLanguage: "python",
        screen: "result",
        authorityConfirmed: true,
        processingConfirmed: true,
        result: {
          reportUrl: "https://example.invalid/similarity-report/demo-001",
          availabilityLabel: "Estimated availability only",
          createdAt: "2026-07-29T00:00:00.000Z",
        },
      }),
  });

  function createScenario(id) {
    const factory = SCENARIO_FACTORIES[id];
    if (!factory) {
      throw new Error(`Unknown research scenario: ${id}`);
    }
    return factory();
  }

  function summarize(state) {
    const files = state.groups.flatMap((entry) => entry.files);
    const languages = [...new Set(files.map((entry) => entry.language).filter(Boolean))];
    return {
      groupCount: state.groups.length,
      fileCount: files.length,
      totalBytes: files.reduce((sum, entry) => sum + entry.bytes, 0),
      languages,
      baseFileCount: state.baseFiles.length,
    };
  }

  function validateDraft(state) {
    const errors = [];
    if (state.groups.length < 2) {
      errors.push({ code: "group-count", message: ERROR_MESSAGES["group-count"] });
    }
    state.groups.forEach((entry) => {
      if (entry.files.length === 0) {
        errors.push({
          code: "empty-group",
          groupId: entry.id,
          message: ERROR_MESSAGES["empty-group"],
        });
      }
      entry.files.forEach((candidate) => {
        if (candidate.issue === "unsupported-file" || !candidate.language) {
          errors.push({
            code: "unsupported-file",
            groupId: entry.id,
            fileId: candidate.id,
            message: ERROR_MESSAGES["unsupported-file"],
          });
        }
      });
    });
    const summary = summarize(state);
    if (summary.languages.length > 1) {
      errors.push({ code: "mixed-language", message: ERROR_MESSAGES["mixed-language"] });
    }
    if (state.selectedLanguage && summary.languages.some((item) => item !== state.selectedLanguage)) {
      if (!errors.some((entry) => entry.code === "mixed-language")) {
        errors.push({ code: "mixed-language", message: ERROR_MESSAGES["mixed-language"] });
      }
    }
    return errors;
  }

  function canReview(state) {
    return validateDraft(state).length === 0 && Boolean(state.selectedLanguage);
  }

  function canSubmit(state) {
    return (
      canReview(state) &&
      state.authorityConfirmed === true &&
      state.processingConfirmed === true &&
      state.online === true
    );
  }

  function submit(state) {
    const next = clone(state);
    const errors = validateDraft(next);
    if (errors.length > 0) {
      next.notice = errors[0].message;
      return next;
    }
    if (!next.authorityConfirmed || !next.processingConfirmed) {
      next.notice = "Confirm authority and external processing for this exact comparison before submission.";
      return next;
    }
    if (!next.online) {
      next.notice = ERROR_MESSAGES.offline;
      return next;
    }
    if (next.providerOutcome === "timeout") {
      next.screen = "error";
      next.notice = ERROR_MESSAGES["provider-timeout"];
      return next;
    }
    next.screen = "processing";
    next.notice = "Synthetic prototype only: no code was uploaded.";
    return next;
  }

  function nextScreen(state) {
    const index = SCREEN_ORDER.indexOf(state.screen);
    if (index < 0 || index === SCREEN_ORDER.length - 1) {
      return state.screen;
    }
    return SCREEN_ORDER[index + 1];
  }

  return Object.freeze({
    BASE_STATE,
    ERROR_MESSAGES,
    SCENARIO_IDS: Object.freeze(Object.keys(SCENARIO_FACTORIES)),
    SCREEN_ORDER,
    SUPPORTED_EXTENSIONS,
    SUPPORTED_LANGUAGES,
    canReview,
    canSubmit,
    createScenario,
    nextScreen,
    submit,
    summarize,
    validateDraft,
  });
});
