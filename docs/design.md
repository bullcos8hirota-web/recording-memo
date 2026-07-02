# 設計書 — 高精度録音・自動要約アプリ

[requirements.md](./requirements.md) を前提とする。

## 1. 全体アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                     ブラウザ (単一SPA)                     │
│                                                           │
│  ┌───────────┐   ┌────────────┐   ┌──────────────────┐  │
│  │ UI Layer  │   │  Stores    │   │  Storage Layer     │  │
│  │ (React)   │◄─►│ (Zustand)  │◄─►│ (IndexedDB/Dexie)  │  │
│  └─────┬─────┘   └─────┬──────┘   └──────────┬─────────┘  │
│        │               │                     │            │
│        ▼               ▼                     │            │
│  ┌───────────┐   ┌──────────────────────┐    │            │
│  │ Audio     │   │  Web Workers          │    │            │
│  │ Capture   │   │  - ASR Worker         │    │            │
│  │ (MediaRec)│   │    (transformers.js   │    │            │
│  └───────────┘   │     + Whisper)        │    │            │
│                   │  - Summarize Worker    │    │            │
│                   │    (transformers.js   │    │            │
│                   │     + 小型LLM)         │    │            │
│                   └──────────────────────┘    │            │
│                                                 ▼            │
│                                    音声Blob / 文字起こし / 要約 │
└─────────────────────────────────────────────────────────┘
         ネットワーク送信なし（モデルの初回ダウンロードのみ外部CDN/HFへアクセス）
```

**設計原則**: 音声・テキストデータは常にブラウザ内（メモリ／IndexedDB）に留まる。外部通信はモデルファイルの取得（初回のみ、キャッシュ後は不要）に限定する。

## 2. 技術スタック

| 領域 | 選定 | 理由 |
|---|---|---|
| フレームワーク | React + TypeScript + Vite | 個人開発でのスピード、型安全性 |
| スタイリング | Tailwind CSS | 高速にUI構築 |
| 状態管理 | Zustand | Reduxより軽量、Worker連携がシンプル |
| ローカルDB | IndexedDB + Dexie.js | 大容量Blob保存に対応、クエリが書きやすい |
| ASR | [transformers.js](https://github.com/huggingface/transformers.js)（Xenova/Whisper, whisper-base or small, 量子化版） | ブラウザ内WebGPU/WASM推論の実績が最も豊富 |
| 要約LLM | transformers.js + 軽量Instructモデル（例: Qwen2.5-1.5B-Instruct 量子化版、日本語対応を精度検証の上で選定） | オンデバイスで動く現実的なサイズ |
| 音声処理 | Web Audio API / MediaRecorder API | ブラウザ標準機能 |
| PWA化 | vite-plugin-pwa（Phase後半） | オフライン起動・モデルキャッシュ |

## 3. コンポーネント構成（UI）

```
src/
  components/
    Recorder/           録音操作パネル（開始/停止/波形/タイマー）
    Player/              音声プレイヤー（シーク/速度変更）
    TranscriptView/      文字起こし表示・編集・ハイライト同期
    SummaryView/         要約表示・編集
    HistoryList/         録音一覧・検索・タグ
    ModelLoadingIndicator/ モデルDL進捗表示
  workers/
    asr.worker.ts        文字起こし処理（transformers.js + Whisper）
    summarize.worker.ts  要約処理（transformers.js + LLM）
  lib/
    audio/               録音・波形生成ユーティリティ
    db/                  Dexie スキーマ・CRUD
    export/               Markdown/テキストエクスポート
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
  id: string;              // UUID
  title: string;
  createdAt: number;       // epoch ms
  durationMs: number;
  audioBlob: Blob;         // 音声本体
  tags: string[];
  status: 'recording' | 'recorded' | 'transcribing' | 'transcribed' | 'summarizing' | 'done' | 'error';
}

// transcripts テーブル（recordingId で1対1）
interface Transcript {
  recordingId: string;
  segments: TranscriptSegment[];
  fullText: string;         // 全文検索用に結合済みテキストを保持
  editedAt?: number;
}

interface TranscriptSegment {
  start: number;   // 秒
  end: number;     // 秒
  text: string;
  speaker?: string; // Phase 2以降
}

// summaries テーブル（recordingId で1対1）
interface Summary {
  recordingId: string;
  overview: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: string[];
  editedAt?: number;
}
```

## 5. 処理フロー

### 5.1 録音〜保存
1. `Recorder` が `MediaRecorder` でマイク入力をキャプチャ（`audio/webm;codecs=opus`）
2. 停止時に Blob 化し、`Recording` レコードとして Dexie に保存（status: `recorded`）
3. 一覧に即座に反映（文字起こしはバックグラウンドで開始）

### 5.2 文字起こし
1. `Recording.audioBlob` を `asr.worker.ts` に転送（Transferable/構造化複製）
2. Worker 内で Blob → PCM デコード → Whisper モデル（初回はモデルDL＋Cache API保存）で推論
3. セグメント単位の結果を逐次 `transcriptStore` に反映し、UIへストリーミング的に表示
4. 完了後 `Transcript` を保存、`Recording.status` を `transcribed` に更新

### 5.3 要約
1. 文字起こし完了をトリガに `summarize.worker.ts` へ全文を渡す
2. プロンプトテンプレートで「概要／要点／決定事項／アクションアイテム」の構造化出力を指示
3. LLM出力をパースして `Summary` として保存
4. 失敗・低品質時は再実行ボタンをUIに用意（MVPでは自動リトライはしない）

### 5.4 再生・同期
- `Player` の `timeupdate` イベントで現在秒数を `transcriptStore` に渡し、該当セグメントをハイライト
- セグメントクリックで `audio.currentTime` をシーク

## 6. Web Worker 設計の理由
- Whisper / LLM の推論は数百ms〜数秒単位でメインスレッドをブロックしうるため、UIの応答性を保つために両方とも Worker 内で実行する
- モデルロード状態・推論進捗は `postMessage` でストア経由でUIに反映する
- 将来 WebGPU が使えない環境向けに WASM フォールバックを Worker 内で自動判定する

## 7. モデル選定方針（Phase 1で検証）
- ASR: `whisper-base` または `whisper-small` の量子化版から、日本語会議音声でのWER（誤り率）とレイテンシを比較して選定
- 要約LLM: 日本語Instructionに対応する軽量モデル（1.5B〜3B級）を2〜3種試し、構造化要約の再現性・崩れにくさで選定
- 両モデルとも `transformers.js` の `AutoModel` / `pipeline` API 経由でロードし、モデル差し替えを容易にする（設定ファイルでモデルIDを外出し）

## 8. エラー・エッジケース対応方針
| ケース | 対応 |
|---|---|
| WebGPU非対応ブラウザ | WASM推論にフォールバック、速度低下を通知 |
| マイク権限拒否 | 録音開始前に権限エラーをわかりやすく表示 |
| モデルDL失敗（オフライン等） | リトライ導線、エラーメッセージ表示 |
| ストレージ容量逼迫 | `navigator.storage.estimate()` で使用量監視、警告表示 |
| 長時間録音（1時間超） | チャンク分割してASR処理し、メモリ使用量を抑える（Phase 1後半で検証） |
| 要約生成の出力崩れ（JSON等パース失敗） | フォールバックで生テキストをそのまま概要欄に表示し、手動編集を促す |

## 9. 将来拡張（Phase 2以降・スコープ外だが設計に含み込む余地を残す）
- 話者分離（speaker diarization）
- 要約⇄文字起こしの対応箇所ジャンプ
- 多言語対応
- クラウドAPIとのハイブリッド利用（オプトイン、より高精度が必要な場合）
- PWA化・オフライン起動の完全対応
- モバイルブラウザ対応
