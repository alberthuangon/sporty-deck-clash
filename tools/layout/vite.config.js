import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/* standalone build of the match screen, used only by `npm run layout` */
export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [vue()],
  build: { outDir: 'dist', emptyOutDir: true }
})
