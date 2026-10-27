import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// One JS chunk + one CSS file with every asset inlined, so scripts/inline-build.mjs can fold the
// build into a single self-contained HTML file.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
