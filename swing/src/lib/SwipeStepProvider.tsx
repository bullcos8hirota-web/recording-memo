import { useRef, type ReactNode } from 'react'
import { useSwipeStep } from './useSwipeStep'
import { SwipeStepContext, type SwipeStep } from './swipeStepContext'

/**
 * 画面のどこを触っても横フリックが効くように、判定は一番外側で受ける。
 * 「隣に何があるか」は画面ごとに違うので、中身の画面が処理を登録する形にしている。
 */
export function SwipeStepProvider({ children }: { children: ReactNode }) {
  const step = useRef<SwipeStep | null>(null)
  const set = useRef((next: SwipeStep | null) => {
    step.current = next
  }).current

  const swipe = useSwipeStep((direction) => step.current?.(direction))

  return (
    <SwipeStepContext.Provider value={{ set }}>
      <div onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
        {children}
      </div>
    </SwipeStepContext.Provider>
  )
}
