import { useEffect, useRef } from 'react'

/**
 * 横スクロールするチップ列で、選ばれているチップを見える位置まで送る。
 * フリックで切り替えたとき、画面外のチップが選ばれたままだと今どこにいるか分からない。
 */
export function useActiveChipScroll(activeId: string) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const chip = ref.current?.querySelector(`[data-chip="${activeId}"]`)
    chip?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeId])

  return ref
}
