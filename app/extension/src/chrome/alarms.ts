import type { AlarmName } from "../core/types";
import { browser } from "../browser";

export async function scheduleAlarm(name: AlarmName, when: number): Promise<void> {
  await browser.alarms.create(name, { when });
}

export async function clearAlarm(name: AlarmName): Promise<void> {
  await browser.alarms.clear(name);
}
