import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// 端末に古い画面が残っていないか確かめられるよう、ビルド時刻を埋め込む(日本時間)。
const buildId = new Date(Date.now() + 9 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 16)
  .replace('T', ' ')

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), tailwindcss()],
})
