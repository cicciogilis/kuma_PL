import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // xlsx è importato dinamicamente in scheduleParser: forziamo il pre-bundle
  // così l'hash resta stabile e non si verificano errori tipo
  // "Failed to fetch dynamically imported module ... xlsx.js?v=...".
  optimizeDeps: {
    include: ['xlsx'],
  },
  server: {
    host: true,
  },
})
