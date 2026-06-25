import React, { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { getEnglishFeedback } from '../services/gemini';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceId';
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

  // 画像を 512px にリサイズして base64 化（トークン削減・レスポンス時間短縮）
  const getCompressedImageBase64 = async (uri) => {
    try {
      let localUri = uri;
      if (uri.startsWith('http')) {
        const tempPath = FileSystem.cacheDirectory + 'talkmemory_topic_dl.jpg';
        const { uri: downloaded } = await FileSystem.downloadAsync(uri, tempPath);
        localUri = downloaded;
      }
      const result = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: 512 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      return result.base64 ?? null;
    } catch (e) {
      console.warn('[Topic] Compress failed:', e.message);
      return null;
    }
  };

  // 写真をローカルで圧縮して base64 化（API 呼び出しなし・高速）
  // 結果を imageBase64Ref に保存し、確認ボタン押下時にフィードバックへ渡す
  const prepareImageBase64 = async (uri) => {
    imageBase64Ref.current = null;
    const base64 = await getCompressedImageBase64(uri);
    imageBase64Ref.current = base64;
  };

  const [assets, setAssets] = useState([]);
  const [supabaseImages, setSupabaseImages] = useState([]);
  const [currentImageId, setCurrentImageId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [image, setImage] = useState(null);
  const [imageDate, setImageDate] = useState('');
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [step, setStep] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [sessionProgress, setSessionProgress] = useState({ current: 1, total: 3 });
  const [isCorrect, setIsCorrect] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const MIN_INPUT_LENGTH = 10;
  const scaleAnim = useState(new Animated.Value(1))[0];
  const flipAnim = useRef(new Animated.Value(0)).current;
  const abortRef = useRef(null);
  const imageBase64Ref = useRef(null); // 圧縮済み JPEG base64（確認ボタン押下時に使用）
  const navigation = useNavigation();


  useEffect(() => {
    (async () => {
      try {
        const currentUserId = await getDeviceUserId();
        setUserId(currentUserId);

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

        // Supabase images はホーム画面の「最近の学習」表示用として取得するだけ。
        // 学習セッションには使わない（使い回しになり同じ画像が続く原因になるため）。
        try {
          const { data: imgs } = await supabase
            .from('images')
            .select('id, image_url, created_at')
            .eq('user_id', currentUserId);
          setSupabaseImages(imgs || []);
        } catch (_) {}

        // 優先順位: デバイス写真（毎回ランダム） > picsum フォールバック
        if (deviceAssets.length > 0) {
          const initial = deviceAssets[Math.floor(Math.random() * deviceAssets.length)];
          const info = await MediaLibrary.getAssetInfoAsync(initial.id);
          const uri = info.localUri || initial.uri;
          setImage(uri);
          setCurrentImageId(null);
          setImageDate(new Date(initial.creationTime).toLocaleDateString('ja-JP'));
          prepareImageBase64(uri); // ローカル圧縮のみ（API 呼び出しなし）
        } else {
          const url = getRandomPhotoUrl();
          setImage(url);
          setCurrentImageId(null);
          setImageDate(new Date().toLocaleDateString('ja-JP'));
          prepareImageBase64(url);
        }
      } catch (_) {
        setImage(getRandomPhotoUrl());
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

  // 履歴を保存するための image_id を確保する。
  // Supabase 由来の写真は currentImageId をそのまま使い、
  // 端末/picsum の写真は images へ登録してから紐付ける（同一セッションでは再利用）。
  const ensureImageId = async () => {
    if (currentImageId) return currentImageId;
    if (!userId || !image) return null;
    await supabase.from('users').upsert({ id: userId });
    const { data, error } = await supabase
      .from('images')
      .insert({ user_id: userId, image_url: image })
      .select('id')
      .single();
    if (error || !data) {
      console.error('[Supabase] image insert failed:', error?.message);
      return null;
    }
    setCurrentImageId(data.id);
    return data.id;
  };

  const handleNextStep = async () => {
    if (input.trim().length < MIN_INPUT_LENGTH || isLoading) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      const result = await getEnglishFeedback(input, controller.signal, imageBase64Ref.current);
      if (controller.signal.aborted) return;

      if (result.apiError) {
        setIsCorrect(false);
        setFeedback({ apiError: true });
      } else {
        setIsCorrect(result.score >= 75);
        setFeedback({ ...result });
      }

      // 写真 → 英語入力 → 添削 → Supabase 保存（全ての写真ソースで保存する）
      if (!result.apiError && userId) {
        try {
          const imageId = await ensureImageId();
          if (imageId) {
            const { error } = await supabase.from('learning_histories').insert({
              user_id: userId,
              image_id: imageId,
              input_text: input,
              feedback_text: result.feedback || '',
              advice_text: result.suggestion || '',
              score: result.score || 0,
              grammar_points: result.grammarPoints || [],
              alternatives: result.alternatives || [],
              learned_at: new Date().toISOString(),
            });
            if (error) console.error('[Supabase] history insert failed:', error.message);
          }
        } catch (e) {
          console.error('[Supabase] save error:', e.message);
        }
      }
      setStep(3);
    } finally {
      setIsLoading(false);
    }
  };

  const flipToNextAsset = async (asset) => {
    Animated.timing(flipAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start(async () => {
      const info = await MediaLibrary.getAssetInfoAsync(asset.id);
      const uri = info.localUri || asset.uri;
      setImage(uri);
      setImageDate(new Date(asset.creationTime).toLocaleDateString('ja-JP'));
      flipAnim.setValue(0);
      prepareImageBase64(uri);
    });
  };

  const flipToNextUrl = (url) => {
    Animated.timing(flipAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => {
      setImage(url);
      setImageDate(new Date().toLocaleDateString('ja-JP'));
      flipAnim.setValue(0);
      prepareImageBase64(url);
    });
  };

  const getNextPhoto = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    imageBase64Ref.current = null;
    setIsLoading(false);
    setCurrentImageId(null);
    // デバイス写真優先（毎回ランダムに変わる）、なければ新しい picsum を生成
    if (assets.length > 0) {
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
                  disabled={input.trim().length < MIN_INPUT_LENGTH || isLoading}
                  style={[
                    styles.confirmBtn,
                    (input.trim().length < MIN_INPUT_LENGTH || isLoading) && { backgroundColor: '#e5e7eb' },
                  ]}
                >
                  <Text
                    style={[
                      styles.confirmBtnText,
                      (input.trim().length < MIN_INPUT_LENGTH || isLoading) && { color: '#9ca3af' },
                    ]}
                  >
                    {isLoading ? '採点中... ⏳' : '確認する ✓'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 3 */}
          {step === 3 && feedback && (
            <View style={styles.feedbackContainer}>
              {feedback.apiError ? (
                <View style={[styles.feedbackBox, { borderLeftColor: '#f87171' }]}>
                  <View style={styles.feedbackHeader}>
                    <Text style={{ fontSize: 24, marginRight: 8 }}>⚠️</Text>
                    <Text style={styles.feedbackTitle}>接続に失敗しました</Text>
                  </View>
                  <Text style={styles.errorText}>
                    Gemini への接続に失敗しました。ネットワークを確認して、もう一度「確認する」を押してください。
                  </Text>
                  <View style={styles.feedbackButtons}>
                    <TouchableOpacity style={styles.nextPhotoBtn} onPress={() => setStep(2)}>
                      <Text style={styles.nextPhotoText}>もう一度試す 🔄</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={[styles.feedbackBox, isCorrect ? { borderLeftColor: '#4ade80' } : { borderLeftColor: '#fb923c' }]}>
                  <View style={styles.feedbackHeader}>
                    <Text style={{ fontSize: 24, marginRight: 8 }}>{isCorrect ? '🎉' : '💪'}</Text>
                    <Text style={styles.feedbackTitle}>{isCorrect ? 'Great Job!' : 'Good Try!'}</Text>
                    <View style={styles.scoreBadge}>
                      <Text style={styles.scoreBadgeText}>{feedback.score}点</Text>
                    </View>
                  </View>
                  <View style={{ gap: 12 }}>
                    {/* ① あなたの表現 */}
                    <View style={styles.yourExpressionBox}>
                      <Text style={styles.yourExpressionLabel}>✨ あなたの表現</Text>
                      <Text style={styles.yourExpressionText}>"{input}"</Text>
                    </View>

                    {/* ① 修正ポイント＋補足を1枠にまとめる */}
                    <View style={styles.pointsBox}>
                      <Text style={styles.pointsLabel}>📝 修正ポイント</Text>
                      {feedback.grammarPoints && feedback.grammarPoints.length > 0 ? (
                        feedback.grammarPoints.map((p, i) => (
                          <View key={i} style={styles.pointRow}>
                            <Text style={styles.pointBullet}>•</Text>
                            <Text style={styles.pointText}>{p}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.perfectText}>完璧です！直すところはありません 🎉</Text>
                      )}
                      {feedback.feedback ? (
                        <View style={styles.feedbackSubBox}>
                          <Text style={styles.feedbackSubText}>{feedback.feedback}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* ① 参考表現：ネイティブ言い回し優先、文法修正版を含めて最大2つ */}
                    {((feedback.alternatives && feedback.alternatives.length > 0) || feedback.suggestion) ? (
                      <View style={styles.refBox}>
                        <Text style={styles.refLabel}>🗽 ネイティブならこう言う</Text>
                        {feedback.alternatives && feedback.alternatives.length > 0 ? (
                          feedback.alternatives.slice(0, 2).map((alt, i) => (
                            <View key={i} style={styles.refItem}>
                              <Text style={styles.refBullet}>›</Text>
                              <Text style={styles.refText}>"{alt}"</Text>
                            </View>
                          ))
                        ) : feedback.suggestion ? (
                          <View style={styles.refItem}>
                            <Text style={styles.refBullet}>›</Text>
                            <Text style={styles.refText}>"{feedback.suggestion}"</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  {/* ② ボタンとコンテンツの間に余白 */}
                  <View style={{ height: 20 }} />
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
                    <TouchableOpacity style={styles.reviewBtn} onPress={() => navigation.navigate('History')}>
                      <Text style={styles.reviewText}>復習する 📚</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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
  feedbackSubBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#fed7aa',
  },
  feedbackSubText: {
    color: '#9a3412',
    fontSize: 13,
    lineHeight: 18,
  },
  refBox: {
    backgroundColor: '#ecfdf5',
    borderColor: '#6ee7b7',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  refLabel: {
    color: '#065f46',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  refItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  refBullet: {
    color: '#059669',
    fontWeight: 'bold',
    marginRight: 6,
    fontSize: 16,
    lineHeight: 22,
  },
  refText: {
    flex: 1,
    color: '#064e3b',
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 22,
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
  scoreBadge: {
    marginLeft: 'auto',
    backgroundColor: '#eef2ff',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  scoreBadgeText: {
    color: '#4338ca',
    fontWeight: 'bold',
  },
  pointsBox: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  pointsLabel: {
    color: '#c2410c',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  pointBullet: {
    color: '#ea580c',
    fontWeight: 'bold',
    marginRight: 6,
    lineHeight: 22,
  },
  pointText: {
    flex: 1,
    color: '#9a3412',
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 22,
  },
  perfectText: {
    color: '#15803d',
    fontWeight: '600',
  },
  altBox: {
    backgroundColor: '#ecfeff',
    borderColor: '#a5f3fc',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  altLabel: {
    color: '#0e7490',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  altText: {
    color: '#155e75',
    fontStyle: 'italic',
    marginTop: 2,
  },
  errorText: {
    color: '#b91c1c',
    marginTop: 4,
    lineHeight: 20,
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
