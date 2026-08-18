import Dexie, { type Table } from 'dexie'
import type { PriceSeries, Settings, Stock } from './schema'
import type { Trade } from '../money/trade'

export class SwingDatabase extends Dexie {
  stocks!: Table<Stock, string>
  series!: Table<PriceSeries, string>
  trades!: Table<Trade, string>
  settings!: Table<Settings, string>

  constructor() {
    super('swing-trade')
    this.version(1).stores({
      stocks: 'code, createdAt',
      series: 'code, updatedAt',
      trades: 'id, code, entryDate, exitDate',
      settings: 'id',
    })
  }
}

export const db = new SwingDatabase()

// IndexedDBが使えない環境では open() が失敗する。ここで受けておかないと
// 未処理のPromise拒否としてコンソールに残る(画面はストア側で救済している)。
db.open().catch((error: unknown) => {
  console.warn('保存領域を開けませんでした', error)
})

export * from './schema'
