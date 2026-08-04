# SEC-5 · License findings & waiver requests

Disposition of the **non-CVE** findings in Sonatype IQ report `security_gaps_part_1.pdf` (2026-06-29)
— the items that need a written decision rather than a code fix.

Written after SEC-2 (`react-scripts` → Vite), SEC-3 (`xlsx` → SheetJS 0.20.3) and SEC-4 (release
workflow), on branch `security-remediation`. Baseline "before" state: [`BASELINE.md`](BASELINE.md).

**No dependency or source changes accompany this document.**

---

## 1. Resolved without a waiver — three license findings are gone

The report flagged three packages on license grounds. All three entered the tree only through
`react-scripts@4.0.1`, which SEC-2 removed:

| Package | Report finding | Baseline path |
| --- | --- | --- |
| `node-forge@0.10.0` | BSD-3-Clause **OR** GPL-2.0 (dual, copyleft option) | `react-scripts@4.0.1 > webpack-dev-server@3.11.0 > selfsigned@1.10.8 > node-forge@0.10.0` |
| `rework@1.0.1` | No license declared | `react-scripts@4.0.1 > resolve-url-loader@3.1.2 > rework@1.0.1` |
| `path-is-inside@1.0.2` | MIT **or** WTFPL (dual) | `react-scripts@4.0.1 > webpack-dev-server@3.11.0 > del@4.1.1 > is-path-in-cwd@2.1.0 > is-path-inside@2.1.0 > path-is-inside@1.0.2` |

Baseline paths were read from `security/baseline-tree.json` (the pre-remediation `npm ls --all --json`).

### Verification

```
$ npm ls node-forge
tableau-extension-exportall@2.3.1 C:\Users\lavid\PyCharmMiscProject\Tableau-Extension-ExportAll
`-- (empty)

$ npm ls rework
tableau-extension-exportall@2.3.1 C:\Users\lavid\PyCharmMiscProject\Tableau-Extension-ExportAll
`-- (empty)

$ npm ls path-is-inside
tableau-extension-exportall@2.3.1 C:\Users\lavid\PyCharmMiscProject\Tableau-Extension-ExportAll
`-- (empty)
```

`(empty)` for all three: **no waiver needed.** For context, the same tree now reports
`npm audit` → `found 0 vulnerabilities`, down from 204 advisories at baseline.

---

## 2. Waiver requested — `@tableau/tableau-ui` license classification

**Finding:** "License-Non Standard / See-License-Clause", threat score 5/6, on
`@tableau/tableau-ui : 3.2.0`.

**Disposition requested: waiver.**

### Why the classification fires

The package declares a non-SPDX license string, so Sonatype cannot map it to a known license and
classifies it as non-standard. From `node_modules/@tableau/tableau-ui/package.json`:

```json
"license": "SEE LICENSE IN LICENSE"
```

The referenced `LICENSE` file contains exactly one line:

```
This project is subject to Tableau EULA at https://www.tableau.com/legal.
```

This is not a missing or ambiguous license — it is a vendor EULA reference, which by design has no
SPDX identifier.

### Rationale for the waiver

- **First-party vendor library.** `@tableau/tableau-ui` is Tableau's own official React component
  library for building Tableau extensions, published by Tableau on npm:
  https://www.npmjs.com/package/@tableau/tableau-ui
- **Used solely inside a Tableau product.** This repository *is* a Tableau dashboard extension; it
  only ever runs embedded in Tableau Desktop/Server/Cloud, by users who already hold a Tableau
  licence and are already bound by the same EULA the component library points at. Using Tableau's
  component library inside a Tableau extension introduces no licence obligation the deployment did
  not already carry.
- **No copyleft exposure.** The EULA is proprietary vendor terms, not a reciprocal/copyleft licence.
  There is no source-disclosure or share-alike obligation of the kind the license-scanning policy
  exists to catch.
- **No viable alternative.** Building a Tableau-look-and-feel extension without Tableau's own UI kit
  means reimplementing it; the licence posture would not improve, since the extension still runs
  under the Tableau EULA either way.

### Version note

The report cites `3.2.0`. `package.json` declares `"@tableau/tableau-ui": "^3.2.0"`, which currently
resolves to **3.14.0**. Both versions carry the identical `SEE LICENSE IN LICENSE` → Tableau EULA
declaration, so the waiver should be granted against the `^3.x` range rather than a single pinned
version, otherwise the finding will reappear on the next patch bump.

---

## 3. Waiver / process change requested — `Component-Unknown` on the submitted archives

**Finding:** `Component-Unknown`, threat score 2, on `Cohen_Avi_DWH__*.zip`, `v2.3.1.zip`, and
`Tableau-Extension-ExportAll-2.3.1.zip`.

**Disposition requested: waiver, plus a change to how future scans are submitted.**

### Rationale

These three names are not dependencies. They are the **outer archive filenames of the scan
submission itself** — the zip that was handed to Sonatype, plus the release zip inside it. Sonatype
attempts to identify every archive it encounters against its component database; an arbitrary
project zip has no coordinates to match, so it is reported as `Component-Unknown`.

There is nothing to remediate in the codebase: the finding describes the packaging of the
submission, not the software. It will recur on every scan submitted as a bare zip, with a different
filename each time.

### Recommended process change

Submit either the **extracted source tree** (so Sonatype reads `package.json` /
`package-lock.json` and resolves real coordinates) or, preferably, the **production build output**
— see §4.

---

## 4. Scan-scope recommendation

**Request:** evaluate the production artifact rather than the full development tree.

Concretely, scan either the `build/` output produced by `npm run release` (the exact bytes that get
deployed and served to users) or the SBOM to be generated in SEC-6 (issue #7), which will enumerate
the runtime dependency set with resolved versions.

### Why the dev/runtime distinction matters here

The installed tree is 197 packages, of which only **47** are production dependencies; the remaining
150 are development-only. (Counted with `npm ls --all --parseable` and
`npm ls --omit=dev --all --parseable`, discounting the root line each prints.) `devDependencies` — `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`,
`copyfiles` — run exclusively on a developer machine or in CI to produce the bundle; not one line of
them is emitted into `build/`, so no user, dashboard, or Tableau Server ever executes them. A
vulnerability or licence obligation in a build tool is a supply-chain concern for the build pipeline,
not an exposure in the shipped extension, and conflating the two inflates the finding count by
roughly 4× against this repo without describing risk to any user.

The current runtime dependency set, in full:

```
$ npm ls --omit=dev --depth=0
tableau-extension-exportall@2.3.1 C:\Users\lavid\PyCharmMiscProject\Tableau-Extension-ExportAll
+-- @material-ui/core@4.12.4
+-- @material-ui/icons@4.11.3
+-- @tableau/tableau-ui@3.14.0
+-- compare-versions@3.6.0
+-- file-saver@2.0.5
+-- react-dom@17.0.2
+-- react@17.0.2
`-- xlsx@0.20.3
```

---

## Summary

| # | Item | Requested disposition |
| --- | --- | --- |
| 1 | `node-forge`, `rework`, `path-is-inside` | None needed — removed with `react-scripts` (SEC-2) |
| 2 | `@tableau/tableau-ui` non-standard license | Waiver, scoped to `^3.x` |
| 3 | `Component-Unknown` on submitted `.zip` files | Waiver + submission-format change |
| 4 | Scan scope covers dev tooling | Scan `build/` output or the SEC-6 SBOM |
