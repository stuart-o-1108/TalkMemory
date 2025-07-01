import Constants from 'expo-constants';

// API キーを複数のプロパティから取得する事で環境差異を吸収
const GEMINI_API_KEY =
  Constants.expoConfig?.extra?.GEMINI_API_KEY ||
  Constants.manifest2?.extra?.GEMINI_API_KEY ||
  Constants.manifest?.extra?.GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY;

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
    `次の英文のフィードバックを日本語1文でください。もしより良い表現があれば別の1文で提案してください。結果はJSONで {"feedback":"...","suggestion":"..."} の形式で返してください。英文: ${text}`
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

// フォローアップ提案エージェントに推測を依頼
export async function getFollowUp(text) {
  const raw = await callGemini(
    `ユーザーはこの英文で何か感情を伝えようとしています。その裏に隠れている可能性のある気持ちや状況を想像し、「もしかして、こんな気持ちもあったのでは？」という形で1つだけ提案してください。英文: ${text}`
  );
  return raw?.trim() || '';
}