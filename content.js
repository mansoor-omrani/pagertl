// content.js
// Injected on demand. Idempotent: calling it multiple times is safe.

(function () {
  const STYLE_ID = "pagerrtl-custom-style";

  /**
   * Enable RTL mode by injecting the given CSS into the page.
   * @param {string} customCss
   */
  function enable(customCss) {
    let styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(styleEl);
    }
    styleEl.textContent = customCss || "";
  }

  /**
   * Disable RTL mode by removing the injected <style>.
   */
  function disable() {
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.remove();
  }

  // Expose to background script.
  window.__PageRTL__ = { enable, disable };
})();
