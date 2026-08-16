import { mount } from "svelte";
import { initLandingLocale } from "../locale";
import BlocklistPage from "./BlocklistPage.svelte";

initLandingLocale();
mount(BlocklistPage, { target: document.getElementById("app")! });
