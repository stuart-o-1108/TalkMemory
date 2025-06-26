// LearningScreen.js
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export default function LearningScreen() {
  const [photoUri, setPhotoUri] = useState(null);
  const [input, setInput] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [step, setStep] = useState(1);
  const [feedback, setFeedback] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    loadPhoto();
  }, []);

  const loadPhoto = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return;

    const assets = await MediaLibrary.getAssetsAsync({
      mediaType: 'photo',
      first: 1000,
      sortBy: ['creationTime'],
    });

    if (assets.assets.length > 0) {
      const random = assets.assets[Math.floor(Math.random() * assets.assets.length)];
      const info = await MediaLibrary.getAssetInfoAsync(random.id);
      const uri = info.localUri || random.uri;
      setPhotoUri(uri);

      const d = new Date(random.creationTime);
      setDate(`${d.getFullYear()}/${('0'+(d.getMonth()+1)).slice(-2)}/${('0'+d.getDate()).slice(-2)}`);

      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }
  };

  const handleNext = () => {
    if (step === 1) setStep(2);
    else if (step === 2) {
      setFeedback(
        `「${input}」は良い表現です！別の言い方として "I'm feeling thrilled" も使えます。`
      );
      setStep(3);
    } else {
      // reset
      setStep(1);
      setInput('');
      setFeedback('');
      fadeAnim.setValue(0);
      loadPhoto();
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.wrapper}>
          <Text style={styles.logo}>MemoryTalk</Text>
          {photoUri && (
            <>
              <Animated.Image
                source={{ uri: photoUri }}
                style={[styles.image, { opacity: fadeAnim }]}
                resizeMode="contain"
              />
              <Text style={styles.date}>📅 {date}</Text>
            </>
          )}

          {step === 1 && <Text style={styles.prompt}>英語で気持ちを言葉にしてみよう</Text>}
          {step === 2 && (
            <TextInput
              style={styles.input}
              placeholder="I'm feeling excited..."
              value={input}
              onChangeText={setInput}
              multiline
            />
          )}
          {step === 3 && <View style={styles.feedbackBox}><Text style={styles.feedback}>{feedback}</Text></View>}

          <TouchableOpacity style={styles.button} onPress={handleNext}>
            <Text style={styles.buttonText}>
              {step === 1 ? '入力する' : step === 2 ? '確認する' : '次の写真へ'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'flex-start' },
  wrapper: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    flex: 1,
  },
  logo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#00A4FF',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 10,
  },
  date: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  prompt: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  input: {
    width: '100%',
    minHeight: 60,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  feedbackBox: {
    width: '100%',
    backgroundColor: '#E0F7FF',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  feedback: {
    color: '#0077AA',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#00A4FF',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 24,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
