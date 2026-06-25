import React, { useState, useEffect } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import { getDeviceUserId } from '../lib/deviceId';

const WEEKLY_GOAL_KEY = 'weekly_goal';
const XP_PER_SESSION = 50;
const XP_PER_LEVEL = 500;

// ローカル日付（YYYY-MM-DD）を返す。toISOString は UTC でずれるため自前で組む。
const dayKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// 月曜始まりの今週の開始日（YYYY-MM-DD）を返す
const startOfCurrentWeek = () => {
  const now = new Date();
  const day = now.getDay(); // 0=日, 1=月, ..., 6=土
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(monday.getDate() - daysFromMonday);
  return dayKey(monday);
};

// 学習した日付の集合から、今日（または昨日）から遡る連続学習日数を数える。
const computeStreak = (uniqueDayKeys) => {
  const set = new Set(uniqueDayKeys);
  const cursor = new Date();
  if (!set.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(dayKey(cursor))) return 0;
  }
  let streak = 0;
  while (set.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

export default function HomeScreen({ navigation }) {
  const [weeklyGoal, setWeeklyGoalState] = useState(5);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [userStats, setUserStats] = useState({
    streak: 0,
    totalSessions: 0,
    completedThisWeek: 0,
    level: 1,
    xp: 0,
  });
  const [recentSessions, setRecentSessions] = useState([]);

  const saveAndSetGoal = async (goal) => {
    await SecureStore.setItemAsync(WEEKLY_GOAL_KEY, String(goal));
    setWeeklyGoalState(goal);
    setGoalModalVisible(false);
  };

  useEffect(() => {
    SecureStore.getItemAsync(WEEKLY_GOAL_KEY).then((stored) => {
      if (stored) setWeeklyGoalState(parseInt(stored, 10));
    });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const uid = await getDeviceUserId();
      const { data: histories } = await supabase
        .from('learning_histories')
        .select('image_id, learned_at, score, image:images(image_url)')
        .eq('user_id', uid)
        .order('learned_at', { ascending: false });

      // 学習日ごとにまとめてセッションカードを作成
      const sessionMap = {};
      (histories || []).forEach((h) => {
        if (!h.learned_at) return;
        const dk = dayKey(new Date(h.learned_at));
        if (!sessionMap[dk]) {
          sessionMap[dk] = {
            date: dk,
            displayDate: new Date(h.learned_at).toLocaleDateString('ja-JP'),
            count: 0,
            photos: [],
          };
        }
        sessionMap[dk].count++;
        if (sessionMap[dk].photos.length < 3 && h.image?.image_url) {
          sessionMap[dk].photos.push(h.image.image_url);
        }
      });
      setRecentSessions(
        Object.values(sessionMap).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
      );

      const list = histories || [];
      const dayKeys = list
        .filter((h) => h.learned_at)
        .map((h) => dayKey(new Date(h.learned_at)));
      const uniqueDays = Array.from(new Set(dayKeys));

      // XP: 1セッション（1枚の写真で英文添削完了）= 50 XP
      const xp = list.length * XP_PER_SESSION;

      // 今週（月〜日）に学習した日数
      const weekStart = startOfCurrentWeek();
      const todayKey = dayKey(new Date());
      const completedThisWeek = uniqueDays.filter(
        (k) => k >= weekStart && k <= todayKey
      ).length;

      setUserStats({
        streak: computeStreak(uniqueDays),
        totalSessions: list.length,
        completedThisWeek,
        level: Math.floor(xp / XP_PER_LEVEL) + 1,
        xp,
      });
    };
    fetchData();
  }, []);

  const progressPercentage = (userStats.completedThisWeek / weeklyGoal) * 100;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.hello}>こんにちは！</Text>
            <Text style={styles.subHello}>今日も一緒に学習しましょう</Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <Text style={styles.profileIcon}>👤</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <LinearGradient colors={["#fb923c", "#ef4444"]} style={styles.statCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>🔥</Text>
              <Text style={styles.cardTitle}>連続学習</Text>
            </View>
            <Text style={styles.cardValue}>{userStats.streak}日</Text>
          </LinearGradient>

          <LinearGradient colors={["#4ade80", "#10b981"]} style={styles.statCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>⭐</Text>
              <Text style={styles.cardTitle}>レベル</Text>
            </View>
            <Text style={styles.cardValue}>{userStats.level}</Text>
          </LinearGradient>
        </View>

        {/* Weekly Progress */}
        <View style={styles.weeklyBox}>
          <View style={styles.weeklyHeader}>
            <Text style={styles.weeklyTitle}>今週の目標</Text>
            <Text style={styles.weeklyCount}>
              {userStats.completedThisWeek}/{weeklyGoal}日
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={["#60a5fa", "#a78bfa"]}
              style={[styles.progressBarFill, { width: `${Math.min(progressPercentage, 100)}%` }]}
            />
          </View>
          <View style={styles.progressDotsRow}>
            {Array.from({ length: weeklyGoal }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index < userStats.completedThisWeek && styles.progressDotActive,
                ]}
              >
                <Text
                  style={[
                    styles.progressDotText,
                    index < userStats.completedThisWeek && styles.progressDotTextActive,
                  ]}
                >
                  {index + 1}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Main Action Button */}
        <TouchableOpacity
          style={styles.mainButton}
          onPress={() => navigation.navigate('Learning')}
        >
          <Text style={styles.mainButtonIcon}>📸</Text>
          <Text style={styles.mainButtonText}>今日の写真で学習開始</Text>
          <Text style={styles.mainButtonSub}>思い出を英語で表現してみよう</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>最近の学習</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
          {recentSessions.map((session) => (
            <TouchableOpacity
              key={session.date}
              style={styles.sessionCard}
              onPress={() => navigation.navigate('History', { filterDate: session.date })}
            >
              <View style={styles.sessionThumbRow}>
                {session.photos.length === 0 ? (
                  <View style={[styles.sessionThumb, { backgroundColor: '#e2e8f0' }]} />
                ) : (
                  session.photos.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={styles.sessionThumb} />
                  ))
                )}
              </View>
              <Text style={styles.sessionDate}>{session.displayDate}</Text>
              <Text style={styles.sessionCount}>{session.count}個の表現</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>クイックアクション</Text>
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => navigation.navigate('History')}
          >
            <Text style={styles.quickIcon}>📚</Text>
            <Text style={styles.quickText}>学習履歴</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => setGoalModalVisible(true)}>
            <Text style={styles.quickIcon}>🎯</Text>
            <Text style={styles.quickText}>目標設定</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard}>
            <Text style={styles.quickIcon}>🏆</Text>
            <Text style={styles.quickText}>実績</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Weekly Goal Modal */}
      <Modal
        visible={goalModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGoalModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setGoalModalVisible(false)}
        >
          <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>週間目標を設定</Text>
            <Text style={styles.modalSub}>毎週月曜日にリセットされます</Text>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.goalOption, weeklyGoal === n && styles.goalOptionActive]}
                onPress={() => saveAndSetGoal(n)}
              >
                <Text style={[styles.goalOptionText, weeklyGoal === n && styles.goalOptionTextActive]}>
                  週 {n} 日
                </Text>
                {weeklyGoal === n && <Text style={styles.goalCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  hello: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#334155',
  },
  subHello: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 4,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  profileIcon: { fontSize: 24 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardIcon: { fontSize: 20, marginRight: 4, color: '#fff' },
  cardTitle: { fontSize: 14, color: '#fff', fontWeight: '600' },
  cardValue: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  weeklyBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  weeklyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  weeklyTitle: { fontSize: 18, fontWeight: 'bold', color: '#334155' },
  weeklyCount: { fontSize: 14, color: '#64748B' },
  progressBarBg: {
    backgroundColor: '#E5E7EB',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  progressDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    backgroundColor: '#60a5fa',
  },
  progressDotText: { fontSize: 12, color: '#9CA3AF' },
  progressDotTextActive: { color: '#fff', fontWeight: 'bold' },
  mainButton: {
    backgroundColor: '#6366F1',
    borderRadius: 20,
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  mainButtonIcon: { fontSize: 28, marginBottom: 8, color: '#fff' },
  mainButtonText: { fontSize: 20, color: '#fff', fontWeight: 'bold' },
  mainButtonSub: { fontSize: 14, color: '#e0e7ff', marginTop: 4 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 12,
  },
  photoScroll: { marginBottom: 24 },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    marginRight: 12,
    width: 150,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sessionThumbRow: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 6,
  },
  sessionThumb: {
    flex: 1,
    height: 72,
    borderRadius: 6,
  },
  sessionDate: { fontSize: 11, color: '#64748B', marginBottom: 2 },
  sessionCount: { fontSize: 12, color: '#2563EB', fontWeight: '600' },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  quickIcon: { fontSize: 24, marginBottom: 4 },
  quickText: { fontSize: 14, fontWeight: '600', color: '#334155' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
  },
  goalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f1f5f9',
  },
  goalOptionActive: {
    backgroundColor: '#e0e7ff',
  },
  goalOptionText: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '500',
  },
  goalOptionTextActive: {
    color: '#6366F1',
    fontWeight: 'bold',
  },
  goalCheck: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: 'bold',
  },
});
