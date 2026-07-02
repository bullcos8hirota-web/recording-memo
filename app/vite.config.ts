import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // Pre-bundle transformers.js up front so the dev server doesn't trigger a
    // mid-session dependency-optimization reload the first time the ASR
    // worker imports it (which would abort an in-flight model download).
    include: ['@huggingface/transformers'],
  },
})
