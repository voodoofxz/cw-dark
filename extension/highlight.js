(() => {
  if (window.__cwdmHlLoaded) return;
  window.__cwdmHlLoaded = true;

  const defaults = { enabled: true, highlights: [{ text: "Client Responded", color: "#f2b84b" }] };
  let settings = { ...defaults };
  let rules = [];
  let timer = null;

  // After the extension is reloaded or updated, scripts already running in open
  // tabs lose their connection to Chrome ("Extension context invalidated").
  // Detect that and shut down quietly instead of throwing errors.
  const alive = () => { try { return !!chrome.runtime?.id; } catch { return false; } };

  const norm = (t) => t.replace(/\s+/g, " ").trim().toLowerCase();

  // The dark filter flips lightness but keeps hue, so pre-flip the color
  // to make it show up as the color the user picked.
  function flipLightness(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    l = 1 - l;
    const hue = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    if (s === 0) { r = g = b = l; } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      r = hue(p, q, h + 1 / 3); g = hue(p, q, h); b = hue(p, q, h - 1 / 3);
    }
    const x = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
    return "#" + x(r) + x(g) + x(b);
  }

  // Turn "New*" into /^new.*$/i. * = any characters, ? = exactly one character.
  // Everything else is matched literally.
  function toRegex(pattern) {
    const escaped = norm(pattern)
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    return new RegExp("^" + escaped + "$", "i");
  }

  function buildRules() {
    rules = [];
    for (const r of settings.highlights || []) {
      if (r && r.text && r.text.trim()) {
        rules.push({
          re: toRegex(r.text),
          color: settings.enabled ? flipLightness(r.color) : r.color
        });
      }
    }
  }

  // First rule in the list that matches wins.
  function colorFor(text) {
    const t = norm(text);
    for (const r of rules) if (r.re.test(t)) return r.color;
    return null;
  }

  // Find every "Status" column header on the page and remember its position.
  // A cell only counts as a status if it sits below one of these headers and
  // lines up with it horizontally. That keeps menu items like "+ New" in the
  // top bar from matching a status named "New".
  function statusColumns() {
    const cols = [];
    const candidates = document.querySelectorAll(
      'th, td, [role="columnheader"], div, span, a, label'
    );
    for (const el of candidates) {
      if (el.childElementCount > 3) continue;
      const t = el.textContent;
      if (!t || t.length > 20 || norm(t) !== "status") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 5 || r.height < 5) continue;
      // Use the enclosing header cell's width when there is one
      const cell = el.closest('th, td, [role="columnheader"]') || el;
      const cr = cell.getBoundingClientRect();
      cols.push({ left: Math.min(r.left, cr.left), right: Math.max(r.right, cr.right), bottom: r.bottom });
    }
    return cols;
  }

  function inStatusColumn(cell, cols) {
    const r = cell.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const mid = r.left + r.width / 2;
    return cols.some((c) => r.top >= c.bottom - 2 && mid >= c.left - 4 && mid <= c.right + 4);
  }

  function scan() {
    timer = null;
    if (!alive()) { observer.disconnect(); removeEventListener("resize", schedule); return; }
    const painted = new Set();
    let cols = null; // computed only if some cell text matches
    if (rules.length) {
      for (const cell of document.querySelectorAll('td, [role="gridcell"]')) {
        const text = cell.textContent;
        if (!text || text.length > 80) continue;
        const color = colorFor(text);
        if (!color || cell.querySelector("table")) continue;
        if (!cols) cols = statusColumns();
        if (!cols.length || !inStatusColumn(cell, cols)) continue;
        const row = cell.closest('tr, [role="row"]');
        if (!row) continue;
        painted.add(row);
        if (row.style.getPropertyValue("--cwdm-hl") !== color) {
          row.style.setProperty("--cwdm-hl", color);
        }
        row.classList.add("cwdm-hl-row");
      }
    }
    // Clear rows whose status changed
    for (const row of document.querySelectorAll(".cwdm-hl-row")) {
      if (!painted.has(row)) {
        row.classList.remove("cwdm-hl-row");
        row.style.removeProperty("--cwdm-hl");
      }
    }
  }

  const schedule = () => { if (!timer) timer = setTimeout(scan, 150); };

  // Only watch content changes, not attributes, so our own edits don't retrigger it.
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true, subtree: true, characterData: true
  });

  addEventListener("resize", schedule);

  chrome.storage.sync.get(defaults).then((s) => {
    settings = { ...defaults, ...s };
    buildRules();
    scan();
  }).catch(() => {});

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.highlights || changes.enabled) {
      if (changes.highlights) settings.highlights = changes.highlights.newValue ?? defaults.highlights;
      if (changes.enabled) settings.enabled = changes.enabled.newValue ?? true;
      buildRules();
      scan();
    }
  });
})();
