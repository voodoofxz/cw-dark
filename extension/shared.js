// Shared helpers for popup, options and background.
const CWDM_DEFAULTS = {
  enabled: true,
  sites: [],            // hostnames, e.g. "na.myconnectwise.net"
  brightness: 95,       // percent
  contrast: 90,         // percent
  keepImages: true,     // re-invert images/logos so they keep original colors
  keepDark: true,       // leave areas ConnectWise already draws dark (left nav) dark
  customCSS: "",
  highlights: [{ text: "Client Responded", color: "#f2b84b" }]
};

// Accepts "https://na.myconnectwise.net/v4_6_release/...", "cw.example.com:8443", etc.
// Returns a bare lowercase hostname, or null if it isn't valid.
function cwdmNormalizeHost(input) {
  if (!input) return null;
  let s = String(input).trim();
  if (!/^[a-z]+:\/\//i.test(s)) s = "https://" + s;
  try {
    const host = new URL(s).hostname.toLowerCase();
    if (!host || !/^[a-z0-9.-]+$/.test(host) || !host.includes(".") && host !== "localhost") return null;
    return host;
  } catch {
    return null;
  }
}

// Match patterns ignore ports, so one pattern covers http/https on any port.
function cwdmOriginFor(host) {
  return `*://${host}/*`;
}

async function cwdmGetSettings() {
  const stored = await chrome.storage.sync.get(CWDM_DEFAULTS);
  return { ...CWDM_DEFAULTS, ...stored };
}
