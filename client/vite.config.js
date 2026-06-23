import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/sirui-ai/',
  plugins: [react()],
  server: {
    host: 'sirui-ai',
    port: 5173
  }
})
