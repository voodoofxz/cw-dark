importScripts("shared.js");

const DARK_ID = "cwdm-content";
const HL_ID = "cwdm-highlight";

// Keep registered content scripts in sync with the saved site list,
// the on/off switch, and the host permissions the user has granted.
async function sync({ injectOpenTabs = false } = {}) {
  const { enabled, sites } = await cwdmGetSettings();

  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [DARK_ID, HL_ID] });
  if (existing.length) {
    await chrome.scripting.unregisterContentScripts({ ids: existing.map((s) => s.id) });
  }

  const granted = [];
  for (const host of sites) {
    const origin = cwdmOriginFor(host);
    if (await chrome.permissions.contains({ origins: [origin] })) granted.push(origin);
  }
  if (!granted.length) return;

  const scripts = [{
    // Status highlighting runs in every frame, in light or dark mode.
    id: HL_ID,
    matches: granted,
    css: ["highlight.css"],
    js: ["highlight.js"],
    runAt: "document_idle",
    allFrames: true,
    persistAcrossSessions: true
  }];
  if (enabled) {
    // Dark mode runs in the top frame only; its filter already covers iframes.
    scripts.push({
      id: DARK_ID,
      matches: granted,
      css: ["dark.css"],
      js: ["content.js"],
      runAt: "document_start",
      allFrames: false,
      persistAcrossSessions: true
    });
  }
  await chrome.scripting.registerContentScripts(scripts);

  if (injectOpenTabs) {
    const tabs = await chrome.tabs.query({ url: granted });
    for (const tab of tabs) {
      try {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id, allFrames: true }, files: ["highlight.css"] });
        await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["highlight.js"] });
        if (enabled) {
          await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["dark.css"] });
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
        }
      } catch (e) {
        console.warn("CW Dark Mode: could not inject into tab", tab.id, e);
      }
    }
  }
}

// The popup closes as soon as Chrome shows the permission prompt, which kills
// the popup's code before it can save the site. So the background worker adds
// any host the user grants to the site list itself.
function hostFromOrigin(origin) {
  const m = /^\*:\/\/([^/*]+)\/\*$/.exec(origin || "");
  return m ? m[1].toLowerCase() : null;
}

async function adoptGrantedHosts(origins) {
  const hosts = (origins || []).map(hostFromOrigin).filter(Boolean);
  if (!hosts.length) return false;
  const { sites } = await cwdmGetSettings();
  const merged = [...new Set([...sites, ...hosts])].sort();
  if (merged.length === sites.length) return false;
  await chrome.storage.sync.set({ sites: merged }); // triggers sync via onChanged
  return true;
}

async function startup() {
  // Picks up sites granted earlier from the popup that never got saved.
  const { origins } = await chrome.permissions.getAll();
  if (!(await adoptGrantedHosts(origins))) await sync();
}

chrome.runtime.onInstalled.addListener(startup);
chrome.runtime.onStartup.addListener(startup);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.sites || changes.enabled) sync({ injectOpenTabs: true });
});

chrome.permissions.onAdded.addListener(async (perms) => {
  if (!(await adoptGrantedHosts(perms.origins))) sync({ injectOpenTabs: true });
});
chrome.permissions.onRemoved.addListener(() => sync());

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== "toggle-theme") return;
  const { enabled } = await cwdmGetSettings();
  await chrome.storage.sync.set({ enabled: !enabled });
});
