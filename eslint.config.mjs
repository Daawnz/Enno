import antfu from "@antfu/eslint-config";

export default antfu({
  svelte: true,
  stylistic: {
    indent: 2,
    quotes: "double",
    semi: true,
  },
  ignores: [
    "node_modules/**",
    "test-results/**",
    "playwright-report/**",
    "dist/**",
    "lhci-artifacts/**",
    ".lighthouseci/**",
    "tsconfig.json",
    "tsconfig.svelte.json",
    "app/common/i18n/generated/**",
    "app/common/i18n/messages/**",
    "docs/**",
    "project.inlang/.meta.json",
    "project.inlang/README.md",
    "project.inlang/cache/**",
  ],
}, {
  files: ["app/extension/src/**/*.ts", "app/landing/src/**/*.ts", "tests/**/*.ts"],
  rules: {
    "antfu/no-top-level-await": "off",
    "no-console": "off",
  },
}, {
  files: ["**/*.{ts,mts,cts}"],
  ignores: ["**/*.d.ts"],
  rules: {
    "ts/consistent-type-definitions": ["error", "type"],
    "test/prefer-lowercase-title": ["error", { ignoreTopLevelDescribe: true }],
  },
});
