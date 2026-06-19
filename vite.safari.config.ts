import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { copyFileSync, cpSync, mkdirSync } from 'node:fs'

// Builds the Safari content script as a single self-contained IIFE bundle
// (content.js), plus copies the Safari manifest, the vanilla inject.js, and
// the shared icons into dist-safari/.
function copySafariAssets() {
  return {
    name: 'copy-safari-assets',
    closeBundle() {
      const out = 'dist-safari'
      mkdirSync(out, { recursive: true })
      copyFileSync('manifest.safari.json', `${out}/manifest.json`)
      copyFileSync('safari/inject.js', `${out}/inject.js`)
      cpSync('public/icons', `${out}/icons`, { recursive: true })
    },
  }
}

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  resolve: {
    alias: {
      // Swap the data source to the injected (content-script) implementation.
      '@source': fileURLToPath(new URL('./src/data/injectedSource.ts', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist-safari',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/safari/content.tsx', import.meta.url)),
      formats: ['iife'],
      name: 'FourOhFourAM',
      fileName: () => 'content.js',
    },
  },
  plugins: [react(), copySafariAssets()],
})
