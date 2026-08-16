import { browser } from "../browser";
import { blockedRootDomainOf } from "../core/blocklist";
import { setRulesetEnabled } from "./rules";

// A pass lets a single navigation reach a blocked domain, then elapses so any
// later navigation (e.g. a refresh) is blocked again. It works by installing a
// dynamic `allow` DNR rule (priority 2, higher than the static blocklist
// redirect rule at priority 1) for a blocked domain and revoking it once that
// domain's main-frame navigation commits.
//
// The `allow` covers the granted domain and all of its subdomains (e.g. a pass
// for reddit.com also allows old.reddit.com), so a same-navigation redirect to
// a subdomain (reddit.com -> old.reddit.com) reaches the final page instead of
// being re-blocked. It is revoked on the first main-frame commit of any host
// inside that domain, so a later navigation (a refresh) is blocked again. A
// redirect to a DIFFERENT blocked domain is not followed by design: an unlock
// never bleeds into unrelated blocked sites.
//
// DNR rules are not scoped to a tab: while an `allow` is installed it applies
// to every tab, so a concurrent main-frame hit to the same domain in another
// tab may slip through. Its lifetime is bounded (commit + 30s fallback), which
// limits the window to an accepted edge case.

type PendingPass = {
  ruleId: number;
  host: string;
  root: string | null;
  timer: ReturnType<typeof setTimeout> | null;
};

let nextRuleId = 1;
const pending = new Map<number, PendingPass>();

const REVOKE_MS = 30_000;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hostOf(url: string) {
  try {
    const host = new URL(url).hostname;
    return host || null;
  }
  catch {
    return null;
  }
}

async function revokeAllow(ruleId: number) {
  try {
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ruleId],
      addRules: [],
    });
  }
  catch {
    // The rule has already elapsed; nothing to do.
  }
}

function clearPending(tabId: number) {
  const entry = pending.get(tabId);
  if (!entry)
    return;
  if (entry.timer)
    clearTimeout(entry.timer);
  pending.delete(tabId);
}

async function grantDynamicAllow(tabId: number, host: string, root: string | null) {
  const ruleId = nextRuleId++;
  const regexFilter = root
    ? `^\\s*https?://(?:[^/]*\\.)?${escapeRegex(root)}($|[/?#])`
    : `^\\s*https?://${escapeRegex(host)}($|[/?#])`;
  try {
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [],
      addRules: [
        {
          id: ruleId,
          priority: 2,
          action: { type: "allow" },
          condition: { regexFilter, resourceTypes: ["main_frame"] },
        },
      ],
    });
  }
  catch {
    return false;
  }

  const timer = setTimeout(() => {
    clearPending(tabId);
    void revokeAllow(ruleId);
  }, REVOKE_MS);
  pending.set(tabId, { ruleId, host, root, timer });
  return true;
}

export async function grantPass(tabId: number, targetUrl: string): Promise<boolean> {
  const host = hostOf(targetUrl);
  if (!host)
    return false;
  const root = blockedRootDomainOf(host);

  // A tab holds at most one pending pass.
  const prior = pending.get(tabId);
  if (prior) {
    clearPending(tabId);
    await revokeAllow(prior.ruleId);
  }

  if (await grantDynamicAllow(tabId, host, root)) {
    // The messenger navigates; the commit revoke then re-enables blocking.
    return true;
  }

  // If the dynamic `allow` rule cannot be installed (older Firefox), fall back
  // to a brief global ruleset disable around the navigation itself; still a
  // single pass because the ruleset is re-enabled immediately after the
  // navigation commits.
  try {
    await setRulesetEnabled(false);
    await browser.tabs.update(tabId, { url: targetUrl });
  }
  catch {
    // ignore
  }
  await setRulesetEnabled(true);
  return false;
}

export function registerPassCleanup(): void {
  browser.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0)
      return;
    const host = hostOf(details.url);
    if (!host)
      return;
    const entry = pending.get(details.tabId);
    if (!entry)
      return;
    const inPass = entry.root
      ? host === entry.root || host.endsWith(`.${entry.root}`)
      : host === entry.host;
    if (inPass) {
      clearPending(details.tabId);
      void revokeAllow(entry.ruleId);
    }
  });
}
