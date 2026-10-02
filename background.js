const DEFAULT_CSS = "pre { direction: ltr; }";
const DEFAULT_PRIORITY = "manual-wins";
const TAB_STATE_KEY = "pagerrtl_tab_states";

async function getTabStates() {
  const data = await chrome.storage.session.get(TAB_STATE_KEY);
  return data[TAB_STATE_KEY] || {};
}
async function setTabStates(states) {
  await chrome.storage.session.set({ [TAB_STATE_KEY]: states });
}
async function getTabState(tabId) {
  const states = await getTabStates();
  return states[tabId] || null;
}
async function setTabState(tabId, state) {
  const states = await getTabStates();
  if (state === null) delete states[tabId];
  else states[tabId] = state;
  await setTabStates(states);
}
async function getSettings() {
  return await chrome.storage.sync.get({
    customCss: DEFAULT_CSS,
    whitelist: "",
    priority: DEFAULT_PRIORITY,
  });
}
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
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l && !l.startsWith("#"));
  return entries.some((entry) => hostname === entry || hostname.endsWith("." + entry));
}
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
async function applyToTab(tabId, state) {
  const { customCss } = await getSettings();
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
    console.warn("PageRTL: could not apply to tab", tabId, err);
  }
}
function updateBadge(tabId, state) {
  const text = state === "on" ? "RTL" : "";
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#2196F3" });
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TAB_INFO") {
    (async () => {
      const tab = await chrome.tabs.get(message.tabId);
      const manualState = await getTabState(message.tabId);
      const { whitelist, priority } = await getSettings();
      const whitelisted = isWhitelisted(tab.url, whitelist);
      const effective = await decideStateForTab(tab);
      sendResponse({ manualState, whitelisted, priority, effective });
    })();
    return true;
  }
  if (message.type === "SET_TAB_STATE") {
    (async () => {
      await setTabState(message.tabId, message.state);
      await applyToTab(message.tabId, message.state);
      sendResponse({ ok: true, state: message.state });
    })();
    return true;
  }
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
  if (message.type === "ADD_TO_WHITELIST") {
    (async () => {
      const { whitelist } = await getSettings();
      const domain = message.domain.toLowerCase().trim();
      const lines = whitelist
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (!lines.includes(domain)) lines.push(domain);
      const newWhitelist = lines.join("\n");
      await chrome.storage.sync.set({ whitelist: newWhitelist });
      sendResponse({ ok: true, whitelist: newWhitelist });
    })();
    return true;
  }
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
  if (message.type === "SET_PRIORITY") {
    (async () => {
      await chrome.storage.sync.set({ priority: message.priority });
      sendResponse({ ok: true });
    })();
    return true;
  }
});
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-rtl") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  const currentState = await decideStateForTab(tab);
  const newState = currentState === "on" ? "off" : "on";
  await setTabState(tab.id, newState);
  await applyToTab(tab.id, newState);
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const states = await getTabStates();
  if (states[tabId]) {
    delete states[tabId];
    await setTabStates(states);
  }
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab.url || !tab.url.startsWith("http")) return;
  if (changeInfo.url) await setTabState(tabId, null);
  const effective = await decideStateForTab(tab);
  await applyToTab(tabId, effective);
});
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "sync") return;
  const relevant = changes.customCss || changes.whitelist || changes.priority;
  if (!relevant) return;
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    if (!tab.id) continue;
    const effective = await decideStateForTab(tab);
    await applyToTab(tab.id, effective);
  }
});
