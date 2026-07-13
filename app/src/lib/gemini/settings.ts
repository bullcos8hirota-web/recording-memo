const API_KEY_STORAGE = 'recording-app.gemini-api-key'
const MODEL_STORAGE = 'recording-app.gemini-model'
const BUDGET_STORAGE = 'recording-app.gemini-monthly-budget-usd'
const CHANGE_EVENT = 'gemini-settings-changed'

export const AVAILABLE_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'] as const
export type GeminiModel = (typeof AVAILABLE_MODELS)[number]

export const DEFAULT_MODEL: GeminiModel = 'gemini-2.5-flash-lite'
export const DEFAULT_MONTHLY_BUDGET_USD = 2

export function getGeminiApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE)?.trim() ?? ''
}

export function saveGeminiApiKey(apiKey: string) {
  const normalized = apiKey.trim()
  if (normalized) {
    localStorage.setItem(API_KEY_STORAGE, normalized)
  } else {
    localStorage.removeItem(API_KEY_STORAGE)
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function getGeminiModel(): GeminiModel {
  const saved = localStorage.getItem(MODEL_STORAGE)
  return (AVAILABLE_MODELS as readonly string[]).includes(saved ?? '')
    ? (saved as GeminiModel)
    : DEFAULT_MODEL
}

export function saveGeminiModel(model: GeminiModel) {
  localStorage.setItem(MODEL_STORAGE, model)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function getMonthlyBudgetUsd(): number {
  const saved = Number(localStorage.getItem(BUDGET_STORAGE))
  return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_MONTHLY_BUDGET_USD
}

export function saveMonthlyBudgetUsd(value: number) {
  if (Number.isFinite(value) && value > 0) {
    localStorage.setItem(BUDGET_STORAGE, String(value))
  } else {
    localStorage.removeItem(BUDGET_STORAGE)
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function subscribeToGeminiSettingsChange(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}
