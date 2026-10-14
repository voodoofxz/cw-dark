(() => {
  if (window.__cwdmLoaded) return;
  window.__cwdmLoaded = true;

  const root = document.documentElement;
  const alive = () => { try { return !!chrome.runtime?.id; } catch { return false; } };
  let styleEl = null;

  function apply(s) {
    root.classList.toggle("cwdm-off", !s.enabled);
    root.classList.toggle("cwdm-img-off", !s.keepImages);
    root.classList.toggle("cwdm-native-off", !s.keepDark);
    root.style.setProperty("--cwdm-brightness", String(s.brightness / 100));
    root.style.setProperty("--cwdm-contrast", String(s.contrast / 100));

    if (s.customCSS && s.enabled) {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "cwdm-custom";
        (document.head || root).appendChild(styleEl);
      }
      styleEl.textContent = s.customCSS;
    } else if (styleEl) {
      styleEl.textContent = "";
    }
  }

  const defaults = { enabled: true, brightness: 95, contrast: 90, keepImages: true, keepDark: true, customCSS: "" };
  let current = { ...defaults };

  chrome.storage.sync.get(defaults).then((s) => {
    current = { ...defaults, ...s };
    apply(current);
  }).catch(() => {});

  // ConnectWise already draws some areas dark (the left nav, menus).
  // Inverting those makes them light, so find large regions whose own
  // background is dark and flip them back. Computed styles are unaffected
  // by the CSS filter, so this sees ConnectWise's original colors.
  const MIN_AREA = 15000;      // px², ignores buttons and badges
  const DARK_LUMA = 0.22;      // 0 = black, 1 = white

  function luma(bg) {
    const m = bg.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    if (a < 0.6) return null;
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function isDarkRegion(el) {
    const l = luma(getComputedStyle(el).backgroundColor);
    if (l === null || l > DARK_LUMA) return false;
    const r = el.getBoundingClientRect();
    if (r.width * r.height < MIN_AREA) return false;
    // A dark full-page wrapper means the whole app is dark already; skip it.
    if (r.width > innerWidth * 0.9 && r.height > innerHeight * 0.9) return false;
    return true;
  }

  function scanDark() {
    darkTimer = null;
    if (!alive()) { darkObserver.disconnect(); removeEventListener("resize", scheduleDark); return; }
    if (!document.body) return;
    for (const el of document.querySelectorAll(".cwdm-native")) {
      if (!isDarkRegion(el)) el.classList.remove("cwdm-native");
    }
    for (const el of document.body.querySelectorAll("div, nav, aside, header, section, ul, table, td")) {
      if (el.closest(".cwdm-native")) continue;
      if (isDarkRegion(el)) el.classList.add("cwdm-native");
    }
  }

  let darkTimer = null;
  const scheduleDark = () => { if (!darkTimer) darkTimer = setTimeout(scanDark, 400); };
  const darkObserver = new MutationObserver(scheduleDark);
  darkObserver.observe(root, { childList: true, subtree: true });
  addEventListener("resize", scheduleDark);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleDark);
  } else {
    scheduleDark();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [k, v] of Object.entries(changes)) {
      if (k in defaults) current[k] = v.newValue ?? defaults[k];
    }
    apply(current);
  });
})();
