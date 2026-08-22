/**
 * ビルド時刻。端末に古い画面が残っていないかを確かめるために使う。
 * (ビルドしていないテスト環境では 'dev')
 */
declare const __BUILD_ID__: string

export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'
