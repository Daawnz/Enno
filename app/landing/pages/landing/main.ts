import { mount } from "svelte";
import { initLandingLocale } from "../locale";
import Landing from "./Landing.svelte";

initLandingLocale();
mount(Landing, { target: document.getElementById("app")! });
