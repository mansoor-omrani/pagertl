// options.js

const DEFAULT_CSS = `html { direction: rtl; }
pre { direction: ltr; }`;

const DEFAULT_PRIORITY = "manual-wins";

// ============================================================
// Presets
// ============================================================

const DOMAIN_PRESETS = {
  "chat.deepseek.com": {
    label: "Deepseek",
    description: "Code blocks and diffs stay LTR",
    css: `html { direction: rtl !important; }
#root > div > div > div:nth-child(1) {
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
const restoreGlobalCssBtn = document.getElementById("restoreGlobalCssBtn");

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

// Preview
const globalPreviewEl = document.getElementById("globalPreview");
const toggleGlobalPreviewBtn = document.getElementById("toggleGlobalPreview");
const domainPreviewEl = document.getElementById("domainPreview");
const toggleDomainPreviewBtn = document.getElementById("toggleDomainPreview");
const domainPreviewWrapEl = domainPreviewEl.closest(".preview-wrap");
const globalPreviewWrapEl = globalPreviewEl.closest(".preview-wrap");

// Import/Export
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFileEl = document.getElementById("importFile");

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
    updateGlobalPreview();
  },
);

// ============================================================
// Live Preview
// ============================================================

const PREVIEW_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 13px;
    margin: 10px;
    color: #222;
    line-height: 1.6;
  }
  h3 { margin: 0 0 6px; font-size: 13px; }
  p { margin: 4px 0; }
  pre {
    background: #f4f6f8;
    padding: 8px;
    border-radius: 4px;
    font-size: 12px;
    margin: 6px 0;
    overflow-x: auto;
  }
  code { font-family: Consolas, Menlo, monospace; }
  .en { color: #1565C0; }
  .fa { color: #2e7d32; }
</style>
<style id="pagerrtl-preview-css"></style>
</head>
<body>
  <h3>Preview</h3>
  <p>این یک متن <span class="fa">فارسی</span> با کلمه‌ی <span class="en">English</span> در وسط آن است.</p>
  <p>Another line with <span class="fa">متن راست‌به‌چپ</span> mixed in.</p>
  <pre><code>function hello(name) {
  return "Hello, " + name + "!";
}</code></pre>
  <p>پاراگراف پایانی برای تست.</p>
</body>
</html>`;

function buildPreviewDoc(css) {
  // We can't just replace the entire document; instead we build the srcdoc
  // with the CSS embedded in the second <style> tag.
  const escaped = String(css || "").replace(/<\/style/gi, "<\\/style");

  return PREVIEW_HTML.replace(
    '<style id="pagerrtl-preview-css"></style>',
    `<style id="pagerrtl-preview-css">${escaped}</style>`,
  );
}

let globalPreviewTimer = null;
function updateGlobalPreview() {
  clearTimeout(globalPreviewTimer);
  globalPreviewTimer = setTimeout(() => {
    globalPreviewEl.srcdoc = buildPreviewDoc(textarea.value);
  }, 200);
}

let domainPreviewTimer = null;
function updateDomainPreview() {
  clearTimeout(domainPreviewTimer);
  domainPreviewTimer = setTimeout(() => {
    // Combine global CSS + current domain CSS in the editor
    const globalCss = textarea.value || "";
    const domainCss = editingDomain ? domainCssTextarea.value : "";
    const combined = [globalCss, domainCss].filter((s) => s && s.trim() !== "").join("\n\n");
    domainPreviewEl.srcdoc = buildPreviewDoc(combined);
  }, 200);
}

// Debounced live updates
textarea.addEventListener("input", updateGlobalPreview);
domainCssTextarea.addEventListener("input", updateDomainPreview);

// Toggle preview visibility
toggleGlobalPreviewBtn.addEventListener("click", () => {
  const collapsed = globalPreviewWrapEl.classList.toggle("collapsed");
  toggleGlobalPreviewBtn.textContent = collapsed ? "Show" : "Hide";
});

toggleDomainPreviewBtn.addEventListener("click", () => {
  const collapsed = domainPreviewWrapEl.classList.toggle("collapsed");
  toggleDomainPreviewBtn.textContent = collapsed ? "Show" : "Hide";
});

// ============================================================
// Restore default global CSS
// ============================================================

restoreGlobalCssBtn.addEventListener("click", () => {
  textarea.value = DEFAULT_CSS;
  updateGlobalPreview();
  showStatus("Global CSS restored. Don't forget to Save all.");
});

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
  updateDomainPreview();
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
// Add / delete domain
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
  updateGlobalPreview();

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
// Live capture of domain textarea edits
// ============================================================

domainCssTextarea.addEventListener("input", () => {
  if (editingDomain) {
    domainCssMap[editingDomain] = domainCssTextarea.value;
  }
});

// ============================================================
// Import / Export
// ============================================================

exportBtn.addEventListener("click", () => {
  if (editingDomain) {
    domainCssMap[editingDomain] = domainCssTextarea.value;
  }

  const payload = {
    _meta: {
      app: "PageRTL",
      version: "1.3.0",
      exportedAt: new Date().toISOString(),
    },
    customCss: textarea.value,
    whitelist: whitelistEl.value,
    priority: priorityEl.value,
    domainCss: domainCssMap,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.href = url;
  a.download = `pagerrtl-settings-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showStatus("Exported ✓");
});

importBtn.addEventListener("click", () => {
  importFileEl.value = "";
  importFileEl.click();
});

importFileEl.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch {
      showStatus("Import failed: invalid JSON.", true);
      return;
    }

    if (!data || typeof data !== "object") {
      showStatus("Import failed: not a valid object.", true);
      return;
    }

    const newCss = typeof data.customCss === "string" ? data.customCss : DEFAULT_CSS;
    const newWhitelist = typeof data.whitelist === "string" ? data.whitelist : "";
    const newPriority = ["manual-wins", "whitelist-wins", "manual-only"].includes(data.priority)
      ? data.priority
      : DEFAULT_PRIORITY;

    let newDomainCss = {};
    if (data.domainCss && typeof data.domainCss === "object") {
      for (const [k, v] of Object.entries(data.domainCss)) {
        if (typeof k === "string" && typeof v === "string") {
          newDomainCss[k.toLowerCase().trim()] = v;
        }
      }
    }

    textarea.value = newCss;
    whitelistEl.value = newWhitelist;
    priorityEl.value = newPriority;
    domainCssMap = newDomainCss;
    closeEditor();
    renderDomainList();
    renderPresets();
    updateGlobalPreview();

    chrome.storage.sync.set(
      {
        customCss: newCss,
        whitelist: newWhitelist,
        priority: newPriority,
        domainCss: newDomainCss,
      },
      () => showStatus("Imported ✓"),
    );
  };
  reader.onerror = () => {
    showStatus("Import failed: could not read file.", true);
  };
  reader.readAsText(file);
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
