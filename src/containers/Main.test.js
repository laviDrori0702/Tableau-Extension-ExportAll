import { normalizePath } from './Main';

// The pathname switch that replaced react-router is the only routing logic
// left, so this is the thing that breaks if a deploy serves a different
// shape of URL (trailing slash, or the copied index.html).
it.each([
  ['/', ''],
  ['/index.html', ''],
  ['/configure', '/configure'],
  ['/configure/', '/configure'],
  ['/configure/index.html', '/configure'],
  ['/desktopexport', '/desktopexport'],
  ['/desktopexport/', '/desktopexport'],
  ['/desktopexport/index.html', '/desktopexport'],
  // "index.html" must only be stripped as a whole path segment
  ['/myindex.html', '/myindex.html'],
])('normalizes %s to %s', (pathname, expected) => {
  expect(normalizePath(pathname)).toBe(expected);
});
