# 404-AM

Chrome DevTools panel to inspect `fetch` and XHR requests: status, duration, headers, payload and response body. Sensitive values are masked by default. Copy as cURL or fetch.

## Develop

```bash
pnpm install
pnpm build
pnpm watch
```

## Load in Chrome

1. Run `pnpm build` (creates `dist/`).
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `dist/` folder.
5. Open DevTools on any page → **404-AM** tab.

After changing code, run `pnpm build` or keep `pnpm watch` running, then close and reopen DevTools.

## Architecture

- `manifest.json` → `devtools_page: devtools.html`
- `devtools.ts` → `chrome.devtools.panels.create("404-AM", …, "panel.html")`
- `panel.html` → React app listening to `chrome.devtools.network.onRequestFinished`

No background service worker is needed.

## Publish to the Chrome Web Store

```bash
npm run package   # builds dist/ and writes 404-am-v<version>.zip
```

1. Bump `version` in **both** `package.json` and `public/manifest.json`.
2. Run `npm run package` to produce `404-am-v<version>.zip` (manifest at the zip root).
3. Open the [Developer Console](https://chrome.google.com/webstore/devconsole) and upload the zip.
4. Fill in the listing using [`STORE_LISTING.md`](./STORE_LISTING.md) (name, descriptions, permission justifications, privacy answers).
5. Host [`PRIVACY.md`](./PRIVACY.md) publicly and paste its URL into the privacy policy field.
6. Add 1–5 screenshots (1280×800 or 640×400) — see the asset checklist in `STORE_LISTING.md`.
7. Submit for review.

Publishing files in this repo: [`STORE_LISTING.md`](./STORE_LISTING.md), [`PRIVACY.md`](./PRIVACY.md), [`LICENSE`](./LICENSE), [`scripts/package.mjs`](./scripts/package.mjs), [`CHANGELOG.md`](./CHANGELOG.md).

## Publish to Firefox (addons.mozilla.org)

The same code runs on Firefox (it uses the `chrome.*` namespace, which Firefox
supports). Only the manifest differs — see [`manifest.firefox.json`](./manifest.firefox.json)
(adds `browser_specific_settings.gecko`, drops Chrome-only keys).

```bash
npm run package:firefox   # writes 404-am-firefox-v<version>.zip
```

1. Edit the Gecko `id` in `manifest.firefox.json` (e.g. `404-am@yourdomain`).
2. Run `npm run package:firefox`.
3. Submit the zip at <https://addons.mozilla.org/developers/addon/submit/>.
4. **Source code:** because the upload is bundled/minified, AMO review requires
   the source. Run `npm run package:source` to produce
   `404-am-source-v<version>.zip`, and see [`BUILD.md`](./BUILD.md) for the
   reproducible build instructions reviewers need (OS/env, Node/npm versions,
   steps).

> The Firefox packager overwrites `dist/manifest.json`. Run `npm run build`
> (or `npm run package`) again before loading the Chrome build.

### Automation

- **CI** (`.github/workflows/ci.yml`) runs typecheck + build on every push/PR.
- **Release** (`.github/workflows/release.yml`) builds and attaches
  `404-am-v<version>.zip` to a GitHub Release whenever you push a `v*` tag:
  ```bash
  git tag v0.1.0 && git push origin v0.1.0
  ```
- **Landing page** (`docs/index.html`) — enable GitHub Pages from the `/docs`
  folder to publish it.
- **Screenshots** — see [`screenshots/`](./screenshots/) for a demo target page
  and a capture guide.
