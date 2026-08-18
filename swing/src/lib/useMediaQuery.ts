import { useEffect, useState } from 'react'

/** 画面幅に応じて表示を変えるためのフック。SSRは想定していない。 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])

  return matches
}

/** Tailwind の sm ブレークポイントに合わせる。 */
export const useIsPhone = (): boolean => !useMediaQuery('(min-width: 640px)')
