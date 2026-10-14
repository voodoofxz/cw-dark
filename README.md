# ConnectWise PSA Dark Mode

A Chromium extension (Chrome, Edge, Brave, Vivaldi) that adds a dark theme and status-based ticket highlighting to ConnectWise PSA (Manage), on cloud and self-hosted sites.

Independent project; not affiliated with or endorsed by ConnectWise.

## Features
- Dark / Light toggle (Alt+Shift+D), adjustable brightness and contrast
- Runs only on ConnectWise sites you add, with per-site permission
- Already-dark areas (left nav) stay dark; images keep original colors
- Status highlights with colors, `*` / `?` wildcards, export and import
- Custom CSS for spot fixes (unsupported; use at your own risk)

## Install for development
1. Clone this repo.
2. Open `chrome://extensions` or `edge://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder.
4. Open your ConnectWise tab, click the extension icon, and choose **Add this site**.

After editing files, click the reload arrow on the extension card and refresh ConnectWise.

## Repository layout
```
extension/   Extension source — this folder is what gets zipped and published
store/       Store listing copy and images for Chrome Web Store and Edge Add-ons
.github/     CI checks and the release workflow
CHANGELOG.md Version history
```

## Releasing a new version
1. Bump `version` in `extension/manifest.json`.
2. Add a `## x.y.z` section at the top of `CHANGELOG.md`.
3. Commit, then tag and push:
   ```
   git tag v1.4.2
   git push origin main --tags
   ```
4. The **Release** workflow checks the tag matches the manifest version, builds `cw-dark-x.y.z.zip`, and creates a GitHub release with the changelog notes and the zip attached.
5. Download the zip from the release and upload it to the Chrome Web Store and Edge Partner Center.

## Deploying at an organization
After store approval, force-install by store ID with Intune or Group Policy `ExtensionInstallForcelist`.

## License
MIT. See `LICENSE`.
