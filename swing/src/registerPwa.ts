export function registerPwa() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    const basePath = import.meta.env.BASE_URL
    navigator.serviceWorker.register(`${basePath}sw.js`, { scope: basePath }).catch((error: unknown) => {
      console.warn('Service worker registration failed', error)
    })
  })
}
