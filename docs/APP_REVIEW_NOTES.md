# App Review Information — Notes (Nocturne)

Paste the block below into **App Store Connect → App Review Information → Notes**.
It answers Apple's Guideline 2.1 "Information Needed" request point-by-point.

---

## Notes for the App Review team

Nocturne is a developer tool delivered as a **Safari Web Extension** (macOS). The
container app's only job is to let the user enable the extension in Safari; all
features live in an overlay panel that appears inside Safari web pages once the
extension is turned on. Below is everything requested.

### 1. Demonstration video

A screen recording is attached showing the full flow:

1. Launch the Nocturne app.
2. Tap "Quit and Open Safari Extensions Preferences…" and enable the Nocturne
  extension (and allow it on the current website).
3. Open any website in Safari (e.g. a page that makes fetch/XHR calls).
4. Open the Nocturne overlay panel and show core features: live capture of
  network requests (method, URL, status, timing), filtering by errors/slow/
   content-type, request detail tabs (Preview, Headers, Body, Traces), the JSON
   tree viewer, "Copy as cURL / fetch", and the "Copy for AI" debug brief.

There are **no** account, login, registration, account-deletion, purchase, or
subscription flows. There is **no** user-generated content. The app requests
**no** access to location, contacts, camera, microphone, or App Tracking
Transparency.

### 2. Devices and operating systems tested

- [FILL IN — e.g. MacBook Pro (M-series), macOS 26.x, Safari 26.x]
- [FILL IN — add any other Mac models / macOS versions you tested on]

### 3. Purpose and target audience

Nocturne is a network and console inspector for **web developers and QA
engineers**. While debugging a web app, developers need to see exactly what each
network request did — status, timing, headers, payload and response body — and
quickly share that context. Nocturne surfaces this in a focused Safari overlay
panel, with secrets masked by default and a one-click "Copy for AI" that
produces a structured, secret-masked debug brief to paste into an AI assistant.
It solves the problem of slow, scattered network debugging and the risk of
leaking secrets when sharing request data. It is a professional developer
utility (Developer Tools category) and is not directed at children.

### 4. How to set up and access the main features

No login, credentials, or sample files are required. Steps:

1. Open the Nocturne app and click "Quit and Open Safari Extensions Preferences…".
2. In Safari → Settings → Extensions, enable **Nocturne** and allow it on the
  websites you want to debug (or "Always Allow on Every Website").
3. Browse to a website that performs network requests. Any modern site works;
   for a guaranteed example with live fetch/XHR traffic, open
   **https://jsonplaceholder.typicode.com/** (its homepage runs live fetch
   requests) — or any single-page web app such as **https://github.com/**.
4. Open the Nocturne overlay panel on the page to inspect captured fetch/XHR
  traffic and console output. All features are available immediately and for
   free — no purchase or unlock.

### 5. External services, tools, or platforms

**None.** Nocturne has no backend. It does not use any data providers,
authentication services, payment processors, analytics, or AI services. All
capture and processing happens **locally on the user's device**; nothing is
transmitted off-device. (The "Copy for AI" feature only formats data onto the
clipboard — the app itself does not contact any AI service.)

### 6. Regional differences

None. The app behaves identically in all regions; there is no region-gated
content or functionality.

### 7. Regulated industry / protected third-party material

Not applicable. Nocturne is a general-purpose developer utility. It does not
operate in a regulated industry and includes no protected third-party material.

### Privacy

Nocturne collects no data: no analytics, no accounts, no remote servers. Privacy
policy: [https://nocturne.thefndrs.com/privacy/](https://nocturne.thefndrs.com/privacy/)

---

## Reply to App Review (paste into the App Store Connect message thread)

> Hello, and thank you for the detailed feedback. We have addressed both items.
>
> **Guideline 5 – Legal (China / DST):**
> Nocturne has no ChatGPT, OpenAI, or generative-AI functionality. It is an
> offline network/console inspector for web developers; it has no backend and
> makes no network calls to any AI service. Its only AI-adjacent feature, "Copy
> for AI," simply formats the captured request data onto the system clipboard so
> the user can paste it into any tool of their choice — the app itself never
> contacts ChatGPT, OpenAI, or any other service.
>
> The "ChatGPT" and "GPT" references were only present in our App Store metadata
> (keywords/description), not in the app. We have removed all references to
> ChatGPT and OpenAI from the app name, subtitle, keywords, promotional text,
> description, and screenshots. The app contains no deep-synthesis or generative-
> AI functionality to deactivate.
>
> **Guideline 2.1 – Information Needed (how to verify the Safari extension):**
> Nocturne is a Safari Web Extension (macOS). To verify functionality:
> 1. Launch the Nocturne app and click "Quit and Open Safari Extensions
>    Preferences…".
> 2. In Safari → Settings → Extensions, enable **Nocturne** and choose "Always
>    Allow on Every Website".
> 3. In Safari, open a website that makes network requests. For a reliable test
>    target with live fetch/XHR traffic, open
>    **https://jsonplaceholder.typicode.com/** (its homepage runs live fetch
>    requests), or any single-page app such as **https://github.com/**.
> 4. Open the Nocturne overlay panel on the page. You will see captured requests
>    (method, URL, status, timing). Click a request to view Preview / Headers /
>    Body / Traces, try the filters (errors, slow, content-type), the JSON tree
>    viewer, "Copy as cURL / fetch," and the "Copy for AI" debug brief.
>
> No login, account, purchase, or sample data is required — all features are
> available immediately and for free. We have also added these steps to the App
> Review Information → Notes field. Please let us know if anything else is needed.

---

## Action checklist before resubmitting

- [ ] **Guideline 5 (China):** remove every "ChatGPT" / "GPT" / "OpenAI"
  ```
  reference from App Store metadata — Keywords (most likely), App Name,
  Subtitle, Promotional Text, Description, and any Screenshot image with the
  text baked in. The shipping app is already clean (it uses the generic
  "Copy for AI"), so no code change is needed.
  ```
- [x] **Screen recording (Point 1):** record on a physical Mac running the
  ```
  latest macOS. Start with launching the app, enable the extension in
  Safari, then demonstrate the panel capturing real requests. Attach it in
  the App Review Information section (or include a link).
  ```
- [ ] **Fill in Point 2** with the actual device models + macOS/Safari versions
  ```
  you tested.
  ```
- [ ] **Screenshots (Guideline 2.3.3):** replace any splash/"enable the
  ```
  extension" screenshots with shots of the **extension actually in use** —
  the request list with filters, a JSON response in tree view, the
  "Copy for AI" output, and the Console panel. Do not submit only the
  container-app enable screen.
  ```
- [ ] Paste the Notes block above into the **Notes** field (keep it there for
  ```
  future submissions, as Apple requests).
  ```
