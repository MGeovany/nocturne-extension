# Build instructions (for AMO reviewers)

These steps reproduce an exact copy of the submitted add-on from this source.
None of the source files are transpiled, concatenated, or minified by hand —
all processing is done by the open-source Vite toolchain described below.

## System requirements

- **Operating system:** any of macOS, Linux, or Windows. The add-on build
  (`npm install` + `npm run build`) is cross-platform. The optional packaging
  scripts (`npm run package*`) additionally need the `zip` CLI and a POSIX
  shell, which are standard on macOS/Linux.
- **Disk/RAM:** trivial (< 500 MB including dependencies).
- **Network:** required for `npm install` to fetch dependencies.

## Required programs

- **Node.js 20.x LTS** (also builds cleanly on 22.x). Install from
  <https://nodejs.org/> or via nvm:
  ```bash
  nvm install 20 && nvm use 20
  ```
  This project pins the version in `.nvmrc`.
- **npm 10.x** — bundled with Node.js above (no separate install).

Verify:
```bash
node -v   # v20.x or v22.x
npm -v    # 10.x
```

## Build steps

```bash
# 1. From the root of this source archive, install exact dependencies
#    (versions locked in package-lock.json):
npm install

# 2. Type-check and build:
npm run build
```

The build output is written to `dist/`. The tools used (declared in
`devDependencies` / `package.json`):

- **Vite 5** — orchestrates the build (uses **Rollup** to bundle and **esbuild**
  to minify).
- **@vitejs/plugin-react** — compiles JSX/TSX.
- **TypeScript 5** — type-checking only (`tsc --noEmit`).

Entry points: `devtools.html` (registers the DevTools panel via `devtools.ts`)
and `panel.html` (loads the React app in `src/`). `public/` is copied verbatim
into `dist/` (icons + the Chrome `manifest.json`).

## Reproducing the exact submitted (Firefox) package

The submitted add-on is the `dist/` output with the Firefox manifest. To produce
the identical zip:

```bash
npm run package:firefox    # writes nocturne-firefox-v<version>.zip
```

This runs `npm run build`, then replaces `dist/manifest.json` with
`manifest.firefox.json` (the only file that differs from the Chrome build), and
zips the contents of `dist/`.

Equivalent manual steps (no `zip` CLI needed):
1. `npm run build`
2. Copy `manifest.firefox.json` over `dist/manifest.json`.
3. The contents of `dist/` are the add-on.
