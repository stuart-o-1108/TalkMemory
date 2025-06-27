import React, { useState } from 'react';
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

export default function DetailScreen() {
  const [activeTab, setActiveTab] = useState('expressions');
  const [showTranslation, setShowTranslation] = useState({});

  const [sessionData] = useState({
    id: 1,
    date: '2025-06-26',
    photo:
      'https://via.placeholder.com/400x300/4ade80/ffffff?text=Beautiful+Memory',
    originalExpressions: [
      {
        id: 1,
        original: 'I was so happy',
        corrected: 'I felt incredibly happy',
        translation: 'とても幸せでした',
        aiAdvice:
          'より感情的なニュアンスを表現するために "felt incredibly" を使うとより自然になります。',
        score: 85,
        grammarPoints: ['感情表現の強調', 'より自然な語順'],
        alternatives: [
          'I was absolutely delighted',
          'I was overjoyed',
          'I felt tremendously happy',
        ],
      },
      {
        id: 2,
        original: 'This moment is great',
        corrected: 'This moment was amazing',
        translation: 'この瞬間は最高でした',
        aiAdvice:
          '過去の出来事なので過去形を使い、"great"より"amazing"の方が感動的です。',
        score: 90,
        grammarPoints: ['時制の統一', '語彙の豊富さ'],
        alternatives: [
          'This moment was wonderful',
          'This was an incredible moment',
          'What an amazing moment this was',
        ],
      },
      {
        id: 3,
        original: 'I remember this day good',
        corrected: 'I remember this day fondly',
        translation: 'この日をよく覚えています',
        aiAdvice:
          '"good"は副詞として使う場合"well"になりますが、"fondly"がより適切で感情的です。',
        score: 75,
        grammarPoints: ['副詞の使い方', '感情表現'],
        alternatives: [
          'I have fond memories of this day',
          'This day holds special memories',
          'I cherish this day',
        ],
      },
    ],
    sessionStats: {
      totalExpressions: 3,
      averageScore: 83,
      timeSpent: '12分',
      completedAt: '14:30',
    },
    emotion: 'joy',
    tags: ['家族', '休日', '公園'],
  });

  const toggleTranslation = (id) => {
    setShowTranslation((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getScoreColor = (score) => {
    if (score >= 90) return styles.scoreExcellent;
    if (score >= 75) return styles.scoreGood;
    if (score >= 60) return styles.scoreOkay;
    return styles.scoreBad;
  };

  const getEmotionEmoji = (emotion) => {
    const emojiMap = {
      joy: '😊',
      excitement: '🤩',
      contentment: '😌',
      sadness: '😢',
      anger: '😠',
      surprise: '😲',
    };
    return emojiMap[emotion] || '😊';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => {}}>
            <Text style={styles.back}>&larr; 履歴に戻る</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>学習詳細</Text>
            <Text style={styles.headerDate}>{sessionData.date}</Text>
          </View>
        </View>

        <View style={styles.photoBox}>
          <View style={styles.photoOverlay}>
            <View style={styles.emotionBox}>
              <Text style={styles.emotionEmoji}>{getEmotionEmoji(sessionData.emotion)}</Text>
              <Text style={styles.emotionText}>喜び</Text>
            </View>
          </View>
          <Image source={{ uri: sessionData.photo }} style={styles.photo} />
          <View style={styles.tagRow}>
            {sessionData.tags.map((tag) => (
              <Text key={tag} style={styles.tag}>
                #{tag}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.statsBox}>
          <Text style={styles.statsTitle}>セッション統計</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{sessionData.sessionStats.totalExpressions}</Text>
              <Text style={styles.statLabel}>表現数</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#16a34a' }]}>{sessionData.sessionStats.averageScore}%</Text>
              <Text style={styles.statLabel}>平均スコア</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#7c3aed' }]}>{sessionData.sessionStats.timeSpent}</Text>
              <Text style={styles.statLabel}>学習時間</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#ea580c' }]}>{sessionData.sessionStats.completedAt}</Text>
              <Text style={styles.statLabel}>完了時刻</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabsRow}>
          {[
            { key: 'expressions', label: '表現一覧' },
            { key: 'analysis', label: '分析' },
            { key: 'practice', label: '復習' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabButton,
                activeTab === tab.key && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'expressions' && (
          <View style={styles.expressionsBox}>
            {sessionData.originalExpressions.map((exp, idx) => (
              <View key={exp.id} style={styles.expressionCard}>
                <View style={styles.expressionHeader}>
                  <View style={styles.expressionIndexBox}>
                    <Text style={styles.expressionIndex}>{idx + 1}</Text>
                  </View>
                  <View style={styles.expressionInfo}>
                    <Text style={styles.expressionTitle}>表現 {idx + 1}</Text>
                    <Text style={styles.expressionPoints}>
                      学習ポイント: {exp.grammarPoints.join(', ')}
                    </Text>
                  </View>
                  <View style={[styles.scoreBox, getScoreColor(exp.score)]}>
                    <Text style={styles.scoreText}>{exp.score}%</Text>
                  </View>
                </View>

                <View style={styles.originalBox}>
                  <View style={styles.originalHeader}>
                    <Text style={styles.originalLabel}>あなたの表現</Text>
                    <TouchableOpacity onPress={() => toggleTranslation(exp.id)}>
                      <Text style={styles.toggleTrans}>
                        {showTranslation[exp.id] ? '翻訳を隠す' : '日本語で見る'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.originalText}>“{exp.original}”</Text>
                  {showTranslation[exp.id] && (
                    <Text style={styles.translationText}>「{exp.translation}」</Text>
                  )}
                </View>

                <View style={styles.correctBox}>
                  <Text style={styles.correctLabel}>改善版</Text>
                  <Text style={styles.correctText}>“{exp.corrected}”</Text>
                </View>

                <View style={styles.adviceBox}>
                  <Text style={styles.adviceLabel}>AIからのアドバイス</Text>
                  <Text style={styles.adviceText}>{exp.aiAdvice}</Text>
                </View>

                <View style={styles.altBox}>
                  <Text style={styles.altLabel}>他の表現方法</Text>
                  {exp.alternatives.map((alt, i) => (
                    <Text key={i} style={styles.altText}>“{alt}”
                    </Text>
                  ))}
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>復習に追加</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.actionButtonGreen]}>
                    <Text style={styles.actionButtonText}>もう一度練習</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'analysis' && (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>分析内容をここに表示</Text>
          </View>
        )}

        {activeTab === 'practice' && (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>復習機能は未実装です</Text>
          </View>
        )}
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
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 16,
  },
  tabButtonActive: {
    backgroundColor: '#4338ca',
  },
  tabText: {
    color: '#64748B',
    fontWeight: 'bold',
  },
  tabTextActive: {
    color: '#fff',
  },
  expressionsBox: {
    gap: 16,
  },
  expressionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  expressionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  expressionIndexBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  expressionIndex: {
    color: '#fff',
    fontWeight: 'bold',
  },
  expressionInfo: {
    flex: 1,
  },
  expressionTitle: {
    fontWeight: 'bold',
    color: '#334155',
  },
  expressionPoints: {
    fontSize: 12,
    color: '#64748B',
  },
  scoreBox: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scoreText: {
    fontWeight: 'bold',
    fontSize: 12,
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
    marginBottom: 8,
  },
  originalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  originalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
  },
  toggleTrans: {
    fontSize: 12,
    color: '#2563EB',
  },
  originalText: {
    color: '#1E293B',
    fontWeight: '500',
  },
  translationText: {
    marginTop: 4,
    fontSize: 12,
    fontStyle: 'italic',
    color: '#475569',
  },
  correctBox: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#93C5FD',
    borderRadius: 8,
    marginBottom: 8,
  },
  correctLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  correctText: {
    color: '#1E3A8A',
  },
  adviceBox: {
    backgroundColor: '#F5F3FF',
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#C4B5FD',
    borderRadius: 8,
    marginBottom: 8,
  },
  adviceLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6B21A8',
    marginBottom: 4,
  },
  adviceText: {
    color: '#6B21A8',
  },
  altBox: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    marginTop: 8,
  },
  altLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 4,
  },
  altText: {
    fontSize: 12,
    color: '#047857',
    marginBottom: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonGreen: {
    backgroundColor: '#22C55E',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  placeholderBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  placeholderText: {
    color: '#64748B',
  },
});