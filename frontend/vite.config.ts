import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://10.10.11.71:8080',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../public',
    emptyOutDir: true
  }
}) 