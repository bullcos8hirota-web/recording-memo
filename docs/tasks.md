# タスクリスト — 高精度録音・自動要約アプリ（MVP）

[requirements.md](./requirements.md) / [design.md](./design.md) を前提とする。
フェーズ順に上から着手する想定。各タスクは概ね数時間〜1日程度の粒度。

## Phase 0: プロジェクト基盤
- [x] Vite + React + TypeScript プロジェクト作成
- [x] Tailwind CSS セットアップ
- [x] ESLint / Prettier 設定（oxlint + prettier）
- [x] ディレクトリ構成作成（[design.md](./design.md) §3 に準拠）
- [x] Dexie.js 導入、スキーマ定義（Recording / Transcript / Summary）
- [x] Zustand ストア雛形（recordingStore / transcriptStore / summaryStore）

## Phase 1: 録音機能
- [x] マイク権限リクエスト＋エラーハンドリングUI
- [x] `MediaRecorder` による録音開始/一時停止/再開/停止
- [x] 録音中の経過時間表示
- [x] 簡易波形表示（Web Audio API の AnalyserNode）
- [x] 録音終了時に Blob を Dexie へ保存
- [x] 録音一覧（HistoryList）に新規録音を表示

## Phase 2: 文字起こしエンジン統合
- [x] transformers.js 導入、WebGPU/WASM 動作確認（環境判定ロジック）— `device: 'auto'` でWebGPU失敗時にWASMへ自動フォールバックすることを確認
- [x] Whisper モデル（`onnx-community/whisper-small`、多言語）を暫定選定 — ⚠️ base/smallの実音声WER比較PoCは未実施。実運用で精度不足なら `lib/asr/config.ts` のモデルIDを差し替えて再評価する
- [x] `asr.worker.ts` 実装（Blob受信 → デコード → 推論 → セグメント返却）
- [x] モデルダウンロード進捗UI（`ModelLoadingIndicator`）
- [ ] Cache API によるモデルキャッシュ確認 — ⚠️ 検証中に `Unable to add response to browser cache` という警告が毎回発生しキャッシュ書き込みに失敗していた。ヘッドレスChromium固有の問題か実ブラウザでも起きるか要確認（次回、通常のChrome/Edgeで2回目の読み込みが速くなるか実機確認が必要）
- [x] 文字起こし結果を `Transcript` として保存
- [x] `TranscriptView`: セグメント表示、テキスト編集機能
- [x] 長時間録音時のチャンク分割処理（30秒超のみ `chunk_length_s`/`stride_length_s` を適用、ライブラリ組み込み機能を利用）

## Phase 3: 要約エンジン統合
- [ ] 軽量Instruct LLM候補を2〜3種選定、日本語構造化要約でPoC → モデル確定
- [ ] `summarize.worker.ts` 実装（全文受信 → プロンプト構築 → 推論 → パース）
- [ ] 出力フォーマット設計（概要／要点／決定事項／アクションアイテムのJSON等）
- [ ] パース失敗時のフォールバック処理（生テキスト表示）
- [ ] `SummaryView`: 表示・編集・再実行ボタン
- [ ] 文字起こし完了後に自動で要約をトリガーする連携処理

## Phase 4: 履歴・管理UI
- [ ] `HistoryList`: 一覧表示（タイトル・日時・長さ・要約プレビュー）
- [ ] タイトル編集
- [ ] タグ付け・タグフィルタ
- [ ] 全文検索（タイトル＋文字起こし本文）
- [ ] 個別削除／複数選択削除（確認ダイアログ付き）
- [ ] Markdown/テキストエクスポート機能
- [ ] 音声ファイルダウンロード機能

## Phase 5: 再生・同期表示
- [ ] `Player`: 再生/一時停止/シーク/速度変更
- [ ] 再生位置と文字起こしセグメントのハイライト同期
- [ ] セグメントクリックでのシークジャンプ

## Phase 6: 精度検証・パフォーマンスチューニング
- [ ] 実際の会議録音サンプル（自分の声等）でE2E精度確認
- [ ] WebGPU非対応環境（WASMフォールバック）での動作確認
- [ ] ストレージ容量監視・警告UI（`navigator.storage.estimate()`）
- [ ] Networkタブで音声/テキストの外部送信が無いことを確認（要件5.1の検証）
- [ ] 1時間超の長時間録音での動作確認

## Phase 7: 仕上げ（MVPリリース）
- [ ] エラーメッセージ・空状態（録音ゼロ件時）のUI整備
- [ ] 基本的なレスポンシブ対応（PCブラウザ幅想定、最低限）
- [ ] README作成（セットアップ手順・技術構成）
- [ ] MVP Done基準（[requirements.md](./requirements.md) §7）の最終チェック

## Phase 8以降（MVP後・任意）
- [ ] 話者分離
- [ ] 要約⇄文字起こし対応箇所ジャンプ
- [ ] PWA化・オフライン完全対応
- [ ] クラウドAPIオプトイン機能（高精度モード）
- [ ] 多言語対応
