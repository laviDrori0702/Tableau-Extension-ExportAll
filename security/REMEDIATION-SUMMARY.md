# Security remediation summary (SEC-0 … SEC-6)

Branch `security-remediation`, repo version `2.3.1`. Response to Sonatype IQ report
`security_gaps_part_1.pdf` (2026-06-29): **227 policy violations, 59 critical**.

Baseline evidence: [`BASELINE.md`](BASELINE.md). Licence dispositions: [`WAIVER-REQUESTS.md`](WAIVER-REQUESTS.md).

---

## Before / after

| Measure | Baseline (`efd7625`) | Now (`security-remediation`) |
| --- | --- | --- |
| Sonatype violations / critical | 227 / 59 | rescan pending — see below |
| `npm audit` advisories (full tree) | 204 | **0** |
| … critical / high | 21 / 60 | **0 / 0** |
| … moderate / low | 116 / 7 | **0 / 0** |
| `npm audit --omit=dev` (runtime only) | not separable — 1954 of 2005 packages were prod | **0 vulnerabilities** |
| Installed packages | 2005 | 197 |
| … of which runtime (prod) | 1954 | 45 (SBOM components) |
| Direct deps with advisories | `react-scripts` (high), `xlsx` (high) | none |

Sonatype's own count cannot be reproduced locally — only the IQ server can restate it. `npm audit`
is the reproducible proxy: it fell from 204 advisories to 0, and the two packages that carried the
report's CVE findings on *direct* dependencies (`react-scripts@4.0.1`, `xlsx@0.16.9`) are both gone
from the tree. The remaining ask of the security department is a rescan (see
[Recommendation](#recommendation-for-the-security-department)).

## What changed, per ticket

| Ticket | Issue | Change | Effect |
| --- | --- | --- | --- |
| SEC-0 | [#1](https://github.com/laviDrori0702/Tableau-Extension-ExportAll/issues/1) | Captured `npm audit` / `npm ls --all` before any change | Evidence baseline, no code change |
| SEC-1 | [#2](https://github.com/laviDrori0702/Tableau-Extension-ExportAll/issues/2) | Dropped `react-router-dom`; routing is now a `window.location.pathname` switch in `Main.jsx` (`normalizePath`) | Removes `path-to-regexp` **CVE-2024-45296** (high, ReDoS) |
| SEC-2 | [#3](https://github.com/laviDrori0702/Tableau-Extension-ExportAll/issues/3) | Replaced `react-scripts@4.0.1` (CRA) with Vite 8; tests moved to vitest; `now.json` routes `/assets/*` | The single largest change — CRA's tree carried the large majority of findings. After SEC-1 + SEC-2 the audit was down to a single advisory (`xlsx`, high): all 21 criticals left with `react-scripts`. Evidence: `post-vite-audit.txt` |
| SEC-3 | [#4](https://github.com/laviDrori0702/Tableau-Extension-ExportAll/issues/4) | `xlsx` 0.16.9 → SheetJS **0.20.3**, installed from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` | Fixes **CVE-2023-30533** (prototype pollution) and **CVE-2024-22363** (ReDoS). The tarball URL is required, not a workaround: SheetJS stopped publishing to npm at 0.18.5, which is still vulnerable to both |
| SEC-4 | [#5](https://github.com/laviDrori0702/Tableau-Extension-ExportAll/issues/5) | `release.yml`: Node 12 → 20, unmaintained actions → `actions/checkout@v4` + `actions/setup-node@v4` + `softprops/action-gh-release` **pinned to commit `3bb1273`**; added `npm audit --omit=dev --audit-level=high` gate before build | Release pipeline no longer runs EOL Node or mutable third-party tags; a new high/critical runtime finding now fails the release instead of shipping |
| SEC-5 | [#6](https://github.com/laviDrori0702/Tableau-Extension-ExportAll/issues/6) | Licence findings dispositioned in `WAIVER-REQUESTS.md` | Three licence findings resolved by SEC-2; two waivers requested |
| SEC-6 | [#7](https://github.com/laviDrori0702/Tableau-Extension-ExportAll/issues/7) | This document, clean-install audit evidence, CycloneDX SBOMs | Handoff package |

React stays on **17** deliberately: `@tableau/tableau-ui` and `@material-ui` v4 are both v17-era.
No CVE in the report targets React 17, so bumping it would be an unrelated breaking change.

## Evidence files

Reproduce all of it with `rm -rf node_modules && npm ci` on this branch, then re-run each command.

| File | Command | Result |
| --- | --- | --- |
| `final-audit-production.txt` | `npm audit --omit=dev` | `found 0 vulnerabilities` |
| `final-audit-full.txt` | `npm audit` | `found 0 vulnerabilities` |
| `sbom-production.cdx.json` | `npm sbom --omit dev --sbom-format cyclonedx` | CycloneDX 1.5, 45 components |
| `sbom-full.cdx.json` | `npm sbom --sbom-format cyclonedx` | CycloneDX 1.5, 171 components |
| `baseline-audit.{json,txt}`, `baseline-tree.json` | pre-remediation equivalents | 204 advisories |

Clean `npm ci` on 2026-08-04 (npm 11.5.2): `added 197 packages … found 0 vulnerabilities`.
`npm test` → 9 passed. `npm run release` → clean build (`build/`, 920 kB JS before gzip).

**No dev-only exceptions to justify.** The full-tree audit is also 0, so there is no residual
dev-only finding carrying a waiver.

Two `npm ci` deprecation warnings remain and are *not* advisories: `@material-ui/core@4.12.4`
(unmaintained since 2021 — held back by React 17, above) and `glob@7`/`inflight@1` reaching the
tree through `copyfiles`, a dev-only build helper.

## Remaining waiver requests

Both are in [`WAIVER-REQUESTS.md`](WAIVER-REQUESTS.md); neither is a CVE and neither is fixable in code:

1. **`@tableau/tableau-ui` — "License-Non Standard / See-License-Clause"** (threat 5/6). The package
   declares `"license": "SEE LICENSE IN LICENSE"`, pointing at the Tableau EULA, which has no SPDX
   identifier by design. Waiver requested scoped to `^3.x`, not the reported `3.2.0`, or the finding
   reappears on the next patch bump.
2. **`Component-Unknown` on `Cohen_Avi_DWH__*.zip`, `v2.3.1.zip`, `Tableau-Extension-ExportAll-2.3.1.zip`**
   (threat 2). These are the submitted archive filenames, not dependencies. Waiver plus a change in
   how future scans are submitted.

Resolved without a waiver: `node-forge@0.10.0` (BSD-3 OR GPL-2.0), `rework@1.0.1` (no licence
declared), `path-is-inside@1.0.2` (MIT or WTFPL) — all three entered through `react-scripts` and
left with it in SEC-2. `npm ls` reports `(empty)` for each.

## Functional verification

The build, the test suite, and both audits pass locally. What is **not** verified here is runtime
behaviour inside Tableau — that needs a Tableau Desktop or Server ≥ 2021.1 environment, which this
workstation does not have. The checklist has been handed to the repo owner as a comment on
[#7](https://github.com/laviDrori0702/Tableau-Extension-ExportAll/issues/7) and must be executed
before the PR is merged.

The settings contract is unchanged by the remediation — the same keys (`selectedSheets`,
`buttonLabel`, `buttonStyle`, `filename`, `metaVersion`) in the same JSON-stringified form — so
dashboards configured with 2.3.1 or earlier keep working. Verifying that is item 2 of the checklist.

One deployment-shaped caveat, out of scope for the SEC tickets but worth stating: `now.json`'s route
table is what makes `/configure` and `/desktopexport` resolve, and no local build or static file
server exercises it. A green `npm run release` is not evidence that the deployed site works.

## Recommendation for the security department

Rescan **the production artifact, not the development tree**:

- `security/sbom-production.cdx.json` — the 45 runtime components with resolved versions, the
  authoritative input for a coordinate-based rescan; or
- `v2.3.1.zip`, the output of `npm run release` (`build/` nested, matching what `release.yml`
  publishes) — the exact bytes served to users.

Scanning the full development tree inflates the count roughly 4× against this repo: of 197 installed
packages only 45 are runtime. `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom` and `copyfiles` run
only on a developer machine or in CI and emit no code into `build/`, so no user, dashboard, or
Tableau Server ever executes them. A finding in a build tool is a pipeline concern, not exposure in
the shipped extension. See §4 of `WAIVER-REQUESTS.md`.

Then: grant or refuse the two waivers above, and confirm the rescan before the repo owner merges
the PR.
