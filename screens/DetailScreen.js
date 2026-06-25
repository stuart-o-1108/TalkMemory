import React, { useState, useEffect } from 'react';
import {
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function DetailScreen({ route, navigation }) {
  const [showTranslation] = useState({});
  const [sessionData, setSessionData] = useState({
    id: null,
    date: '',
    photo: '',
    originalExpressions: [],
    sessionStats: {
      totalExpressions: 0,
      averageScore: 0,
      timeSpent: '',
      completedAt: '',
    },
    emotion: '',
    tags: [],
  });

  useEffect(() => {
    const load = async () => {
      const id = route?.params?.historyId;
      if (!id) return;
      const { data, error } = await supabase
        .from('learning_histories')
        .select('*, image:images(image_url)')
        .eq('id', id)
        .single();
      if (!error && data) {
        setSessionData({
          id: data.id,
          date: new Date(data.learned_at).toLocaleDateString('ja-JP'),
          photo: data.image?.image_url,
          originalExpressions: [
            {
              id: data.id,
              original: data.input_text,
              corrected: data.advice_text,
              translation: '',
              aiAdvice: data.feedback_text,
              score: data.score || 0,
              grammarPoints: data.grammar_points || [],
              alternatives: data.alternatives || [],
            },
          ],
          sessionStats: {
            totalExpressions: 1,
            averageScore: data.score || 0,
            timeSpent: '—',
            completedAt: data.learned_at
              ? new Date(data.learned_at).toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—',
          },
          emotion: '',
          tags: [],
        });
      }
    };
    load();
  }, [route?.params?.historyId]);

  const getScoreColor = (score) => {
    if (score >= 90) return styles.scoreExcellent;
    if (score >= 75) return styles.scoreGood;
    if (score >= 60) return styles.scoreOkay;
    return styles.scoreBad;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>&larr; 履歴に戻る</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>学習詳細</Text>
            <Text style={styles.headerDate}>{sessionData.date}</Text>
          </View>
        </View>

        {/* ④ 写真はクエリで取得した sessionData.photo を使う（履歴ごとに一致） */}
        <View style={styles.photoBox}>
          <Image source={{ uri: sessionData.photo }} style={styles.photo} />
        </View>

        {/* ⑤ 学習時間・完了時刻を削除し、表現数とスコアのみ */}
        <View style={styles.statsBox}>
          <Text style={styles.statsTitle}>セッション統計</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{sessionData.sessionStats.totalExpressions}</Text>
              <Text style={styles.statLabel}>表現数</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#16a34a' }]}>{sessionData.sessionStats.averageScore}%</Text>
              <Text style={styles.statLabel}>スコア</Text>
            </View>
          </View>
        </View>

        <View style={styles.expressionsBox}>
          {sessionData.originalExpressions.map((exp) => (
            <View key={exp.id} style={styles.expressionCard}>
              <View style={styles.scoreCenterRow}>
                <View style={[styles.scoreBox, getScoreColor(exp.score)]}>
                  <Text style={styles.scoreText}>{exp.score}%</Text>
                </View>
              </View>

              <View style={styles.originalBox}>
                <Text style={styles.originalLabel}>あなたの表現</Text>
                <Text style={styles.originalText}>”{exp.original}”</Text>
              </View>

              {exp.alternatives && exp.alternatives.length > 0 && (
                <View style={styles.nativeBox}>
                  <Text style={styles.nativeLabel}>🗽 ネイティブならこう言う</Text>
                  {exp.alternatives.map((alt, i) => (
                    <Text key={i} style={styles.nativeText}>”{alt}”</Text>
                  ))}
                </View>
              )}

              {exp.grammarPoints && exp.grammarPoints.length > 0 && (
                <View style={styles.grammarBox}>
                  <Text style={styles.grammarLabel}>📝 修正ポイント</Text>
                  {exp.grammarPoints.map((p, i) => (
                    <View key={i} style={styles.grammarRow}>
                      <Text style={styles.grammarBullet}>•</Text>
                      <Text style={styles.grammarText}>{p}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: '#EEF2FF',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  back: {
    color: '#2563eb',
    fontSize: 16,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#334155',
  },
  headerDate: {
    color: '#64748B',
    fontSize: 12,
  },
  photoBox: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  photoOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
  },
  emotionBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    alignItems: 'center',
    marginRight: 4,
  },
  emotionEmoji: {
    marginRight: 2,
    fontSize: 16,
  },
  emotionText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: 'bold',
  },
  photo: {
    width: '100%',
    height: 200,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 4,
  },
  tag: {
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
    fontSize: 12,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  statsBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    marginBottom: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  expressionsBox: {
    gap: 16,
  },
  expressionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  scoreCenterRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  scoreBox: {
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  scoreText: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  scoreExcellent: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
  },
  scoreGood: {
    backgroundColor: '#DBEAFE',
    color: '#1E40AF',
  },
  scoreOkay: {
    backgroundColor: '#FEF9C3',
    color: '#92400E',
  },
  scoreBad: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  originalBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#CBD5E1',
    borderRadius: 8,
  },
  originalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 4,
  },
  originalText: {
    color: '#1E293B',
    fontWeight: '500',
  },
  nativeBox: {
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6ee7b7',
    borderRadius: 8,
  },
  nativeLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#065f46',
    marginBottom: 6,
  },
  nativeText: {
    fontSize: 13,
    color: '#064e3b',
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 20,
  },
  grammarBox: {
    backgroundColor: '#fff7ed',
    borderLeftWidth: 4,
    borderLeftColor: '#fb923c',
    borderRadius: 8,
    padding: 12,
  },
  grammarLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#c2410c',
    marginBottom: 6,
  },
  grammarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  grammarBullet: {
    color: '#ea580c',
    fontWeight: 'bold',
    marginRight: 6,
    lineHeight: 20,
  },
  grammarText: {
    flex: 1,
    color: '#9a3412',
    fontSize: 13,
    lineHeight: 20,
  },
});
