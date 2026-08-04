import { defineConfig } from "wxt";

// Production / store builds talk only to the hosted relay (ADR-0010).
// Loopback is opt-in only when VITE_MOSS_USE_LOCAL_API=1 (developer machines).
const API_ORIGIN = "https://api.mossworkflow.dev/";
const UPLOAD_ORIGIN = "https://uploads.mossworkflow.dev/";
const LOCAL_API_ORIGIN = "http://127.0.0.1:8787/";

const allowLocalApi = process.env.VITE_MOSS_USE_LOCAL_API === "1";

const hostPermissions = allowLocalApi
  ? [API_ORIGIN, UPLOAD_ORIGIN, LOCAL_API_ORIGIN]
  : [API_ORIGIN, UPLOAD_ORIGIN];

const connectSrc = allowLocalApi
  ? "script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; connect-src 'self' https://api.mossworkflow.dev https://uploads.mossworkflow.dev http://127.0.0.1:8787"
  : "script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; connect-src 'self' https://api.mossworkflow.dev https://uploads.mossworkflow.dev";

export default defineConfig({
  srcDir: "src",
  publicDir: "src/public",
  modules: ["@wxt-dev/module-react"],
  outDir: ".output",
  manifestVersion: 3,
  manifest: {
    name: "Code Similarity Workflow",
    short_name: "Similarity",
    description:
      "Group student submissions, run a similarity check through a hosted relay, and review results.",
    version: "0.0.0",
    minimum_chrome_version: "120",
    // Every permission maps to a shipped feature; see docs/engineering/extension-shell.md.
    permissions: ["storage", "alarms"],
    optional_permissions: [],
    host_permissions: hostPermissions,
    action: {
      default_title: "Code Similarity Workflow",
      default_popup: "popup.html",
    },
    options_ui: {
      page: "settings.html",
      // Embedded options page; account controls also live in the popup.
      open_in_tab: false,
    },
    content_security_policy: {
      extension_pages: connectSrc,
    },
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
  },
  vite: () => ({
    build: {
      // Store review rejects bundles that ship debug sources.
      sourcemap: false,
      minify: true,
      target: "chrome120",
    },
  }),
  zip: {
    artifactTemplate: "moss-extension-{{version}}-{{browser}}.zip",
  },
});
