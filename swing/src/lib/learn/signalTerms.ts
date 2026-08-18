/** シグナルの種類と、対応する用語集の項目の対応表。 */
export const SIGNAL_TERMS: Record<string, string> = {
  'trend-up': 'trend',
  'trend-down': 'trend',
  'ma25-rising': 'moving-average',
  'ma25-falling': 'moving-average',
  'golden-cross': 'golden-cross',
  'dead-cross': 'golden-cross',
  pullback: 'pullback',
  breakout: 'breakout',
  breakdown: 'high-low',
  'macd-cross': 'macd',
  'rsi-oversold': 'rsi',
  'rsi-overbought': 'rsi',
  overheat: 'deviation',
  'low-volume': 'volume',
  'low-volatility': 'volatility',
}
