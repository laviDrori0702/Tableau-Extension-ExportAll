# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Fork only

All work happens on the fork `laviDrori0702/Tableau-Extension-ExportAll` (`origin`, `https://github.com/laviDrori0702/Tableau-Extension-ExportAll.git`) at `C:\Users\lavid\PyCharmMiscProject\Tableau-Extension-ExportAll`.

The `upstream` remote (`TheInformationLab/Tableau-Extension-ExportAll`) is read-only reference. **Never** push, tag, open PRs/issues, or otherwise write to it — no `git push upstream`, no `gh` command without `--repo laviDrori0702/Tableau-Extension-ExportAll` (bare `gh` resolves to `upstream`).

## What this is

A Tableau dashboard extension (Create React App 4, React 17, class + function components mixed) that adds an "Export All" button to a dashboard and writes the selected worksheets' summary data into a single `.xlsx` via SheetJS + FileSaver. Not sandboxed — file download is impossible in a sandboxed extension.

## Commands

```bash
npm start        # dev server on :3000 (must be loaded from Tableau to work — see below)
npm run build    # CRA build to ./build
npm run release  # build + duplicate index.html into build/configure and build/desktopexport
npm test         # CRA/Jest watch mode
```

`src/containers/Main.test.js` covers `normalizePath` only — there is no render/integration coverage.

There is no lint script; ESLint runs inside `react-scripts` (`eslintConfig: react-app`).

## Architecture

**Three routes, one bundle.** `src/containers/Main.js` is the single stateful container, holding all settings state (`meta`, button label/style, filename) and passing mutation handlers down:

- `/` → `Extension` — the button rendered inside the dashboard. Calls `tableau.extensions.initializeAsync`.
- `/configure` → `Configure` — the config dialog, opened by `displayDialogAsync`. Calls `initializeDialogAsync`.
- `/desktopexport` → `DesktopExport` — a static "upgrade to Desktop 2019.4+" message; older Desktop cannot download files. Mostly commented-out legacy code.

`Main.render()` picks the view with a plain `window.location.pathname` check (`normalizePath` strips a trailing slash and a trailing `/index.html`, so `/configure`, `/configure/` and `/configure/index.html` all match). There is no router — each view is a separate page load, so the path never changes at runtime.

Each dialog is a **separate browser context** with its own `Main` instance, so state is not shared between the extension and its dialogs. Everything crosses that boundary through `tableau.extensions.settings` (JSON strings). After the dialog closes, `Extension.refreshSettings()` re-reads the settings keys.

**Settings keys** (all JSON-stringified in Tableau's settings store): `selectedSheets`, `buttonLabel`, `buttonStyle`, `filename`, `metaVersion`. `setSettings(type, value)` in `func.js` maps friendly names to these keys; `saveSettings()` only calls `saveAsync` when `environment.mode === "authoring"` (Tableau rejects saves in viewing mode).

**`src/components/func/func.js` is the core.** Everything non-UI lives here:
- `initializeMeta()` — builds fresh `meta` from the dashboard's worksheets (all columns selected).
- `revalidateMeta(existing)` — reconciles saved `meta` against the dashboard's *current* worksheets/columns: keeps saved selections, renames and ordering, appends new columns at the end, drops vanished ones, then reorders sheets to the saved order. Any change to the meta shape must be handled here or saved dashboards break.
- `exportToExcel` → `buildExcelBlob` → `decodeDataset` → `decodeRow` — maps Tableau `dataType` to SheetJS cell types (`n`/`s`/`b`/`z`), uses raw `value` for numbers and `formattedValue` for dates/strings. `ignoreEC:false` on write is deliberate (prevents Excel crashes during text-to-column). Illegal Excel tab characters `*?/\[]` are stripped from tab names.

**`meta` shape** (the whole persisted config):
```js
[{ sheetName, changeName, selected, customCols,
   columns: [{ index, name, changeName, dataType, selected, order }] }]
```

Note `buildExcelBlob` reads `tableau.extensions.dashboardContent.dashboard.worksheets` while `initializeMeta`/`revalidateMeta` read the private `._dashboard.worksheets`.

## Hosting & routing

The extension is served statically. CRA's `homepage: ".."` makes asset paths relative, which is what lets `/configure/index.html` and `/desktopexport/index.html` resolve `../static/...` back to the root — hence the `release` script copying the built `index.html` into those folders. `public/configure/index.html` and `public/desktopexport/index.html` are pre-build placeholders that the release step overwrites; don't rely on them for asset paths.

`now.json` (Vercel v2) rewrites everything to `/index.html` and serves `/download` → `/ExportAll.trex`.

The Tableau Extensions API is loaded from `public/js/tableau.extensions.1.4.0.min.js` via a `<script>` tag in each HTML entry, so `tableau` is a **global** — files using it carry a `/* global tableau */` comment for the linter.

## Releasing

Version lives in **three** places and must be bumped together: `package.json`, `ExportAll.trex` (`extension-version`), and `public/ExportAll.trex` (currently byte-identical to the root one; `now.json`/`public/now.json` likewise). Pushing a `v*` tag triggers `.github/workflows/release.yml`, which runs `npm run release`, zips `build/` as `v#.#.#.zip`, and creates a **draft** GitHub release.

`ExportAll.trex`'s `<url>` points at the hosted deployment; local installs edit that tag to their own web server.

## Agent skills

### Issue tracker

GitHub Issues on the fork `laviDrori0702/Tableau-Extension-ExportAll` — every `gh` command must pass `--repo`, or it resolves to the `upstream` remote (`TheInformationLab/…`) instead. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical labels, used unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root (neither exists yet — that's fine). See `docs/agents/domain.md`.

## Conventions in this codebase

- Console logging is the debugging mechanism, prefixed with the filename: `console.log('[func.js] ...')`. Match this when adding code.
- `func.js` helpers all return Promises even when synchronous — keep the shape if you extend them.
