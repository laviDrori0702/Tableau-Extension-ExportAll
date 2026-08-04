import { normalizePath } from './Main';

// TODO(SEC-2/#3): add a render test asserting each path mounts its own view -
// needs a `tableau` global mock for Extension's initializeAsync, and the build
// toolchain fixed first.
//
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
