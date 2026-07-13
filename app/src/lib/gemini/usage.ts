import { getMonthlyBudgetUsd } from './settings'

const USAGE_STORAGE = 'recording-app.gemini-usage'

export interface MonthUsage {
  estimatedUsd: number
  requests: number
  promptTokenCount: number
  candidatesTokenCount: number
  updatedAt?: string
}

interface UsageMetadata {
  promptTokenCount?: number
  candidatesTokenCount?: number
}

const PRICE_TABLE_PER_MILLION: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 1.0, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.3, output: 0.4 },
}

function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function readAllUsage(): Record<string, MonthUsage> {
  try {
    const raw = localStorage.getItem(USAGE_STORAGE)
    return raw ? (JSON.parse(raw) as Record<string, MonthUsage>) : {}
  } catch {
    return {}
  }
}

function writeAllUsage(usage: Record<string, MonthUsage>) {
  localStorage.setItem(USAGE_STORAGE, JSON.stringify(usage))
}

const emptyMonth: MonthUsage = {
  estimatedUsd: 0,
  requests: 0,
  promptTokenCount: 0,
  candidatesTokenCount: 0,
}

export function estimateCostUsd(
  model: string,
  promptTokenCount: number | undefined,
  candidatesTokenCount: number | undefined,
): number {
  const prices = PRICE_TABLE_PER_MILLION[model] ?? PRICE_TABLE_PER_MILLION['gemini-2.5-flash-lite']
  const inputCost = (Number(promptTokenCount || 0) / 1_000_000) * prices.input
  const outputCost = (Number(candidatesTokenCount || 0) / 1_000_000) * prices.output
  return Number((inputCost + outputCost).toFixed(6))
}

export function getCurrentMonthUsage(): MonthUsage {
  return readAllUsage()[monthKey()] ?? emptyMonth
}

export function getBudgetStatus(): { usage: MonthUsage; limitUsd: number; overBudget: boolean } {
  const usage = getCurrentMonthUsage()
  const limitUsd = getMonthlyBudgetUsd()
  return { usage, limitUsd, overBudget: usage.estimatedUsd >= limitUsd }
}

export function assertBudgetAvailable() {
  const { overBudget, limitUsd } = getBudgetStatus()
  if (overBudget) {
    throw new Error(
      `今月のAI利用上限 $${limitUsd.toFixed(2)} に達しています。設定で上限を見直すか、来月まで待ってください。`,
    )
  }
}

export function recordUsage(model: string, usageMetadata: UsageMetadata | undefined): MonthUsage {
  const costUsd = estimateCostUsd(
    model,
    usageMetadata?.promptTokenCount,
    usageMetadata?.candidatesTokenCount,
  )
  const all = readAllUsage()
  const key = monthKey()
  const current = all[key] ?? emptyMonth
  const next: MonthUsage = {
    estimatedUsd: Number((current.estimatedUsd + costUsd).toFixed(6)),
    requests: current.requests + 1,
    promptTokenCount: current.promptTokenCount + Number(usageMetadata?.promptTokenCount || 0),
    candidatesTokenCount:
      current.candidatesTokenCount + Number(usageMetadata?.candidatesTokenCount || 0),
    updatedAt: new Date().toISOString(),
  }
  all[key] = next
  writeAllUsage(all)
  return next
}
