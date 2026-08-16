import path from "node:path";
import { fileURLToPath } from "node:url";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(root, "app/landing"),
  envDir: root,
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
    outDir: path.join(root, "dist/landing"),
    emptyOutDir: true,
    target: "chrome111",
    rollupOptions: {
      input: {
        index: path.join(root, "app/landing/index.html"),
        blocklist: path.join(root, "app/landing/blocklist.html"),
      },
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
