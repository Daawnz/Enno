import { mount } from "svelte";
import { initLocale } from "../../src/chrome/i18n";
import { initPageTheme } from "../../src/chrome/theme";
import BlockedPage from "./BlockedPage.svelte";

async function bootstrap() {
  void initLocale();
  // Apply the stored Light/Dark/System choice before first paint so the blocked
  // page matches the popup instead of flashing the browser theme.
  await initPageTheme();
  mount(BlockedPage, { target: document.getElementById("app")! });
}

void bootstrap();
