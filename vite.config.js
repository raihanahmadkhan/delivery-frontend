import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
const apiTarget = process.env.ROUTELAB_API_TARGET || 'http://127.0.0.1:8000'
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/docs': apiTarget,
      '/openapi.json': apiTarget,
      '/health': apiTarget,
      '/ready': apiTarget,
    },
  },
})
