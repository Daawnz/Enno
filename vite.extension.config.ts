import path from "node:path";
import { fileURLToPath } from "node:url";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(root, "app/extension"),
  envDir: root,
  base: "./",
  publicDir: false,
  plugins: [
    svelte(),
    tailwindcss(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./app/common/i18n/generated",
      emitTsDeclarations: true,
      strategy: ["localStorage", "preferredLanguage", "baseLocale"],
    }),
  ],
  build: {
    outDir: path.join(root, "dist/extension"),
    emptyOutDir: true,
    target: "chrome111",
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: path.join(root, "app/extension/popup.html"),
        blocked: path.join(root, "app/extension/blocked.html"),
        background: path.join(root, "app/extension/src/background.ts"),
      },
      output: {
        entryFileNames: chunk =>
          chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
