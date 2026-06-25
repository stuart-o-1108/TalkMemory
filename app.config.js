import 'dotenv/config';

export default {
  expo: {
    name: "TalkMemory",
    slug: "TalkMemory",
    version: "1.0.0",
    description: "TalkMemory: 英語学習を写真と思い出から学べるアプリ",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "talkmemory",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true
    },
    web: {
      bundler: "metro",
      //output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ],
      [
        "expo-media-library",
        {
          "photosPermission": "思い出の写真を使って英語学習をするために、写真へのアクセスを許可してください。",
          "savePhotosPermission": "写真の保存を許可してください。",
          "isAccessMediaLocationEnabled": true
        }
      ]
    ],
    extra: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      MOCK_GEMINI: process.env.MOCK_GEMINI,
    }
  }
}