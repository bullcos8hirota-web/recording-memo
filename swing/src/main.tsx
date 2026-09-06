import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/Layout/ErrorBoundary'
import { registerPwa } from './registerPwa'
import { applyTheme, readTheme } from './lib/theme'

// 最初の描画前に当てる。あとから当てると一瞬ちらつく。
applyTheme(readTheme())

// 保存領域が使えない端末ではDexieが内部でPromiseを拒否する。画面側で案内している
// ので、この種のエラーだけは握りつぶしてコンソールを汚さないようにする。
const STORAGE_ERRORS = ['DatabaseClosedError', 'MissingAPIError', 'InvalidStateError']
window.addEventListener('unhandledrejection', (event) => {
  const name = (event.reason as { name?: string } | undefined)?.name
  if (name && STORAGE_ERRORS.includes(name)) event.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

registerPwa()
