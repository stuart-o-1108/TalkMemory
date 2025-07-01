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
      ]
    ],
    extra: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    }
  }
}