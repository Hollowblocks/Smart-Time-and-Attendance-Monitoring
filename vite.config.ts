import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/stamp/',
  plugins: [react(), tailwindcss()],
  server: {
    hmr: {
      protocol: 'wss',
      host: 'https://devsysadd-collab.da.gov.ph/stamp'
    }
  }
})
