import { mount } from "svelte";
import { initLocale } from "../../src/chrome/i18n";
import { initPageTheme } from "../../src/chrome/theme";
import Popup from "./Popup.svelte";

async function bootstrap() {
  void initLocale();
  // Apply the stored Light/Dark/System choice before first paint so the popup
  // does not flash the browser theme when an override is active.
  await initPageTheme();
  mount(Popup, { target: document.getElementById("app")! });
}

void bootstrap();
