import React, { useState } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';

export default function HistoryScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');

  const [historyData] = useState([
    {
      id: 1,
      date: '2025-06-26',
      photo: 'https://via.placeholder.com/80x80/4ade80/ffffff?text=Photo1',
      expressions: [
        { original: 'I was so happy', corrected: 'I felt incredibly happy', score: 85 },
        { original: 'This moment is great', corrected: 'This moment was amazing', score: 90 }
      ],
      totalScore: 87,
      emotion: 'joy'
    },
    {
      id: 2,
      date: '2025-06-25',
      photo: 'https://via.placeholder.com/80x80/60a5fa/ffffff?text=Photo2',
      expressions: [
        { original: 'I feel excited about this', corrected: 'I felt excited about this moment', score: 95 }
      ],
      totalScore: 95,
      emotion: 'excitement'
    },
    {
      id: 3,
      date: '2025-06-24',
      photo: 'https://via.placeholder.com/80x80/f472b6/ffffff?text=Photo3',
      expressions: [
        { original: 'It was good day', corrected: 'It was a good day', score: 75 },
        { original: 'I enjoyed with friends', corrected: 'I enjoyed time with friends', score: 80 },
        { original: 'Very fun experience', corrected: 'It was a very fun experience', score: 85 }
      ],
      totalScore: 80,
      emotion: 'contentment'
    }
  ]);

  const [stats] = useState({
    totalSessions: 45,
    averageScore: 87
  });

  const getEmotionEmoji = (emotion) => {
    const emojiMap = {
      joy: '😊',
      excitement: '🤩',
      contentment: '😌',
      sadness: '😢',
      anger: '😠',
      surprise: '😲'
    };
    return emojiMap[emotion] || '😊';
  };

  const getScoreStyle = (score) => {
    if (score >= 90) return { backgroundColor: '#D1FAE5', color: '#047857' };
    if (score >= 75) return { backgroundColor: '#DBEAFE', color: '#1E40AF' };
    if (score >= 60) return { backgroundColor: '#FEF3C7', color: '#92400E' };
    return { backgroundColor: '#FEE2E2', color: '#991B1B' };
  };

  const filteredHistory = historyData.filter(item =>
    item.expressions.some(exp =>
      exp.original.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.corrected.toLowerCase().includes(searchQuery.toLowerCase())
    ) || item.date.includes(searchQuery)
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Text style={styles.logo} onPress={() => navigation.navigate('Home')}>MemoryTalk</Text>
        </View>

        <Text style={styles.title}>学習履歴</Text>

        <TextInput
          style={styles.searchInput}
          placeholder="学習内容を検索..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#2563EB' }]}>{stats.totalSessions}</Text>
            <Text style={styles.statLabel}>総学習回数</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>{stats.averageScore}%</Text>
            <Text style={styles.statLabel}>平均スコア</Text>
          </View>
        </View>

        <View style={styles.tabsRow}>
          {[
            { key: 'recent', label: '最近', icon: '🕒' },
            { key: 'favorites', label: 'お気に入り', icon: '⭐' }
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabButton,
                activeTab === tab.key && styles.tabButtonActive
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.icon} {tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredHistory.map(item => {
          const scoreStyle = getScoreStyle(item.totalScore);
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.photoWrapper}>
                  <Image source={{ uri: item.photo }} style={styles.photo} />
                  <View style={styles.emojiBadge}>
                    <Text>{getEmotionEmoji(item.emotion)}</Text>
                  </View>
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.date}>{item.date}</Text>
                  <Text style={styles.exprCount}>{item.expressions.length}個の表現を学習</Text>
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: scoreStyle.backgroundColor }]}> 
                  <Text style={{ color: scoreStyle.color, fontWeight: 'bold' }}>{item.totalScore}%</Text>
                </View>
              </View>

              <View style={styles.expressions}> 
                {item.expressions.slice(0,2).map((exp, index) => {
                  const expStyle = getScoreStyle(exp.score);
                  return (
                    <View key={index} style={styles.expBox}>
                      <View style={styles.expHeader}>
                        <Text style={styles.expLabel}>あなたの表現</Text>
                        <Text style={[styles.expScore, { backgroundColor: expStyle.backgroundColor, color: expStyle.color }]}>{exp.score}%</Text>
                      </View>
                      <Text style={styles.expText}>"{exp.original}"</Text>
                      <Text style={styles.expLabel}>改善版</Text>
                      <Text style={styles.expCorrect}>"{exp.corrected}"</Text>
                    </View>
                  );
                })}
                {item.expressions.length > 2 && (
                  <Text style={styles.moreText}>+{item.expressions.length - 2}個の表現を見る</Text>
                )}
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.detailButton, styles.singleButton]}
                  onPress={() => navigation.navigate('Detail', { item: { image: item.photo, text: item.expressions[0]?.corrected || '' } })}
                >
                  <Text style={styles.actionText}>詳細を見る</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerRow: {
    marginBottom: 10,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0EA5E9',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statBox: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: '#4F46E5',
  },
  tabText: {
    fontWeight: 'bold',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  emojiBadge: {
    position: 'absolute',
    right: -6,
    top: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  headerText: {
    flex: 1,
  },
  date: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  exprCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expressions: {
    marginBottom: 12,
  },
  expBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  expHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  expLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: 'bold',
  },
  expScore: {
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  expText: {
    color: '#374151',
    marginBottom: 6,
  },
  expCorrect: {
    color: '#1D4ED8',
    fontWeight: '500',
  },
  moreText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  detailButton: {
    backgroundColor: '#6366F1',
    marginRight: 8,
  },
  practiceButton: {
    backgroundColor: '#10B981',
    marginLeft: 8,
  },
  singleButton: {
    marginLeft: 0,
    marginRight: 0,
  },
  actionText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});