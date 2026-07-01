# Changelog

All notable changes to Nocturne are documented here. This project adheres to
[Keep a Changelog](https://keepachangelog.com/) and
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] — 2026-06-19

Initial release.

### Added
- DevTools panel "Nocturne" capturing fetch/XHR requests via
  `chrome.devtools.network.onRequestFinished`.
- Request list with method, status, duration, size, and content-type badge.
- Filters: errors (4xx/5xx), slow requests, content-type, starred, URL search,
  and search inside response bodies.
- Sort by recent / slowest / largest / status; group by domain.
- Preserve-log mode with navigation markers.
- Request detail tabs: Preview, Headers, Body, Traces.
  - Important headers highlighted; sensitive values masked by default with a
    reveal toggle.
  - JSON syntax highlighting and an interactive tree (click a key to copy its
    path, click a value to copy it).
  - Find-in-body with match highlighting and jump-to-first-match.
- Mini waterfall timeline per request.
- Integrated Console panel showing the page's console output alongside requests.
- Favorites (star) per request.
- Resizable, persisted sidebar (via `chrome.storage.local`).
- Persisted filter/sort/UI preferences.
- Export to HAR and JSON.
- Copy as cURL, Copy as fetch, Copy response.
- "Copy for AI": a secret-masked debug brief (what failed, where to look,
  full request/response context, recent console errors) for pasting into an AI
  assistant.
- Keyboard shortcuts: `/` focuses search, ↑/↓ move the selection.

[Unreleased]: https://example.com/compare/v0.1.0...HEAD
[0.1.0]: https://example.com/releases/tag/v0.1.0
