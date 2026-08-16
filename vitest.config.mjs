import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["app/extension/src/**/*.test.ts"],
    environment: "node",
  },
});
