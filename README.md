# TalkMemory

**思い出写真 × 英語 × マルチモーダル AI 添削**

スマホの写真を AI が読み取り、その状況に合った英語表現のお題を自動生成。ユーザーが英文を書くと、写真の文脈を踏まえて AI が添削・スコアリング・言い換えを返す英語学習アプリ。

---

## コンセプト

> カメラロールの写真を開くと、AI がその場面を読み取って「この瞬間を英語で表現してみよう」というお題を生成。ユーザーが英文を書くと、写真の文脈に合わせた添削と点数が返ってくる。

### 技術的な見どころ（ポートフォリオ観点）

| ポイント | 実装内容 |
|---|---|
| マルチモーダル LLM | 写真（base64）とテキストを Gemini に同時送信し、画像理解ベースの添削を実現 |
| 構造化出力 | スコア・文法ポイント・言い換え候補を JSON で安定取得、フォールバック設計あり |
| 認証なし運用 | デバイス ID（UUID）を user_id に使い、ログイン不要で Supabase を活用 |

---

## 技術スタック

| 分類 | 技術 |
|---|---|
| フレームワーク | React Native (Expo ~53) |
| 言語 | JavaScript |
| ナビゲーション | React Navigation v7 (Native Stack) |
| AI | Gemini 1.5 Pro（マルチモーダル） |
| データベース | Supabase (PostgreSQL) |
| デバイス識別 | UUID を expo-secure-store に永続化 |
| 画像取得 | expo-media-library |
| APIキー管理 | `.env` → `app.config.js` の `extra` 経由 |

---

## 画面構成

```
Home        ダッシュボード。学習開始ボタンと履歴のサマリー
  └─ Learning   写真 → AI お題生成 → 英語入力 → AI 添削・スコア表示 → 保存
  └─ History    学習履歴一覧（Supabase から取得）
       └─ Detail  履歴詳細。スコア・文法ポイント・言い換えを表示
```

---

## 認証設計（デバイス ID 方式）

ログイン画面を設けず、初回起動時に生成した UUID をデバイス識別子として使う。

```
初回起動
  → UUID 生成
  → expo-secure-store に保存
  → 以降はこの UUID を user_id としてすべての Supabase クエリで使用
```

将来ログイン機能を追加する場合は、`getDeviceUserId()` の戻り値を `supabase.auth.getUser()` の `user.id` に差し替えるだけで移行できる。

---

## AI 設計

### マルチモーダル入力

Gemini 1.5 Pro の `generateContent` に画像（base64）とテキストを同時送信する。

```js
contents: [{
  parts: [
    { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
    { text: prompt }
  ]
}]
```

### 2段階の AI 呼び出し

| フェーズ | 関数 | 内容 |
|---|---|---|
| お題生成 | `generateTopic(imageBase64)` | 写真の状況を読み取り、英語表現のお題を日本語で返す |
| 添削 | `getEnglishFeedback(text, imageBase64)` | 写真の文脈を踏まえて英文を採点・添削する |

### 構造化 JSON 出力仕様

Gemini には以下の JSON のみを返すよう指示する。

```json
{
  "score": 82,
  "feedback": "とても自然な表現です。",
  "suggestion": "I was really moved by this moment.",
  "grammarPoints": ["形容詞の語順", "冠詞 a / the の使い分け"],
  "alternatives": [
    "This view left me speechless.",
    "I couldn't help but smile at this scene."
  ]
}
```

### スコア定義

| 範囲 | 評価基準 |
|---|---|
| 90〜100 | ネイティブに近い自然な表現 |
| 75〜89 | 意味は伝わるが、より自然な言い回しがある |
| 60〜74 | 文法ミスがあるが意図は読み取れる |
| 0〜59 | 大幅な修正が必要。基本構造から見直す |

### JSON フォールバック戦略

Gemini のレスポンスが壊れた場合（JSON パース失敗 / フィールド欠損）は以下で補完する。

```js
{ score: 0, feedback: rawText, suggestion: "", grammarPoints: [], alternatives: [] }
```

パース手順: `raw.match(/\{[\s\S]*\}/)` で JSON 部分だけ抽出してから `JSON.parse`。
失敗時は `catch` で上記デフォルト値にフォールバックし、ユーザーにはエラーを出さない。

---

## DBテーブル設計

```
users          (id uuid PK, created_at)          ← device UUID を insert
images         (id, user_id FK, image_url, created_at)
learning_histories (id, user_id FK, image_id FK,
                    input_text, feedback_text, advice_text,
                    score, grammar_points jsonb, alternatives jsonb,
                    learned_at, is_review, created_at)
favorites      (id, user_id FK, image_id FK, created_at)  ※ UNIQUE(user_id, image_id)
reviews        (id, learning_history_id FK, reviewed_at)
```

---

## 開発フェーズ

### ステップ 1：確実に動かす

- [ ] `lib/supabase.js` の URL/Key を `.env` に移す
- [ ] `lib/deviceId.js` を新規作成（UUID 生成・SecureStore 永続化）
- [ ] 全画面の `supabase.auth.getUser()` を `getDeviceUserId()` に置き換える
- [ ] `npx expo start` → Expo Go 実機で起動確認

### ステップ 2：コア体験を 1 本、完全に繋げる

- [ ] 「写真選択 → 英語入力 → Gemini添削 → 結果表示 → Supabase 保存 → 履歴で見返せる」を完全動作させる
- [ ] ダミーデータ・ハードコードを撤廃

### ステップ 3：AI の作り込み

- [ ] Gemini をマルチモーダル化（写真 base64 + テキストを同時送信）
- [ ] お題自動生成（`generateTopic`）を実装
- [ ] 構造化 JSON 出力（score / grammarPoints / alternatives）を実装
- [ ] Detail 画面のハードコードを実データに置き換え
- [ ] フォールバック処理を実装・検証

---

## 環境セットアップ

```bash
npm install
npx expo start
```

`.env` に以下を設定

```
GEMINI_API_KEY=your_key_here
SUPABASE_URL=your_url_here
SUPABASE_ANON_KEY=your_key_here
```
