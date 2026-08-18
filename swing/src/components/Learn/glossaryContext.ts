import { createContext, useContext } from 'react'

export type GlossaryContextValue = {
  /** 用語IDを渡すと解説シートを開く。 */
  openTerm: (id: string) => void
}

export const GlossaryContext = createContext<GlossaryContextValue>({ openTerm: () => {} })

export const useGlossary = (): GlossaryContextValue => useContext(GlossaryContext)
