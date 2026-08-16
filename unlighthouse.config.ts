/* eslint-disable node/prefer-global/process */
import { defineConfig } from "unlighthouse";

const theme = process.env.UNLIGHTHOUSE_THEME === "dark" ? "dark" : "light";

export default defineConfig({
  site: "http://localhost:8000",
  urls: ["/", "/blocklist.html"],
  cache: false,
  scanner: {
    skipJavascript: false,
    samples: 1,
  },
  puppeteerOptions: {
    args: ["--headless=new", "--force-prefers-reduced-motion"],
  },
  hooks: {
    "puppeteer:before-goto": async (page) => {
      await page.emulateMediaFeatures([
        { name: "prefers-color-scheme", value: theme },
      ]);
    },
  },
  ci: {
    budget: {
      "performance": 100,
      "accessibility": 100,
      "best-practices": 100,
      "seo": 100,
    },
    buildStatic: true,
    reporter: "jsonExpanded",
  },
  outputPath: `./unlighthouse-artifacts/${theme}`,
});
