import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  DimensionValue,
  ScrollView,
  Animated,
  Easing,
  Platform,
  Vibration,
  Dimensions,
  StatusBar,
  AppState,
  TouchableOpacity
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Typography, Shadows, Spacing } from '../theme/Theme';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const PRESET_WORK = [15, 25, 45, 60];
const PRESET_BREAK = [5, 10, 15, 30];

export default function FocusScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp<any>>();
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [totalTime, setTotalTime] = useState(25 * 60);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  
  const appState = useRef(AppState.currentState);
  const startTimeRef = useRef<number | null>(null);

  useKeepAwake(); // Keep screen on while this screen is focused

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customWorkMin, setCustomWorkMin] = useState('25');
  const [customBreakMin, setCustomBreakMin] = useState('5');

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const breatheTextOpacity = useRef(new Animated.Value(0)).current;
  const [breatheStatus, setBreatheStatus] = useState('Inhale');

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingBottom: 20,
    },
    logoText: {
      ...Typography.header,
      fontSize: 24,
      color: colors.text,
    },
    headerBtn: { padding: 8, borderRadius: 12, backgroundColor: colors.surface, ...Shadows.soft },
    timerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 40,
    },
    circleContainer: {
      width: width * 0.8,
      height: width * 0.8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    timeText: {
      ...Typography.header,
      fontSize: 80,
      color: colors.text,
      letterSpacing: -2,
    },
    statusText: {
      ...Typography.caption,
      fontSize: 14,
      fontWeight: '800',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 2,
      marginTop: 8,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 32,
      marginTop: 60,
    },
    mainBtn: {
      width: 140,
      height: 64,
      borderRadius: 32,
      ...Shadows.soft,
      overflow: 'hidden',
    },
    mainBtnGradient: {
      width: '100%',
      height: '100%',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    mainBtnText: {
      color: '#FFF',
      fontWeight: '800',
      fontSize: 16,
      letterSpacing: 1,
    },
    secondaryBtn: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      ...Shadows.soft,
    },
    zenContainer: {
      marginTop: 40,
      alignItems: 'center',
    },
    zenText: {
      ...Typography.body,
      color: colors.textVariant,
      fontSize: 18,
      letterSpacing: 4,
      textTransform: 'uppercase',
      opacity: 0.6,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15,14,23,0.6)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 36,
      borderTopRightRadius: 36,
      padding: 32,
      paddingBottom: 48,
    },
    sheetTitle: {
      ...Typography.header,
      fontSize: 28,
      color: colors.text,
      marginBottom: 32,
    },
    input: {
      backgroundColor: colors.background,
      width: '100%',
      padding: 16,
      borderRadius: 12,
      ...Typography.header,
      fontSize: 32,
      textAlign: 'center',
      color: colors.text,
    },
    saveBtn: { 
      backgroundColor: colors.primary, 
      width: '100%', 
      padding: 16, 
      borderRadius: 12, 
      alignItems: 'center',
      marginTop: 24,
    },
    saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
    lockOverlay: { marginTop: 32, alignItems: 'center' },
    lockText: { ...Typography.title, color: colors.error, marginTop: 12 },
    lockSubText: { ...Typography.caption, marginTop: 4, opacity: 0.6, color: colors.textVariant },
  });

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

  const playSound = async (type: 'work' | 'break') => {
    try {
      // Logic for sound placeholder
      Vibration.vibrate(type === 'work' ? [0, 500, 200, 500] : [0, 100, 100, 100]);
    } catch (e) { console.log('Sound error'); }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/active/) && nextAppState === 'background') {
        if (isActive) {
          startTimeRef.current = Date.now();
        }
      } else if (appState.current.match(/background/) && nextAppState === 'active') {
        if (isActive && startTimeRef.current) {
          const now = Date.now();
          const elapsed = Math.floor((now - startTimeRef.current) / 1000);
          setTimeLeft(prev => Math.max(0, prev - elapsed));
          startTimeRef.current = null;
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isActive]);

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
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      breatheTextOpacity.setValue(0);
    }
  }, [isActive]);

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      playSound(mode);
      const nextMode = mode === 'work' ? 'break' : 'work';
      const nextTime = nextMode === 'work' ? parseInt(customWorkMin) * 60 : parseInt(customBreakMin) * 60;
      setMode(nextMode);
      setTotalTime(nextTime);
      setTimeLeft(nextTime);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

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

  const fillHeight = `${(timeLeft / totalTime) * 100}%` as DimensionValue;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={styles.headerBar}>
        <Text style={styles.logoText}>Deep Focus</Text>
        <TouchableOpacity 
          onPress={() => setIsLocked(!isLocked)} 
          style={styles.headerBtn}
        >
          <Ionicons name={isLocked ? "lock-closed" : "lock-open-outline"} size={22} color={isLocked ? colors.error : colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity 
          disabled={isLocked}
          onPress={() => setShowCustomModal(true)} 
          style={[styles.headerBtn, { marginLeft: 16, opacity: isLocked ? 0.5 : 1 }]}
        >
          <Ionicons name="options-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.timerContainer}>
        <Animated.View style={[styles.circleContainer, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
             <View style={{
                width: width * 0.72,
                height: width * 0.72,
                borderRadius: width * 0.36,
                backgroundColor: isDark ? colors.surface : '#FFF',
                ...Shadows.soft,
                borderWidth: 1,
                borderColor: isDark ? colors.onSurfaceVariant + '30' : '#F0F0FF',
                overflow: 'hidden',
                justifyContent: 'center',
                alignItems: 'center'
             }}>
                <View style={{ position: 'absolute', bottom: 0, width: '100%', height: fillHeight, backgroundColor: colors.primary + '10' }} />
                <Text style={styles.timeText}>{formatTime(timeLeft)}</Text>
                <Text style={styles.statusText}>{mode === 'work' ? 'FLOWING' : 'RECOVERY'}</Text>
             </View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.zenContainer, { opacity: breatheTextOpacity }]}>
           <Text style={styles.zenText}>{breatheStatus}</Text>
        </Animated.View>

        {isLocked && (
          <View style={styles.lockOverlay}>
            <MaterialCommunityIcons name="lock-outline" size={24} color={colors.error} />
            <Text style={styles.lockText}>Interface Locked</Text>
            <Text style={styles.lockSubText}>Tap the lock icon above to release</Text>
          </View>
        )}

        <View style={styles.controls}>
          <TouchableOpacity 
            style={styles.secondaryBtn} 
            onPress={resetTimer}
            disabled={isLocked}
          >
            <Ionicons name="reload" size={24} color={colors.textVariant} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.mainBtn} 
            onPress={toggleTimer}
            disabled={isLocked}
          >
             <LinearGradient colors={[colors.primary, colors.primaryLight]} style={styles.mainBtnGradient}>
              <Ionicons name={isActive ? "pause" : "play"} size={28} color="#FFF" />
              <Text style={styles.mainBtnText}>{isActive ? 'PAUSE' : 'START'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showCustomModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowCustomModal(false)}>
           <Pressable style={styles.sheet}>
              <Text style={styles.sheetTitle}>Timer Settings</Text>
              
              <View style={{ marginBottom: 24 }}>
                <Text style={[Typography.caption, { color: colors.textVariant, fontWeight: '700', marginBottom: 8 }]}>WORK DURATION (MIN)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={customWorkMin}
                  onChangeText={setCustomWorkMin}
                />
              </View>

              <View style={{ marginBottom: 32 }}>
                <Text style={[Typography.caption, { color: colors.textVariant, fontWeight: '700', marginBottom: 8 }]}>BREAK DURATION (MIN)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={customBreakMin}
                  onChangeText={setCustomBreakMin}
                />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleCustomSubmit}>
                <Text style={styles.saveBtnText}>Apply Settings</Text>
              </TouchableOpacity>
           </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
