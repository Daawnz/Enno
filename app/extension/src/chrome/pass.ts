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

// Retry budget for an unlock navigation that races DNR allow-rule propagation
// (see retryBlockedPassNavigation). Lives next to `pending` so it is cleared
// with the pass it belongs to.
const retryCount = new Map<number, number>();
const MAX_RETRY = 3;

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
  retryCount.delete(tabId);
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

function hostWithinPass(host: string, entry: PendingPass): boolean {
  return entry.root
    ? host === entry.root || host.endsWith(`.${entry.root}`)
    : host === entry.host;
}

// Exposed to the background navigation-error handler: whether a URL is inside
// a currently granted pass (the granted domain or one of its subdomains). A
// pass stays live until the first in-pass main-frame commit (or the 30s
// fallback), so a main-frame error on such a URL is pass-internal unless it is
// a declarativeNetRequest block (see retryBlockedPassNavigation).
export function passCoversUrl(tabId: number, url: string): boolean {
  const entry = pending.get(tabId);
  if (!entry)
    return false;
  const host = hostOf(url);
  return host !== null && hostWithinPass(host, entry);
}

// Called from the webNavigation error handler. A grant installs a dynamic
// `allow` rule and immediately navigates; DNR rule application can reach the
// network service a few milliseconds after updateDynamicRules resolves, so the
// very next navigation to the granted host can be briefly re-blocked by the
// static blocklist rule. When that happens, retry the same URL a bounded number
// of times (the allow rule is live by then) instead of bouncing the user back to
// the blocked page. Returns true if the retry was scheduled, false otherwise.
export function retryBlockedPassNavigation(tabId: number, url: string): boolean {
  if (!passCoversUrl(tabId, url))
    return false;
  const n = retryCount.get(tabId) ?? 0;
  if (n >= MAX_RETRY)
    return false;
  retryCount.set(tabId, n + 1);
  setTimeout(() => {
    void browser.tabs.update(tabId, { url });
  }, 20);
  return true;
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
