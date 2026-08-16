import { mount } from "svelte";
import { initLocale } from "../../src/chrome/i18n";
import Popup from "./Popup.svelte";

void initLocale();
mount(Popup, { target: document.getElementById("app")! });
