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

export * from './schema'
