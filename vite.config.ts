import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/iembot-json': {
        target: 'https://weather.im',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
