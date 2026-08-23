# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A Tableau dashboard extension (`com.theinformationlab.extensions.exportall`) that adds
an "Export All" button to a dashboard. One click writes the selected sheets and columns
of summary data into a single `.xlsx` workbook, client-side. No data ever leaves the
browser — there is no backend.

Create React App (react-scripts 5) + React 17. Not sandboxed, and cannot be: Tableau
blocks file downloads from sandboxed extensions, which is this extension's whole purpose.

## Commands

```bash
npm install

npm start          # dev server — no NODE_OPTIONS flag needed
npm run build      # plain CRA build
npm run release    # build + copy index.html into build/configure and build/desktopexport
npm test           # react-scripts test
```

react-scripts 5 ships webpack 5, which dropped the MD4 hash that made older Node fail with
`ERR_OSSL_EVP_UNSUPPORTED`. The `--openssl-legacy-provider` flag this project used to require
is obsolete — don't reintroduce it.

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
the Render deploy, `https://tableau-extension-exportall-mu1y.onrender.com`, not the upstream
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
- `xlsx` (`^0.16.9`) and `compare-versions` (`^3.6.0`) are long-standing deliberate
  pins — neither is related to the react-scripts 5 upgrade. Check before bumping:
  `compare-versions` v4+ is ESM-only and will break. The old `postcss` override is
  gone because CRA 5 ships postcss 8 natively, which is already the patched line.
- `.npmrc` sets `legacy-peer-deps=true`. `@tableau/tableau-ui@3.2.0` declares a peer of
  React 16 while this project runs React 17, so npm 7+ fails the install with `ERESOLVE`
  without it — including the `npm install` in `render.yaml`'s build command.
- **The `ajv` entries in `overrides` exist because of that `legacy-peer-deps` flag.**
  react-scripts 5 pulls both `ajv-keywords@5` (peer: `ajv@8`) and `ajv-keywords@3`
  (peer: `ajv@6`). `legacy-peer-deps` skips peer installation entirely, so npm hoists
  eslint's `ajv@6` to the root and `ajv-keywords@5` dies with
  `Cannot find module 'ajv/dist/compile/codegen'`. The fix is a root `ajv@8` devDependency
  plus nested `ajv@6` overrides for `eslint` and `fork-ts-checker-webpack-plugin`.
  A single root pin can't work — both majors are genuinely required. The root
  devDependency is the load-bearing half: `overrides` can only rewrite *declared
  dependency* ranges, and `ajv-keywords` declares `ajv` as a **peer**, so no override
  on `ajv-keywords` itself has anything to rewrite. Don't try to replace the
  devDependency with one.
- `resolve-url-loader` is overridden to `^5.0.0`. CRA 5 depends on v4, which carries a
  private `postcss@7` with open advisories; v5 uses postcss 8. Sass isn't used here, so
  the loader is barely exercised — the override is purely to clear the audit.

## Agent skills

### Issue tracker

GitHub Issues on the `origin` remote, driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one root `CONTEXT.md` plus ADRs in `docs/adr/`. See `docs/agents/domain.md`.
