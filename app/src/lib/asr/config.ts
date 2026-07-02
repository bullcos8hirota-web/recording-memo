/**
 * Whisper モデルの差し替え口。design.md §7 の方針どおり、
 * PoC/実運用での精度・速度検証結果に応じてここだけ変更すればよい。
 */
export const ASR_MODEL_ID = 'onnx-community/whisper-small'
export const ASR_LANGUAGE = 'japanese'
