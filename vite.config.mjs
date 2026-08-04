// .mjs, not .js: package.json has no "type": "module", so Vite's native config
// loader warns that ESM syntax here is being loaded as CommonJS - and that
// becomes the default in a future major. .mjs is explicit and warning-free.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'build' },   // keep CRA's output path: release script & CI zip expect build/
  // Main.test.js uses bare `it`/`expect` the way CRA's Jest provided them. jsdom
  // matches CRA's default env too: importing Main pulls in @tableau/tableau-ui,
  // a browser bundle that touches `self` at module scope.
  test: { globals: true, environment: 'jsdom' },
});
