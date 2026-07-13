# 設計書 — スマホでサクッと使えるAI録音メモアプリ

[requirements.md](./requirements.md) を前提とする。

## 1. 全体アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                  ブラウザ (単一SPA / PWA)                   │
│                                                           │
│  ┌───────────┐   ┌────────────┐   ┌──────────────────┐  │
│  │ UI Layer  │   │  Stores    │   │  Storage Layer     │  │
│  │ (React)   │◄─►│ (Zustand)  │◄─►│ (IndexedDB/Dexie)  │  │
│  └─────┬─────┘   └─────┬──────┘   └──────────┬─────────┘  │
│        │               │                     │            │
│        ▼               ▼                     │            │
│  ┌───────────┐   ┌──────────────────────┐    │            │
│  │ Audio     │   │  lib/gemini          │    │            │
│  │ Capture   │   │  ブラウザから直接      │    │            │
│  │ (MediaRec)│   │  Gemini APIを呼ぶ      │    │            │
│  └───────────┘   │  (fetch, APIキーは    │    │            │
│                   │  localStorageに保存)  │    │            │
│                   └──────────┬───────────┘    │            │
│                              │                 ▼            │
│                              │    音声Blob / 文字起こし / 要約 │
└──────────────────────────────┼───────────────────────────┘
                               ▼
                  Google Gemini API（オプトイン時のみ・利用者自身のAPIキー）
```

**設計原則**: 自前サーバーを持たない。APIキー未設定時は音声・テキストが一切外部に出ない。APIキー設定時のみ、ブラウザから直接Gemini APIへ音声を送信する（利用者自身のAPIキー・課金）。中間サーバーがない分、構成がシンプルになり、運用コストとサーバー故障点をゼロにできる。

## 2. 技術スタック

| 領域 | 選定 | 理由 |
|---|---|---|
| フレームワーク | React + TypeScript + Vite | 個人開発でのスピード、型安全性 |
| スタイリング | Tailwind CSS | 高速にUI構築 |
| 状態管理 | Zustand | Reduxより軽量 |
| ローカルDB | IndexedDB + Dexie.js | 大容量Blob保存に対応、クエリが書きやすい |
| AI（文字起こし・要約） | Gemini API（`gemini-2.5-flash-lite` 既定、`gemini-2.5-flash` 選択可）をブラウザから直接 `fetch` で呼び出し | サーバー不要・音声を1回のAPI呼び出しで文字起こし+要約まで生成できる |
| ライブ文字起こし（AI未設定時の補助） | Web Speech API（ブラウザ標準） | ダウンロード不要・軽量。Gemini未設定時の簡易表示に使う |
| 音声処理 | Web Audio API / MediaRecorder API | ブラウザ標準機能 |
| PWA化 | 手書きService Worker + manifest | オフライン起動、ホーム画面追加 |
| 共有・保存 | Web Share API（`navigator.share`） | Google Driveなど任意のアプリへスマホの共有シート経由で保存。OAuth連携は持たない |

## 3. コンポーネント構成（UI）

```
src/
  components/
    Recorder/            録音操作パネル（開始/停止/波形/タイマー）
    AiSettings/           Gemini APIキー・モデル・月次予算の設定
    HistoryList/          録音一覧・検索
      RecordingItem       1件ごとの操作（詳しく見る/共有・保存/削除）
    SummaryView/          要約表示・編集・作り直す
    TranscriptView/       文字起こし表示・編集
  lib/
    audio/                録音ユーティリティ
    db/                   Dexie スキーマ・CRUD
    export/               Markdown/テキストエクスポート
    speech/               ライブ文字起こし（Web Speech API）
    summarize/fallback.ts AI未設定時の簡易要約（キーワードベース）
    gemini/
      settings.ts          APIキー・モデル・月次予算の保存（localStorage）
      usage.ts              月次利用量・概算コストの記録、上限チェック
      client.ts             Gemini API直接呼び出し（音声→文字起こし+要約のJSON）
      runGeminiPipeline.ts  録音1件に対する一連の処理（DB更新含む）
  stores/
    recordingStore.ts
    transcriptStore.ts
    summaryStore.ts
  App.tsx
```

## 4. データモデル（Dexie / IndexedDB）

```ts
// recordings テーブル
interface Recording {
  id: string
  title: string
  createdAt: number
  durationMs: number
  audioBlob: Blob
  tags: string[]
  status: 'recorded' | 'transcribing' | 'summarizing' | 'done' | 'error'
  errorMessage?: string
  processedAt?: number
}

// transcripts テーブル（recordingId で1対1）
interface Transcript {
  recordingId: string
  segments: TranscriptSegment[]
  fullText: string
  editedAt?: number
}

interface TranscriptSegment {
  start: number
  end: number
  text: string
  speaker?: string
}

// summaries テーブル（recordingId で1対1）
interface Summary {
  recordingId: string
  overview: string
  keyPoints: string[]
  decisions: string[]
  actionItems: string[]
  editedAt?: number
}
```

## 5. 処理フロー

### 5.1 録音〜保存
1. `Recorder` が `MediaRecorder` でマイク入力をキャプチャ
2. 停止時に Blob 化し、`Recording` レコードとして Dexie に保存
3. 一覧に即座に反映。Gemini APIキー設定済みなら、バックグラウンドで `runGeminiPipeline` を起動

### 5.2 AI議事録化（Gemini APIキー設定時）
1. `lib/gemini/client.ts` が音声Blobをbase64化し、`generateContent` エンドポイントへ1回のリクエストで送信（プロンプト＋音声のinlineData、`responseSchema` でJSON構造を指定）
2. レスポンスの `usageMetadata` から概算コストを算出し、`lib/gemini/usage.ts` に月次集計として記録
3. 結果（title/tags/transcript/summary）を `Transcript` `Summary` としてDexieに保存、`Recording.status` を `done` に更新
4. 失敗時は `status: 'error'` とエラーメッセージを保存し、UIから「作り直す」で再実行できる

### 5.3 コスト上限
- `runGeminiPipeline` 実行前に `assertBudgetAvailable()` を呼び、今月の概算コストが自己申告の上限を超えていればAPI呼び出し自体を行わずエラーにする
- 上限・モデル・APIキーは `AiSettings` コンポーネントから設定する

### 5.4 AI未設定時のフォールバック
- `useLiveSpeechRecognition`（Web Speech API）でライブ文字起こしを試み、`buildFallbackSummary` で簡易な要点抽出を行う
- いつでも `AiSettings` でAPIキーを入れれば、次回録音から本格的なAI議事録に切り替わる

## 6. エラー・エッジケース対応方針
| ケース | 対応 |
|---|---|
| Gemini APIキー未設定 | 端末内簡易整理にフォールバック。「詳しく見る」操作時などにキー未設定である旨を案内 |
| 音声が18MBを超える | 事前にサイズチェックしてエラー表示（長時間録音は将来チャンク分割を検討） |
| 月次予算超過 | API呼び出し前にブロックし、上限に達した旨を表示。設定で上限変更可能 |
| Gemini APIエラー・JSONパース失敗 | `status: 'error'` にしてエラーメッセージを表示、「作り直す」で再実行 |
| マイク権限拒否 | 録音開始前に権限エラーをわかりやすく表示 |
| Web Speech API非対応ブラウザ | ライブ文字起こし欄を非表示・エラー表示のみ |

## 7. 今回見送った構成（検討はしたが不採用）
- **自前Node.jsサーバー経由でGemini APIキーを隠す構成**: セキュリティ上はAPIキーをサーバー側に隠せる利点があったが、個人の軽い利用ではCloud Run等の常時デプロイ・課金アカウント登録の管理負担がメリットを上回ると判断し、ブラウザから直接Gemini APIを呼ぶ構成に変更した。共有端末で使う場合は、Google Cloud Console側でAPIキーの利用範囲・レート制限をかけることを推奨する
- **Google Drive自動アップロード（OAuth連携）**: 設定の手間に対して個人利用でのメリットが小さいため、スマホの共有シート（`navigator.share`）経由での手動保存に統一した
- **オンデバイスWhisper/軽量LLM（transformers.js）**: モデルダウンロードが数百MB〜と重く、スマホでの「サクッと使える」体験と相性が悪いため撤去し、Gemini API一本化とした

## 8. 将来拡張（スコープ外だが余地を残す）
- 話者分離の精度向上
- 長時間録音のチャンク分割対応
- 要約⇄文字起こしの対応箇所ジャンプ
- 複数端末間の同期（現状は端末ローカル完結）
