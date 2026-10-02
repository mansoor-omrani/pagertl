// options.js

const DEFAULT_CSS = "pre { direction: ltr; }";
const DEFAULT_PRIORITY = "manual-wins";

// ============================================================
// Presets: predefined CSS for popular domains
// ============================================================

const DOMAIN_PRESETS = {
  "chat.deepseek.com": {
    label: "Deepseek",
    description: "Code blocks and diffs stay LTR",
    css: `#root > div > div > div:nth-child(1) {
  position: absolute !important;
  right: unset !important;
}
  
.ds-virtual-list-items:nth-child(1) {
    direction: ltr;
}`,
  },
};

// ============================================================
// Element refs
// ============================================================

const textarea = document.getElementById("customCss");
const whitelistEl = document.getElementById("whitelist");
const priorityEl = document.getElementById("priority");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");
const openShortcutsEl = document.getElementById("openShortcuts");

const presetListEl = document.getElementById("presetList");
const loadAllPresetsBtn = document.getElementById("loadAllPresetsBtn");
const presetCountEl = document.getElementById("presetCount");

const domainListEl = document.getElementById("domainList");
const newDomainEl = document.getElementById("newDomain");
const addDomainBtn = document.getElementById("addDomainBtn");
const domainEditorEl = document.getElementById("domainEditor");
const editingDomainNameEl = document.getElementById("editingDomainName");
const domainCssTextarea = document.getElementById("domainCssTextarea");
const deleteDomainBtn = document.getElementById("deleteDomainBtn");

// ============================================================
// State
// ============================================================

let domainCssMap = {};
let editingDomain = null;

// ============================================================
// Load settings
// ============================================================

chrome.storage.sync.get(
  {
    customCss: DEFAULT_CSS,
    whitelist: "",
    priority: DEFAULT_PRIORITY,
    domainCss: {},
  },
  (settings) => {
    textarea.value = settings.customCss;
    whitelistEl.value = settings.whitelist;
    priorityEl.value = settings.priority;
    domainCssMap = { ...settings.domainCss };
    renderDomainList();
    renderPresets();
  },
);

// ============================================================
// Presets UI
// ============================================================

function renderPresets() {
  presetListEl.innerHTML = "";

  const presetDomains = Object.keys(DOMAIN_PRESETS).sort();
  let addedCount = 0;

  for (const domain of presetDomains) {
    const preset = DOMAIN_PRESETS[domain];
    const isAdded = domainCssMap[domain] !== undefined;
    if (isAdded) addedCount++;

    const item = document.createElement("div");
    item.className = "preset-item" + (isAdded ? " added" : "");
    item.title = isAdded ? "Already added — click to open in editor" : "Click to add this preset";

    const label = document.createElement("div");
    label.className = "preset-label";
    label.innerHTML = `${escapeHtml(preset.label)}${isAdded ? ' <span class="check">✓</span>' : ""}`;

    const domainEl = document.createElement("div");
    domainEl.className = "preset-domain";
    domainEl.textContent = domain;

    const descEl = document.createElement("div");
    descEl.className = "preset-desc";
    descEl.textContent = preset.description;

    item.appendChild(label);
    item.appendChild(domainEl);
    item.appendChild(descEl);

    item.addEventListener("click", () => {
      if (domainCssMap[domain] !== undefined) {
        // Already added → open in editor
        openEditorFor(domain);
      } else {
        addPreset(domain);
      }
    });

    presetListEl.appendChild(item);
  }

  const total = presetDomains.length;
  presetCountEl.textContent = `${addedCount} of ${total} presets added`;
}

function addPreset(domain) {
  const preset = DOMAIN_PRESETS[domain];
  if (!preset) return;

  domainCssMap[domain] = preset.css;
  renderDomainList();
  renderPresets();
  showStatus(`Added preset for ${domain}`);
}

loadAllPresetsBtn.addEventListener("click", () => {
  let added = 0;
  for (const domain of Object.keys(DOMAIN_PRESETS)) {
    if (domainCssMap[domain] === undefined) {
      domainCssMap[domain] = DOMAIN_PRESETS[domain].css;
      added++;
    }
  }

  if (added === 0) {
    showStatus("All presets are already added.");
    return;
  }

  renderDomainList();
  renderPresets();
  showStatus(`Added ${added} preset(s). Don't forget to Save all.`);
});

// ============================================================
// Domain list UI
// ============================================================

function renderDomainList() {
  domainListEl.innerHTML = "";
  const domains = Object.keys(domainCssMap).sort();

  for (const domain of domains) {
    const chip = document.createElement("span");
    chip.className = "domain-chip";
    if (domain === editingDomain) chip.classList.add("active");
    chip.textContent = domain;

    chip.addEventListener("click", () => openEditorFor(domain));

    domainListEl.appendChild(chip);
  }
}

function openEditorFor(domain) {
  editingDomain = domain;
  editingDomainNameEl.textContent = domain;
  domainCssTextarea.value = domainCssMap[domain] || "";
  domainEditorEl.hidden = false;
  renderDomainList();

  // Scroll editor into view
  domainEditorEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeEditor() {
  editingDomain = null;
  domainEditorEl.hidden = true;
  domainCssTextarea.value = "";
  editingDomainNameEl.textContent = "";
  renderDomainList();
}

// ============================================================
// Add domain manually
// ============================================================

addDomainBtn.addEventListener("click", () => {
  const raw = newDomainEl.value.trim().toLowerCase();
  if (!raw) return;

  if (raw.includes(" ") || raw.includes("/") || raw.includes(":") || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(raw)) {
    showStatus("Invalid domain. Use format: example.com", true);
    return;
  }

  if (domainCssMap[raw] !== undefined) {
    showStatus("Domain already exists.", true);
    newDomainEl.value = "";
    openEditorFor(raw);
    return;
  }

  domainCssMap[raw] = "";
  newDomainEl.value = "";
  renderDomainList();
  renderPresets();
  openEditorFor(raw);
  showStatus("Domain added. Edit its CSS below.");
});

newDomainEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addDomainBtn.click();
  }
});

// ============================================================
// Delete domain
// ============================================================

deleteDomainBtn.addEventListener("click", () => {
  if (!editingDomain) return;
  if (!confirm(`Delete CSS for "${editingDomain}"?`)) return;
  delete domainCssMap[editingDomain];
  closeEditor();
  renderPresets();
});

// ============================================================
// Save / Reset
// ============================================================

saveBtn.addEventListener("click", () => {
  if (editingDomain) {
    domainCssMap[editingDomain] = domainCssTextarea.value;
  }

  chrome.storage.sync.set(
    {
      customCss: textarea.value,
      whitelist: whitelistEl.value,
      priority: priorityEl.value,
      domainCss: domainCssMap,
    },
    () => showStatus("Saved ✓"),
  );
});

resetBtn.addEventListener("click", () => {
  if (!confirm("Reset all settings to defaults?")) return;

  textarea.value = DEFAULT_CSS;
  whitelistEl.value = "";
  priorityEl.value = DEFAULT_PRIORITY;
  domainCssMap = {};
  closeEditor();
  renderPresets();

  chrome.storage.sync.set(
    {
      customCss: DEFAULT_CSS,
      whitelist: "",
      priority: DEFAULT_PRIORITY,
      domainCss: {},
    },
    () => showStatus("Reset to default ✓"),
  );
});

// ============================================================
// Live capture edits
// ============================================================

domainCssTextarea.addEventListener("input", () => {
  if (editingDomain) {
    domainCssMap[editingDomain] = domainCssTextarea.value;
  }
});

// ============================================================
// Shortcuts link
// ============================================================

openShortcutsEl.addEventListener("click", () => {
  const url = navigator.userAgent.includes("Edg/") ? "edge://extensions/shortcuts" : "chrome://extensions/shortcuts";
  chrome.tabs.create({ url });
});

// ============================================================
// Helpers
// ============================================================

function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#c62828" : "#2e7d32";
  statusEl.classList.add("show");
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => statusEl.classList.remove("show"), 2200);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
