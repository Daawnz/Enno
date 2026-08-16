import { browser } from "../browser";
import {
  ALL_RULESET_IDS,
  GLOBAL_RULESET_ID,
  rulesetIdForLocale,
} from "../core/blocklist";
import { getCurrentLocale } from "./i18n";

export async function setRulesetEnabled(enabled: boolean): Promise<void> {
  const localeRuleset = rulesetIdForLocale(getCurrentLocale());
  const change = enabled
    ? {
        enableRulesetIds: [GLOBAL_RULESET_ID, localeRuleset],
        disableRulesetIds: ALL_RULESET_IDS.filter(
          id => id !== GLOBAL_RULESET_ID && id !== localeRuleset,
        ),
      }
    : {
        enableRulesetIds: [],
        disableRulesetIds: [...ALL_RULESET_IDS],
      };
  await browser.declarativeNetRequest.updateEnabledRulesets(change);
}
