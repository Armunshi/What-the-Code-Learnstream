/* global __dirname */
// __dirname is a Node/CJS global; Vite shims it into config files regardless
// of the project's "type": "module", so this works at runtime. The lint
// config's browser-only globals don't know that, hence the directive above
// instead of pulling in a Node globals set for one file.
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['learnstream.onrender.com']
  },
  server:{
    port:2000
  }
})
