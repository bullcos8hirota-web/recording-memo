/**
 * 端末の保存領域。
 *
 * ブラウザは容量が足りなくなると、サイトのデータを勝手に捨てる。捨てられる順番は
 * 「最近使っていない」「ホーム画面に追加していない」ものから。実際に一度消えたので、
 * 消さないでほしいと明示的に申請しておく。
 */

export type StorageState = {
  /** ブラウザが「消さない」と約束している状態か。 */
  persisted: boolean
  /** この機能自体が使えるか(古いブラウザでは使えない)。 */
  supported: boolean
}

export async function storageState(): Promise<StorageState> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
    return { persisted: false, supported: false }
  }
  try {
    return { persisted: await navigator.storage.persisted(), supported: true }
  } catch {
    return { persisted: false, supported: false }
  }
}

/**
 * 保護を申請する。許可されるかはブラウザ次第で、ホーム画面に追加してあるかどうかが
 * 効くことが多い。断られても動作は変わらない(消えやすいままというだけ)。
 */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
