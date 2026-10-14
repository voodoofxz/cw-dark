const $ = (id) => document.getElementById(id);
let settings;

function setMsg(id, text, isErr = false) {
  $(id).textContent = text;
  $(id).className = "msg" + (isErr ? " err" : "");
}

async function renderSites() {
  const list = $("site-list");
  list.innerHTML = "";
  if (!settings.sites.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No sites yet. Add your ConnectWise address above.";
    list.appendChild(li);
    return;
  }
  for (const host of settings.sites) {
    const li = document.createElement("li");
    const left = document.createElement("div");
    const code = document.createElement("code");
    code.textContent = host;
    left.appendChild(code);

    const has = await chrome.permissions.contains({ origins: [cwdmOriginFor(host)] });
    if (!has) {
      const warn = document.createElement("div");
      warn.className = "warn";
      warn.textContent = "Access not granted. Remove and add again to fix.";
      left.appendChild(warn);
    }

    const btn = document.createElement("button");
    btn.className = "remove";
    btn.textContent = "Remove";
    btn.addEventListener("click", () => removeSite(host));

    li.append(left, btn);
    list.appendChild(li);
  }
}

$("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const host = cwdmNormalizeHost($("site-input").value);
  if (!host) {
    setMsg("site-msg", "That doesn't look like a web address. Try something like na.myconnectwise.net.", true);
    return;
  }
  if (settings.sites.includes(host)) {
    setMsg("site-msg", `${host} is already added.`);
    return;
  }

  // Request access immediately so it stays inside the user's click.
  let granted = false;
  try {
    granted = await chrome.permissions.request({ origins: [cwdmOriginFor(host)] });
  } catch (err) {
    setMsg("site-msg", err.message, true);
    return;
  }
  if (!granted) {
    setMsg("site-msg", "Access wasn't granted, so the site wasn't added.", true);
    return;
  }

  settings.sites = [...settings.sites, host].sort();
  await chrome.storage.sync.set({ sites: settings.sites });
  $("site-input").value = "";
  setMsg("site-msg", `Added ${host}. Open tabs on that site update automatically.`);
  renderSites();
});

async function removeSite(host) {
  settings.sites = settings.sites.filter((h) => h !== host);
  await chrome.storage.sync.set({ sites: settings.sites });
  try { await chrome.permissions.remove({ origins: [cwdmOriginFor(host)] }); } catch {}
  setMsg("site-msg", `Removed ${host}. Reload any open tabs on that site to return to light mode.`);
  renderSites();
}

async function init() {
  settings = await cwdmGetSettings();

  cwdmInitTheme()(settings.enabled);

  for (const k of ["brightness", "contrast"]) {
    $(k).value = settings[k];
    $(k + "-out").textContent = settings[k] + "%";
    $(k).addEventListener("input", (e) => {
      const v = Number(e.target.value);
      $(k + "-out").textContent = v + "%";
      chrome.storage.sync.set({ [k]: v });
    });
  }

  $("keepImages").checked = settings.keepImages;
  $("keepImages").addEventListener("change", (e) => chrome.storage.sync.set({ keepImages: e.target.checked }));

  $("keepDark").checked = settings.keepDark;
  $("keepDark").addEventListener("change", (e) => chrome.storage.sync.set({ keepDark: e.target.checked }));

  $("customCSS").value = settings.customCSS;
  $("save-css").addEventListener("click", async () => {
    const css = $("customCSS").value;
    // chrome.storage.sync allows ~8 KB per item
    if (new Blob([css]).size > 7500) {
      setMsg("css-msg", "Custom CSS is too long to sync. Keep it under about 7 KB.", true);
      return;
    }
    await chrome.storage.sync.set({ customCSS: css });
    setMsg("css-msg", "CSS saved.");
  });

  renderHighlights(settings.highlights);
  $("hl-add").addEventListener("click", () => {
    addHighlightRow({ text: "", color: "#f2b84b" });
    $("hl-list").lastElementChild.querySelector('input[type="text"]').focus();
  });
  $("hl-save").addEventListener("click", saveHighlights);
  $("hl-export").addEventListener("click", exportHighlights);
  $("hl-import").addEventListener("click", () => $("hl-file").click());
  $("hl-file").addEventListener("change", (e) => e.target.files[0] && importHighlights(e.target.files[0]));

  renderSites();
}

function addHighlightRow(rule) {
  const list = $("hl-list");
  list.querySelector(".empty")?.remove();
  const li = document.createElement("li");
  li.className = "hl-row";

  const text = document.createElement("input");
  text.type = "text";
  text.value = rule.text;
  text.placeholder = "Client Responded";
  text.setAttribute("aria-label", "Status name");

  const color = document.createElement("input");
  color.type = "color";
  color.value = rule.color || "#f2b84b";
  color.setAttribute("aria-label", "Highlight color");

  const btn = document.createElement("button");
  btn.className = "remove";
  btn.textContent = "Remove";
  btn.addEventListener("click", () => {
    li.remove();
    if (!list.children.length) renderHighlights([]);
  });

  li.append(text, color, btn);
  list.appendChild(li);
}

function renderHighlights(rules) {
  const list = $("hl-list");
  list.innerHTML = "";
  if (!rules.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No statuses highlighted. Add one to get started.";
    list.appendChild(li);
    return;
  }
  rules.forEach(addHighlightRow);
}

function currentHighlights() {
  return [...$("hl-list").querySelectorAll(".hl-row")]
    .map((li) => ({
      text: li.querySelector('input[type="text"]').value.trim(),
      color: li.querySelector('input[type="color"]').value
    }))
    .filter((r) => r.text);
}

function exportHighlights() {
  const rules = currentHighlights();
  if (!rules.length) {
    setMsg("hl-msg", "There are no statuses to export.", true);
    return;
  }
  const data = { type: "cw-dark-highlights", version: 1, highlights: rules };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "cw-status-highlights.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  setMsg("hl-msg", `Exported ${rules.length} status${rules.length === 1 ? "" : "es"}.`);
}

// Accepts the exported format, or a bare array of { text, color }.
function parseHighlights(json) {
  const raw = Array.isArray(json) ? json : json?.highlights;
  if (!Array.isArray(raw)) throw new Error("This file doesn't contain status highlights.");
  const rules = raw
    .filter((r) => r && typeof r.text === "string" && r.text.trim())
    .slice(0, 100)
    .map((r) => ({
      text: r.text.trim().slice(0, 100),
      color: /^#[0-9a-f]{6}$/i.test(r.color) ? r.color.toLowerCase() : "#f2b84b"
    }));
  if (!rules.length) throw new Error("This file has no statuses in it.");
  return rules;
}

async function importHighlights(file) {
  try {
    const rules = parseHighlights(JSON.parse(await file.text()));
    // Merge: same status (ignoring case) takes the imported color; new ones are added at the end.
    const merged = currentHighlights();
    let added = 0, updated = 0;
    for (const r of rules) {
      const existing = merged.find((m) => m.text.toLowerCase() === r.text.toLowerCase());
      if (existing) { existing.color = r.color; updated++; } else { merged.push(r); added++; }
    }
    renderHighlights(merged);
    setMsg("hl-msg", `Imported ${added} new, updated ${updated}. Click Save highlights to keep them.`);
  } catch (err) {
    setMsg("hl-msg", err instanceof SyntaxError ? "That file isn't valid JSON." : err.message, true);
  } finally {
    $("hl-file").value = "";
  }
}

async function saveHighlights() {
  const rules = currentHighlights();
  await chrome.storage.sync.set({ highlights: rules });
  settings.highlights = rules;
  renderHighlights(rules);
  setMsg("hl-msg", "Highlights saved.");
}

init();
