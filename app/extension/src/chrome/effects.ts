import type { Effects } from "../core/types";
import { clearAlarm, scheduleAlarm } from "./alarms";
import { setRulesetEnabled } from "./rules";

export async function applyEffects(effects: Effects): Promise<void> {
  await setRulesetEnabled(effects.rulesetEnabled);
  for (const name of effects.clearAlarms) await clearAlarm(name);
  if (effects.scheduleAlarm) {
    await scheduleAlarm(effects.scheduleAlarm.name, effects.scheduleAlarm.when);
  }
}
