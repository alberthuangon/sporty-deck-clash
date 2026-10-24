import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    assetsInlineLimit: 4096,
    target: 'es2020'
  }
})
