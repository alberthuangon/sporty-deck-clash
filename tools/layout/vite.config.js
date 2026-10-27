import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

/* standalone two-page build used only by `npm run layout`:
     index.html   — the match screen, driven frame by frame
     screens.html — the whole app, walked state by state */
export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [vue()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    /* unminified: this bundle is only ever read by the harness, and a stack
       trace that names the function is worth more here than bytes */
    minify: false,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        screens: resolve(__dirname, 'screens.html')
      }
    }
  }
})
