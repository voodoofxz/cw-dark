// Dark/Light segmented control used by popup and options.
// Light = dark mode off; status highlights still apply in their true colors.
function cwdmInitTheme(onChange) {
  const buttons = [...document.querySelectorAll(".theme [data-theme]")];
  const paint = (dark) => buttons.forEach((b) =>
    b.setAttribute("aria-checked", String((b.dataset.theme === "dark") === dark)));

  buttons.forEach((b) => b.addEventListener("click", async () => {
    const dark = b.dataset.theme === "dark";
    paint(dark);
    await chrome.storage.sync.set({ enabled: dark });
    onChange?.(dark);
  }));

  // Arrow keys move between the two options, like a native radio group
  buttons.forEach((b, i) => b.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    const next = buttons[(i + 1) % buttons.length];
    next.focus(); next.click();
  }));

  chrome.storage.onChanged.addListener((c, area) => {
    if (area === "sync" && c.enabled) { paint(c.enabled.newValue); onChange?.(c.enabled.newValue); }
  });

  return paint;
}
