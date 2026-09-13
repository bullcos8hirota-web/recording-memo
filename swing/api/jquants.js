/**
 * J-Quants への中継。
 *
 * ブラウザから api.jquants.com を直接叩けるとは限らない(CORSは相手の設定次第)ので、
 * 同じオリジンから呼べる入口を1つ置く。APIキーは受け取ったリクエストのヘッダを
 * そのまま渡すだけで、ここには保存しない。転送先は株価の1エンドポイントに固定する。
 */
const BASE = 'https://api.jquants.com'
/** 通してよいAPIはこれだけ。中継を万能の踏み台にしない。 */
const ALLOWED_PATHS = new Set([
  '/v2/equities/bars/daily',
  '/v2/equities/master',
  '/v2/fins/earnings-date',
])
const DEFAULT_PATH = '/v2/equities/bars/daily'
const ALLOWED_PARAMS = new Set(['code', 'date', 'from', 'to', 'pagination_key'])

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')

  if (request.method !== 'GET') {
    response.status(405).json({ message: 'GET only' })
    return
  }

  const apiKey = request.headers['x-api-key']
  if (typeof apiKey !== 'string' || apiKey === '') {
    response.status(401).json({ message: 'x-api-key header is required' })
    return
  }

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (!ALLOWED_PARAMS.has(key)) continue
    params.set(key, Array.isArray(value) ? value[0] : String(value))
  }

  const requested = request.query?.path
  const path = typeof requested === 'string' ? requested : DEFAULT_PATH
  if (!ALLOWED_PATHS.has(path)) {
    response.status(400).json({ message: 'unsupported path' })
    return
  }

  try {
    const upstream = await fetch(`${BASE}${path}?${params.toString()}`, {
      headers: { 'x-api-key': apiKey },
    })
    const body = await upstream.text()
    response.status(upstream.status)
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.send(body)
  } catch {
    response.status(502).json({ message: 'J-Quantsに接続できませんでした。' })
  }
}
