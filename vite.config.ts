import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // GitHub Pages has no server, so that build talks to Appwrite from the browser.
  const browserBackend = process.env.VITE_BROWSER_DATA === 'true';

  return {
    // Project pages are served from /<repo>/, so the base is configurable.
    base: process.env.VITE_BASE || '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
        // Only the selected backend is bundled into the build.
        '@backend': path.resolve(
          import.meta.dirname,
          browserBackend ? 'src/services/browserApi.ts' : 'src/services/serverApi.ts'
        ),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
