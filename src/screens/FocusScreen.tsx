import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  DimensionValue,
  ScrollView,
  Animated,
  Easing,
  Platform,
  Vibration,
  Dimensions,
  StatusBar,
  TouchableOpacity,
  TouchableNativeFeedback,
  Modal,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Typography, Shadows } from '../theme/Theme';
import { scaleFontSize } from '../utils/ResponsiveSize';
import { useTheme } from '../context/ThemeContext';
import { recordFocusSession } from '../services/DailyLogService';

const { width, height } = Dimensions.get('window');
const ds = (size: number) => (size * width) / 414;

// ─── Types ────────────────────────────────────────────────────────────────────
type TimerStatus = 'setup' | 'focus' | 'break' | 'complete';

interface SessionLog {
  id: string;
  name: string;
  tag: string;
  duration: number;
  timestamp: number;
  mode: string;
  completedSprints?: number;
}

interface SprintRecord {
  index: number;
  completed: boolean;
  duration: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const MODES = [
  {
    id: 'pomodoro',
    name: 'Pomodoro',
    focus: 25,
    break: 5,
    icon: 'timer-outline' as const,
    sprints: 4,
    desc: '25 min focus, 5 min break',
    color: '#1A73E8',
  },
  {
    id: 'deep_work',
    name: 'Deep Work',
    focus: 90,
    break: 15,
    icon: 'flash-outline' as const,
    sprints: 2,
    desc: '90 min deep dive, 15 min rest',
    color: '#7B1FA2',
  },
  {
    id: 'zen',
    name: 'Zen Flow',
    focus: 10,
    break: 0,
    icon: 'leaf-outline' as const,
    sprints: 1,
    desc: 'Calm, breathe, be present',
    color: '#0F9D58',
  },
  {
    id: 'custom',
    name: 'Custom',
    focus: 25,
    break: 5,
    icon: 'options-outline' as const,
    sprints: 3,
    desc: 'Your own rhythm',
    color: '#F57C00',
  },
];

// Zen duration presets
const ZEN_DURATIONS = [2, 5, 10, 15, 20, 30, 45, 60];

const TAGS = ['Work', 'Code', 'Study', 'Personal', 'Health', 'Zen'];

const SPRINT_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6];

// ─── Ripple Button (Material-style) ──────────────────────────────────────────
const RippleBtn: React.FC<{
  onPress: () => void;
  style?: any;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ onPress, style, children, disabled }) => {
  if (Platform.OS === 'android') {
    return (
      <TouchableNativeFeedback
        onPress={onPress}
        disabled={disabled}
        background={TouchableNativeFeedback.Ripple('rgba(255,255,255,0.2)', true)}
      >
        <View style={style}>{children}</View>
      </TouchableNativeFeedback>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} style={style} disabled={disabled} activeOpacity={0.78}>
      {children}
    </TouchableOpacity>
  );
};

// ─── Animated Water Fill ──────────────────────────────────────────────────────
const WaterFill: React.FC<{ percent: number; color: string; isActive: boolean }> = ({
  percent,
  color,
  isActive,
}) => {
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const fillAnim = useRef(new Animated.Value(percent)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: percent,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percent]);

  useEffect(() => {
    if (!isActive) return;
    const loop1 = Animated.loop(
      Animated.timing(waveAnim1, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const loop2 = Animated.loop(
      Animated.timing(waveAnim2, {
        toValue: 1,
        duration: 3600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop1.start();
    loop2.start();
    return () => {
      loop1.stop();
      loop2.stop();
    };
  }, [isActive]);

  const ringSize = ds(270);
  const fillHeight = fillAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [0, ringSize],
    extrapolate: 'clamp',
  });

  // Wave translateX animations
  const wave1X = waveAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [-ringSize, ringSize],
  });
  const wave2X = waveAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [ringSize, -ringSize],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: fillHeight,
        overflow: 'hidden',
      }}
    >
      {/* Base fill */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          top: 0,
          backgroundColor: color + '18',
        }}
      />
      {/* Wave 1 */}
      <Animated.View
        style={{
          position: 'absolute',
          top: -12,
          left: 0,
          right: 0,
          height: 24,
          transform: [{ translateX: wave1X }],
        }}
      >
        <View
          style={{
            width: ringSize * 2.5,
            height: 24,
            borderRadius: 12,
            backgroundColor: color + '30',
          }}
        />
      </Animated.View>
      {/* Wave 2 */}
      <Animated.View
        style={{
          position: 'absolute',
          top: -8,
          left: 0,
          right: 0,
          height: 16,
          transform: [{ translateX: wave2X }],
        }}
      >
        <View
          style={{
            width: ringSize * 2.5,
            height: 16,
            borderRadius: 8,
            backgroundColor: color + '20',
          }}
        />
      </Animated.View>
      {/* Draining ripple on empty */}
      {percent < 5 && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            backgroundColor: color + '40',
          }}
        />
      )}
    </Animated.View>
  );
};

// ─── Sprint Dots ──────────────────────────────────────────────────────────────
const SprintDots: React.FC<{
  total: number;
  completed: number;
  current: number;
  color: string;
}> = ({ total, completed, current, color }) => {
  const scaleAnims = useRef(
    Array.from({ length: total }, () => new Animated.Value(1))
  ).current;

  useEffect(() => {
    if (current < total) {
      Animated.sequence([
        Animated.timing(scaleAnims[current], {
          toValue: 1.4,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnims[current], {
          toValue: 1.15,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [current]);

  return (
    <View style={{ flexDirection: 'row', gap: ds(8), justifyContent: 'center', marginTop: ds(12) }}>
      {Array.from({ length: total }, (_, i) => (
        <Animated.View
          key={i}
          style={{
            width: i === current ? ds(20) : ds(8),
            height: ds(8),
            borderRadius: ds(4),
            backgroundColor:
              i < completed
                ? color
                : i === current
                  ? color + 'AA'
                  : color + '30',
            transform: [{ scale: scaleAnims[i] }],
          }}
        />
      ))}
    </View>
  );
};

// ─── Completion Celebration ───────────────────────────────────────────────────
const CelebrationOverlay: React.FC<{
  visible: boolean;
  onDismiss: () => void;
  completedSprints: number;
  sessionName: string;
  modeColor: string;
  totalMinutes: number;
}> = ({ visible, onDismiss, completedSprints, sessionName, modeColor, totalMinutes }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(ring1, { toValue: 1, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(ring1, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.delay(600),
            Animated.timing(ring2, { toValue: 1, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(ring2, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        ),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.65)',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: opacityAnim,
        }}
      >
        {/* Expanding rings */}
        <Animated.View
          style={{
            position: 'absolute',
            width: ds(300),
            height: ds(300),
            borderRadius: ds(150),
            borderWidth: 2,
            borderColor: modeColor + '60',
            transform: [
              { scale: ring1.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.0] }) },
            ],
            opacity: ring1.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.8, 0.3, 0] }),
          }}
        />
        <Animated.View
          style={{
            position: 'absolute',
            width: ds(300),
            height: ds(300),
            borderRadius: ds(150),
            borderWidth: 2,
            borderColor: modeColor + '40',
            transform: [
              { scale: ring2.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.2] }) },
            ],
            opacity: ring2.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.8, 0.3, 0] }),
          }}
        />

        <Animated.View
          style={{
            backgroundColor: '#fff',
            borderRadius: ds(32),
            padding: ds(36),
            alignItems: 'center',
            width: width - ds(48),
            transform: [{ scale: scaleAnim }],
            shadowColor: modeColor,
            shadowOpacity: 0.3,
            shadowRadius: 32,
            elevation: 20,
          }}
        >
          <View
            style={{
              width: ds(72),
              height: ds(72),
              borderRadius: ds(36),
              backgroundColor: modeColor + '15',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: ds(16),
            }}
          >
            <Ionicons name="checkmark-circle" size={ds(44)} color={modeColor} />
          </View>

          <Text style={{ fontSize: ds(22), fontWeight: '800', color: '#1A1A2E', marginBottom: ds(4) }}>
            Session Complete!
          </Text>
          <Text style={{ fontSize: ds(14), color: '#666', marginBottom: ds(24), textAlign: 'center' }}>
            {sessionName || 'Focus Session'}
          </Text>

          <View style={{ flexDirection: 'row', gap: ds(16), marginBottom: ds(28) }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: ds(28), fontWeight: '800', color: modeColor }}>{completedSprints}</Text>
              <Text style={{ fontSize: ds(11), color: '#999', fontWeight: '600' }}>SPRINTS</Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#eee' }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: ds(28), fontWeight: '800', color: modeColor }}>{totalMinutes}</Text>
              <Text style={{ fontSize: ds(11), color: '#999', fontWeight: '600' }}>MINUTES</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={onDismiss}
            style={{
              width: '100%',
              height: ds(52),
              borderRadius: ds(26),
              backgroundColor: modeColor,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: ds(16) }}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FocusScreen() {
  const { colors, isDark } = useTheme();
  useKeepAwake();

  // ─── State ──────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<TimerStatus>('setup');
  const [activeModeIdx, setActiveModeIdx] = useState(0);
  const [sessionName, setSessionName] = useState('');
  const [sessionTag, setSessionTag] = useState('Work');

  const [customFocus, setCustomFocus] = useState('25');
  const [customBreak, setCustomBreak] = useState('5');
  const [customSprints, setCustomSprints] = useState(3);

  // Zen-specific duration picker
  const [zenDuration, setZenDuration] = useState(10);

  // Sprint tracking
  const [totalSprints, setTotalSprints] = useState(4);
  const [currentSprint, setCurrentSprint] = useState(0);
  const [completedSprints, setCompletedSprints] = useState(0);

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [totalTime, setTotalTime] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [showComplete, setShowComplete] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(0);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const breatheOpacity = useRef(new Animated.Value(0)).current;
  const wavyPulse = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const headerSlide = useRef(new Animated.Value(-20)).current;
  const headerFade = useRef(new Animated.Value(0)).current;
  const setupFade = useRef(new Animated.Value(0)).current;
  const setupSlide = useRef(new Animated.Value(20)).current;
  const timerScale = useRef(new Animated.Value(0.85)).current;

  const [breatheLabel, setBreatheLabel] = useState('Inhale');

  const mode = MODES[activeModeIdx];
  const isCustomMode = mode.id === 'custom';
  const isZenMode = mode.id === 'zen';
  const modeColor = mode.color;

  const focusGreen = '#0F9D58';
  const breakBlue = '#1A73E8';
  const currentThemeColor =
    status === 'focus'
      ? modeColor
      : status === 'break'
        ? breakBlue
        : status === 'complete'
          ? modeColor
          : modeColor;

  // ─── Entry animations ────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(setupFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(setupSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (status !== 'setup') {
      timerScale.setValue(0.85);
      fadeIn.setValue(0);
      slideUp.setValue(30);
      headerFade.setValue(0);
      headerSlide.setValue(-20);

      Animated.parallel([
        Animated.spring(timerScale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
        Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideUp, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(headerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [status]);

  // ─── Persistence ─────────────────────────────────────────────────────────────
  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async () => {
    try {
      const saved = await AsyncStorage.getItem('@focus_logs_v3');
      if (saved) setLogs(JSON.parse(saved));
    } catch { }
  };

  const saveSession = useCallback(async () => {
    if (status !== 'focus') return;
    const elapsedSecs = totalTime - timeLeft;
    const newLog: SessionLog = {
      id: Date.now().toString(),
      name: sessionName || (isZenMode ? 'Zen Flow' : 'Focus Session'),
      tag: sessionTag,
      duration: Math.max(1, Math.floor(elapsedSecs / 60)),
      timestamp: Date.now(),
      mode: mode.id,
      completedSprints: completedSprints + 1,
    };
    const updated = [newLog, ...logs].slice(0, 8);
    setLogs(updated);
    try {
      await AsyncStorage.setItem('@focus_logs_v3', JSON.stringify(updated));
    } catch { }
  }, [status, sessionName, sessionTag, totalTime, timeLeft, mode.id, completedSprints, logs, isZenMode]);

  // ─── Haptic ───────────────────────────────────────────────────────────────────
  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(style);
  };

  // ─── Format ───────────────────────────────────────────────────────────────────
  const formatTime = (secs: number) => {
    const absSecs = Math.abs(secs);
    const m = Math.floor(absSecs / 60);
    const s = absSecs % 60;
    const sign = secs < 0 ? '+' : ''; // Overtime shown with +
    return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getFocusSecs = useCallback(() => {
    if (isZenMode) return zenDuration * 60;
    if (isCustomMode) return (parseInt(customFocus) || 25) * 60;
    return mode.focus * 60;
  }, [isZenMode, isCustomMode, zenDuration, customFocus, mode.focus]);

  // ─── Update notification with live timer ───────────────────────────────────────
  // REMOVED - No notifications, only haptics!

  // ─── Timer Engine ─────────────────────────────────────────────────────────────
  // Focus phase: counts into negative (overtime). Break phase: stops at 0.
  // With haptic feedback at key intervals
  useEffect(() => {
    let interval: any = null;

    // Haptic feedback when phase starts
    if (isActive && (status === 'focus' || status === 'break')) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      if (Platform.OS !== 'web') Vibration.vibrate([0, 200, 100, 200]);
    }

    if (isActive) {
      if (status === 'focus') {
        interval = setInterval(() => {
          setTimeLeft((prev: number) => {
            const next = prev - 1;

            // Haptic feedback at key milestones
            if (next === 60 || next === 30 || next === 10) {
              triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
              if (Platform.OS !== 'web') Vibration.vibrate(150);
            }

            // Heavy feedback when time is up
            if (next === 0) {
              triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
              if (Platform.OS !== 'web') Vibration.vibrate([0, 500, 200, 500, 200, 500]);
            }

            return next; // Goes negative for overtime
          });
        }, 1000);
      } else if (status === 'break') {
        if (timeLeft > 0) {
          interval = setInterval(() => {
            setTimeLeft((prev: number) => {
              const next = prev - 1;

              // Haptic feedback at key milestones in break
              if (next === 60 || next === 10) {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                if (Platform.OS !== 'web') Vibration.vibrate(150);
              }

              // Heavy feedback when break is over
              if (next === 0) {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
                if (Platform.OS !== 'web') Vibration.vibrate([0, 500, 200, 500, 200, 500]);
              }

              return next;
            });
          }, 1000);
        } else {
          handlePhaseEnd();
        }
      }
    }
    return () => clearInterval(interval);
  }, [isActive, status]);

  // Called when the user manually skips OR when break reaches zero.
  // Focus phase: saves actual elapsed time (including overtime), then transitions.
  // Break phase: resets to next focus sprint.
  // CHANGE: Every sprint gets a break timer, even the last one.
  const handlePhaseEnd = useCallback(() => {
    setIsActive(false);
    if (Platform.OS !== 'web') Vibration.vibrate([0, 400, 150, 400]);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    if (status === 'focus') {
      saveSession(); // saveSession captures actual elapsed (totalTime - timeLeft) including overtime
      const newCompleted = completedSprints + 1;
      setCompletedSprints(newCompleted);

      // Always show break timer, even for last sprint
      const breakSecs = isZenMode
        ? 0
        : (isCustomMode ? (parseInt(customBreak) || 5) : mode.break) * 60;

      if (breakSecs > 0) {
        // Transition to break but DO NOT auto-start — user manually presses play
        setStatus('break');
        setTimeLeft(breakSecs);
        setTotalTime(breakSecs);
        setIsActive(false); // ← Never auto-start break
      } else {
        // Zen / no-break: advance sprint, pause
        if (newCompleted >= totalSprints) {
          setStatus('complete');
          setShowComplete(true);
          return;
        }
        const focusSecs = getFocusSecs();
        setCurrentSprint(newCompleted);
        setTimeLeft(focusSecs);
        setTotalTime(focusSecs);
        setIsActive(false);
      }
    } else if (status === 'break') {
      const newCompleted = completedSprints + 1;
      if (newCompleted >= totalSprints) {
        setStatus('complete');
        setShowComplete(true);
        return;
      }
      const focusSecs = getFocusSecs();
      setCurrentSprint(newCompleted);
      setStatus('focus');
      setTimeLeft(focusSecs);
      setTotalTime(focusSecs);
      setIsActive(false);
    }
  }, [status, completedSprints, totalSprints, isZenMode, isCustomMode, customBreak, mode.break, saveSession, getFocusSecs]);

  const skipPhase = () => {
    triggerHaptic();
    handlePhaseEnd();
  };

  const startSession = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    const sprints = isCustomMode ? customSprints : isZenMode ? 1 : mode.sprints;
    setTotalSprints(sprints);
    setCompletedSprints(0);
    setCurrentSprint(0);
    const secs = getFocusSecs();
    setTimeLeft(secs);
    setTotalTime(secs);
    setIsActive(true);
    setStatus('focus');
    setSessionStartTime(Date.now());
  };

  const handleCompleteSession = () => {
    const endTs = Date.now();
    if (sessionStartTime > 0) {
      recordFocusSession({
        startTs: sessionStartTime,
        endTs,
        title: sessionName || (isZenMode ? 'Zen Flow' : 'Focus Session'),
        tag: sessionTag,
        mode: mode.id,
      }).catch(() => { });
    }
    setShowComplete(false);
    setStatus('setup');
    setIsActive(false);
    setCompletedSprints(0);
    setCurrentSprint(0);
  };

  // ─── Breathing & Wave animations ──────────────────────────────────────────────
  useEffect(() => {
    let animLoop: any = null;
    let waveLoop: any = null;

    if (isActive && status !== 'setup' && status !== 'complete') {
      const breatheSequence = () => {
        setBreatheLabel('Inhale');
        animLoop = Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 4500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(breatheOpacity, { toValue: 0.9, duration: 1200, useNativeDriver: true }),
            Animated.delay(2000),
            Animated.timing(breatheOpacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
          ]),
        ]);
        animLoop.start(({ finished }: any) => {
          if (!finished) return;
          setBreatheLabel('Exhale');
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 4000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(breatheOpacity, { toValue: 0.9, duration: 1000, useNativeDriver: true }),
              Animated.delay(2000),
              Animated.timing(breatheOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
            ]),
          ]).start(({ finished: f }: any) => {
            if (f && isActive) breatheSequence();
          });
        });
      };
      breatheSequence();

      if (status === 'focus') {
        waveLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(wavyPulse, {
              toValue: 1,
              duration: 2800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(wavyPulse, {
              toValue: 0,
              duration: 2800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        );
        waveLoop.start();
      }
    } else {
      pulseAnim.setValue(1);
      breatheOpacity.setValue(0);
      wavyPulse.setValue(0);
      if (animLoop) animLoop.stop();
      if (waveLoop) waveLoop.stop();
    }
    return () => {
      if (animLoop) animLoop.stop();
      if (waveLoop) waveLoop.stop();
    };
  }, [isActive, status]);

  const percent = (timeLeft / totalTime) * 100;

  // ─── Styles ─────────────────────────────────────────────────────────────────
  const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },

    // Setup
    header: {
      paddingHorizontal: ds(24),
      paddingTop: Platform.OS === 'ios' ? ds(70) : ds(50), // Increased to clear notch securely
      marginBottom: ds(12),
    },
    title: {
      fontSize: ds(26),
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    sub: {
      fontSize: ds(13),
      color: colors.textVariant,
      opacity: 0.65,
      marginTop: ds(3),
    },

    card: {
      backgroundColor: isDark ? colors.surfaceContainer : '#F5F6FA',
      borderRadius: ds(24),
      padding: ds(20),
      marginHorizontal: ds(16),
      marginBottom: ds(14),
    },
    label: {
      fontSize: ds(10),
      fontWeight: '800',
      color: colors.textVariant,
      textTransform: 'uppercase',
      letterSpacing: ds(1.5),
      marginBottom: ds(12),
    },
    input: {
      fontSize: ds(17),
      color: colors.text,
      borderBottomWidth: 1.5,
      borderBottomColor: isDark ? colors.surfaceContainer : '#E0E0E0',
      paddingVertical: ds(10),
      fontWeight: '500',
    },

    // Mode grid
    grid: {
      flexDirection: 'column',
      gap: ds(10),
    },
    gridRow: {
      flexDirection: 'row',
      gap: ds(10),
    },
    gridItem: {
      flex: 1,
      padding: ds(14),
      borderRadius: ds(18),
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    gridItemActive: {
      borderColor: modeColor,
      backgroundColor: modeColor + '12',
    },
    gridItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: ds(4) },
    gridItemText: { fontSize: ds(13), fontWeight: '700', color: colors.text, marginLeft: ds(8) },
    gridItemDesc: { fontSize: ds(10), color: colors.textVariant, opacity: 0.7 },

    // Zen duration chips
    zenDurationRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ds(8),
      marginTop: ds(4),
    },
    zenChip: {
      paddingHorizontal: ds(14),
      paddingVertical: ds(8),
      borderRadius: ds(20),
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    zenChipActive: {
      backgroundColor: modeColor,
      borderColor: modeColor,
    },
    zenChipText: {
      fontSize: ds(12),
      fontWeight: '700',
      color: colors.textVariant,
    },
    zenChipTextActive: {
      color: '#fff',
    },

    // Sprint selector
    sprintRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ds(8),
      marginTop: ds(4),
    },
    sprintChip: {
      width: ds(40),
      height: ds(40),
      borderRadius: ds(20),
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sprintChipActive: {
      backgroundColor: modeColor,
      borderColor: modeColor,
    },
    sprintChipText: {
      fontSize: ds(14),
      fontWeight: '700',
      color: colors.textVariant,
    },
    sprintChipTextActive: { color: '#fff' },

    // Tags
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ds(8),
      marginTop: ds(14),
    },
    tagChip: {
      paddingHorizontal: ds(14),
      paddingVertical: ds(9),
      borderRadius: ds(20),
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    tagChipActive: {
      backgroundColor: modeColor,
      borderColor: modeColor,
    },
    tagText: { fontSize: ds(12), fontWeight: '700', color: colors.textVariant },
    tagActiveText: { color: '#fff' },

    mainBtn: {
      height: ds(58),
      borderRadius: ds(29),
      backgroundColor: modeColor,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: ds(16),
      marginTop: ds(4),
      marginBottom: ds(24),
      ...Shadows.soft,
    },
    mainBtnText: { color: '#fff', fontSize: ds(16), fontWeight: '800', letterSpacing: 0.5 },

    // Records
    recordsHeader: {
      marginTop: ds(8),
      marginHorizontal: ds(16),
      marginBottom: ds(12),
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    recordsTitle: {
      fontSize: ds(10),
      fontWeight: '800',
      color: colors.textVariant,
      textTransform: 'uppercase',
      letterSpacing: ds(1.5),
    },
    logCard: {
      backgroundColor: colors.surface,
      borderRadius: ds(18),
      padding: ds(14),
      marginHorizontal: ds(16),
      marginBottom: ds(10),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      ...Shadows.soft,
    },
    logInfo: { flex: 1 },
    logName: { fontSize: ds(14), fontWeight: '700', color: colors.text },
    logMeta: { fontSize: ds(11), color: colors.textVariant, opacity: 0.6, marginTop: ds(2) },
    logBadgeRow: { flexDirection: 'row', gap: ds(6), marginTop: ds(4), flexWrap: 'wrap' },
    logBadge: {
      backgroundColor: colors.primary + '12',
      paddingHorizontal: ds(8),
      paddingVertical: ds(3),
      borderRadius: ds(6),
    },
    logBadgeText: { fontSize: ds(10), color: colors.primary, fontWeight: '700' },

    // Timer view
    timerRoot: { flex: 1, justifyContent: 'space-between', paddingBottom: ds(40) },
    timerHeader: {
      paddingHorizontal: ds(24),
      paddingTop: Platform.OS === 'ios' ? ds(110) : ds(80), // Increased padding to clear status bar/notch
      alignItems: 'center',
    },
    sessionTagBadge: {
      paddingHorizontal: ds(12),
      paddingVertical: ds(4),
      borderRadius: ds(20),
      marginBottom: ds(6),
    },
    sessionTagText: { fontSize: ds(10), fontWeight: '800', letterSpacing: ds(1.5) },
    sessionTitle: {
      fontSize: ds(20),
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.3,
    },

    // Center timer section
    timerCenter: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: ds(40), // Space from sprint dots
      overflow: 'visible', // Don't clip rings
    },

    timerContent: {
      alignItems: 'center', // Horizontal center for breathe and ring
    },

    ring: {
      width: ds(270),
      height: ds(270),
      borderRadius: ds(135),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: ds(2),
      borderColor: colors.surfaceContainer,
      overflow: 'hidden',
    },

    waveRing: {
      position: 'absolute',
      width: ds(292),
      height: ds(292),
      borderRadius: ds(146),
      borderWidth: 1.5,
      borderColor: modeColor + '35',
    },

    waveRingOuter: {
      position: 'absolute',
      width: ds(310),
      height: ds(310),
      borderRadius: ds(155),
      borderWidth: 1,
      borderColor: modeColor + '20',
    },

    timeText: {
      fontSize: ds(62),
      fontWeight: '800',
      color: colors.text,
      letterSpacing: ds(-2),
      fontVariant: ['tabular-nums'],
    },
    phaseText: {
      fontSize: ds(10),
      fontWeight: '900',
      color: currentThemeColor,
      marginTop: ds(-2),
      letterSpacing: ds(2.5),
      textTransform: 'uppercase',
    },

    breatheOverlay: {
      alignItems: 'center',
      zIndex: 10,
      marginBottom: ds(24), // Relative space above ring
    },
    breatheText: {
      fontSize: ds(13),
      fontWeight: '800',
      color: currentThemeColor,
      letterSpacing: ds(4),
      textTransform: 'uppercase',
    },

    // Controls
    controlsRoot: { alignItems: 'center', paddingBottom: ds(4) },
    exitBtn: {
      width: ds(44),
      height: ds(44),
      borderRadius: ds(22),
      backgroundColor: isDark ? colors.surfaceContainer : '#EBEBF0',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: ds(18),
    },
    controlsRow: { flexDirection: 'row', alignItems: 'center', gap: ds(20) },
    ctrlBtn: {
      width: ds(52),
      height: ds(52),
      borderRadius: ds(26),
      backgroundColor: isDark ? colors.surfaceContainer : '#EBEBF0',
      justifyContent: 'center',
      alignItems: 'center',
    },
    playBtn: {
      width: ds(80),
      height: ds(80),
      borderRadius: ds(40),
      backgroundColor: currentThemeColor,
      justifyContent: 'center',
      alignItems: 'center',
      ...Shadows.soft,
    },
  });

  // ─── SETUP SCREEN ─────────────────────────────────────────────────────────────
  if (status === 'setup') {
    const effectiveSprints = isCustomMode
      ? customSprints
      : isZenMode
        ? 1
        : mode.sprints;

    return (
      <Animated.View
        style={[s.root, { opacity: setupFade, transform: [{ translateY: setupSlide }] }]}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <View style={{ height: 30 }} />

        <View style={s.header}>
          <Text style={s.title}>Focus</Text>
          <Text style={s.sub}>Set your intention and begin.</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: ds(40) }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mode selector */}
          <View style={s.card}>
            <Text style={s.label}>Mode</Text>
            <View style={s.grid}>
              {[0, 2].map((rowStart) => (
                <View key={rowStart} style={s.gridRow}>
                  {MODES.slice(rowStart, rowStart + 2).map((m, rel) => {
                    const i = rowStart + rel;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[s.gridItem, activeModeIdx === i && { ...s.gridItemActive, borderColor: m.color, backgroundColor: m.color + '12' }]}
                        onPress={() => {
                          setActiveModeIdx(i);
                          if (m.id === 'zen') setSessionTag('Zen');
                          else if (sessionTag === 'Zen') setSessionTag('Work');
                          triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.78}
                      >
                        <View style={s.gridItemRow}>
                          <Ionicons name={m.icon} size={ds(16)} color={activeModeIdx === i ? m.color : colors.textVariant} />
                          <Text style={[s.gridItemText, activeModeIdx === i && { color: m.color }]}>{m.name}</Text>
                        </View>
                        <Text style={s.gridItemDesc}>{m.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Zen duration picker */}
            {isZenMode && (
              <View style={{ marginTop: ds(16) }}>
                <Text style={[s.label, { marginBottom: ds(10) }]}>Duration</Text>
                <View style={s.zenDurationRow}>
                  {ZEN_DURATIONS.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[s.zenChip, zenDuration === d && s.zenChipActive]}
                      onPress={() => {
                        setZenDuration(d);
                        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text
                        style={[s.zenChipText, zenDuration === d && s.zenChipTextActive]}
                      >
                        {d < 60 ? `${d}m` : `${d / 60}h`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Custom fields */}
            {isCustomMode && (
              <View style={{ marginTop: ds(16) }}>
                <View style={{ flexDirection: 'row', gap: ds(12), marginBottom: ds(16) }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.label, { marginBottom: ds(6) }]}>Focus (min)</Text>
                    <TextInput
                      style={s.input}
                      keyboardType="numeric"
                      value={customFocus}
                      onChangeText={setCustomFocus}
                      maxLength={3}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.label, { marginBottom: ds(6) }]}>Break (min)</Text>
                    <TextInput
                      style={s.input}
                      keyboardType="numeric"
                      value={customBreak}
                      onChangeText={setCustomBreak}
                      maxLength={3}
                    />
                  </View>
                </View>
                <Text style={[s.label, { marginBottom: ds(10) }]}>Sprints</Text>
                <View style={s.sprintRow}>
                  {SPRINT_COUNT_OPTIONS.map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[s.sprintChip, customSprints === n && s.sprintChipActive]}
                      onPress={() => {
                        setCustomSprints(n);
                        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text
                        style={[
                          s.sprintChipText,
                          customSprints === n && s.sprintChipTextActive,
                        ]}
                      >
                        {n}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Sprint info for non-custom, non-zen */}
            {!isCustomMode && !isZenMode && (
              <View
                style={{
                  marginTop: ds(14),
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: ds(6),
                }}
              >
                <Ionicons name="repeat-outline" size={ds(14)} color={colors.textVariant} />
                <Text style={{ fontSize: ds(12), color: colors.textVariant, opacity: 0.7 }}>
                  {mode.sprints} sprints · {mode.focus} min focus · {mode.break} min break
                </Text>
              </View>
            )}
          </View>

          {/* Session details */}
          <View style={s.card}>
            <Text style={s.label}>Session</Text>
            <TextInput
              style={s.input}
              placeholder={
                isZenMode
                  ? 'Meditative intention (optional)'
                  : 'What will you work on?'
              }
              placeholderTextColor={colors.textVariant + '70'}
              value={sessionName}
              onChangeText={setSessionName}
              numberOfLines={1}
              maxLength={50}
            />

            <Text style={[s.label, { marginTop: ds(16) }]}>Tag</Text>
            <View style={s.tagRow}>
              {TAGS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    s.tagChip,
                    t === sessionTag && { ...s.tagChipActive, backgroundColor: modeColor, borderColor: modeColor },
                  ]}
                  onPress={() => {
                    setSessionTag(t);
                    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={[s.tagText, t === sessionTag && s.tagActiveText]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Start button */}
          <TouchableOpacity style={s.mainBtn} onPress={startSession} activeOpacity={0.88}>
            <Text style={s.mainBtnText}>
              {isZenMode
                ? `BEGIN ZEN · ${zenDuration < 60 ? `${zenDuration}m` : `${zenDuration / 60}h`}`
                : `START · ${effectiveSprints} SPRINT${effectiveSprints > 1 ? 'S' : ''}`}
            </Text>
          </TouchableOpacity>

          {/* Session history */}
          {logs.length > 0 && (
            <>
              <View style={s.recordsHeader}>
                <Text style={s.recordsTitle}>Recent Sessions</Text>
                <TouchableOpacity
                  onPress={async () => {
                    await AsyncStorage.removeItem('@focus_logs_v3');
                    setLogs([]);
                  }}
                >
                  <Text style={{ fontSize: ds(12), color: colors.error, fontWeight: '700' }}>
                    Clear
                  </Text>
                </TouchableOpacity>
              </View>

              {logs.map((log) => {
                const logMode = MODES.find((m) => m.id === log.mode);
                const logColor = logMode?.color || colors.primary;
                return (
                  <View key={log.id} style={s.logCard}>
                    <View style={s.logInfo}>
                      <Text style={s.logName} numberOfLines={1}>
                        {log.name}
                      </Text>
                      <View style={s.logBadgeRow}>
                        <View style={[s.logBadge, { backgroundColor: logColor + '15' }]}>
                          <Text style={[s.logBadgeText, { color: logColor }]}>
                            #{log.tag.toUpperCase()}
                          </Text>
                        </View>
                        {log.completedSprints && (
                          <View style={[s.logBadge, { backgroundColor: logColor + '10' }]}>
                            <Text style={[s.logBadgeText, { color: logColor }]}>
                              {log.completedSprints} sprint{log.completedSprints > 1 ? 's' : ''}
                            </Text>
                          </View>
                        )}
                        <Text style={s.logMeta}>
                          {new Date(log.timestamp).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{
                        fontSize: ds(16),
                        fontWeight: '800',
                        color: logColor,
                      }}
                    >
                      {log.duration}m
                    </Text>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </Animated.View>
    );
  }

  // ─── TIMER SCREEN ─────────────────────────────────────────────────────────────
  const phaseLabel = isZenMode
    ? 'BREATHING'
    : status === 'focus'
      ? (timeLeft < 0 ? 'OVERTIME' : 'FOCUSING')
      : status === 'break'
        ? 'RECOVERING'
        : 'DONE';

  const totalSessionMinutes = Math.round(
    (Date.now() - sessionStartTime) / 60000
  );

  return (
    <View style={[s.root]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Soft background gradient */}
      <LinearGradient
        colors={
          isDark
            ? [colors.background, modeColor + '0A']
            : ['#FFFFFF', modeColor + '08']
        }
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[
          s.timerRoot,
          {
            opacity: fadeIn,
            transform: [{ translateY: slideUp }],
          },
        ]}
      >
        {/* Header */}
        <Animated.View
          style={[
            s.timerHeader,
            {
              opacity: headerFade,
              transform: [{ translateY: headerSlide }],
            },
          ]}
        >
          <View
            style={[
              s.sessionTagBadge,
              { backgroundColor: currentThemeColor + '15' },
            ]}
          >
            <Text style={[s.sessionTagText, { color: currentThemeColor }]}>
              {sessionTag.toUpperCase()} · {phaseLabel}
            </Text>
          </View>
          <Text style={s.sessionTitle} numberOfLines={1} ellipsizeMode="tail">
            {sessionName || (isZenMode ? 'Zen Meditation' : 'Focus Session')}
          </Text>
        </Animated.View>

        {/* Sprint progress dots */}
        {totalSprints > 1 && (
          <View style={{ marginTop: ds(32) }}>
            <SprintDots
              total={totalSprints}
              completed={completedSprints}
              current={currentSprint}
              color={currentThemeColor}
            />
          </View>
        )}

        {/* Timer section with rings and breathe label */}
        <View style={s.timerCenter}>
          {/* Inner wave ring, outside main circle */}
          {status === 'focus' && isActive && (
            <Animated.View
              style={[
                s.waveRing,
                {
                  transform: [
                    {
                      scale: wavyPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.12],
                      }),
                    },
                  ],
                  opacity: wavyPulse.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.5, 0.15, 0.5],
                  }),
                },
              ]}
            />
          )}

          {/* Outer wave ring */}
          {status === 'focus' && isActive && (
            <Animated.View
              style={[
                s.waveRingOuter,
                {
                  transform: [
                    {
                      scale: wavyPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1.05, 1.2],
                      }),
                    },
                  ],
                  opacity: wavyPulse.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 0.1, 0.3],
                  }),
                },
              ]}
            />
          )}

          {/* Centered content for breathe label and ring */}
          <View style={s.timerContent}>
            {/* Breathe label, relatively positioned above ring */}
            {isActive && (
              <Animated.View style={[s.breatheOverlay, { opacity: breatheOpacity }]}>
                <Text style={s.breatheText}>{breatheLabel}</Text>
              </Animated.View>
            )}

            {/* Main timer ring */}
            <Animated.View
              style={[
                s.ring,
                {
                  transform: [{ scale: Animated.multiply(pulseAnim, timerScale) }],
                  borderColor: currentThemeColor + '25',
                },
              ]}
            >
              {/* Water fill animation */}
              <WaterFill
                percent={percent}
                color={currentThemeColor}
                isActive={isActive}
              />

              <Text style={s.timeText}>{formatTime(timeLeft)}</Text>
              <Text style={s.phaseText}>{phaseLabel}</Text>

              {/* Sprint label inside ring */}
              {totalSprints > 1 && (
                <Text
                  style={{
                    fontSize: ds(10),
                    color: colors.textVariant,
                    opacity: 0.55,
                    marginTop: ds(4),
                    fontWeight: '700',
                    letterSpacing: ds(1),
                  }}
                >
                  SPRINT {currentSprint + 1} / {totalSprints}
                </Text>
              )}
            </Animated.View>
          </View>
        </View>

        {/* Controls */}
        <View style={s.controlsRoot}>
          <TouchableOpacity
            style={s.exitBtn}
            onPress={() => {
              triggerHaptic();
              const endTs = Date.now();
              const elapsedMin = sessionStartTime > 0 ? Math.round((endTs - sessionStartTime) / 60000) : 0;
              // If the user actually used the timer today, capture it in the daily log.
              if (sessionStartTime > 0 && elapsedMin >= 1) {
                recordFocusSession({
                  startTs: sessionStartTime,
                  endTs,
                  title: sessionName || (isZenMode ? 'Zen Flow' : 'Focus Session'),
                  tag: sessionTag,
                  mode: mode.id,
                }).catch(() => { });
              }
              setStatus('setup');
              setIsActive(false);
              setCompletedSprints(0);
              setCurrentSprint(0);
            }}
          >
            <Ionicons name="close-outline" size={ds(26)} color={colors.textVariant} />
          </TouchableOpacity>

          <View style={s.controlsRow}>
            {/* Reset current phase */}
            <TouchableOpacity
              style={s.ctrlBtn}
              onPress={() => {
                triggerHaptic();
                setTimeLeft(totalTime);
              }}
            >
              <Ionicons name="refresh-outline" size={ds(22)} color={colors.textVariant} />
            </TouchableOpacity>

            {/* Play/Pause */}
            <RippleBtn
              style={[s.playBtn, { backgroundColor: currentThemeColor }]}
              onPress={() => {
                triggerHaptic();
                setIsActive(!isActive);
              }}
            >
              <Ionicons
                name={isActive ? 'pause' : 'play'}
                size={ds(36)}
                color="#fff"
              />
            </RippleBtn>

            {/* Skip phase */}
            <TouchableOpacity style={s.ctrlBtn} onPress={skipPhase}>
              <Ionicons
                name="play-skip-forward-outline"
                size={ds(22)}
                color={colors.textVariant}
              />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Completion modal */}
      <CelebrationOverlay
        visible={showComplete}
        onDismiss={handleCompleteSession}
        completedSprints={completedSprints}
        sessionName={sessionName || (isZenMode ? 'Zen Meditation' : 'Focus Session')}
        modeColor={modeColor}
        totalMinutes={totalSessionMinutes}
      />
    </View>
  );
}