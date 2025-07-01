import Constants from 'expo-constants';

// API キーを複数のプロパティから取得する事で環境差異を吸収
const GEMINI_API_KEY =
  Constants.expoConfig?.extra?.GEMINI_API_KEY ||
  Constants.manifest2?.extra?.GEMINI_API_KEY ||
  Constants.manifest?.extra?.GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY;

// API バージョン v1 で Gemeni-Pro モデルを呼び出す
const ENDPOINT =
  'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent';

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key is missing');
    return null;
  }
  const res = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) {
    console.warn('Gemini request failed', await res.text());
    return null;
  }
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// 英語コーチエージェントにフィードバックを依頼
export async function getEnglishFeedback(text) {
  const raw = await callGemini(
    'あなたはフレンドリーな英語コーチです。以下の英文を見て、日本語で添削と優しいアドバイスを返してください。\n\n' +
      '・そのまま使えるなら「完璧！」と返す。\n' +
      '・直したほうが良い場合は、添削後の文＋理由を説明。\n' +
      '・できれば自然な言い換え例も1つください。\n\n' +
      '次のJSON形式だけで答えてください。{"feedback":"...","suggestion":"..."}\n' +
      `英文: ${text}`,
  );
  if (!raw) return { message: '', suggestion: '', encouragement: '' };

  const match = raw.match(/\{[^]*\}/);
  let parsed = { feedback: '', suggestion: '' };
  if (match) {
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      parsed.feedback = match[0];
    }
  } else {
    parsed.feedback = raw.trim();
  }
  return {
    message: parsed.feedback || '',
    suggestion: parsed.suggestion || '',
    encouragement: 'この調子で続けましょう！',
  };
}


// 共感型エージェントに「もしかして...？」を尋ねる
export async function getFollowUp(text) {
  const raw = await callGemini(
    // ユーザーの英文から推測される感情を短い日本語で返答させる
    `ユーザーの英文から想像できる別の感情や状況があれば、` +
      `「もしかして...？」の形で1文だけ日本語で提案してください。` +
      `英文: ${text}`,
  );
  return raw?.replace(/```/g, '').trim() || '';
}