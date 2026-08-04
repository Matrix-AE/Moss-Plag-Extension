import { defineConfig } from "wxt";

function originWithSlash(value: string, fallback: string): string {
  const raw = String(value || fallback).trim().replace(/\/+$/, "");
  return `${raw}/`;
}

function originNoSlash(value: string, fallback: string): string {
  return String(value || fallback).trim().replace(/\/+$/, "");
}

const DEFAULT_API = "https://api.mossworkflow.dev";
const DEFAULT_UPLOAD = "https://uploads.mossworkflow.dev";

const apiOrigin = originWithSlash(process.env.VITE_MOSS_API_ORIGIN || "", DEFAULT_API);
const uploadOrigin = originWithSlash(
  process.env.VITE_MOSS_UPLOAD_ORIGIN || process.env.VITE_MOSS_API_ORIGIN || "",
  process.env.VITE_MOSS_API_ORIGIN ? originNoSlash(process.env.VITE_MOSS_API_ORIGIN, DEFAULT_API) : DEFAULT_UPLOAD,
);
const apiConnect = originNoSlash(apiOrigin, DEFAULT_API);
const uploadConnect = originNoSlash(uploadOrigin, DEFAULT_UPLOAD);

const LOCAL_API_ORIGIN = "http://127.0.0.1:8787/";
const allowLocalApi = process.env.VITE_MOSS_USE_LOCAL_API === "1";

const hostPermissions = allowLocalApi
  ? [apiOrigin, uploadOrigin, LOCAL_API_ORIGIN]
  : [apiOrigin, uploadOrigin];

const connectSrc = allowLocalApi
  ? `script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; connect-src 'self' ${apiConnect} ${uploadConnect} http://127.0.0.1:8787`
  : `script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; connect-src 'self' ${apiConnect} ${uploadConnect}`;

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
    permissions: ["storage", "alarms"],
    optional_permissions: [],
    host_permissions: hostPermissions,
    action: {
      default_title: "Code Similarity Workflow",
      default_popup: "popup.html",
    },
    options_ui: {
      page: "settings.html",
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
      sourcemap: false,
      minify: true,
      target: "chrome120",
    },
  }),
  zip: {
    artifactTemplate: "moss-extension-{{version}}-{{browser}}.zip",
  },
});
