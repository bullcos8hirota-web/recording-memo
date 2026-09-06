/**
 * 画面の明るさ。端末の設定に合わせるのが既定だが、端末ごと変えずに
 * このアプリだけ明るく（暗く）したいことがあるので、選べるようにする。
 */
export type ThemeChoice = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'swing-theme'

export function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // プライベートモードなどで読めないことがある。既定に落とす。
  }
  return 'system'
}

/**
 * <html> に data-theme を立てる。Tailwind の dark: はこの属性を見る。
 * color-scheme も合わせて、入力欄やスクロールバーの見た目を揃える。
 */
export function applyTheme(choice: ThemeChoice): void {
  const prefersDark =
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
  const dark = choice === 'dark' || (choice === 'system' && prefersDark)
  const root = document.documentElement
  root.dataset.theme = dark ? 'dark' : 'light'
  root.style.colorScheme = dark ? 'dark' : 'light'

  // ブラウザのバーの色も合わせる。合わせないと、明るい画面の上に黒い帯が残る。
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.remove()
  }
  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  meta.content = dark ? '#0f172a' : '#ffffff'
  document.head.appendChild(meta)
}

export function storeTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // 保存できなくても、その場の表示は切り替わる。
  }
  applyTheme(choice)
}

/** 「端末に合わせる」を選んでいるあいだ、端末側の切り替えに追従する。 */
export function watchSystemTheme(getChoice: () => ThemeChoice): () => void {
  if (typeof matchMedia !== 'function') return () => {}
  const media = matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (getChoice() === 'system') applyTheme('system')
  }
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
