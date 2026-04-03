import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // In prod the app is served at /weather/ — set via VITE_BASE env var during build.
  // Local dev omits the base so assets load from root (localhost:3002).
  base: process.env.VITE_BASE ?? '/',
  server: {
    port: 3002,
  },
})
