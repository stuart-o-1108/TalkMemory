import Constants from 'expo-constants';

// ─── DEV モック ────────────────────────────────────────────────────────────
// .env に MOCK_GEMINI=true を追加すると開発中の API 呼び出しをゼロにできる
// 本番ビルド（__DEV__ = false）では常に本物の API を使う
const MOCK_MODE =
  typeof __DEV__ !== 'undefined' && __DEV__ &&
  Constants.expoConfig?.extra?.MOCK_GEMINI === 'true';

const MOCK_RESPONSE = {
  apiError: false,
  score: 78,
  feedback: '「enjoyed」は過去形なので「enjoy」ではなく「enjoyed」が正しい形です。',
  suggestion: 'I really enjoyed the view from the top of the mountain.',
  grammarPoints: [
    '"enjoy" は動詞なので過去のことは "enjoyed" を使う',
    '"the" を付けて特定の山を指す方が自然',
  ],
  alternatives: [
    'The scenery from the summit took my breath away.',
    'I was amazed by the breathtaking view.',
  ],
};
// ─────────────────────────────────────────────────────────────────────────────

// generateContent エンドポイント（マルチモーダル対応、Free Tier で使える全モデルに対応）
const GENERATE_ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
// interactions エンドポイント（画像なしテキスト呼び出し用フォールバック）
const INTERACTIONS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
// Free Tier で利用可能なモデル（2.0/1.5 系は Free Tier クォータが 0 のため不可）
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

function getApiKey() {
  return (
    Constants.expoConfig?.extra?.GEMINI_API_KEY ||
    Constants.manifest2?.extra?.GEMINI_API_KEY ||
    Constants.manifest?.extra?.GEMINI_API_KEY
  );
}

// マルチモーダル呼び出し（画像 + テキスト）
async function callGeminiVision(imageBase64, textPrompt, signal, modelIndex = 0) {
  if (modelIndex >= MODELS.length) return null;
  const apiKey = getApiKey();
  const model = MODELS[modelIndex];
  try {
    const res = await fetch(GENERATE_ENDPOINT(model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          { text: textPrompt },
        ]}],
      }),
      signal,
    });
    if ([429, 500, 503].includes(res.status) && modelIndex + 1 < MODELS.length) {
      console.warn('[Gemini Vision]', res.status, '→ fallback to', MODELS[modelIndex + 1]);
      return callGeminiVision(imageBase64, textPrompt, signal, modelIndex + 1);
    }
    if (!res.ok) {
      const errText = await res.text();
      console.error('[Gemini Vision] Failed', res.status, errText.slice(0, 200));
      return null;
    }
    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (e) {
    if (e.name === 'AbortError') return null;
    console.error('[Gemini Vision] Error:', e.message);
    return null;
  }
}

// テキストのみ呼び出し（画像なし時のフォールバック）
async function callGeminiText(textPrompt, signal, modelIndex = 0) {
  if (modelIndex >= MODELS.length) return null;
  const apiKey = getApiKey();
  const model = MODELS[modelIndex];
  try {
    const res = await fetch(INTERACTIONS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ model, input: textPrompt }),
      signal,
    });
    if ([429, 500, 503].includes(res.status) && modelIndex + 1 < MODELS.length) {
      console.warn('[Gemini Text]', res.status, '→ fallback to', MODELS[modelIndex + 1]);
      return callGeminiText(textPrompt, signal, modelIndex + 1);
    }
    if (!res.ok) {
      const errText = await res.text();
      console.error('[Gemini Text] Failed', res.status, errText.slice(0, 200));
      return null;
    }
    const json = await res.json();
    return json.steps?.find(s => s.type === 'model_output')?.content?.[0]?.text ?? null;
  } catch (e) {
    if (e.name === 'AbortError') return null;
    console.error('[Gemini Text] Error:', e.message);
    return null;
  }
}

// ユーザーの英文を写真の文脈で添削する
// imageBase64: 圧縮済み JPEG base64（あれば写真を見てフィードバック、なければテキストのみ）
// 戻り値: { apiError, score, feedback, suggestion, grammarPoints[], alternatives[] }
export async function getEnglishFeedback(text, signal, imageBase64 = null) {
  if (MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 1500)); // 実際の応答時間を模倣
    return MOCK_RESPONSE;
  }

  const prompt =
    (imageBase64
      ? 'あなたは英語コーチです。この写真を見てください。ユーザーはこの写真の場面について以下の英語表現を書きました。写真の内容を踏まえて英文を分析し、日本語でJSONのみを返してください。\n'
      : 'あなたは英語コーチです。以下の英文を分析し、日本語でJSONのみを返してください。\n') +
    `英文: "${text}"\n\n` +
    `返すJSON:\n` +
    `{\n` +
    `  "score": 0〜100の整数,\n` +
    `  "grammarPoints": [\n` +
    `    "修正箇所を短く・カジュアルに1文で。語尾は「〜だよ」「〜しよう」など話し言葉。敬語・丁寧語は使わない。"\n` +
    `    "良い例: '「scenery」より「view」の方が特定の場所からの眺めに適しているよ！'\n` +
    `    '過去のことは「was」ではなく「is」を使おう！'\n` +
    `    '「rainy」より写真の状況には「snowy」が合っているよ！'\n` +
    `  ],\n` +
    `  "feedback": "grammarPointsで指摘した箇所についての補足。具体的な使い分け例（例: '自分の家からの眺めはview、広い自然の景色はsceneryのように使い分けると◎'）を入れてユーザーの理解を深める内容にする。指摘と無関係な内容は書かない。補足不要なら空文字",\n` +
    `  "alternatives": ["ネイティブがよく使う自然な言い回し（英語）を最大2つ"],\n` +
    `  "suggestion": "添削後の最も自然な英文"\n` +
    `}\n\n` +
    `採点ルール（必ず守ること）:\n` +
    `- grammarPoints に修正箇所がある場合: score は 0〜89 の範囲\n` +
    `- grammarPoints が空配列（修正不要）の場合: score は必ず 90〜100\n` +
    `- grammarPoints には修正が必要な箇所のみ。「完璧です」等のポジティブコメントは絶対に入れない。不要なら []\n` +
    `- feedback は grammarPoints の補足のみ。別の箇所を新たに指摘しない。不要なら ""\n` +
    `- スコア目安: 90〜100=修正不要 / 75〜89=通じるが改善余地 / 60〜74=意図は伝わるが誤りあり / 60未満=大幅修正が必要`;

  const raw = imageBase64
    ? await callGeminiVision(imageBase64, prompt, signal)
    : await callGeminiText(prompt, signal);

  if (raw === null) {
    return { apiError: true, score: 0, feedback: '', suggestion: '', grammarPoints: [], alternatives: [] };
  }

  const match = raw.match(/\{[\s\S]*\}/);
  let parsed = null;
  if (match) {
    try { parsed = JSON.parse(match[0]); } catch (_) {}
  }
  if (!parsed) {
    return { apiError: false, score: 0, feedback: raw.trim(), suggestion: '', grammarPoints: [], alternatives: [] };
  }

  const grammarPoints = Array.isArray(parsed.grammarPoints) ? parsed.grammarPoints : [];
  let score = Number.isFinite(parsed.score) ? parsed.score : 0;
  if (grammarPoints.length === 0 && score < 90) score = 90;
  if (grammarPoints.length > 0 && score >= 90) score = 89;

  return {
    apiError: false,
    score,
    feedback: parsed.feedback || '',
    suggestion: parsed.suggestion || '',
    grammarPoints,
    alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives : [],
  };
}
