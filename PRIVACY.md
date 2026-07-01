# Privacy Policy — Nocturne

_Last updated: 2026-06-19_

**Canonical URL:** https://nocturne.thefndrs.com/privacy/

Nocturne is a browser extension that helps developers inspect and debug network
requests and console output on web pages they are working on. This policy applies
to Chrome/Firefox/Edge DevTools builds and the Safari Web Extension.

## Data we collect

**None.** Nocturne does not collect, transmit, sell, or share any data. There are
no analytics, no accounts, no tracking, and no remote servers. Everything runs
locally on your device.

## What the extension accesses, and why

### Network requests

Nocturne reads fetch and XHR traffic from the page you are debugging so it can
show method, URL, status, timing, headers, payloads, and response bodies in the
panel. This data is displayed on your device only and is never sent to us or any
third party.

- **Chrome / Firefox / Edge** — captured via the DevTools network API while
  DevTools is open on that tab.
- **Safari** — captured by a small script injected into the active page while
  the extension is enabled, relayed to the overlay panel via local messaging.

### Console output

Console logs from the page are shown in the integrated Console panel. They are
not stored on servers or transmitted off-device.

### Local preferences

UI settings (filters, sort order, sidebar width, and similar options) are saved
locally using browser extension storage on your own device.

## Actions you initiate

- **Export (HAR/JSON)** and **Copy** actions write to a file or your clipboard
  on your device. What you do with that output is your choice.
- **Copy for AI** masks sensitive header values (e.g. `Authorization`, `Cookie`)
  by default before copying.

## Permissions

- `storage` — remember UI preferences locally.
- `devtools_page` — Chrome/Firefox/Edge builds deliver the panel inside
  DevTools.
- `http://*/*` and `https://*/*` (Safari only) — required so the extension can
  run on web pages you choose to debug and show the overlay panel.

Nocturne runs **no remote code** and sends no captured data to external services.

## Children

Nocturne is a developer tool and is not directed at children under 13.

## Changes

We may update this policy from time to time. The “Last updated” date at the top
will reflect the latest revision.

## Contact

For questions about this policy, open an issue in the
[project repository](https://github.com/MGeovany/nocturne/issues) or visit
https://nocturne.thefndrs.com/support/
