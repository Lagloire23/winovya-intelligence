import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/winovya-intelligence/',
  plugins: [react()],
  server: { port: 3000 },
   build: { outDir: 'dist', sourcemap: true },
  preview: {
    port: 4173,
    host: '0.0.0.0',
    allowedHosts: ['intelligence.winovya.com', 'localhost', '127.0.0.1'],
  }
})