import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
const here = fileURLToPath(new URL('.', import.meta.url))
export default defineConfig({
  root: here, plugins: [vue()],
  build: { outDir: here + 'dist', emptyOutDir: true }
})
