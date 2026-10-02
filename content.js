(function () {
  const STYLE_ID = "pagerrtl-custom-style";
  const APPLIED_FLAG = "data-pagerrtl-applied";
  const ORIGINAL_DIR_ATTR = "data-pagerrtl-original-dir";

  function enable(customCss) {
    const htmlEl = document.documentElement;
    if (!htmlEl) return;
    if (!htmlEl.hasAttribute(APPLIED_FLAG)) {
      const originalDir = htmlEl.getAttribute("dir");
      if (originalDir !== null) {
        htmlEl.setAttribute(ORIGINAL_DIR_ATTR, originalDir);
      }
      htmlEl.setAttribute(APPLIED_FLAG, "1");
    }
    htmlEl.setAttribute("dir", "rtl");
    let styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(styleEl);
    }
    styleEl.textContent = customCss || "";
  }

  function disable() {
    const htmlEl = document.documentElement;
    if (!htmlEl) return;
    if (htmlEl.hasAttribute(APPLIED_FLAG)) {
      const originalDir = htmlEl.getAttribute(ORIGINAL_DIR_ATTR);
      if (originalDir !== null) {
        htmlEl.setAttribute("dir", originalDir);
      } else {
        htmlEl.removeAttribute("dir");
      }
      htmlEl.removeAttribute(ORIGINAL_DIR_ATTR);
      htmlEl.removeAttribute(APPLIED_FLAG);
    }
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.remove();
  }

  window.__PageRTL__ = { enable, disable };
})();
