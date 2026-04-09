import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Inject build timestamp — used to bust localStorage cache on each new deploy
  define: {
    __BUILD_TIME__: JSON.stringify(Date.now()),
  },
  server: {
    proxy: {
      '/api/f1-popup': {
        target: 'https://fantasy.formula1.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/f1-popup/, '/feeds/popup'),
      },
      '/api/f1': {
        target: 'https://fantasy.formula1.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/f1/, '/feeds/v2/statistics'),
      },
    },
  },
})
