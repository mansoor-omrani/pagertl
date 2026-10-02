const DEFAULT_CSS = "pre { direction: ltr; }";
const DEFAULT_PRIORITY = "manual-wins";

const textarea = document.getElementById("customCss");
const whitelistEl = document.getElementById("whitelist");
const priorityEl = document.getElementById("priority");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");
const openShortcutsEl = document.getElementById("openShortcuts");

chrome.storage.sync.get({ customCss: DEFAULT_CSS, whitelist: "", priority: DEFAULT_PRIORITY }, (settings) => {
  textarea.value = settings.customCss;
  whitelistEl.value = settings.whitelist;
  priorityEl.value = settings.priority;
});

saveBtn.addEventListener("click", () => {
  chrome.storage.sync.set({ customCss: textarea.value, whitelist: whitelistEl.value, priority: priorityEl.value }, () =>
    showStatus("Saved ✓"),
  );
});

resetBtn.addEventListener("click", () => {
  textarea.value = DEFAULT_CSS;
  whitelistEl.value = "";
  priorityEl.value = DEFAULT_PRIORITY;
  chrome.storage.sync.set({ customCss: DEFAULT_CSS, whitelist: "", priority: DEFAULT_PRIORITY }, () =>
    showStatus("Reset to default ✓"),
  );
});

openShortcutsEl.addEventListener("click", () => {
  const url = navigator.userAgent.includes("Edg/") ? "edge://extensions/shortcuts" : "chrome://extensions/shortcuts";
  chrome.tabs.create({ url });
});

function showStatus(msg) {
  statusEl.textContent = msg;
  statusEl.classList.add("show");
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => statusEl.classList.remove("show"), 1500);
}
