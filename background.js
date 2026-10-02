// background.js

const DEFAULT_CSS = "pre { direction: ltr; }";
const DEFAULT_PRIORITY = "manual-wins"; // "manual-wins" | "whitelist-wins" | "manual-only"
const TAB_STATE_KEY = "pagerrtl_tab_states";

// ============================================================
//  Storage helpers — tab states (per-tab, session-scoped)
// ============================================================

async function getTabStates() {
  const data = await chrome.storage.session.get(TAB_STATE_KEY);
  return data[TAB_STATE_KEY] || {};
}

async function setTabStates(states) {
  await chrome.storage.session.set({ [TAB_STATE_KEY]: states });
}

async function getTabState(tabId) {
  const states = await getTabStates();
  return states[tabId] || null; // null = no manual decision yet
}

async function setTabState(tabId, state) {
  const states = await getTabStates();
  if (state === null) {
    delete states[tabId];
  } else {
    states[tabId] = state; // "on" | "off"
  }
  await setTabStates(states);
}

// ============================================================
//  Storage helpers — global settings
// ============================================================

async function getSettings() {
  return await chrome.storage.sync.get({
    customCss: DEFAULT_CSS,
    whitelist: "",
    priority: DEFAULT_PRIORITY,
    domainCss: {},
  });
}

// ============================================================
//  Whitelist helpers
// ============================================================

function isWhitelisted(url, whitelistText) {
  if (!whitelistText || whitelistText.trim() === "") return false;

  let hostname;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  const entries = whitelistText
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line && !line.startsWith("#"));

  return entries.some((entry) => {
    if (hostname === entry) return true;
    if (hostname.endsWith("." + entry)) return true;
    return false;
  });
}

// ============================================================
//  Domain-specific CSS helpers
// ============================================================

/**
 * Returns the effective CSS for a given URL by combining
 * the global customCss with any domain-specific CSS.
 * Domain-specific rules are appended last so they can override.
 */
async function getEffectiveCss(url) {
  const settings = await chrome.storage.sync.get({
    customCss: DEFAULT_CSS,
    domainCss: {},
  });

  const globalCss = settings.customCss || "";
  const domainCssMap = settings.domainCss || {};

  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return globalCss;
  }

  // Find the most specific matching domain (longest match wins)
  let matchedDomain = null;
  for (const domain of Object.keys(domainCssMap)) {
    const d = domain.toLowerCase().trim();
    if (!d) continue;
    if (hostname === d || hostname.endsWith("." + d)) {
      if (!matchedDomain || d.length > matchedDomain.length) {
        matchedDomain = d;
      }
    }
  }

  const domainSpecific = matchedDomain ? domainCssMap[matchedDomain] : "";

  const parts = [globalCss, domainSpecific].filter((s) => s && s.trim() !== "");
  return parts.join("\n\n");
}

/**
 * Checks if the given hostname has a domain-specific CSS entry.
 */
async function hasDomainCss(hostname) {
  const { domainCss } = await chrome.storage.sync.get({ domainCss: {} });
  if (!hostname || !domainCss) return false;
  hostname = hostname.toLowerCase();

  for (const domain of Object.keys(domainCss)) {
    const d = domain.toLowerCase().trim();
    if (!d) continue;
    if (hostname === d || hostname.endsWith("." + d)) return true;
  }
  return false;
}

// ============================================================
//  Decision logic — should RTL be on for this tab?
// ============================================================

/**
 * @returns {"on" | "off"}
 */
async function decideStateForTab(tab) {
  const { whitelist, priority } = await getSettings();
  const manualState = await getTabState(tab.id);
  const whitelisted = isWhitelisted(tab.url, whitelist);

  switch (priority) {
    case "manual-only":
      return manualState === "on" ? "on" : "off";

    case "whitelist-wins":
      if (whitelisted) return "on";
      return manualState === "on" ? "on" : "off";

    case "manual-wins":
    default:
      if (manualState === "on") return "on";
      if (manualState === "off") return "off";
      return whitelisted ? "on" : "off";
  }
}

// ============================================================
//  Apply to tab (inject content.js + call enable/disable)
// ============================================================

async function applyToTab(tabId, state) {
  let customCss = "";
  if (state === "on") {
    try {
      const tab = await chrome.tabs.get(tabId);
      customCss = await getEffectiveCss(tab.url || "");
    } catch {
      customCss = "";
    }
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content.js"],
    });

    const func = state === "on" ? "enable" : "disable";
    const args = state === "on" ? [customCss] : [];

    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: (fnName, fnArgs) => {
        if (window.__PageRTL__ && typeof window.__PageRTL__[fnName] === "function") {
          window.__PageRTL__[fnName](...fnArgs);
        }
      },
      args: [func, args],
    });

    updateBadge(tabId, state);
  } catch (err) {
    // Restricted page (chrome://, PDF viewer, etc.)
    console.warn("PageRTL: could not apply to tab", tabId, err);
  }
}

// ============================================================
//  Badge
// ============================================================

function updateBadge(tabId, state) {
  const text = state === "on" ? "RTL" : "";
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#2196F3" });
}

// ============================================================
//  Message handler (from popup)
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ---- GET_TAB_INFO ----
  if (message.type === "GET_TAB_INFO") {
    (async () => {
      const tab = await chrome.tabs.get(message.tabId);
      const manualState = await getTabState(message.tabId);
      const { whitelist, priority } = await getSettings();
      const whitelisted = isWhitelisted(tab.url, whitelist);
      const effective = await decideStateForTab(tab);

      let hostname = "";
      try {
        hostname = new URL(tab.url).hostname.toLowerCase();
      } catch {}

      const hasCss = await hasDomainCss(hostname);

      sendResponse({
        manualState,
        whitelisted,
        priority,
        effective,
        hasDomainCss: hasCss,
        hostname,
      });
    })();
    return true;
  }

  // ---- SET_TAB_STATE ----
  if (message.type === "SET_TAB_STATE") {
    (async () => {
      await setTabState(message.tabId, message.state);
      await applyToTab(message.tabId, message.state);
      sendResponse({ ok: true, state: message.state });
    })();
    return true;
  }

  // ---- CLEAR_TAB_STATE ----
  if (message.type === "CLEAR_TAB_STATE") {
    (async () => {
      await setTabState(message.tabId, null);
      const tab = await chrome.tabs.get(message.tabId);
      const effective = await decideStateForTab(tab);
      await applyToTab(message.tabId, effective);
      sendResponse({ ok: true, effective });
    })();
    return true;
  }

  // ---- ADD_TO_WHITELIST ----
  if (message.type === "ADD_TO_WHITELIST") {
    (async () => {
      const { whitelist } = await getSettings();
      const domain = message.domain.toLowerCase().trim();
      const lines = whitelist
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (!lines.includes(domain)) {
        lines.push(domain);
      }
      const newWhitelist = lines.join("\n");
      await chrome.storage.sync.set({ whitelist: newWhitelist });
      sendResponse({ ok: true, whitelist: newWhitelist });
    })();
    return true;
  }

  // ---- REMOVE_FROM_WHITELIST ----
  if (message.type === "REMOVE_FROM_WHITELIST") {
    (async () => {
      const { whitelist } = await getSettings();
      const domain = message.domain.toLowerCase().trim();
      const lines = whitelist
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .filter((l) => l.toLowerCase() !== domain);
      const newWhitelist = lines.join("\n");
      await chrome.storage.sync.set({ whitelist: newWhitelist });
      sendResponse({ ok: true, whitelist: newWhitelist });
    })();
    return true;
  }

  // ---- ADD_DOMAIN_CSS ----
  if (message.type === "ADD_DOMAIN_CSS") {
    (async () => {
      const { domainCss } = await chrome.storage.sync.get({ domainCss: {} });
      const domain = message.domain.toLowerCase().trim();

      if (domainCss[domain] === undefined) {
        // Add with empty CSS — user will edit it in Options
        domainCss[domain] = "";
        await chrome.storage.sync.set({ domainCss });
      }

      // Re-apply to the current tab (in case RTL is on)
      if (message.tabId) {
        try {
          const tab = await chrome.tabs.get(message.tabId);
          const effective = await decideStateForTab(tab);
          await applyToTab(message.tabId, effective);
        } catch {}
      }

      sendResponse({ ok: true });
    })();
    return true;
  }

  // ---- REMOVE_DOMAIN_CSS ----
  if (message.type === "REMOVE_DOMAIN_CSS") {
    (async () => {
      const { domainCss } = await chrome.storage.sync.get({ domainCss: {} });
      const domain = message.domain.toLowerCase().trim();

      // Remove any matching key (case-insensitive)
      for (const key of Object.keys(domainCss)) {
        if (key.toLowerCase() === domain) {
          delete domainCss[key];
        }
      }

      await chrome.storage.sync.set({ domainCss });

      // Re-apply to the current tab
      if (message.tabId) {
        try {
          const tab = await chrome.tabs.get(message.tabId);
          const effective = await decideStateForTab(tab);
          await applyToTab(message.tabId, effective);
        } catch {}
      }

      sendResponse({ ok: true });
    })();
    return true;
  }

  // ---- SET_PRIORITY ----
  if (message.type === "SET_PRIORITY") {
    (async () => {
      await chrome.storage.sync.set({ priority: message.priority });
      sendResponse({ ok: true });
    })();
    return true;
  }
});

// ============================================================
//  Keyboard shortcut
// ============================================================

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-rtl") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  const currentState = await decideStateForTab(tab);
  const newState = currentState === "on" ? "off" : "on";

  // A shortcut press counts as a manual decision.
  await setTabState(tab.id, newState);
  await applyToTab(tab.id, newState);
});

// ============================================================
//  Tab lifecycle events
// ============================================================

// Forget a tab's state when it is closed.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const states = await getTabStates();
  if (states[tabId]) {
    delete states[tabId];
    await setTabStates(states);
  }
});

// When a tab finishes loading, decide what to do.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab.url || !tab.url.startsWith("http")) return;

  // If the URL changed (navigation), the previous manual decision may
  // no longer be relevant. Reset it so whitelist can take effect again.
  if (changeInfo.url) {
    await setTabState(tabId, null);
  }

  const effective = await decideStateForTab(tab);
  await applyToTab(tabId, effective);
});

// ============================================================
//  React to settings changes
// ============================================================

// If any relevant setting changes, re-evaluate every open tab.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "sync") return;

  const relevant = changes.customCss || changes.domainCss || changes.whitelist || changes.priority;
  if (!relevant) return;

  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    if (!tab.id) continue;
    const effective = await decideStateForTab(tab);
    await applyToTab(tab.id, effective);
  }
});
