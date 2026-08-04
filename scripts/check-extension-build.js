"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_PAGES = ["popup.html", "settings.html"];
const ALLOWED_HOSTS = [
  "https://api.mossworkflow.dev/",
  "https://uploads.mossworkflow.dev/",
];
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const NETWORK_SINK_PATTERN =
  /(?:\bfetch|importScripts|new\s+WebSocket|new\s+EventSource|navigator\.sendBeacon|import)\s*\(\s*[`"']([^`"']+)[`"']/g;

const FORBIDDEN_CODE_PATTERNS = [
  { code: "eval", pattern: /\beval\s*\(/ },
  { code: "new-function", pattern: /new\s+Function\s*\(/ },
  { code: "source-map-reference", pattern: /sourceMappingURL/ },
  { code: "commonjs-require", pattern: /\brequire\(\s*["']/ },
  { code: "node-builtin-import", pattern: /(?:from|import)\s*\(?\s*["']node:/ },
  { code: "node-process-polyfill", pattern: /\bprocess\.(?:env|version|platform)\b/ },
];

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

// Permissions are only legitimate when the shell doc explains the feature that needs them.
function documentedPermissions(docPath) {
  if (!fs.existsSync(docPath)) {
    return null;
  }
  const doc = fs.readFileSync(docPath, "utf8");
  const section = doc.split("## Permissions")[1] || "";
  return [...section.matchAll(/^\| `([a-zA-Z]+)` \|/gm)].map((match) => match[1]);
}

function parseCsp(csp) {
  const directives = new Map();
  for (const part of csp.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    const name = tokens.shift();
    if (name) {
      directives.set(name, tokens);
    }
  }
  return directives;
}

function checkExtensionBuild(options = {}) {
  const outDir = options.outDir || path.resolve(__dirname, "../apps/extension/.output/chrome-mv3");
  const docPath = options.docPath || path.resolve(__dirname, "../docs/engineering/extension-shell.md");
  const violations = [];
  const add = (code, message) => violations.push({ code, message });

  if (!fs.existsSync(outDir)) {
    return { ok: false, violations: [{ code: "missing-build", message: `${outDir} does not exist` }] };
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8"));

  if (manifest.manifest_version !== 3) {
    add("manifest-version", `expected manifest_version 3, got ${manifest.manifest_version}`);
  }
  if (!manifest.background?.service_worker) {
    add("missing-service-worker", "manifest has no background.service_worker");
  }
  if (manifest.background?.persistent) {
    add("persistent-background", "MV3 forbids persistent background pages");
  }

  const declared = documentedPermissions(docPath);
  if (declared === null) {
    add("missing-doc", `${docPath} not found; permissions cannot be justified`);
  } else {
    for (const permission of manifest.permissions || []) {
      if (!declared.includes(permission)) {
        add("undocumented-permission", `permission "${permission}" has no documented feature`);
      }
    }
    for (const permission of declared) {
      if (!(manifest.permissions || []).includes(permission)) {
        add("unused-documented-permission", `documented permission "${permission}" is not requested`);
      }
    }
  }

  const hosts = manifest.host_permissions || [];
  for (const host of hosts) {
    if (!ALLOWED_HOSTS.includes(host)) {
      add("unexpected-host", `host permission ${host} is outside the approved origins`);
    }
  }
  for (const host of ALLOWED_HOSTS) {
    if (!hosts.includes(host)) {
      add("missing-host", `approved origin ${host} is not declared`);
    }
  }
  if ((manifest.optional_permissions || []).length) {
    add("optional-permissions", "shell must not ship optional permissions");
  }

  const csp = manifest.content_security_policy?.extension_pages;
  if (!csp) {
    add("missing-csp", "extension_pages CSP is required");
  } else {
    const directives = parseCsp(csp);
    if (JSON.stringify(directives.get("script-src")) !== JSON.stringify(["'self'"])) {
      add("weak-script-src", `script-src must be exactly 'self', got ${csp}`);
    }
    if (JSON.stringify(directives.get("object-src")) !== JSON.stringify(["'none'"])) {
      add("weak-object-src", "object-src must be 'none'");
    }
    if (/unsafe-(?:eval|inline)|wasm-unsafe-eval/.test(csp)) {
      add("unsafe-csp", "CSP must not allow unsafe-eval, unsafe-inline, or wasm-unsafe-eval");
    }
    for (const origin of directives.get("connect-src") || []) {
      if (origin !== "'self'" && !ALLOWED_HOSTS.includes(`${origin}/`)) {
        add("unexpected-connect-src", `connect-src ${origin} is outside the approved origins`);
      }
    }
  }

  for (const page of REQUIRED_PAGES) {
    if (!fs.existsSync(path.join(outDir, page))) {
      add("missing-page", `${page} is missing from the build`);
    }
  }

  for (const [size, relative] of Object.entries(manifest.icons || {})) {
    const file = path.join(outDir, relative);
    if (!fs.existsSync(file)) {
      add("missing-icon", `icon ${size} (${relative}) is missing`);
      continue;
    }
    if (!fs.readFileSync(file).subarray(0, 8).equals(PNG_MAGIC)) {
      add("invalid-icon", `icon ${relative} is not a PNG`);
    }
  }

  for (const file of walk(outDir)) {
    const relative = path.relative(outDir, file).replace(/\\/g, "/");
    if (file.endsWith(".map")) {
      add("source-map", `${relative} must not ship to the store`);
      continue;
    }
    if (file.endsWith(".js")) {
      const text = fs.readFileSync(file, "utf8");
      for (const rule of FORBIDDEN_CODE_PATTERNS) {
        if (rule.pattern.test(text)) {
          add(rule.code, `${relative} contains forbidden pattern ${rule.code}`);
        }
      }
      // Only network sinks matter here; bare URL strings are namespaces and doc links.
      for (const match of text.matchAll(NETWORK_SINK_PATTERN)) {
        const url = match[1] ?? "";
        if (/^https?:\/\//.test(url) && !ALLOWED_HOSTS.some((host) => url.startsWith(host.replace(/\/$/, "")))) {
          add("remote-endpoint", `${relative} calls ${match[0].slice(0, 24)}… against ${url}`);
        }
      }
      continue;
    }
    if (file.endsWith(".html")) {
      const html = fs.readFileSync(file, "utf8");
      for (const tag of html.match(/<script[^>]*>[\s\S]*?<\/script>/g) || []) {
        if (!/\ssrc=/.test(tag) || !/<script[^>]*>\s*<\/script>/.test(tag)) {
          add("inline-script", `${relative} contains an inline script`);
        }
        const src = /\ssrc="([^"]+)"/.exec(tag)?.[1];
        if (src && /^https?:/.test(src)) {
          add("remote-script", `${relative} loads remote script ${src}`);
        }
      }
      if (/\son[a-z]+="/.test(html)) {
        add("inline-handler", `${relative} contains an inline event handler`);
      }
    }
  }

  return { ok: violations.length === 0, violations, manifest };
}

if (require.main === module) {
  const result = checkExtensionBuild();
  if (!result.ok) {
    for (const violation of result.violations) {
      console.error(`[${violation.code}] ${violation.message}`);
    }
    process.exit(1);
  }
  console.log("Extension build check passed");
}

module.exports = { ALLOWED_HOSTS, checkExtensionBuild, documentedPermissions, parseCsp };
