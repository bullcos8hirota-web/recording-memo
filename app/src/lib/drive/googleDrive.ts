const CLIENT_ID_KEY = 'recording-app.google-client-id'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const CHANGE_EVENT = 'google-drive-settings-changed'

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void
}

interface TokenResponse {
  access_token?: string
  error?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (options: {
            client_id: string
            scope: string
            callback: (response: TokenResponse) => void
          }) => TokenClient
        }
      }
    }
  }
}

export function getStoredGoogleClientId(): string {
  return localStorage.getItem(CLIENT_ID_KEY) ?? ''
}

export function saveGoogleClientId(clientId: string) {
  const normalized = clientId.trim()
  if (normalized) {
    localStorage.setItem(CLIENT_ID_KEY, normalized)
  } else {
    localStorage.removeItem(CLIENT_ID_KEY)
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function subscribeToGoogleDriveSettingsChange(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    )
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Googleログインを読み込めませんでした')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Googleログインを読み込めませんでした'))
    document.head.appendChild(script)
  })
}

export async function requestGoogleDriveToken(clientId: string): Promise<string> {
  if (!clientId.trim()) {
    throw new Error('Google Drive連携にはGoogle OAuthクライアントIDが必要です。')
  }

  await loadGoogleIdentityScript()

  return new Promise((resolve, reject) => {
    const tokenClient = window.google?.accounts.oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(`Googleログインに失敗しました: ${response.error}`))
          return
        }
        if (!response.access_token) {
          reject(new Error('Google Driveのアクセストークンを取得できませんでした。'))
          return
        }
        resolve(response.access_token)
      },
    })
    tokenClient?.requestAccessToken({ prompt: '' })
  })
}

export async function createGoogleDoc(
  accessToken: string,
  filename: string,
  htmlContent: string,
): Promise<{ id: string; url: string }> {
  const metadata = {
    name: filename,
    mimeType: 'application/vnd.google-apps.document',
  }
  const boundary = `recording-app-${crypto.randomUUID()}`
  const body = new Blob(
    [
      `--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\n`,
      'Content-Type: text/html; charset=UTF-8\r\n\r\n',
      htmlContent,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` },
  )

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body,
    },
  )

  if (!response.ok) {
    throw new Error('Google Driveへの保存に失敗しました。')
  }

  const payload = (await response.json()) as { id: string; webViewLink: string }
  return { id: payload.id, url: payload.webViewLink }
}
