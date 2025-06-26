// HistoryScreen.js
import {
  FlatList,
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const dummyData = [
  {
    id: '1',
    image: 'https://placekitten.com/300/300',
    text: 'I felt relaxed at the beach',
  },
  {
    id: '2',
    image: 'https://placekitten.com/300/301',
    text: 'That day was really exciting!',
  },
  {
    id: '3',
    image: 'https://placekitten.com/300/302',
    text: 'I was so happy with my friends!',
  },
];

export default function HistoryScreen({ navigation }) {
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('Detail', { item })}
    >
      <Image source={{ uri: item.image }} style={styles.image} />
      <Text style={styles.text} numberOfLines={2}>{item.text}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.logo} onPress={() => navigation.navigate('Home')}>
          MemoryTalk
        </Text>
      </View>
      <Text style={styles.title}>学習履歴</Text>
      <FlatList
        data={dummyData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 16,
    backgroundColor: '#F1F5F9',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginBottom: 16,
  },
  listContainer: {
    paddingBottom: 40,
  },
  card: {
    flex: 1 / 3,
    margin: 4,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 2,
    alignItems: 'center',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
  },
  text: {
    padding: 6,
    fontSize: 14,
    color: '#334155',
    textAlign: 'center',
  },
});
