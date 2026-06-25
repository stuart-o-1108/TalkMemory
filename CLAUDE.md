# TalkMemory — CLAUDE.md

## プロジェクト概要

思い出写真 × 英語学習 × マルチモーダル AI 添削アプリ。写真を Gemini に渡してお題を生成し、ユーザーの英文を写真の文脈で添削・スコアリングする。ログイン不要（デバイス ID 方式）。ポートフォリオ用途。

---

## 技術スタック

| 分類 | 技術 |
|---|---|
| フレームワーク | React Native (Expo ~53) |
| 言語 | JavaScript（TypeScript 未使用） |
| ナビゲーション | React Navigation v7 (Native Stack) |
| AI | Gemini 1.5 Pro（マルチモーダル） |
| データベース | Supabase (PostgreSQL) |
| デバイス識別 | UUID を expo-secure-store に永続化（ログイン不要） |
| 画像取得 | expo-media-library |
| APIキー管理 | `.env` → `app.config.js` の `extra` 経由 |

---

## ディレクトリ構成

```
App.js                      # エントリポイント → AppNavigator
navigation/AppNavigator.js  # スタック定義（Home / Learning / History / Detail）
screens/
  HomeScreen.js             # ダッシュボード（Supabase から履歴サマリーを取得）
  LearningScreen.js         # 学習画面（写真→お題生成→入力→添削→保存）
  HistoryScreen.js          # 履歴一覧（Supabase から取得）
  DetailScreen.js           # 履歴詳細（score/grammarPoints/alternatives を表示）
services/
  gemini.js                 # generateTopic(imageBase64) / getEnglishFeedback(text, imageBase64)
lib/
  supabase.js               # Supabase クライアント + favorites CRUD
  deviceId.js               # getDeviceUserId() — SecureStore で UUID を永続化（新規作成予定）
```

---

## 認証設計（デバイス ID 方式）

ログイン画面なし。`lib/deviceId.js` の `getDeviceUserId()` が UUID を返す。

```js
// lib/deviceId.js のインターフェース
getDeviceUserId(): Promise<string>  // SecureStore から取得、なければ生成して保存
```

全画面の `supabase.auth.getUser()` をこれに置き換える。  
将来ログイン機能を追加する場合は `getDeviceUserId()` の戻り値を `auth user.id` に差し替えるだけ。

---

## 画面遷移

```
Home ──→ Learning（写真→お題生成→入力→添削→保存）
Home ──→ History ──→ Detail
```

---

## AI 設計（services/gemini.js）

### Gemini への画像送信方法

```js
contents: [{
  parts: [
    { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
    { text: prompt }
  ]
}]
```

### 関数インターフェース

```js
// 写真から英語学習のお題を生成する（multimodal）
generateTopic(imageBase64: string, signal: AbortSignal): Promise<string | null>

// ユーザーの英文を添削する（テキストのみ。context にお題テキストを渡すと文脈考慮）
getEnglishFeedback(text: string, signal: AbortSignal, context?: string): Promise<FeedbackResult>
```

### FeedbackResult の型

```js
{
  score: number,           // 0〜100
  feedback: string,        // 添削コメント（日本語）
  suggestion: string,      // 改善後の英文
  grammarPoints: string[], // 文法ポイントのラベル
  alternatives: string[]   // 別の言い回し候補
}
```

### スコア定義（不変条件）

| 範囲 | 基準 |
|---|---|
| 90〜100 | 修正不要・ネイティブ同等（grammarPoints は必ず空配列） |
| 75〜89 | 意味は通じるが改善余地あり |
| 60〜74 | 文法ミスがあるが意図は読み取れる |
| 0〜59 | 大幅な修正が必要 |

**コード側強制ルール（`services/gemini.js` の `getEnglishFeedback` 末尾）:**
- `grammarPoints.length === 0 && score < 90` → score を 90 に強制
- `grammarPoints.length > 0 && score >= 90` → score を 89 に強制

grammarPoints に「完璧です」等のポジティブコメントを入れない（プロンプトで禁止）。

### grammarPoints・feedback の口調ルール

- **grammarPoints**: 短く・カジュアル・話し言葉（「〜だよ」「〜しよう」）。敬語禁止。
  - 良い例: `「scenery」より「view」の方が特定の場所の眺めに適しているよ！`
  - NG: `「scenery」よりも「view」の方が、特定の場所からの眺めを表す際により一般的です。`
- **feedback**: 具体的な使い分け例を含む補足（例: `自分の家からの眺めはview、広い自然の景色はscenery`）。grammarPoints の箇条書きで書ききれない理解を深める内容のみ。

### Gemini API フォールバック方針

| ステップ | 動作 |
|---|---|
| 1 | `gemini-2.5-flash` でリクエスト |
| 2 | 429/500 → 即座に `gemini-2.5-flash-lite` へフォールバック（待ち時間なし） |
| 3 | 両方失敗 → `null` 返却 → `apiError: true` → UI でリトライボタン表示 |

### JSON フォールバック

Gemini のレスポンスが壊れた場合は以下で補完する（ユーザーにエラーは出さない）。

```js
{ score: 0, feedback: rawText, suggestion: "", grammarPoints: [], alternatives: [] }
```

パース手順: `raw.match(/\{[\s\S]*\}/)` で JSON 部分を抽出 → `JSON.parse` → 失敗時は catch でデフォルト値。

### Step 3 マルチモーダル実装方針（2026-06-24 実装済み）

| 機能 | エンドポイント | 画像送信 |
|---|---|---|
| `generateTopic(imageBase64, signal)` | `v1beta/models/{model}:generateContent` | JPEG base64（512px リサイズ済み） |
| `getEnglishFeedback(text, signal, context)` | `v1beta/interactions` | なし（お題テキストをコンテキストとして付加） |

**レスポンス時間対策:**
- 画像は `expo-image-manipulator` で 512px・60% JPEG に圧縮してからエンコード
- `getEnglishFeedback` は画像を送らず、お題テキスト（`context`）だけを付加して速度を維持
- お題生成はバックグラウンドで並行実行（Step1 表示中に完了を待つ）

---

## DBテーブル設計

```
users          (id uuid PK, created_at)
images         (id, user_id FK, image_url, created_at)
learning_histories (id, user_id FK, image_id FK,
                    input_text, feedback_text, advice_text,
                    score int, grammar_points jsonb, alternatives jsonb,
                    learned_at, is_review bool, created_at)
favorites      (id, user_id FK, image_id FK, created_at)  ※ UNIQUE(user_id, image_id)
reviews        (id, learning_history_id FK, reviewed_at)
```

---

## 現在の状態と課題

### 実装済みで動くもの
- LearningScreen: 写真表示（MediaLibrary / picsum フォールバック）+ Gemini 添削（テキストのみ）
- Gemini API 接続（`services/gemini.js`）
- ナビゲーション全体

### 未実装・要修正（ステップ順）

**ステップ 1（起動を安定させる）**
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` が `lib/supabase.js` にハードコード → `.env` に移す
- `lib/deviceId.js` が存在しない → 新規作成が必要
- 全画面の `supabase.auth.getUser()` を `getDeviceUserId()` に置き換える

**ステップ 2（コア体験を繋げる）**
- LearningScreen の保存処理が `user && currentImageId` 条件でスキップされている
- HomeScreen の stats（streak / level / XP）がハードコードのダミー
- DetailScreen の「履歴に戻る」ボタンが `onPress={() => {}}` で未接続

**ステップ 3（AI の作り込み）**
- Gemini がテキストのみ → 画像（base64）を渡すマルチモーダル化
- お題自動生成（`generateTopic`）が未実装
- 構造化 JSON 出力（score / grammarPoints / alternatives）が未実装
- learning_histories テーブルに `score` / `grammar_points` / `alternatives` カラムが未追加
- DetailScreen の「分析」「復習」タブがプレースホルダー

---

## 開発フェーズ

### ステップ 1：確実に動かす
1. `.env` に `SUPABASE_URL` / `SUPABASE_ANON_KEY` を追加し `lib/supabase.js` を修正
2. `lib/deviceId.js` を新規作成（`getDeviceUserId` — UUID を SecureStore に保存・取得）
3. 全画面の `supabase.auth.getUser()` を `getDeviceUserId()` に置き換え
4. `npx expo start` → Expo Go 実機で起動確認

### ステップ 2：コア体験を 1 本繋げる
「写真 → 英語入力 → Gemini 添削 → Supabase 保存 → 履歴で見返せる」をダミーなしで完全動作させる。

### ステップ 3：AI の作り込み
- Gemini マルチモーダル化（`generateTopic` + `getEnglishFeedback` に imageBase64 追加）
- 構造化 JSON 出力 + フォールバック実装
- Supabase テーブルに `score` / `grammar_points` / `alternatives` カラム追加
- Detail 画面を実データに置き換え

---

## 規約・方針

- スタイルは各ファイル末尾の `StyleSheet.create({})` にまとめる
- 変数名: camelCase、コンポーネント名: PascalCase
- Gemini 操作は `services/gemini.js` に集約
- デバイス ID 取得は `lib/deviceId.js` の `getDeviceUserId()` を使う（直接 SecureStore を触らない）
- Supabase 操作は各画面か `lib/supabase.js` に書く
- ハードコードのダミーデータを新規追加しない
- `expo-media-library` で取得した画像は `getAssetInfoAsync()` で `localUri` を取得してから使う
