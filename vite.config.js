import { defineConfig } from 'vite'

export default defineConfig({
  base: '/let-me-take-a-look-app/',
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  server: {
    port: 3000,
    open: true
  }
})