import { DEFAULT_SETTINGS, type PriceSeries, type Settings, type Stock } from './schema'
import type { Trade } from '../money/trade'

/**
 * 端末の中身をまるごと1ファイルにする。
 *
 * このアプリのデータは、この端末のこのブラウザの中にしかない。機種変更やサイトデータの
 * 削除で消えるので、持ち出せる形を1つ用意しておく。
 */
export const BACKUP_FORMAT = 'swing-trade-backup'
export const BACKUP_VERSION = 1

export type Backup = {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  settings: Settings
  stocks: Stock[]
  series: PriceSeries[]
  trades: Trade[]
}

export function buildBackup(input: {
  settings: Settings
  stocks: Stock[]
  series: PriceSeries[]
  trades: Trade[]
  /** APIキーを含めるか。既定では持ち出さない。 */
  includeApiKey?: boolean
  now?: Date
}): Backup {
  const { jquantsApiKey, ...settingsWithoutKey } = input.settings
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: (input.now ?? new Date()).toISOString(),
    settings: input.includeApiKey ? { ...settingsWithoutKey, jquantsApiKey } : settingsWithoutKey,
    stocks: input.stocks,
    series: input.series,
    trades: input.trades,
  }
}

export class BackupError extends Error {}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asArray = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) throw new BackupError(`${label}が読めません。`)
  return value
}

/**
 * 読み込む前に形を確かめる。壊れたファイルで既存のデータを潰さないため、
 * 少しでも怪しければ何もせずに投げる。
 */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('ファイルの中身がJSONではありません。')
  }
  if (!isObject(raw)) throw new BackupError('ファイルの中身が読めません。')
  if (raw.format !== BACKUP_FORMAT) {
    throw new BackupError('このアプリの書き出したファイルではないようです。')
  }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    throw new BackupError('新しい版で書き出されたファイルです。アプリを更新してください。')
  }
  if (!isObject(raw.settings)) throw new BackupError('設定が読めません。')

  const stocks = asArray(raw.stocks, '銘柄') as Stock[]
  const series = asArray(raw.series, '株価') as PriceSeries[]
  const trades = asArray(raw.trades, '売買記録') as Trade[]
  if (stocks.some((stock) => typeof stock?.code !== 'string')) {
    throw new BackupError('銘柄の形が違います。')
  }
  if (series.some((item) => typeof item?.code !== 'string' || !Array.isArray(item?.bars))) {
    throw new BackupError('株価の形が違います。')
  }
  if (trades.some((trade) => typeof trade?.id !== 'string')) {
    throw new BackupError('売買記録の形が違います。')
  }

  return {
    format: BACKUP_FORMAT,
    version: raw.version,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    // 足りない項目は既定値で埋める。古いファイルでも開けるように。
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings as Partial<Settings>), id: 'app' },
    stocks,
    series,
    trades,
  }
}

/** ファイル名。日付を入れておくと、何回か書き出したときに見分けられる。 */
export function backupFileName(now = new Date()): string {
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
  return `swing-trade-${stamp}.json`
}

/** 読み込む前に「何が入っているか」を見せるための要約。 */
export function describeBackup(backup: Backup): string {
  const bars = backup.series.reduce((total, item) => total + item.bars.length, 0)
  const date = backup.exportedAt ? backup.exportedAt.slice(0, 10) : '不明'
  const key = backup.settings.jquantsApiKey ? ' / APIキーあり' : ''
  return `${date}に書き出したもの: 銘柄${backup.stocks.length}件 / 株価${bars}本 / 売買記録${backup.trades.length}件${key}`
}
