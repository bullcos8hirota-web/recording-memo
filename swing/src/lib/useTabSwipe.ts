import { useRef, type TouchEvent } from 'react'

/** 横に振り切ったと見なす距離(px)。短いと普通のタップで誤爆する。 */
const DISTANCE = 70
/** 縦に動いた量に対して、横がこの倍以上なら「横フリック」と見なす。 */
const RATIO = 1.8

/**
 * 画面を横にフリックしてタブを切り替える。
 * 表やチャートなど横スクロールする中身の上では効かないようにしている
 * (data-no-swipe を付けた要素の中では無視する)。
 */
export function useTabSwipe(onSwipe: (direction: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null)

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) {
      start.current = null
      return
    }
    const target = event.target as HTMLElement | null
    if (target?.closest('[data-no-swipe], input, textarea, select')) {
      start.current = null
      return
    }
    const touch = event.touches[0]
    start.current = { x: touch.clientX, y: touch.clientY }
  }

  const onTouchEnd = (event: TouchEvent) => {
    const from = start.current
    start.current = null
    if (!from) return
    const touch = event.changedTouches[0]
    if (!touch) return
    const dx = touch.clientX - from.x
    const dy = touch.clientY - from.y
    if (Math.abs(dx) < DISTANCE || Math.abs(dx) < Math.abs(dy) * RATIO) return
    onSwipe(dx < 0 ? 1 : -1)
  }

  return { onTouchStart, onTouchEnd }
}
