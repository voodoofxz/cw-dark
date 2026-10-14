const $ = (id) => document.getElementById(id);
let settings;
let tabHost = null;

async function init() {
  settings = await cwdmGetSettings();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url && /^https?:/.test(tab.url)) tabHost = cwdmNormalizeHost(tab.url);

  const paint = cwdmInitTheme((dark) => { settings.enabled = dark; render(); });
  paint(settings.enabled);
  for (const k of ["brightness", "contrast"]) {
    $(k).value = settings[k];
    $(k + "-out").textContent = settings[k] + "%";
  }
  render();
}

function render() {
  $("state-label").textContent = settings.enabled ? "Dark on your ConnectWise sites" : "Light, with status highlights";
  $("sliders").hidden = !settings.enabled;
  const n = settings.sites.length;
  $("site-count").textContent = n === 0 ? "No sites added" : `${n} site${n === 1 ? "" : "s"} added`;

  $("host").textContent = tabHost || "Not a web page";
  const added = tabHost && settings.sites.includes(tabHost);
  $("add-current").hidden = !tabHost || added;
  $("host-note").textContent = !tabHost
    ? "Open your ConnectWise PSA tab to add it."
    : added
      ? (settings.enabled ? "Dark theme and highlights are active here." : "Light theme. Status highlights are active here.")
      : "Add this site if it's your ConnectWise PSA.";
}


for (const k of ["brightness", "contrast"]) {
  $(k).addEventListener("input", (e) => {
    const v = Number(e.target.value);
    settings[k] = v;
    $(k + "-out").textContent = v + "%";
    chrome.storage.sync.set({ [k]: v });
  });
}

$("add-current").addEventListener("click", async () => {
  // Permission request must happen first, inside the click gesture.
  // Chrome usually closes this popup when the prompt appears; the background
  // worker then saves the site once access is granted.
  const origin = cwdmOriginFor(tabHost);
  let granted = false;
  try {
    granted = await chrome.permissions.request({ origins: [origin] });
  } catch (err) {
    $("msg").className = "msg err";
    $("msg").textContent = err.message;
    return;
  }
  if (!granted) {
    $("msg").className = "msg err";
    $("msg").textContent = "Access wasn't granted, so the site wasn't added.";
    return;
  }
  settings.sites = [...new Set([...settings.sites, tabHost])].sort();
  await chrome.storage.sync.set({ sites: settings.sites });
  $("msg").className = "msg";
  $("msg").textContent = "Site added.";
  render();
});

$("open-options").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

init();
