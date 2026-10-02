// popup.js

const toggleEl = document.getElementById("toggle");
const statusEl = document.getElementById("status");
const warnEl = document.getElementById("warn");
const siteNameEl = document.getElementById("siteName");
const openOptionsEl = document.getElementById("openOptions");
const resetManualEl = document.getElementById("resetManual");

const whitelistRowEl = document.getElementById("whitelistRow");
const whitelistValueEl = document.getElementById("whitelistValue");
const whitelistBtnEl = document.getElementById("whitelistBtn");

const domainCssRowEl = document.getElementById("domainCssRow");
const domainCssValueEl = document.getElementById("domainCssValue");
const domainCssBtnEl = document.getElementById("domainCssBtn");

let currentTab = null;
let currentHostname = null;
let currentWhitelisted = false;
let currentHasDomainCss = false;

function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge-extension://") ||
    url.startsWith("devtools://") ||
    url.startsWith("https://chrome.google.com/webstore") ||
    url.startsWith("https://microsoftedge.microsoft.com/addons")
  );
}

async function refresh() {
  const info = await chrome.runtime.sendMessage({
    type: "GET_TAB_INFO",
    tabId: currentTab.id,
  });

  toggleEl.checked = info.effective === "on";
  currentWhitelisted = info.whitelisted;
  currentHasDomainCss = info.hasDomainCss;

  // ---- Whitelist UI ----
  if (currentWhitelisted) {
    whitelistValueEl.textContent = "yes ✓";
    whitelistValueEl.style.color = "#2e7d32";
    whitelistBtnEl.textContent = "Remove";
    whitelistBtnEl.classList.remove("primary");
  } else {
    whitelistValueEl.textContent = "no";
    whitelistValueEl.style.color = "#888";
    whitelistBtnEl.textContent = "Add";
    whitelistBtnEl.classList.add("primary");
  }

  // ---- Domain CSS UI ----
  if (currentHasDomainCss) {
    domainCssValueEl.textContent = "yes ✓";
    domainCssValueEl.style.color = "#2e7d32";
    domainCssBtnEl.textContent = "Remove";
    domainCssBtnEl.classList.remove("primary");
  } else {
    domainCssValueEl.textContent = "no";
    domainCssValueEl.style.color = "#888";
    domainCssBtnEl.textContent = "Add";
    domainCssBtnEl.classList.add("primary");
  }

  // ---- Status label ----
  if (info.manualState === null) {
    statusEl.textContent = currentWhitelisted ? "Auto-enabled via whitelist" : "No manual decision yet";
    statusEl.style.color = currentWhitelisted ? "#2e7d32" : "#888";
  } else {
    statusEl.textContent = `Manual: ${info.manualState.toUpperCase()}`;
    statusEl.style.color = info.manualState === "on" ? "#2e7d32" : "#888";
  }
}

// ---- Init ----
(async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    warnEl.textContent = "No active tab.";
    toggleEl.disabled = true;
    return;
  }

  currentTab = tab;

  try {
    const url = new URL(tab.url);
    currentHostname = url.hostname.toLowerCase();
    siteNameEl.textContent = currentHostname || url.protocol;
  } catch {
    siteNameEl.textContent = tab.url || "";
  }

  if (isRestrictedUrl(tab.url)) {
    warnEl.textContent = "This page cannot be modified.";
    toggleEl.disabled = true;
    whitelistRowEl.style.opacity = "0.5";
    whitelistBtnEl.disabled = true;
    domainCssRowEl.style.opacity = "0.5";
    domainCssBtnEl.disabled = true;
    resetManualEl.style.display = "none";
    return;
  }

  await refresh();
})();

// ---- Toggle on/off ----
toggleEl.addEventListener("change", async () => {
  const newState = toggleEl.checked ? "on" : "off";
  toggleEl.disabled = true;
  statusEl.textContent = "Applying…";

  await chrome.runtime.sendMessage({
    type: "SET_TAB_STATE",
    tabId: currentTab.id,
    state: newState,
  });

  toggleEl.disabled = false;
  await refresh();
});

// ---- Whitelist add/remove ----
whitelistBtnEl.addEventListener("click", async () => {
  if (!currentHostname) return;
  whitelistBtnEl.disabled = true;

  if (currentWhitelisted) {
    await chrome.runtime.sendMessage({
      type: "REMOVE_FROM_WHITELIST",
      domain: currentHostname,
    });
  } else {
    await chrome.runtime.sendMessage({
      type: "ADD_TO_WHITELIST",
      domain: currentHostname,
    });
  }

  whitelistBtnEl.disabled = false;
  await refresh();
});

// ---- Domain CSS add/remove ----
domainCssBtnEl.addEventListener("click", async () => {
  if (!currentHostname) return;
  domainCssBtnEl.disabled = true;

  if (currentHasDomainCss) {
    await chrome.runtime.sendMessage({
      type: "REMOVE_DOMAIN_CSS",
      domain: currentHostname,
      tabId: currentTab.id,
    });
  } else {
    await chrome.runtime.sendMessage({
      type: "ADD_DOMAIN_CSS",
      domain: currentHostname,
      tabId: currentTab.id,
    });
    // Open options page so the user can edit the CSS
    chrome.runtime.openOptionsPage();
  }

  domainCssBtnEl.disabled = false;
  await refresh();
});

// ---- Reset manual override ----
resetManualEl.addEventListener("click", async () => {
  if (!currentTab) return;
  await chrome.runtime.sendMessage({
    type: "CLEAR_TAB_STATE",
    tabId: currentTab.id,
  });
  await refresh();
});

// ---- Open options page ----
openOptionsEl.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
