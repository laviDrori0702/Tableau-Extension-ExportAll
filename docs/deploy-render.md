# Deploying Export All to Render

> **Not on this branch.** `render.yaml` is deliberately absent on `dev/environment` — this is
> the local dev branch and carries no deploy config. The live deploy runs from
> `prod/environment`. This doc is kept here for reference; note in particular that `now.json`
> and `public/now.json` are dead Vercel leftovers on every branch.

This fork is hosted as a **Render static site**, provisioned from `render.yaml` at the repo
root. Export All is frontend-only — a Create React App build, no backend, no API keys, no
environment variables — so the whole deployment is one static service.

Production URL: `https://tableau-extension-exportall-mu1y.onrender.com`

## First deploy

1. Push the branch you want to deploy (`prod/environment`) to `origin`.
2. In the Render dashboard: **New → Blueprint**, pick this repository.
3. Render reads `render.yaml` and proposes one service, `tableau-extension-exportall`
   (`type: web`, `runtime: static`). Set the branch to `prod/environment`.
4. **Apply**. Render runs `npm install && npm run build` and publishes `./build`.

`autoDeployTrigger: commit` is set, so every subsequent push to that branch redeploys
automatically. (Older Blueprints spell this `autoDeploy: true`; Render still honours it, but
the newer key is the documented one.)

Static sites are CDN-served and never sleep, so there's no cold-start penalty — unlike free
*web services*. They also carry no `plan` key: there's no instance type to choose, and the
validator rejects `plan: free` with `no such plan free for service type web`. Hosting is
free, metered only against workspace bandwidth and build minutes.

### Which build script Render runs

`npm run build` (plain `react-scripts build`), **not** `npm run release`.

`release` exists to copy `build/index.html` into `build/configure` and `build/desktopexport`,
giving those two client-side routes real files on disk — a workaround for hosts without
rewrite support. Render's catch-all rewrite covers every route generically, including any
added later, so the copies are redundant. The script is left in `package.json` because it's
harmless and the old Vercel deploy may still use it.

## Verify after deploying

Do all of these before telling anyone the URL:

- [ ] `https://tableau-extension-exportall-mu1y.onrender.com/` loads (the Export All button).
- [ ] `/configure` loads **directly** in a browser tab — not just via in-app navigation.
      This is what catches a broken asset path (see Troubleshooting).
- [ ] `/desktopexport` loads directly.
- [ ] No 404s or MIME-type errors in the browser console on any of those routes.
- [ ] `/download` downloads `ExportAll.trex` as a file rather than rendering XML.
- [ ] Add the extension to a real Tableau dashboard using `ExportAll.trex`: the button
      renders inside Tableau's iframe, the Configure dialog opens, and an export produces
      an `.xlsx`.
- [ ] On Tableau Desktop, run an export (Desktop ≥ 2019.4) — or confirm the
      `/desktopexport` explainer dialog appears on older Desktop.

## The `.trex` manifest

`ExportAll.trex` (and the copy in `public/`, which is what `/download` serves) is the file a
user loads into Tableau. Its `<source-location><url>` decides where Tableau fetches the
extension from. Both copies point at the Render URL on this branch.

Distributing it: hand users the `.trex` file, or the `/download` short URL.

### Tableau Server / Cloud safe list

Tableau blocks unsandboxed extensions that aren't safe-listed. A site admin must add
`https://tableau-extension-exportall-mu1y.onrender.com` to
**Settings → Extensions → Allow specific extensions**. This is a Tableau-side action; nothing
in this repo can do it.

Tableau requires HTTPS for any non-localhost extension URL. Render serves HTTPS by default.

### Moving to a custom domain

1. In Render: service → **Settings → Custom Domains**, add the hostname, and create the
   `CNAME` record it gives you.
2. Change `<url>` in **both** `ExportAll.trex` and `public/ExportAll.trex` to the new
   hostname, commit, and let autoDeploy ship it.
3. Redistribute the `.trex` to users, and safe-list the new URL in Tableau.

Existing `.trex` files keep pointing at the old URL — a hosting change always means
redistributing the manifest. That's the reason to move to a domain you own sooner rather
than later.

### Bumping the version

An extension version bump has to happen in **three** places: `version` in `package.json`,
and `extension-version` in both `.trex` copies.

## Local development

```bash
npm install
npm start
```

No `NODE_OPTIONS` flag is needed. react-scripts 5 / webpack 5 dropped the MD4 hash that
used to make Node 17+ fail with `ERR_OSSL_EVP_UNSUPPORTED`, which is also what let Render
build on its default modern Node.

To point Tableau Desktop at the dev server, copy `ExportAll.trex` somewhere outside the repo,
change its `<url>` to `http://localhost:3000`, and load that copy. Tableau accepts plain http
for localhost, so no certificate work is needed. **Keep the localhost copy out of the repo** —
the committed manifests must carry the production URL.

## Why `now.json` is still here

`now.json` is a **Vercel leftover**. Editing it has no effect on the Render deploy.

Hosting moved to Render because the Vercel deployment
(`exportallextension.theinformationlab.io`) belongs to The Information Lab, the upstream
project: we can't redeploy it, can't read its build logs, and can't get our deliberate
dependency pins (the `xlsx`, `ajv` and `resolve-url-loader` entries) into what it serves.

The file stays because existing users' `.trex` files still point at the Vercel domain, and
deleting the config would strand them. Decommissioning Vercel — redistributing `.trex` files,
retiring the old domain — is separate work.

`render.yaml` reproduces the three behaviours `now.json` provided: the SPA catch-all rewrite,
download headers on `/ExportAll.trex` plus the `/download` redirect, and permissive framing
headers.

One deliberate divergence: `now.json` sets `"Content-Disposition": "Content-Disposition"`,
which is a typo — the value is the header's own name. `render.yaml` sets
`attachment; filename="ExportAll.trex"` instead. Not a transcription slip; reproducing the
typo would have left the manifest rendering as XML.

## Troubleshooting

**Blank page on `/configure` or `/desktopexport`, but `/` works. Console shows JS served as
`text/html`.**

The likely cause is `homepage` in `package.json`. It must be `"/"`, not `".."`.

With `homepage: ".."`, CRA emits *relative* asset references. A request from `/configure`
then resolves `static/js/main.js` to `/configure/static/js/main.js`, which matches the
catch-all rewrite and returns `index.html`. The browser gets HTML where it expected
JavaScript, and the page is blank. `homepage: "/"` makes the references absolute so they
resolve from any route depth.

This is the highest-risk item in the Render setup and the symptom points nowhere near
`package.json`, so check it first.

**`/js/*` returns HTML.** Same root cause — check `homepage` first. `public/js/` vendors three
versions of the Tableau Extensions API (1.2.0, 1.3.0, 1.4.0) and `min-api-version` in the
manifest is `1.0`, so those files must stay reachable.

Note the catch-all rewrite (`/*`) matches asset paths and `/ExportAll.trex` too; what saves
them is Render serving an existing file from the publish directory ahead of applying a
rewrite. An explicit identity rewrite to exempt them is not an option — Render rejects the
Blueprint with `source cannot be the same as destination`.

So this behaviour is load-bearing and untestable locally. Check `/download` and a deep-route
asset on the first deploy, and if either ever returns HTML, the fix is to move the file to a
path the catch-all can't match rather than to add a route.

**Extension doesn't appear in Tableau at all.** Check the safe list (above), and that the
`.trex` `<url>` matches the deployed URL exactly — scheme included.

**Extension is blocked or shows an empty frame.** Framing headers. `render.yaml` sets
`X-Frame-Options: ALLOWALL` and `Access-Control-Allow-Origin: *` on `/*`; confirm they're
present on the response.

**`/download` renders XML instead of downloading.** The `Content-Type` /
`Content-Disposition` headers on `/ExportAll.trex` in `render.yaml` aren't being applied.
Check the response headers, and that the redirect landed on `/ExportAll.trex`.

## Testing

There is no automated test for this deploy, deliberately. `render.yaml` is declarative config
that only Render's build system can interpret, `homepage` and the `.trex` `<url>` are single
literal values, and this guide is prose — no branch, loop, parser, or security path to seam a
test against. The post-deploy checklist above is the test of record, run against the real
Render deployment. It's also the only place the `homepage` interaction can actually be
verified.
