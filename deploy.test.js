// Deployment invariants that no build step and no static file server checks.
//
// `npm run release` only proves the bundle compiles. What actually decides whether
// the deployed site works is now.json's route table - first-match-wins, ending in a
// `.*` catch-all - and the two pairs of files CLAUDE.md says must stay in sync.
// Both have broken before: SEC-2 (#3) had to add the `^/assets/` route after the
// Vite migration, because without it the JS bundle was served the HTML document.

import fs from 'fs';
import path from 'path';

const repoRoot = __dirname;
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
const nowConfig = readJson('now.json');

/**
 * Resolve a request path against now.json the way Vercel v2 does: walk the routes
 * in order, take the first whose `src` matches the whole path, and report what that
 * route does with it. Anchored, because Vercel implicitly full-matches `src`.
 */
function resolveRoute(requestPath) {
  for (const route of nowConfig.routes) {
    if (!new RegExp(`^${route.src}$`).test(requestPath)) continue;
    return {
      src: route.src,
      dest: route.dest ?? null,
      status: route.status ?? 200,
      location: route.headers?.Location ?? null,
      // No `dest` and no redirect means the matched file is served as-is.
      servesFileItself: !route.dest && !route.headers?.Location,
    };
  }
  throw new Error(`no route matched ${requestPath} - the catch-all is missing`);
}

// The failure this guards: a static asset silently receiving index.html. It is not a
// 404, so it looks fine until the browser tries to parse HTML as JS or CSS.
it.each([
  ['/assets/index-abc123.js'],
  ['/assets/index-abc123.css'],
  ['/assets/logo-abc123.svg'],
  ['/js/tableau.extensions.1.4.0.min.js'],
  ['/favicon.ico'],
  ['/manifest.json'],
])('%s is served as a file, never as the HTML document', (requestPath) => {
  const resolved = resolveRoute(requestPath);
  expect(resolved.dest).not.toBe('/index.html');
  expect(resolved.src).not.toBe('.*');
});

// The mirror image: the three views are separate page loads of the same document,
// and normalizePath picks the view from the pathname. They MUST hit the catch-all.
it.each([['/'], ['/configure'], ['/configure/'], ['/desktopexport'], ['/desktopexport/']])(
  '%s receives the root index.html so normalizePath can pick the view',
  (requestPath) => {
    expect(resolveRoute(requestPath).dest).toBe('/index.html');
  },
);

it('serves the .trex manifest itself rather than rewriting it', () => {
  const resolved = resolveRoute('/ExportAll.trex');
  expect(resolved.servesFileItself).toBe(true);
  expect(resolved.status).toBe(200);
});

it('redirects /download to the .trex manifest', () => {
  const resolved = resolveRoute('/download');
  expect(resolved.status).toBe(301);
  expect(resolved.location).toBe('/ExportAll.trex');
});

it('keeps the catch-all last, or every route after it would be dead', () => {
  const catchAllIndex = nowConfig.routes.findIndex((route) => route.src === '.*');
  expect(catchAllIndex).toBe(nowConfig.routes.length - 1);
});

// CLAUDE.md: "keep both copies in sync when editing either".
it.each([
  ['now.json', 'public/now.json'],
  ['ExportAll.trex', 'public/ExportAll.trex'],
])('%s and %s stay byte-identical', (rootCopy, publicCopy) => {
  expect(fs.readFileSync(path.join(repoRoot, publicCopy))).toEqual(
    fs.readFileSync(path.join(repoRoot, rootCopy)),
  );
});

// The regression that actually bit in SEC-2, generalised: a new output directory
// appears in build/ and nobody adds a route for it. Only meaningful once built, so
// it is skipped on a clean checkout rather than failing.
const buildDir = path.join(repoRoot, 'build');
const hasBuild = fs.existsSync(buildDir);

it.skipIf(!hasBuild)('every directory in build/ is either routed or an HTML view', () => {
  // configure/ and desktopexport/ hold copies of index.html and are *meant* to fall
  // through to the catch-all - they are views, not assets.
  const htmlViewDirs = ['configure', 'desktopexport'];
  const outputDirs = fs
    .readdirSync(buildDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const dir of outputDirs) {
    if (htmlViewDirs.includes(dir)) continue;
    const resolved = resolveRoute(`/${dir}/some-file.js`);
    expect(
      resolved.dest,
      `build/${dir}/ has no route above the catch-all in now.json, so its files are served index.html`,
    ).not.toBe('/index.html');
  }
});
