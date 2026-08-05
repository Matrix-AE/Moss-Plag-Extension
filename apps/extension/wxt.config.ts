import { defineConfig } from "wxt";

function originWithSlash(value: string, fallback: string): string {
  const raw = String(value || fallback).trim().replace(/\/+$/, "");
  return `${raw}/`;
}

function originNoSlash(value: string, fallback: string): string {
  return String(value || fallback).trim().replace(/\/+$/, "");
}

const DEFAULT_API = "https://mossapi-production.up.railway.app";

const apiOrigin = originWithSlash(process.env.VITE_MOSS_API_ORIGIN || "", DEFAULT_API);
const uploadOrigin = originWithSlash(
  process.env.VITE_MOSS_UPLOAD_ORIGIN || process.env.VITE_MOSS_API_ORIGIN || "",
  originNoSlash(apiOrigin, DEFAULT_API),
);
const apiConnect = originNoSlash(apiOrigin, DEFAULT_API);
const uploadConnect = originNoSlash(uploadOrigin, DEFAULT_API);

const hostPermissions = [...new Set([apiOrigin, uploadOrigin])];
const connectHosts = [...new Set([apiConnect, uploadConnect])].join(" ");

export default defineConfig({
  srcDir: "src",
  publicDir: "src/public",
  modules: ["@wxt-dev/module-react"],
  outDir: ".output",
  manifestVersion: 3,
  manifest: {
    name: "PairProof — Code Similarity",
    short_name: "PairProof",
    description:
      "Group student submissions, run a similarity check through a hosted relay, and review results.",
    version: "0.0.0",
    minimum_chrome_version: "120",
    permissions: ["storage", "alarms", "identity"],
    optional_permissions: [],
    host_permissions: hostPermissions,
    action: {
      default_title: "PairProof",
      default_popup: "popup.html",
    },
    options_ui: {
      page: "settings.html",
      open_in_tab: false,
    },
    content_security_policy: {
      extension_pages: `script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; connect-src 'self' ${connectHosts}`,
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
      sourcemap: false,
      minify: true,
      target: "chrome120",
    },
  }),
  zip: {
    artifactTemplate: "moss-extension-{{version}}-{{browser}}.zip",
  },
});
