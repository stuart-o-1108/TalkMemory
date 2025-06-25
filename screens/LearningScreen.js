// MemoryTalk メイン学習画面 - 改善版（ステップUI with UX強化）

import * as MediaLibrary from 'expo-media-library';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export default function LearningScreen() {
  console.log("✅ LearningScreen loaded!");
  const [step, setStep] = useState(1); // 1: 写真表示, 2: 入力, 3: フィードバック
  const [image, setImage] = useState(null);
  const [imageDate, setImageDate] = useState('');
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    loadRandomImage();
  }, []);

  const loadRandomImage = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      alert('写真へのアクセスが許可されていません');
      return;
    }

    const assets = await MediaLibrary.getAssetsAsync({
      mediaType: 'photo',
      sortBy: ['creationTime'],
      first: 100,
    });

    const assetList = assets.assets;
    if (assetList.length > 0) {
      const randomIndex = Math.floor(Math.random() * assetList.length);
      const asset = assetList[randomIndex];
      const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
      const uri = assetInfo.localUri;
      const date = new Date(assetInfo.creationTime).toLocaleDateString();

      if (uri) {
        setImage(uri);
        setImageDate(date);
        setInput('');
        setFeedback('');
        setStep(1);
        fadeAnim.setValue(0);
        scaleAnim.setValue(0.8);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 5,
            tension: 100,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2 && input.trim()) {
      setFeedback(`いいね！「${input}」って書いてくれたね。こう言うともっと自然かも：\n→（例）That sounds really authentic.`);
      setStep(3);
    } else if (step === 3) {
      loadRandomImage();
    }
  };

  const getButtonLabel = () => {
    if (step === 1) return '気持ちを英語で書いてみる';
    if (step === 2) return 'AIにチェックしてもらう';
    if (step === 3) return '次の写真へ';
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <Text style={styles.header}>MemoryTalk</Text>

        {image && (
          <Animated.View style={[styles.imageContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
            <Image source={{ uri: image }} style={styles.image} />
            <Text style={styles.imageDate}>📅 {imageDate}</Text>
          </Animated.View>
        )}

        <View style={styles.centerContent}>
          {step === 1 && (
            <Text style={styles.prompt}>この写真、覚えてる？どんな気持ちだった？</Text>
          )}

          {step === 2 && (
            <>
              <Text style={styles.prompt}>そのときの気持ちを英語で書いてみよう！</Text>
              <TextInput
                style={styles.input}
                placeholder="I'm feeling grateful..."
                placeholderTextColor="#94A3B8"
                value={input}
                onChangeText={setInput}
              />
            </>
          )}

          {step === 3 && (
            <View style={styles.feedbackWrapper}>
              <Text style={styles.feedbackLabel}>AIからのフィードバック：</Text>
              <View style={styles.feedbackBubble}>
                <Text style={styles.feedbackText}>{feedback}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, step === 2 && !input.trim() && styles.buttonDisabled]}
            onPress={handleNextStep}
            disabled={step === 2 && !input.trim()}
          >
            <Text style={styles.buttonText}>{getButtonLabel()}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}


