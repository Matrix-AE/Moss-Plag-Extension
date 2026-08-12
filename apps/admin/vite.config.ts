import {
  fileURLToPath,
  URL
} from "node:url";

import {
  defineConfig
} from "vite";

import react from "@vitejs/plugin-react";

const appRoot =
  fileURLToPath(
    new URL(
      ".",
      import.meta.url,
    ),
  );

export default defineConfig({
  root: appRoot,

  plugins: [
    react(),
  ],

  server: {
    port: 5174,

    proxy: {
      "/v1":
        "http://127.0.0.1:8787",

      "/health":
        "http://127.0.0.1:8787",
    },
  },

  build: {
    target: "es2022",
    sourcemap: false,
    cssMinify: false,
  },
});