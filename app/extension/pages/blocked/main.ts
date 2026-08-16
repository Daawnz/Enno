import { mount } from "svelte";
import { initLocale } from "../../src/chrome/i18n";
import BlockedPage from "./BlockedPage.svelte";

void initLocale();
mount(BlockedPage, { target: document.getElementById("app")! });
