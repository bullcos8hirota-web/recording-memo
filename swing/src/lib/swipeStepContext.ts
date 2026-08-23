import { createContext, useContext, useEffect, useRef } from 'react'

export type SwipeStep = (direction: 1 | -1) => void

export const SwipeStepContext = createContext<{ set: (step: SwipeStep | null) => void } | null>(
  null,
)

/** 表示中の画面が、横フリックで動かす切り替えを登録する。 */
export function useRegisterSwipeStep(step: SwipeStep) {
  const context = useContext(SwipeStepContext)
  const latest = useRef(step)
  latest.current = step

  useEffect(() => {
    if (!context) return
    context.set((direction) => latest.current(direction))
    return () => context.set(null)
  }, [context])
}
