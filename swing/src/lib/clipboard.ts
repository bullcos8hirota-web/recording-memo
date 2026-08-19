/**
 * クリップボードから文字列を読む。スマホでは入力欄を長押しして「貼り付け」を
 * 選ぶ操作が煩わしいので、ボタン1つで済ませるために使う。
 * 許可されない環境もあるため、失敗したときは理由を返して手動貼り付けを案内する。
 */
export async function readClipboard(): Promise<
  { ok: true; text: string } | { ok: false; reason: string }
> {
  if (!navigator.clipboard?.readText) {
    return {
      ok: false,
      reason: 'このブラウザでは読み取れません。入力欄を長押しして「貼り付け」を選んでください。',
    }
  }
  try {
    const text = await navigator.clipboard.readText()
    if (text.trim() === '') {
      return { ok: false, reason: 'クリップボードが空です。先に表をコピーしてください。' }
    }
    return { ok: true, text }
  } catch {
    return {
      ok: false,
      reason:
        '読み取りが許可されませんでした。表示される確認で「許可」を選ぶか、入力欄を長押しして「貼り付け」を選んでください。',
    }
  }
}
