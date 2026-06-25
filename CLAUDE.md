# TalkMemory — CLAUDE.md

## プロジェクト概要

思い出写真 × 英語学習 × マルチモーダル AI 添削アプリ。カメラロールの写真とユーザーが書いた英文を Gemini に同時送信し、写真の文脈を踏まえた添削・スコアリングを行う。ログイン不要（デバイス ID 方式）。ポートフォリオ用途。

---

## 技術スタック

| 分類 | 技術 |
|---|---|
| フレームワーク | React Native (Expo ~53) |
| 言語 | JavaScript（TypeScript 未使用） |
| ナビゲーション | React Navigation v7 (Native Stack) |
| AI | Gemini 2.5 Flash / Flash-Lite（マルチモーダル） |
| データベース | Supabase (PostgreSQL) |
| デバイス識別 | UUID を expo-secure-store に永続化（ログイン不要） |
| 画像取得 | expo-media-library |
| 画像圧縮 | expo-image-manipulator（512px / 60% JPEG） |
| API キー管理 | `.env` → `app.config.js` の `extra` 経由 |

---

## ディレクトリ構成

```
App.js                      # エントリポイント → AppNavigator
navigation/AppNavigator.js  # スタック定義（Home / Learning / History / Detail）
screens/
  HomeScreen.js             # ダッシュボード（Supabase から履歴サマリーを取得）
  LearningScreen.js         # 学習画面（写真選択 → 英語入力 → 添削 → 保存）
  HistoryScreen.js          # 履歴一覧（Supabase から取得）
  DetailScreen.js           # 履歴詳細（score/grammarPoints/alternatives を表示）
services/
  gemini.js                 # getEnglishFeedback(text, signal, imageBase64)
lib/
  supabase.js               # Supabase クライアント + favorites CRUD
  deviceId.js               # getDeviceUserId() — SecureStore で UUID を永続化
```

---

## 認証設計（デバイス ID 方式）

ログイン画面なし。`lib/deviceId.js` の `getDeviceUserId()` が UUID を返す。

```js
// lib/deviceId.js のインターフェース
getDeviceUserId(): Promise<string>  // SecureStore から取得、なければ生成して保存
```

将来ログイン機能を追加する場合は `getDeviceUserId()` の戻り値を `auth user.id` に差し替えるだけ。

---

## 画面遷移

```
Home ──→ Learning（写真選択 → 英語入力 → 添削 → 保存）
Home ──→ History ──→ Detail
```

---

## AI 設計（services/gemini.js）

### アーキテクチャ（1セッション 1回の API 呼び出し）

写真が選ばれた時点でローカル圧縮（API 呼び出しなし）を行い、ユーザーが英文を送信したタイミングで写真 + テキストを 1回の呼び出しで送信する。

```
写真選択
  → ローカル圧縮（expo-image-manipulator 512px/60% JPEG）→ base64 を useRef に保存
英文送信
  → getEnglishFeedback(text, signal, imageBase64) → generateContent へ 1回だけ送信
```

### Gemini への画像送信方法（generateContent）

```js
contents: [{
  parts: [
    { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
    { text: prompt }
  ]
}]
```

### エンドポイント使い分け

| 条件 | エンドポイント |
|---|---|
| 画像あり | `v1beta/models/{model}:generateContent` |
| テキストのみ | `v1beta/interactions` |

### 関数インターフェース

```js
// ユーザーの英文を写真の文脈で添削する（マルチモーダル）
// imageBase64: 圧縮済み JPEG base64。null の場合はテキストのみで添削
getEnglishFeedback(text: string, signal: AbortSignal, imageBase64?: string | null): Promise<FeedbackResult>
```

### FeedbackResult の型

```js
{
  apiError: boolean,       // true なら UI でリトライボタンを表示
  score: number,           // 0〜100
  feedback: string,        // grammarPoints の補足説明（使い分け例など）
  suggestion: string,      // 改善後の英文
  grammarPoints: string[], // 修正箇所（カジュアルな話し言葉で）
  alternatives: string[]   // ネイティブの別の言い回し候補
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
| 2 | 429/500/503 → 即座に `gemini-2.5-flash-lite` へフォールバック（待ち時間なし） |
| 3 | 両方失敗 → `null` 返却 → `apiError: true` → UI でリトライボタン表示 |

> **モデル選定根拠:** Gemini 2.0/1.5 系は Free Tier クォータが 0（リクエスト不可）であることを実測で確認。2.5 系のみで構成。

### JSON フォールバック

Gemini のレスポンスが壊れた場合は以下で補完する（ユーザーにエラーは出さない）。

```js
{ score: 0, feedback: rawText, suggestion: "", grammarPoints: [], alternatives: [] }
```

パース手順: `raw.match(/\{[\s\S]*\}/)` で JSON 部分を抽出 → `JSON.parse` → 失敗時は catch でデフォルト値。

### 開発モックモード

`.env` に `MOCK_GEMINI=true` を追加すると Gemini 呼び出しをゼロにできる。  
本番ビルド（`__DEV__ = false`）では常に本物の API を使う。  
開発中は `true`、実機動作確認時のみ `false` に切り替える。

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

## 統計設計（HomeScreen）

| 指標 | 計算ロジック |
|---|---|
| XP | `learning_histories` の行数 × 50（1セッション = 写真1枚の添削完了 = 50 XP） |
| Level | `Math.floor(XP / 500) + 1`（500 XP ごとにレベルアップ） |
| streak | 今日（or 昨日）から遡って学習がある連続日数 |
| 今週の進捗 | 月曜〜日曜を1週とし、学習した日数をカウント（毎週月曜リセット） |
| 週間目標 | ユーザーが 1〜7 日で設定、expo-secure-store に保存 |

## 実装状況（MVP 時点）

### 完了

- マルチモーダル添削（`getEnglishFeedback`）
- 構造化 JSON 出力 + 二重ガード
- モデルフォールバック（2.5-flash → 2.5-flash-lite）
- 画像ローカル圧縮（expo-image-manipulator）
- AbortController によるリクエストキャンセル
- 開発モックモード（`MOCK_GEMINI`）
- デバイス UUID 認証 + Supabase 永続化（`lib/deviceId.js` 実装済み）
- 学習履歴一覧・詳細表示（DB から実データ取得）
- HomeScreen ダッシュボード統計（streak / level / XP / 週次進捗）を Supabase 集計から算出
- 週間目標のユーザー設定（1〜7日、expo-secure-store に保存、毎週月曜リセット）

### 未実装（今後の拡張）

- 写真の文脈に応じた AI によるお題自動生成
- 復習モード
- お気に入り機能（favorites テーブルは設計済み）

---

## 開発フェーズ（記録）

### ステップ 1：確実に動かす ✅
- `.env` に Supabase キーを移動
- `lib/deviceId.js` を新規作成（UUID を SecureStore に保存・取得）
- 全画面の `supabase.auth.getUser()` を `getDeviceUserId()` に置き換え

### ステップ 2：コア体験を 1 本繋げる ✅
「写真 → 英語入力 → Gemini 添削 → Supabase 保存 → 履歴で見返せる」を完全動作させた。

### ステップ 3：AI の作り込み ✅
- Gemini マルチモーダル化（写真 + テキストを 1回の generateContent で送信）
- 構造化 JSON 出力 + フォールバック実装
- スコア/文法ポイント/言い換えを DB に保存・Detail 画面で表示
- モデルフォールバック設計（Free Tier 制約を実測検証済み）

---

## 規約・方針

- スタイルは各ファイル末尾の `StyleSheet.create({})` にまとめる
- 変数名: camelCase、コンポーネント名: PascalCase
- Gemini 操作は `services/gemini.js` に集約
- デバイス ID 取得は `lib/deviceId.js` の `getDeviceUserId()` を使う（直接 SecureStore を触らない）
- Supabase 操作は各画面か `lib/supabase.js` に書く
- ハードコードのダミーデータを新規追加しない
- `expo-media-library` で取得した画像は `getAssetInfoAsync()` で `localUri` を取得してから使う
