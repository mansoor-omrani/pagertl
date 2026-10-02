# PageRTL
A lightweight browser extension that toggles right-to-left (RTL) reading mode on any web page — perfect for pages that mix Persian/Arabic with English.

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/)
[![Chrome](https://img.shields.io/badge/Chrome-supported-success)](https://www.google.com/chrome/)
[![Edge](https://img.shields.io/badge/Edge-supported-success)](https://www.microsoft.com/edge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🧩 The Problem

Reading a page that mixes **RTL** languages (Persian, Arabic, Hebrew) with **LTR** languages (English, code, URLs) is painful when the page is not properly laid out. Words jump around, punctuation lands in the wrong place, and code blocks become unreadable.

`PageRTL` fixes this with a single click — or a keyboard shortcut.

---

## ✨ Features

- **One-click RTL toggle** for the current page (per-tab, remembered across reloads).
- **Keyboard shortcut**: `Alt+Shift+R` (fully customizable from your browser's shortcut settings).
- **Visual badge** on the extension icon showing when RTL is active.
- **Global custom CSS** — customize what gets injected into every page.
  - Default: `html { direction: rtl; }` + `pre { direction: ltr; }` (keeps code blocks readable).
- **Domain-specific CSS** — override or extend the global CSS for individual websites.
- **Whitelist** — auto-enable RTL on domains you visit often.
- **Priority modes** — decide whether the whitelist or your manual toggle wins.
- **Recommended presets** — ready-to-use CSS for popular sites (e.g. DeepSeek).
- **Live preview** in the options page — see your CSS changes instantly.
- **Import / Export** your settings as JSON — back up or move between browsers.
- **Works in iframes** and respects restricted pages (`chrome://`, `edge://`, PDF viewer, etc.).
- **No tracking, no analytics, no remote calls.** Everything stays on your machine.

---

## 📸 Screenshots

 _Coming soon — contributions welcome._

---

## 🚀 Installation

### From source (developer mode)

1. **Clone or download** this repository:
   ```bash
   git clone https://github.com/mansoor-omrani/pagertl.git
   ```
2. Open your browser's extensions page:
   - **Chrome:** `chrome://extensions`
   - **Edge:** `edge://extensions`
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `PageRTL` folder.
5. The extension icon will appear in your toolbar. Pin it for easy access.

That's it — you're ready to use it.

 💡 **Note on icons:** The extension ships with placeholder icons. If you want to regenerate them from `icons/icon.svg`, use any SVG-to-PNG converter (e.g. [svgtopng.com](https://svgtopng.com)) to produce `icon16.png`, `icon48.png`, and `icon128.png`.

---

## 🎯 How to Use

### Basic toggle

1. Open any web page.
2. Click the PageRTL icon in the toolbar (or press `Alt+Shift+R`).
3. The page switches to RTL mode. The icon shows an `RTL` badge.
4. Click again (or press the shortcut) to turn it off.

### Customizing the behavior

Open the **Settings** page (right-click the icon → *Options*, or click *Settings* in the popup):

| Section | What it does |
|---|---|
| **Global Custom CSS** | CSS injected on every page when RTL is enabled. |
| **Recommended presets** | One-click CSS for popular sites. |
| **Whitelist** | Domains where RTL is enabled automatically. |
| **Priority** | Whether manual toggle or whitelist wins. |
| **Domain-specific CSS** | Per-domain CSS overrides. |
| **Backup & Restore** | Export/import all settings as JSON. |
| **Keyboard shortcut** | Link to your browser's shortcut settings. |

### Examples

**Keep code blocks LTR on GitHub:**
```css
pre, code, .blob-code, .highlight {
  direction: ltr;
  text-align: left;
}
```

**Force RTL on a specific domain:**
```css
html { direction: rtl !important; }
```

**Disable RTL on a domain even when the global CSS enables it:**
```css
html { direction: ltr !important; }
```

---

## ⌨️ Keyboard Shortcut

The default shortcut is **`Alt+Shift+R`**.

To change it:
- **Chrome:** go to `chrome://extensions/shortcuts`
- **Edge:** go to `edge://extensions/shortcuts`

Find **PageRTL** in the list and assign any shortcut you like.

 ⚠️ Shortcuts only work when the browser window is focused (not globally). This is a browser limitation for non-`Ctrl+Shift+[0-9]` shortcuts.

---

## 🧠 How It Works

PageRTL does **not** modify the page's HTML structure or attributes. Instead, it injects a single `<style>` element into the page:

1. When you enable RTL for a tab, the background script computes the effective CSS:
   **global CSS + domain-specific CSS** (in that order).
2. The CSS is sent to the page and injected as `<style id="pagerrtl-custom-style">`.
3. When you disable RTL, that `<style>` element is removed.

This approach is:

- **Non-invasive** — no `dir` attribute is set on `<html>`, so pages that rely on their own `dir` are not broken.
- **Reversible** — removing the `<style>` restores the page to its original state.
- **Extensible** — any CSS rule you want (RTL, LTR, colors, layout tweaks) can be injected the same way.

Per-tab state is stored in `chrome.storage.session`, and global settings in `chrome.storage.sync`.

---

## 🗂 Project Structure

```
PageRTL/
├── manifest.json          # Manifest V3 configuration
├── background.js          # Service worker: state, decisions, injection
├── content.js             # Injected on-demand: <style> management
├── popup.html             # Toolbar popup UI
├── popup.js               # Popup logic
├── options.html           # Settings page UI
├── options.js             # Settings page logic
├── options.css            # Settings page styles
└── icons/
    ├── icon.svg           # Source icon (vector)
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Key concepts

- **`content.js`** is not declared in `manifest.json`. It's injected on-demand via `chrome.scripting.executeScript`. This means the extension does nothing to a page until you explicitly enable RTL for that tab.
- **`window.__PageRTL__`** is exposed by `content.js` so the background script can call `enable(css)` / `disable()` in the page's context.
- **Per-tab state** is stored in `chrome.storage.session` (cleared when the browser closes). Global settings are in `chrome.storage.sync`.

---

## 🔒 Privacy

PageRTL:

- ✅ Does **not** collect any data.
- ✅ Does **not** communicate with any server.
- ✅ Does **not** read page content.
- ✅ Only injects a `<style>` element when you explicitly enable RTL.

All settings are stored locally in your browser's storage.

---

## 🛠 Development

### Requirements

- Google Chrome 88+ or Microsoft Edge 88+ (Manifest V3 support).
- Any text editor (VS Code recommended).

### Local development

1. Load the extension as described in [Installation](^#-installation).
2. After making changes:
   - Go to `chrome://extensions` (or `edge://extensions`).
   - Click the **Refresh** icon on the PageRTL card.
   - Reload any open tabs to pick up content script changes.

### Debugging

- **Background script:** on the extensions page, click **service worker** under PageRTL to open DevTools.
- **Popup:** right-click the extension icon → **Inspect popup**.
- **Content script:** open DevTools on any page (`F12`) and check the Console. `window.__PageRTL__` should be available when the extension is active.

---

## 🗺 Roadmap

PageRTL is intentionally small and focused. Future work will be **bug fixes and polish**, not new features. If you have an idea, open an issue — but please understand that adding features is weighed against the value of keeping the extension simple.

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-idea`.
3. Commit your changes: `git commit -m "Add my idea"`.
4. Push to the branch: `git push origin feature/my-idea`.
5. Open a Pull Request.

Please keep the code style consistent with the existing files — vanilla JavaScript, no build step, no dependencies.

### Reporting bugs

When reporting a bug, please include:

- Browser name and version.
- The URL (or type of site) where the issue occurred.
- Steps to reproduce.
- Expected vs. actual behavior.
- Screenshots or console errors if relevant.

---

## 📄 License

[MIT](LICENSE) — feel free to use, modify, and distribute.

---

## 🙏 Acknowledgements

Built with ❤️ for anyone who has ever tried to read a Persian article with English code samples embedded in it.

If PageRTL helps you, consider giving the repository a ⭐ — it makes a difference.
