# SEC-0 · Baseline dependency audit snapshot

Captured on branch `security-remediation` at commit `efd7625` (repo version `2.3.1`), before any
remediation. This is the "before" state that the post-remediation rescan is compared against.

Sonatype IQ report `security_gaps_part_1.pdf`, dated 2026-06-29: **227 policy violations, 59 critical**.

## npm audit summary

Source: `security/baseline-audit.json` (`metadata.vulnerabilities`).

| Severity | Count |
| --- | --- |
| Critical | 21 |
| High | 60 |
| Moderate | 116 |
| Low | 7 |
| Info | 0 |
| **Total** | **204** |

204 distinct advisories across 2005 installed packages (1954 prod, 16 dev, 36 optional).

Only two advisories land on a **direct** dependency: `react-scripts` (high) and `xlsx` (high).
Every other finding is transitive, which matches the expectation that ~95% of the Sonatype
violations come in through the `react-scripts@4.0.1` build toolchain.

### Critical advisories (21)

`@babel/traverse`, `@surma/rollup-plugin-off-main-thread`, `cipher-base`, `ejs`, `elliptic`,
`eventsource`, `form-data`, `immer`, `json-schema`, `jsprim`, `loader-utils`, `minimist`,
`pbkdf2`, `react-dev-utils`, `request`, `sha.js`, `shell-quote`, `tar`, `url-parse`,
`websocket-driver`, `workbox-build`

## Pre-existing lockfile problems

`npm ls --all` exits with `ELSPROBLEMS` on this tree — four packages resolve to versions outside
their declared ranges. Recorded here so the same warnings after remediation are not mistaken for
regressions introduced by it:

- `react@17.0.1` (invalid)
- `react-dom@17.0.1` (invalid)
- `typescript@4.1.3` (invalid)
- `type-fest@0.8.1` (invalid)

The tree JSON was still written in full and is valid.

## Files in this snapshot

| File | Command | Notes |
| --- | --- | --- |
| `baseline-audit.json` | `npm audit --json` | Machine-readable advisory set |
| `baseline-audit.txt` | `npm audit` | Human-readable version of the same run |
| `baseline-tree.json` | `npm ls --all --json` | Full resolved dependency tree |

Reproduce with `npm ci` from this commit, then re-run the three commands above.

Note: the `npm ci` install banner printed *206* vulnerabilities (118 moderate) while the audit JSON
records *204* (116 moderate). The JSON files are the authoritative evidence; treat 204 as the
baseline number.
