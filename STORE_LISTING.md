# Chrome Web Store listing — Nocturne

Copy/paste-ready text and a checklist for submitting Nocturne to the
[Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole).

---

## Product name

```
Nocturne — Network & Console DevTools
```

## Summary (short description, max 132 chars)

```
A DevTools panel to inspect, filter and debug a page's fetch/XHR requests and console logs — with a one-click "Copy for AI".
```

## Category

Developer Tools

## Language

English

---

## Detailed description

```
Nocturne adds a "Nocturne" tab to Chrome DevTools — a focused workspace for
understanding what each network request in your web app actually did.

FEATURES
• Live capture of fetch/XHR requests: method, URL, status, duration, size.
• Filters: errors (4xx/5xx), slow requests, content-type, URL search, and
  search inside response bodies.
• Sort by recent, slowest, largest, or status. Group by domain.
• Request detail with tabs: Preview, Headers, Body, Traces.
  - Important headers highlighted (Authorization, Content-Type, Cookie,
    Set-Cookie, x-request-id, x-correlation-id, x-trace-id).
  - Sensitive values masked by default; reveal with one toggle.
  - JSON syntax highlighting + an interactive tree: click a key to copy its
    path (data.items[0].id), click a value to copy it.
  - Find-in-body with match highlighting.
• Integrated Console panel — see requests and console logs side by side.
• Mini waterfall timeline per request.
• Star/favorite requests and a "Preserve log" mode with navigation markers.
• Copy as cURL, Copy as fetch, Copy response.
• "Copy for AI": one click produces a structured, secret-masked debug brief —
  what failed, where to look in your codebase, full request/response context,
  and recent console errors — ready to paste into an AI assistant.
• Export to HAR or JSON.

PRIVACY
Nocturne collects nothing. No analytics, no remote servers. All data stays in
your browser. It requests no host permissions, injects no content scripts, and
runs no remote code. See the privacy policy for details.
```

## Privacy policy URL

Host `PRIVACY.md` (e.g. on GitHub) and paste its public URL here.

---

## Privacy practices form (Developer Console answers)

- **Single purpose:** "Nocturne adds a Chrome DevTools panel to inspect, filter,
  and debug the network requests and console output of the page being
  inspected."
- **Permission justifications:**
  - `storage` — "Persist the user's UI preferences (filters, sort order,
    sidebar width) locally on their device."
  - `devtools_page` — "The extension's entire functionality is delivered as a
    DevTools panel."
- **Remote code:** No, this extension does not use remote code.
- **Data collection:** Does not collect or use user data. (Check no categories.)
- **Data usage certification:** Confirm compliance with the Developer Program
  Policies.

---

## Assets checklist

Provided in this repo:
- [x] Store icon 128×128 — `public/icons/icon128.png`
- [x] Toolbar icons 16/32/48 — `public/icons/`

You must add before submitting (cannot be auto-generated — capture from the
running extension):
- [ ] **1–5 screenshots**, 1280×800 or 640×400 PNG/JPG. Suggested shots:
      the request list with filters, a JSON response in tree view, the
      "Copy for AI" output, and the Console panel.
- [ ] _(optional)_ Small promo tile 440×280.
- [ ] _(optional)_ Marquee promo 1400×560.

---

## Build & upload

```bash
npm run package      # builds, then writes nocturne-v<version>.zip
```

Upload the generated `nocturne-v<version>.zip` in the Developer Console, fill in
the fields above, attach screenshots, and submit for review. Bump `version` in
`package.json` and `public/manifest.json` for each new release.
