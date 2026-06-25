# TalkMemory

**思い出写真 × 英語学習 × マルチモーダル AI 添削**

スマホのカメラロールから写真を選び、その場面を英語で表現してみる。写真とユーザーの英文を Gemini に同時送信し、写真の文脈を踏まえた英作文添削・スコアリング・言い換え提案を返す英語学習アプリ。ポートフォリオ用途。

---

## コンセプト

> カメラロールの写真を開き、その場面を英語で表現してみる。写真とユーザーの英文を **1回のマルチモーダル AI 呼び出し** で同時に処理し、「この写真の文脈ではこの単語が適切」「ネイティブならこう言う」という、写真の内容に紐づいた具体的なフィードバックが返ってくる。

### 技術的な見どころ（ポートフォリオ観点）

| ポイント | 実装内容 |
|---|---|
| マルチモーダル LLM | 写真（base64）とユーザー英文を **1回の API 呼び出し**で同時送信し、画像の文脈を踏まえた添削を実現 |
| 構造化出力 + 二重ガード | score・grammarPoints・alternatives を JSON で安定取得。プロンプト指示 **かつ** コード側後処理でスコアと指摘内容の矛盾を防止 |
| モデルフォールバック | `gemini-2.5-flash` → `gemini-2.5-flash-lite` に自動切替（429/500/503 検知）。Free Tier クォータ制約を実測して対象モデルを選定 |
| 画像ローカル圧縮 | `expo-image-manipulator` で 512px/60% JPEG に前処理してから送信。トークン削減・レスポンス短縮を意識した実装 |
| リクエストキャンセル | `AbortController` で画面離脱・二重送信を防止 |
| API エンドポイント使い分け | 画像あり → `generateContent`、テキストのみ → Interactions API と用途に応じて切り替え |
| 開発モックモード | `MOCK_GEMINI=true` で Gemini 呼び出しをゼロにし、開発中の API 費用と RPD 消費を完全遮断 |
| 認証なし運用 | デバイス ID（UUID）を user_id に使い、ログイン不要で Supabase に学習履歴を永続化 |
| AI 支援開発 | Claude Code を活用。プロジェクト仕様書（CLAUDE.md）を自身で設計・運用しながら AI エージェントへの指示と実装レビューを通じて開発を推進 |

---

## 技術スタック

| 分類 | 技術 |
|---|---|
| フレームワーク | React Native (Expo ~53) |
| 言語 | JavaScript |
| ナビゲーション | React Navigation v7 (Native Stack) |
| AI | Gemini 2.5 Flash / Flash-Lite（マルチモーダル） |
| データベース | Supabase (PostgreSQL) |
| デバイス識別 | UUID を expo-secure-store に永続化 |
| 画像取得 | expo-media-library |
| 画像圧縮 | expo-image-manipulator |
| API キー管理 | `.env` → `app.config.js` の `extra` 経由 |

---

## 画面構成

```
Home        ダッシュボード。学習開始ボタンと履歴のサマリー
  └─ Learning   写真選択 → 英語入力 → AI 添削・スコア表示 → Supabase 保存
  └─ History    学習履歴一覧（Supabase から取得）
       └─ Detail  履歴詳細。スコア・文法ポイント・言い換えを表示
```

---

## AI 設計

### マルチモーダル入力（1セッション 1回の API 呼び出し）

写真とユーザーの英文を **1回の `generateContent` 呼び出し** で同時送信し、写真の文脈を踏まえた添削を行う。
API コストと待ち時間を最小化するため、写真の前処理（圧縮・base64化）はユーザーが英文を入力している間にローカルで完了させておく。

```js
// 写真が選ばれた時点でローカル圧縮（API 呼び出しは不要）
const base64 = await getCompressedImageBase64(uri);  // expo-image-manipulator で 512px/60%

// ユーザーが英文を送信した時点で 1回だけ API 呼び出し
const result = await getEnglishFeedback(inputText, signal, imageBase64);
```

### エンドポイント使い分け

| 条件 | エンドポイント | 理由 |
|---|---|---|
| 画像あり | `v1beta/models/{model}:generateContent` | マルチモーダル対応の安定エンドポイント |
| テキストのみ | `v1beta/interactions` | Gemini 2.5 系の thinking 最適化エンドポイント |

### モデルフォールバック

```
gemini-2.5-flash（主）
  → 429 / 500 / 503 を検知
  → gemini-2.5-flash-lite（自動切替、待ち時間なし）
  → 両方失敗 → null 返却 → UI でリトライボタン表示
```

> **モデル選定根拠:** Gemini 2.0/1.5 系は Free Tier クォータが 0（リクエスト不可）であることを実測で確認。2.5 系のみで構成している。

### 構造化 JSON 出力 + 二重ガード

Gemini には以下の JSON のみを返すよう指示する。

```json
{
  "score": 82,
  "feedback": "grammarPoints の補足（具体的な使い分け例など）",
  "suggestion": "I was really moved by this moment.",
  "grammarPoints": ["「scenery」より「view」の方が特定の場所の眺めに適しているよ！"],
  "alternatives": [
    "This view left me speechless.",
    "I couldn't help but smile at this scene."
  ]
}
```

**LLM の出力を信頼せず、コード側でも整合性を強制する:**

```js
// プロンプト指示 + コード側ポストプロセスの二重ガード
if (grammarPoints.length === 0 && score < 90) score = 90;  // 指摘なし → 高スコアに補正
if (grammarPoints.length > 0 && score >= 90) score = 89;  // 指摘あり → 低スコアに補正
```

### スコア定義

| 範囲 | 評価基準 |
|---|---|
| 90〜100 | ネイティブに近い自然な表現（grammarPoints は必ず空配列） |
| 75〜89 | 意味は伝わるが、より自然な言い回しがある |
| 60〜74 | 文法ミスがあるが意図は読み取れる |
| 0〜59 | 大幅な修正が必要 |

### JSON フォールバック

Gemini のレスポンスが壊れた場合（JSON パース失敗/フィールド欠損）はユーザーにエラーを出さず以下で補完する。

```js
{ score: 0, feedback: rawText, suggestion: "", grammarPoints: [], alternatives: [] }
```

パース手順: `raw.match(/\{[\s\S]*\}/)` で JSON 部分だけ抽出してから `JSON.parse`。失敗時は `catch` でデフォルト値。

### 開発モックモード

```bash
# .env
MOCK_GEMINI=true   # 開発中は Gemini 呼び出しゼロ（RPD 消費なし）
MOCK_GEMINI=false  # 実機動作確認時のみ本物 API を使う
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

将来ログイン機能を追加する場合は、`getDeviceUserId()` の戻り値を `supabase.auth.getUser()` の `user.id` に差し替えるだけで移行できる設計にしている。

---

## DB テーブル設計

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

## 実装状況（MVP 時点）

### 完了

- [x] マルチモーダル添削（写真 + 英文 → Gemini → スコア/文法ポイント/言い換え）
- [x] 構造化 JSON 出力 + 二重ガード（プロンプト指示 + コード側後処理）
- [x] モデルフォールバック（`gemini-2.5-flash` → `gemini-2.5-flash-lite`、Free Tier 制約を実測検証済み）
- [x] 画像ローカル圧縮（512px / 60% JPEG）によるトークン削減
- [x] `AbortController` によるリクエストキャンセル（二重送信・画面離脱対応）
- [x] 開発モックモード（`MOCK_GEMINI` 環境変数）
- [x] デバイス UUID 認証 + Supabase への学習履歴永続化
- [x] 学習履歴一覧・詳細表示（スコア/文法ポイント/言い換えを DB から取得）
- [x] HomeScreen ダッシュボード統計（streak / level / XP / 週次進捗）を Supabase 集計から算出
- [x] React Navigation によるスタックナビゲーション

### 今後の拡張

- [ ] 写真の文脈に応じた AI によるお題自動生成
- [ ] 復習モード（苦手な文法ポイントを再練習）
- [ ] お気に入り機能（favorites テーブルは設計済み）

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
MOCK_GEMINI=true   # 開発中は true、実機確認時は false
```

