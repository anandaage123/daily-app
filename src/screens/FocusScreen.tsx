import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  DimensionValue,
  ScrollView,
  Animated,
  Easing,
  Platform,
  Vibration,
  Dimensions,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, NavigationProp } from '@react-navigation/native';

const { width } = Dimensions.get('window');

// Methodic Muse Palette
const MM_Colors = {
  primary: '#4052B6',
  primaryLight: '#8899FF',
  background: '#F9F5FF',
  surface: '#FFFFFF',
  surfaceContainer: '#E9E5FF',
  text: '#2C2A51',
  textVariant: '#5A5781',
  secondary: '#765600',
  tertiary: '#006947',
  error: '#B41340',
  white: '#FFFFFF',
};

const PRESET_WORK = [15, 25, 45, 60];
const PRESET_BREAK = [5, 10, 15];

export default function FocusScreen() {
  const navigation = useNavigation<NavigationProp<any>>();
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [totalTime, setTotalTime] = useState(25 * 60);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);

  const workPlayer = useAudioPlayer(require('../../assets/timer_end.wav'));
  const breakPlayer = useAudioPlayer(require('../../assets/timer_end.wav'));

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customWorkMin, setCustomWorkMin] = useState('25');
  const [customBreakMin, setCustomBreakMin] = useState('5');

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const breatheTextOpacity = useRef(new Animated.Value(0)).current;
  const [breatheStatus, setBreatheStatus] = useState('Inhale');

  useEffect(() => {
    loadTimings();
  }, []);

  const loadTimings = async () => {
    try {
      const w = await AsyncStorage.getItem('@focus_work_min');
      const b = await AsyncStorage.getItem('@focus_break_min');
      if (w) {
        setCustomWorkMin(w);
        const secs = parseInt(w) * 60;
        setTotalTime(secs);
        setTimeLeft(secs);
      }
      if (b) setCustomBreakMin(b);
    } catch (e) {}
  };

  useEffect(() => {
    if (isActive) {
      const breatheSequence = () => {
        setBreatheStatus('Inhale');
        Animated.parallel([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(breatheTextOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
            Animated.delay(2000),
            Animated.timing(breatheTextOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
          ])
        ]).start(({ finished }) => {
          if (finished && isActive) {
            setBreatheStatus('Exhale');
            Animated.parallel([
              Animated.timing(pulseAnim, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
              Animated.sequence([
                Animated.timing(breatheTextOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
                Animated.delay(2000),
                Animated.timing(breatheTextOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
              ])
            ]).start(() => {
              if (isActive) breatheSequence();
            });
          }
        });
      };

      breatheSequence();

      Animated.loop(
        Animated.timing(rotateAnim, { toValue: 1, duration: 10000, easing: Easing.linear, useNativeDriver: true })
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      breatheTextOpacity.setValue(0);
      rotateAnim.stopAnimation();
    }
  }, [isActive]);

  const playSound = async (type: 'work' | 'break') => {
    try {
      if (type === 'work') {
        workPlayer.play();
        Vibration.vibrate([0, 500, 200, 500]);
      } else {
        breakPlayer.play();
        Vibration.vibrate([0, 100, 100, 100, 100, 100]);
      }
    } catch (e) { console.log('Sound error'); }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    if (timeLeft === 0 && isActive) {
      setIsActive(false);
      playSound(mode);
      const nextMode = mode === 'work' ? 'break' : 'work';
      const nextTime = nextMode === 'work' ? parseInt(customWorkMin) * 60 : parseInt(customBreakMin) * 60;
      setMode(nextMode);
      setTotalTime(nextTime);
      setTimeLeft(nextTime);
    }
  }, [timeLeft, isActive]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(totalTime);
  };

  const switchMode = (m: 'work' | 'break') => {
    setIsActive(false);
    setMode(m);
    const mTime = m === 'work' ? parseInt(customWorkMin) * 60 : parseInt(customBreakMin) * 60;
    setTotalTime(mTime);
    setTimeLeft(mTime);
  };

  const setPreset = async (mins: number, type: 'work' | 'break') => {
    setIsActive(false);
    if (type === 'work') {
      setCustomWorkMin(mins.toString());
      await AsyncStorage.setItem('@focus_work_min', mins.toString());
      if (mode === 'work') {
        setTotalTime(mins * 60);
        setTimeLeft(mins * 60);
      }
    } else {
      setCustomBreakMin(mins.toString());
      await AsyncStorage.setItem('@focus_break_min', mins.toString());
      if (mode === 'break') {
        setTotalTime(mins * 60);
        setTimeLeft(mins * 60);
      }
    }
  };

  const handleCustomSubmit = async () => {
    const workMins = Math.max(1, parseInt(customWorkMin) || 25);
    const breakMins = Math.max(1, parseInt(customBreakMin) || 5);
    setCustomWorkMin(workMins.toString());
    setCustomBreakMin(breakMins.toString());
    await AsyncStorage.setItem('@focus_work_min', workMins.toString());
    await AsyncStorage.setItem('@focus_break_min', breakMins.toString());
    const nextTime = (mode === 'work' ? workMins : breakMins) * 60;
    setTotalTime(nextTime);
    setTimeLeft(nextTime);
    setShowCustomModal(false);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const progress = timeLeft / totalTime;
  const fillHeight = `${progress * 100}%` as DimensionValue;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Uniform App Bar */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
           <Text style={styles.logoText}>Deep Focus</Text>
        </View>
        <TouchableOpacity style={styles.headerIcon} onPress={() => setShowCustomModal(true)}>
          <Ionicons name="settings-outline" size={24} color={MM_Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <View style={styles.timerContainer}>
          <Animated.View style={[styles.glowRing, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.innerTrack}>
              <View style={[styles.progressFill, { height: fillHeight }]}>
                <LinearGradient colors={['#4052B6', '#8899FF']} style={styles.gradient} />
              </View>
              <View style={styles.timerContent}>
                <Text style={styles.timerDigits}>{formatTime(timeLeft)}</Text>
                <Text style={styles.timerSubText}>
                  {!isActive ? 'PAUSED' : (mode === 'work' ? 'FLOWING...' : 'RECOVERY...')}
                </Text>
                <Animated.Text style={[styles.breatheText, { opacity: breatheTextOpacity }]}>
                  {breatheStatus}
                </Animated.Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View style={[styles.decorativeCircle, { transform: [{ rotate: rotation }] }]}>
             <Ionicons name="sparkles" size={24} color={MM_Colors.secondary} />
          </Animated.View>
        </View>

        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'work' && styles.modeBtnActive]}
            onPress={() => switchMode('work')}
          >
            <MaterialCommunityIcons name="brain" size={24} color={mode === 'work' ? '#FFF' : MM_Colors.primary} />
            <Text style={[styles.modeBtnText, mode === 'work' && styles.textWhite]}>Work</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'break' && styles.modeBtnActive]}
            onPress={() => switchMode('break')}
          >
            <Ionicons name="leaf" size={24} color={mode === 'break' ? '#FFF' : MM_Colors.primary} />
            <Text style={[styles.modeBtnText, mode === 'break' && styles.textWhite]}>Break</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.presetsSection}>
          <Text style={styles.sectionLabel}>PRESETS ({mode.toUpperCase()})</Text>
          <View style={styles.presetGrid}>
            {(mode === 'work' ? PRESET_WORK : PRESET_BREAK).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.presetBtn, (mode === 'work' ? customWorkMin : customBreakMin) === m.toString() && styles.presetBtnActive]}
                onPress={() => setPreset(m, mode)}
              >
                <Text style={[styles.presetBtnText, (mode === 'work' ? customWorkMin : customBreakMin) === m.toString() && styles.presetBtnTextActive]}>{m}m</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={resetTimer}>
            <Ionicons name="reload" size={24} color={MM_Colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.mainBtn} onPress={toggleTimer}>
            <LinearGradient colors={['#4052B6', '#8899FF']} style={styles.mainBtnGradient}>
              <Ionicons name={isActive ? "pause" : "play"} size={32} color="#FFF" />
              <Text style={styles.mainBtnText}>{isActive ? 'PAUSE' : 'START'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowCustomModal(true)}>
            <Ionicons name="options" size={24} color={MM_Colors.primary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showCustomModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Duration Settings</Text>
            <View style={styles.inputContainer}>
              <View style={styles.inputItem}>
                <Text style={styles.inputLabel}>WORK (MIN)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={customWorkMin}
                  onChangeText={setCustomWorkMin}
                />
              </View>
              <View style={styles.inputItem}>
                <Text style={styles.inputLabel}>BREAK (MIN)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={customBreakMin}
                  onChangeText={setCustomBreakMin}
                />
              </View>
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleCustomSubmit}>
              <Text style={styles.saveBtnText}>Update Timer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCustomModal(false)} style={{ marginTop: 20 }}>
              <Text style={{ color: MM_Colors.textVariant, fontWeight: '700' }}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MM_Colors.background },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, marginTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoText: { fontSize: 24, fontWeight: '900', color: MM_Colors.primary, letterSpacing: -1 },
  headerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  scrollContent: { padding: 24, paddingTop: 10, flexGrow: 1, paddingBottom: 20 },
  timerContainer: { alignItems: 'center', marginBottom: 40, marginTop: 20, position: 'relative' },
  glowRing: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#E9E5FF',
    padding: 15,
    shadowColor: MM_Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10
  },
  innerTrack: { flex: 1, borderRadius: 125, backgroundColor: '#FFF', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  progressFill: { position: 'absolute', bottom: 0, width: '100%', opacity: 0.15 },
  gradient: { flex: 1 },
  timerContent: { alignItems: 'center' },
  timerDigits: { fontSize: 72, fontWeight: '900', color: MM_Colors.text, letterSpacing: -3 },
  timerSubText: { fontSize: 12, fontWeight: '700', color: MM_Colors.textVariant, letterSpacing: 2, marginTop: -5 },
  breatheText: { fontSize: 14, fontWeight: '800', color: MM_Colors.primary, letterSpacing: 3, marginTop: 10, textTransform: 'uppercase' },

  decorativeCircle: { position: 'absolute', top: -10, right: 30, width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },

  modeToggle: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  modeBtn: { flex: 1, height: 100, borderRadius: 28, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#2C2A51', shadowOpacity: 0.05, shadowRadius: 10 },
  modeBtnActive: { backgroundColor: MM_Colors.primary },
  modeBtnText: { fontSize: 16, fontWeight: '800', color: MM_Colors.text, marginTop: 8 },
  textWhite: { color: '#FFF' },

  presetsSection: { marginBottom: 32 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: MM_Colors.textVariant, letterSpacing: 1, marginBottom: 12 },
  presetGrid: { flexDirection: 'row', gap: 10 },
  presetBtn: { flex: 1, height: 50, borderRadius: 15, backgroundColor: MM_Colors.white, justifyContent: 'center', alignItems: 'center', elevation: 1 },
  presetBtnActive: { backgroundColor: MM_Colors.primary },
  presetBtnText: { fontWeight: '700', color: MM_Colors.text },
  presetBtnTextActive: { color: '#FFF' },

  controls: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  secondaryBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  mainBtn: { flex: 1, height: 72, borderRadius: 36, overflow: 'hidden', elevation: 5 },
  mainBtnGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  mainBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(44, 42, 81, 0.7)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 32, padding: 32, alignItems: 'center' },
  modalTitle: { fontSize: 24, fontWeight: '800', color: MM_Colors.text, marginBottom: 32 },
  inputContainer: { flexDirection: 'row', gap: 20, marginBottom: 32 },
  inputItem: { flex: 1, alignItems: 'center' },
  inputLabel: { fontSize: 10, fontWeight: '800', color: MM_Colors.textVariant, marginBottom: 12 },
  input: { backgroundColor: '#F9F5FF', width: '100%', padding: 20, borderRadius: 20, fontSize: 24, fontWeight: '800', textAlign: 'center', color: MM_Colors.text },
  saveBtn: { backgroundColor: MM_Colors.primary, width: '100%', padding: 20, borderRadius: 24, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
