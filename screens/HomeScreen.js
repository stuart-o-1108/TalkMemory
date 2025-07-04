import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';

export default function HomeScreen({ navigation }) {
  const [userStats] = useState({
    streak: 7,
    totalSessions: 45,
    weeklyGoal: 5,
    completedThisWeek: 3,
    level: 12,
    xp: 2450,
  });

  const [recentPhotos, setRecentPhotos] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: imgs } = await supabase
        .from('images')
        .select('id, image_url, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      const { data: histories } = await supabase
        .from('learning_histories')
        .select('image_id')
        .eq('user_id', user.id);

      const countMap = {};
      (histories || []).forEach((h) => {
        countMap[h.image_id] = (countMap[h.image_id] || 0) + 1;
      });

      setRecentPhotos(
        (imgs || []).map((img) => ({
          id: img.id,
          uri: img.image_url,
          date: new Date(img.created_at).toLocaleDateString('ja-JP'),
          expressions: countMap[img.id] || 0,
        }))
      );
    };
    fetchData();
  }, []);

  const progressPercentage =
    (userStats.completedThisWeek / userStats.weeklyGoal) * 100;

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
          <LinearGradient
            colors={["#fb923c", "#ef4444"]}
            style={styles.statCard}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>🔥</Text>
              <Text style={styles.cardTitle}>連続学習</Text>
            </View>
            <Text style={styles.cardValue}>{userStats.streak}日</Text>
          </LinearGradient>

          <LinearGradient
            colors={["#4ade80", "#10b981"]}
            style={styles.statCard}
          >
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
              {userStats.completedThisWeek}/{userStats.weeklyGoal}回
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={["#60a5fa", "#a78bfa"]}
              style={[styles.progressBarFill, { width: `${Math.min(progressPercentage, 100)}%` }]}
            />
          </View>
          <View style={styles.progressDotsRow}>
            {Array.from({ length: 7 }).map((_, index) => (
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

        {/* Recent Learning */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>最近の学習</Text>
          <TouchableOpacity>
            <Text style={styles.sectionLink}>すべて見る</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
          {recentPhotos.map((photo) => (
            <TouchableOpacity key={photo.id} style={styles.photoCard}>
              <Image source={{ uri: photo.uri }} style={styles.photoImage} />
              <Text style={styles.photoDate}>{photo.date}</Text>
              <Text style={styles.photoExp}>{photo.expressions}個の表現</Text>
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
          <TouchableOpacity style={styles.quickCard}>
            <Text style={styles.quickIcon}>🎯</Text>
            <Text style={styles.quickText}>目標設定</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard}>
            <Text style={styles.quickIcon}>🏆</Text>
            <Text style={styles.quickText}>実績</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 12,
  },
  sectionLink: { color: '#3B82F6', fontWeight: '600' },
  photoScroll: { marginBottom: 24 },
  photoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    marginRight: 12,
    width: 120,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  photoImage: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    marginBottom: 6,
  },
  photoDate: { fontSize: 12, color: '#64748B', marginBottom: 2 },
  photoExp: { fontSize: 12, color: '#2563EB', fontWeight: '600' },
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
});
