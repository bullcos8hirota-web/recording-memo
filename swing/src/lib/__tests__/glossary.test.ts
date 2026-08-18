import { describe, expect, it } from 'vitest'
import { CATEGORY_LABEL, findTerm, searchTerms, TERMS } from '../learn/glossary'
import { SIGNAL_TERMS } from '../learn/signalTerms'
import { analyze } from '../market/signals'
import { buildSampleData } from '../market/sampleData'

describe('用語集', () => {
  it('IDが重複していない', () => {
    const ids = TERMS.map((term) => term.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('どの用語にも一行説明と本文がある', () => {
    for (const term of TERMS) {
      expect(term.short.length, term.id).toBeGreaterThan(5)
      expect(term.body.length, term.id).toBeGreaterThan(0)
      expect(CATEGORY_LABEL[term.category], term.id).toBeTruthy()
    }
  })

  it('関連語のリンク先が実在する', () => {
    for (const term of TERMS) {
      for (const id of term.related ?? []) {
        expect(findTerm(id), `${term.id} -> ${id}`).toBeDefined()
      }
    }
  })

  it('検索は用語名でも説明文でも引ける', () => {
    expect(searchTerms('損切り').some((t) => t.id === 'stop-loss')).toBe(true)
    expect(searchTerms('RSI').some((t) => t.id === 'rsi')).toBe(true)
    expect(searchTerms('買われすぎ').some((t) => t.id === 'rsi')).toBe(true)
    expect(searchTerms('').length).toBe(TERMS.length)
    expect(searchTerms('存在しない用語')).toHaveLength(0)
  })
})

describe('シグナルと用語の対応', () => {
  it('対応表のリンク先が実在する', () => {
    for (const [signal, termId] of Object.entries(SIGNAL_TERMS)) {
      expect(findTerm(termId), `${signal} -> ${termId}`).toBeDefined()
    }
  })

  it('サンプルデータで出るシグナルには必ず解説がある', () => {
    for (const { bars } of buildSampleData()) {
      for (const signal of analyze(bars).signals) {
        expect(SIGNAL_TERMS[signal.id], signal.id).toBeDefined()
      }
    }
  })
})

describe('クイズ', () => {
  it('答えの番号が選択肢の範囲に収まっている', async () => {
    const { QUESTIONS } = await import('../learn/quiz')
    for (const question of QUESTIONS) {
      expect(question.choices.length, question.id).toBeGreaterThanOrEqual(3)
      expect(question.answer, question.id).toBeGreaterThanOrEqual(0)
      expect(question.answer, question.id).toBeLessThan(question.choices.length)
      expect(question.explanation.length, question.id).toBeGreaterThan(10)
    }
  })

  it('IDが重複せず、解説から用語集に飛べる', async () => {
    const { QUESTIONS } = await import('../learn/quiz')
    const ids = QUESTIONS.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const question of QUESTIONS) {
      expect(findTerm(question.term), question.id).toBeDefined()
    }
  })
})
