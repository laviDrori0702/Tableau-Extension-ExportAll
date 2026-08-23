# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A Tableau dashboard extension (`com.theinformationlab.extensions.exportall`) that adds
an "Export All" button to a dashboard. One click writes the selected sheets and columns
of summary data into a single `.xlsx` workbook, client-side. No data ever leaves the
browser — there is no backend.

Create React App (react-scripts 4) + React 17. Not sandboxed, and cannot be: Tableau
blocks file downloads from sandboxed extensions, which is this extension's whole purpose.

## Commands

```bash
npm install

# Dev server. On Node 17+ the legacy OpenSSL flag is REQUIRED — webpack 4 uses an
# MD4 hash removed from modern OpenSSL. Without it: ERR_OSSL_EVP_UNSUPPORTED.
NODE_OPTIONS=--openssl-legacy-provider npm start        # bash
$env:NODE_OPTIONS="--openssl-legacy-provider"; npm start # PowerShell

npm run build      # plain CRA build
npm run release    # build + copy index.html into build/configure and build/desktopexport
npm test           # react-scripts test
```

`NODE_OPTIONS` in `.env` does **not** work — Node reads it at process launch, before
react-scripts loads `.env`.

Tableau opens `/configure` and `/desktopexport` as real URLs in popup dialogs, so those
paths have to resolve. `npm run release` is the deployable artifact **on a host without
rewrite support** — it copies `index.html` to each of those paths on disk.

On the Render deploy, `render.yaml` rewrites all routes to `index.html`, so the plain
`npm run build` is what Render runs and the copies are redundant. See
`docs/deploy-render.md`. Don't "fix" the Render build command to `release`.

## Architecture

**One bundle, three routes.** `src/containers/Main.js` is the only stateful component
(class component, `this.state` holds `meta`, button label/style/disabled, `filename`).
It routes to three top-level views, all fed by the same state and handler props:

| Route | Component | Rendered in |
|---|---|---|
| `/` | `Extension` | the dashboard itself — just the button |
| `/configure` | `Configure` | popup dialog via `displayDialogAsync` |
| `/desktopexport` | `DesktopExport` | popup dialog; a "your Tableau is too old" message for Desktop < 2019.4 |

The popups are **separate browser contexts**. They do not share `Main`'s React state
with the dashboard instance — they only share Tableau's settings store. That is why
`Configure` re-reads settings on mount and `Extension.refreshSettings()` re-reads them
when the dialog closes.

**`src/components/func/func.js` is the boundary layer.** Every call into the
`tableau.extensions` API and every XLSX operation lives here; components stay
presentational-ish. Keep new Tableau/XLSX work in this file.

**The `meta` object is the core data structure** — an array of sheets, each with
`{sheetName, changeName, selected, customCols, columns[]}`, and each column with
`{index, name, changeName, dataType, selected, order}`. `changeName` is the user's
rename override; `order` drives both the sheet tab order and column order in the export.

- `initializeMeta()` builds it fresh from the dashboard's worksheets (all columns selected).
- `revalidateMeta(existing)` re-reads the live dashboard and reconciles against saved
  meta — sheets/columns added or removed in Tableau since the last save. It preserves
  `selected`/`changeName` by matching on **name**, so a field renamed in Tableau reads
  as a new column and loses its config.

**Persistence is `tableau.extensions.settings`**, five keys, each a JSON string:
`selectedSheets` (the meta), `buttonLabel`, `buttonStyle`, `filename`, `metaVersion`.
`saveSettings()` only calls `saveAsync()` in `authoring` mode — Tableau rejects writes
from view mode.

**Export path**: `exportToExcel` → `buildExcelBlob` (per selected sheet:
`getSummaryDataAsync`, apply the column selection/rename/order) → `decodeDataset` /
`decodeRow` maps Tableau data types to SheetJS cell types (`n`/`s`/`b`/`z`; numbers use
the raw `value`, dates use `formattedValue`) → `XLSX.write` → `file-saver`.

`buildExcelBlob` awaits a `Promise.all` over per-sheet `buildWorksheet` calls, so tab and
column order follow the configured order and one failed sheet rejects the whole export
rather than hanging it. Don't reintroduce a completion counter here — the old version
counted finished sheets against a total, which meant a rejected `getSummaryDataAsync`
left the promise unsettled forever and the button silently did nothing. Rejections must
stay chained: `exportToExcel` returns its promise, and `Extension.clickExportHandler`
catches it.

Environment branching in `Extension.clickExportHandler()`: on Server, export directly;
on Desktop, export directly only if `tableauVersion >= 2019.4`, otherwise open the
`/desktopexport` explainer dialog.

## The .trex manifest

`ExportAll.trex` (and the copy in `public/`) is the file a user loads into Tableau. Its
`<source-location><url>` decides where Tableau fetches the extension from.

**For local dev, point a throwaway copy at `http://localhost:3000` and keep it out of
the repo.** The committed `.trex` must carry the production URL — on this fork that is
the Render deploy, `https://tableau-extension-exportall.onrender.com`, not the upstream
Vercel domain. Tableau accepts plain http for localhost, so no certificate work is
needed.

Bumping the extension version means bumping it in **all three** places: `package.json`
(`version`), and `extension-version` in both `ExportAll.trex` and `public/ExportAll.trex`.

`public/ExportAll.trex` is the copy that gets built into `build/` and served at
`/ExportAll.trex` and `/download` — so it, not the root copy, is what users download.
Keep the two in sync.

## Conventions

- Console logs are prefixed with the source file: `console.log('[func.js] ...')`. Keep it.
- `tableau` is a global from the script tag in `public/index.html`; files touching it
  declare `/* global tableau */` for the linter.
- Two UI kits coexist: `@tableau/tableau-ui` for anything that should look native to
  Tableau, `@material-ui/core` for the rest. Prefer tableau-ui in Configure.
- `xlsx` is pinned at `^0.16.9` and `postcss` is pinned through `overrides`. Both pins
  are deliberate; check before bumping.
- Two more `overrides` keep the Babel tree compatible with react-scripts 4, which hard-pins
  `@babel/core` at `7.12.3`: `@babel/preset-env` at `7.21.5` and
  `babel-preset-current-node-syntax` at `1.0.1`. Both float into versions that pull
  `@babel/plugin-syntax-import-attributes`, which requires `@babel/core` >= 7.22 and breaks
  `npm test` with `Requires Babel "^7.22.0"`. The plugin has no release older than 7.22, so
  pinning it directly can't work — pin its parents.
- `.npmrc` sets `legacy-peer-deps=true`. `@tableau/tableau-ui@3.2.0` declares a peer of
  React 16 while this project runs React 17, so npm 7+ fails the install with `ERESOLVE`
  without it — including the `npm install` in `render.yaml`'s build command.

## Agent skills

### Issue tracker

GitHub Issues on the `origin` remote, driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one root `CONTEXT.md` plus ADRs in `docs/adr/`. See `docs/agents/domain.md`.
