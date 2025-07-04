import React, { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import { getEnglishFeedback } from '../services/gemini';
import { supabase } from '../lib/supabase';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';

export default function LearningScreen() {
  const getRandomPhotoUrl = () => {
    const id = Math.floor(Math.random() * 1000) + 1;
    return `https://picsum.photos/seed/${id}/400/400`;
  };

  const [assets, setAssets] = useState([]);
  const [supabaseImages, setSupabaseImages] = useState([]);
  const [currentImageId, setCurrentImageId] = useState(null);
  const [user, setUser] = useState(null);
  const [image, setImage] = useState(null);
  const [imageDate, setImageDate] = useState('');
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [step, setStep] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [sessionProgress, setSessionProgress] = useState({ current: 1, total: 5 });
  const [isCorrect, setIsCorrect] = useState(null);
  const MIN_INPUT_LENGTH = 10;
  const scaleAnim = useState(new Animated.Value(1))[0];
  const flipAnim = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation();


  useEffect(() => {
    (async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      setUser(currentUser);

      // fetch photos from device as fallback
      const { status } = await MediaLibrary.requestPermissionsAsync();
      let deviceAssets = [];
      if (status === 'granted') {
        const res = await MediaLibrary.getAssetsAsync({
          mediaType: 'photo',
          first: 1000,
          sortBy: [MediaLibrary.SortBy.creationTime],
        });
        deviceAssets = res.assets;
        setAssets(res.assets);
      }

      if (currentUser) {
        const { data: imgs } = await supabase
          .from('images')
          .select('id, image_url, created_at')
          .eq('user_id', currentUser.id);
        setSupabaseImages(imgs || []);
        if (imgs && imgs.length > 0) {
          const pick = imgs[Math.floor(Math.random() * imgs.length)];
          setImage(pick.image_url);
          setCurrentImageId(pick.id);
          setImageDate(new Date(pick.created_at).toLocaleDateString('ja-JP'));
          return;
        }
      }

      if (deviceAssets && deviceAssets.length > 0) {
        const initial = deviceAssets[Math.floor(Math.random() * deviceAssets.length)];
        const info = await MediaLibrary.getAssetInfoAsync(initial.id);
        const uri = info.localUri || initial.uri;
        setImage(uri);
        setImageDate(new Date(initial.creationTime).toLocaleDateString('ja-JP'));
      } else {
        const url = getRandomPhotoUrl();
        setImage(url);
        setImageDate(new Date().toLocaleDateString('ja-JP'));
      }
    })();
  }, []);

  useEffect(() => {
    if (step === 1) {
      setIsAnimating(true);
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]).start(() => setIsAnimating(false));
    }
  }, [step, scaleAnim]);

  const handleNextStep = async () => {
    if (input.trim().length < MIN_INPUT_LENGTH) return;

    const result = await getEnglishFeedback(input);

    if (!result.message) {
      setIsCorrect(false);
      setFeedback({
        message: 'もう少し具体的に表現してみてください！',
        suggestion: '',
        encouragement: '',
      });
    } else {
      setIsCorrect(true);
      setFeedback({ ...result });
    }

    if (user && currentImageId) {
      await supabase.from('learning_histories').insert({
        user_id: user.id,
        image_id: currentImageId,
        input_text: input,
        feedback_text: result.message || '',
        advice_text: result.suggestion || '',
      });
    }
    setStep(3);
  };

  const flipToNextAsset = async (asset) => {
    Animated.timing(flipAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start(async () => {
      const info = await MediaLibrary.getAssetInfoAsync(asset.id);
      const uri = info.localUri || asset.uri;
      setImage(uri);
      setImageDate(new Date(asset.creationTime).toLocaleDateString('ja-JP'));
      flipAnim.setValue(0);
    });
  };

  const flipToNextUrl = (url) => {
    Animated.timing(flipAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => {
      setImage(url);
      setImageDate(new Date().toLocaleDateString('ja-JP'));
      flipAnim.setValue(0);
    });
  };

  const getNextPhoto = () => {
    if (supabaseImages.length > 0) {
      const pick = supabaseImages[Math.floor(Math.random() * supabaseImages.length)];
      setCurrentImageId(pick.id);
      flipToNextUrl(pick.image_url);
      setImageDate(new Date(pick.created_at).toLocaleDateString('ja-JP'));
    } else if (assets.length > 0) {
      const asset = assets[Math.floor(Math.random() * assets.length)];
      flipToNextAsset(asset);
    } else {
      const url = getRandomPhotoUrl();
      flipToNextUrl(url);
    }

    setInput('');
    setFeedback(null);
    setStep(1);
    setIsCorrect(null);
    setShowHint(false);
    setSessionProgress((prev) =>
      prev.current < prev.total ? { ...prev, current: prev.current + 1 } : prev
    );
  };

  const progressPercentage = (sessionProgress.current / sessionProgress.total) * 100;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.headerWrapper}>
          <Text style={styles.title} onPress={() => navigation.navigate('Home')}>
            MemoryTalk
          </Text>
          <View style={styles.headerRight}>
            <Text style={styles.sub}>{sessionProgress.current} / {sessionProgress.total}</Text>
          </View>
        </View>

        {/* progress bar */}
        <View style={styles.progressBarOuter}>
          <View style={[styles.progressBarInner, { width: `${progressPercentage}%` }]} />
        </View>

        <View style={styles.body}>
          {/* Photo Section */}
          {image ? (
            <View style={{ marginBottom: 24 }}>
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.date}>📅 {imageDate}</Text>
              </View>
              <Animated.View
                style={[
                  styles.imageWrap,
                  {
                    transform: [
                      { scale: scaleAnim },
                      {
                        rotateY: flipAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '180deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
                {step === 1 && <View style={styles.overlay} />}
              </Animated.View>
            </View>
          ) : null}

          {/* Step 1 */}
          {step === 1 && (
            <View style={styles.stepBox}>
              <Text style={{ fontSize: 28, marginBottom: 12 }}>🤔</Text>
              <Text style={styles.stepTitle}>この写真の瞬間を思い出してください</Text>
              <Text style={styles.stepText}>その時の気持ちや状況を英語で表現してみましょう</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(2)}>
                <Text style={styles.primaryBtnText}>英語で表現してみる 🚀</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <View style={styles.stepBox}>
              <View style={styles.inputHeader}>
                <Text style={styles.inputHeaderText}>💭 気持ちや出来事を英語で表現しよう</Text>
                {/*
                <TouchableOpacity onPress={() => setShowHint(!showHint)}>
                  <Text style={styles.hintBtn}>💡 ヒント</Text>
                </TouchableOpacity>
                */}
              </View>
              {/*
              {showHint && (
                <View style={styles.hintBox}>
                  <Text style={styles.hintText}>例: \"I felt so happy when...\" / \"This moment was...\" / \"I remember feeling...\"</Text>
                </View>
              )}
              */}
              <TextInput
                style={styles.textInput}
                placeholder="I felt excited when..."
                value={input}
                onChangeText={setInput}
                multiline
              />
              <View style={styles.inputFooter}>
                <Text style={styles.charCount}>文字数: {input.length}</Text>
                <TouchableOpacity
                  onPress={handleNextStep}
                  disabled={input.trim().length < MIN_INPUT_LENGTH}
                  style={[
                    styles.confirmBtn,
                    input.trim().length < MIN_INPUT_LENGTH && { backgroundColor: '#e5e7eb' },
                  ]}
                >
                  <Text
                    style={[
                      styles.confirmBtnText,
                      input.trim().length < MIN_INPUT_LENGTH && { color: '#9ca3af' },
                    ]}
                  >
                    確認する ✓
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 3 */}
          {step === 3 && feedback && (
            <View style={styles.feedbackContainer}>
              <View style={[styles.feedbackBox, isCorrect ? { borderLeftColor: '#4ade80' } : { borderLeftColor: '#fb923c' }]}>
                <View style={styles.feedbackHeader}>
                  <Text style={{ fontSize: 24, marginRight: 8 }}>{isCorrect ? '🎉' : '💪'}</Text>
                  <Text style={styles.feedbackTitle}>{isCorrect ? 'Great Job!' : 'Good Try!'}</Text>
                </View>
                <View style={{ gap: 12 }}>
                  <View style={styles.yourExpressionBox}>
                    <Text style={styles.yourExpressionLabel}>✨ あなたの表現</Text>
                    <Text style={styles.yourExpressionText}>"{input}"</Text>
                  </View>
                  <View style={styles.feedbackMessageBox}>
                    <Text style={styles.feedbackMessageLabel}>💡 フィードバック</Text>
                    <Text style={styles.feedbackMessageText}>{feedback.message}</Text>
                  </View>
                  {feedback.suggestion ? (
                    <View style={styles.suggestionBox}>
                      <Text style={styles.suggestionLabel}>🚀 さらに上達するには</Text>
                      <Text style={styles.suggestionText}>{feedback.suggestion}</Text>
                    </View>
                  ) : null}
                  </View>
                <Text style={styles.encourage}>{feedback.encouragement}</Text>
                <View style={styles.feedbackButtons}>
                  {sessionProgress.current >= sessionProgress.total ? (
                    <TouchableOpacity
                      style={styles.nextPhotoBtn}
                      onPress={() => navigation.navigate('Home')}
                    >
                      <Text style={styles.nextPhotoText}>ホームに戻る 🏠</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.nextPhotoBtn} onPress={getNextPhoto}>
                      <Text style={styles.nextPhotoText}>次の写真へ 📸</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.reviewBtn}>
                    <Text style={styles.reviewText}>復習する 📚</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    backgroundColor: '#f0f4ff',
    flexGrow: 1,
  },
  headerWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    alignSelf: 'flex-start',
  },
  sub: {
    fontSize: 12,
    color: '#475569',
  },
  linkText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  progressBarOuter: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 24,
  },
  progressBarInner: {
    height: 8,
    backgroundColor: '#6366f1',
  },
  body: {
    flex: 1,
  },
  date: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    color: '#475569',
    fontSize: 16,
  },
  imageWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
  },
  stepBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepText: {
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  inputHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  hintBtn: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 12,
  },
  hintBox: {
    backgroundColor: '#dbeafe',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    width: '100%',
  },
  hintText: {
    color: '#1e40af',
    fontSize: 12,
  },
  textInput: {
    width: '100%',
    minHeight: 80,
    borderColor: '#cbd5e1',
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  charCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  confirmBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 12,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  feedbackContainer: {
    marginBottom: 24,
  },
  feedbackBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedbackTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  yourExpressionBox: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  yourExpressionLabel: {
    color: '#166534',
    fontWeight: 'bold',
  },
  yourExpressionText: {
    color: '#166534',
    fontStyle: 'italic',
    marginTop: 4,
  },
  feedbackMessageBox: {
    backgroundColor: '#dbeafe',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  feedbackMessageLabel: {
    color: '#1e40af',
    fontWeight: 'bold',
  },
  feedbackMessageText: {
    color: '#1e3a8a',
    marginTop: 4,
  },
  suggestionBox: {
    backgroundColor: '#ede9fe',
    borderColor: '#ddd6fe',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  suggestionLabel: {
    color: '#6b21a8',
    fontWeight: 'bold',
  },
  suggestionText: {
    color: '#581c87',
    marginTop: 4,
  },
  encourage: {
    textAlign: 'center',
    color: '#334155',
    marginVertical: 16,
  },
  feedbackButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  nextPhotoBtn: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  nextPhotoText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  reviewBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  reviewText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
