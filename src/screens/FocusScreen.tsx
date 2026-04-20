import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
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
  AppState
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake, activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Typography, Shadows } from '../theme/Theme';
import { scaleFontSize } from '../utils/ResponsiveSize';
import { useTheme } from '../context/ThemeContext';
import { useAudioPlayer } from 'expo-audio';
import { recordFocusSession, recordHabitCompleted, recordTodoCompleted } from '../services/DailyLogService';

// ─── Task Selection Types ──────────────────────────────────────────────────
interface LinkedTask {
  id: string;
  type: 'habit' | 'todo';
  name: string;
  expectedMinutes?: number;
  timeSpentSeconds: number;
}

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
    desc: '25 min focus · 5 min break',
    color: '#1A73E8',
    emoji: '🍅',
  },
  {
    id: 'deep_work',
    name: 'Deep Work',
    focus: 90,
    break: 15,
    icon: 'flash-outline' as const,
    sprints: 2,
    desc: '90 min deep dive · 15 min rest',
    color: '#7B1FA2',
    emoji: '⚡',
  },
  {
    id: 'zen',
    name: 'Zen Flow',
    focus: 10,
    break: 0,
    icon: 'leaf-outline' as const,
    sprints: 1,
    desc: 'Breathe · meditate · be present',
    color: '#0F9D58',
    emoji: '🌿',
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
    emoji: '⚙️',
  },
];

// Zen duration presets
const ZEN_DURATIONS = [2, 5, 10, 15, 20, 30, 45, 60];

const TAGS = ['Work', 'Code', 'Study', 'Personal', 'Health', 'Zen'];
const TAG_ICONS: Record<string, any> = {
  Work: 'briefcase-outline',
  Code: 'code-slash-outline',
  Study: 'book-outline',
  Personal: 'person-outline',
  Health: 'heart-outline',
  Zen: 'leaf-outline',
};

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

// ─── Drum Scroll Picker ───────────────────────────────────────────────────────
// ─── Time Stepper Picker ──────────────────────────────────────────────────────
const TimePickerSheet: React.FC<{
  visible: boolean;
  title: string;
  color: string;
  value: { m: number; s: number };
  onChange: (v: { m: number; s: number }) => void;
  onClose: () => void;
  maxMinutes?: number;
  allowZero?: boolean;
}> = ({ visible, title, color, value, onChange, onClose, maxMinutes = 300, allowZero = false }) => {
  const [localM, setLocalM] = useState(value.m);
  const [localS, setLocalS] = useState(value.s);
  const [mounted, setMounted] = useState(false);
  const slideAnim = useRef(new Animated.Value(500)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setLocalM(value.m);
      setLocalS(value.s);
      setMounted(true);
      slideAnim.setValue(500);
      overlayAnim.setValue(0);
      Animated.parallel([
        Animated.timing(overlayAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 65, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 500, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  const adjustM = (delta: number) => {
    const next = Math.max(0, Math.min(maxMinutes, localM + delta));
    setLocalM(next);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const adjustS = (delta: number) => {
    let next = localS + delta;
    if (next < 0) {
      if (localM > 0) { setLocalM(localM - 1); next = 55; }
      else next = 0;
    } else if (next >= 60) {
      if (localM < maxMinutes) { setLocalM(localM + 1); next = 0; }
      else next = 55;
    }
    setLocalS(next);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const confirm = () => {
    onChange({ m: localM, s: localS });
    onClose();
  };

  if (!mounted) return null;

  const totalSecs = localM * 60 + localS;

  const fmtDisplay = () => {
    if (totalSecs === 0 && allowZero) return 'None';
    const parts = [];
    if (localM > 0) parts.push(`${localM}m`);
    if (localS > 0 || localM === 0) parts.push(`${String(localS).padStart(2, '0')}s`);
    return parts.join(' ');
  };

  const StepBtn = ({ onPress, icon }: { onPress: () => void; icon: string }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        width: ds(44), height: ds(44), borderRadius: ds(22),
        backgroundColor: color + '12',
        justifyContent: 'center', alignItems: 'center',
      }}
    >
      <Ionicons name={icon as any} size={ds(20)} color={color} />
    </TouchableOpacity>
  );

  const UnitBlock = ({
    value: val, label, onInc, onDec,
  }: { value: number; label: string; onInc: () => void; onDec: () => void }) => (
    <View style={{ alignItems: 'center', flex: 1, gap: ds(8) }}>
      <StepBtn onPress={onInc} icon="chevron-up" />
      <View style={{
        backgroundColor: color + '10', borderRadius: ds(16),
        paddingHorizontal: ds(16), paddingVertical: ds(10),
        minWidth: ds(80), alignItems: 'center',
        borderWidth: 1.5, borderColor: color + '25',
      }}>
        <Text style={{
          fontSize: ds(36), fontWeight: '800', color,
          fontVariant: ['tabular-nums'], lineHeight: ds(44),
        }}>
          {String(val).padStart(2, '0')}
        </Text>
        <Text style={{
          fontSize: ds(10), fontWeight: '700', color,
          opacity: 0.55, letterSpacing: 1.5, textTransform: 'uppercase',
        }}>
          {label}
        </Text>
      </View>
      <StepBtn onPress={onDec} icon="chevron-down" />
    </View>
  );

  // Quick presets in total seconds
  const focusPresets = [30, 60, 120, 300, 600, 900, 1500, 1800, 2700, 3600, 5400];
  const breakPresets = [0, 30, 60, 120, 180, 300, 600, 900];
  const presets = allowZero ? breakPresets : focusPresets;

  const fmtPreset = (secs: number) => {
    if (secs === 0) return 'None';
    if (secs < 60) return `${secs}s`;
    if (secs % 3600 === 0) return `${secs / 3600}h`;
    if (secs % 60 === 0) return `${secs / 60}m`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  return (
    <Modal transparent animationType="none" visible={mounted} statusBarTranslucent>
      <Animated.View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end', opacity: overlayAnim,
      }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        <Animated.View style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: ds(28), borderTopRightRadius: ds(28),
          paddingTop: ds(8),
          paddingHorizontal: ds(24),
          paddingBottom: Platform.OS === 'ios' ? ds(44) : ds(28),
          transform: [{ translateY: slideAnim }],
          shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 20,
        }}>
          {/* Handle */}
          <View style={{
            width: ds(36), height: ds(4), borderRadius: ds(2),
            backgroundColor: '#DDD', alignSelf: 'center', marginBottom: ds(20),
          }} />

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: ds(28) }}>
            <Text style={{ fontSize: ds(17), fontWeight: '800', color: '#1A1A2E', flex: 1 }}>
              {title}
            </Text>
            <View style={{
              backgroundColor: color + '15', borderRadius: ds(12),
              paddingHorizontal: ds(12), paddingVertical: ds(5),
            }}>
              <Text style={{ fontSize: ds(14), fontWeight: '700', color }}>
                {fmtDisplay()}
              </Text>
            </View>
          </View>

          {/* MM : SS steppers */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: ds(12) }}>
            <UnitBlock value={localM} label="min" onInc={() => adjustM(1)} onDec={() => adjustM(-1)} />
            <Text style={{ fontSize: ds(32), fontWeight: '800', color: '#DDD', marginBottom: ds(20) }}>:</Text>
            <UnitBlock value={localS} label="sec" onInc={() => adjustS(5)} onDec={() => adjustS(-5)} />
          </View>

          {/* Quick presets */}
          <View style={{
            flexDirection: 'row', flexWrap: 'wrap', gap: ds(8),
            marginTop: ds(20), justifyContent: 'center',
          }}>
            {presets.map((preset) => {
              const pm = Math.floor(preset / 60);
              const ps = preset % 60;
              const isActive = localM === pm && localS === ps;
              return (
                <TouchableOpacity
                  key={preset}
                  onPress={() => {
                    setLocalM(pm);
                    setLocalS(ps);
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{
                    paddingHorizontal: ds(14), paddingVertical: ds(8),
                    borderRadius: ds(20),
                    backgroundColor: isActive ? color : color + '10',
                    borderWidth: 1.5,
                    borderColor: isActive ? color : color + '25',
                  }}
                >
                  <Text style={{ fontSize: ds(13), fontWeight: '700', color: isActive ? '#fff' : color }}>
                    {fmtPreset(preset)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Confirm */}
          <TouchableOpacity
            onPress={confirm}
            activeOpacity={0.85}
            disabled={totalSecs === 0 && !allowZero}
            style={{
              marginTop: ds(24),
              height: ds(52), borderRadius: ds(16),
              backgroundColor: totalSecs === 0 && !allowZero ? '#CCC' : color,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: ds(15) }}>
              {totalSecs === 0 && allowZero ? 'Set No Break' : `Set ${fmtDisplay()}`}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ─── Custom Confirm Sheet ─────────────────────────────────────────────────────
interface ConfirmSheetAction {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'destructive' | 'cancel';
}

const ConfirmSheet: React.FC<{
  visible: boolean;
  icon?: any;
  iconColor?: string;
  title: string;
  message?: string;
  actions: ConfirmSheetAction[];
}> = ({ visible, icon, iconColor = '#888', title, message, actions }) => {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 300, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
          opacity: overlayAnim,
        }}
      >
        <Animated.View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: ds(28),
            borderTopRightRadius: ds(28),
            paddingTop: ds(8),
            paddingHorizontal: ds(20),
            paddingBottom: Platform.OS === 'ios' ? ds(40) : ds(24),
            transform: [{ translateY: slideAnim }],
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 24,
            elevation: 24,
          }}
        >
          {/* Handle bar */}
          <View style={{
            width: ds(36), height: ds(4), borderRadius: ds(2),
            backgroundColor: '#DDD', alignSelf: 'center', marginBottom: ds(20),
          }} />

          {/* Icon */}
          {icon && (
            <View style={{
              width: ds(52), height: ds(52), borderRadius: ds(26),
              backgroundColor: iconColor + '15',
              justifyContent: 'center', alignItems: 'center',
              alignSelf: 'center', marginBottom: ds(14),
            }}>
              <Ionicons name={icon} size={ds(26)} color={iconColor} />
            </View>
          )}

          {/* Title */}
          <Text style={{
            fontSize: ds(17), fontWeight: '800', color: '#1A1A2E',
            textAlign: 'center', marginBottom: message ? ds(6) : ds(24),
          }}>
            {title}
          </Text>

          {/* Message */}
          {message && (
            <Text style={{
              fontSize: ds(13), color: '#888', textAlign: 'center',
              marginBottom: ds(24), lineHeight: ds(19),
            }}>
              {message}
            </Text>
          )}

          {/* Actions */}
          <View style={{ gap: ds(10) }}>
            {actions.map((action, idx) => {
              const isDestructive = action.variant === 'destructive';
              const isCancel = action.variant === 'cancel';
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={action.onPress}
                  activeOpacity={0.78}
                  style={{
                    height: ds(52),
                    borderRadius: ds(16),
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: isDestructive
                      ? '#FF3B3010'
                      : isCancel
                        ? '#F2F2F7'
                        : '#F2F2F7',
                    borderWidth: isDestructive ? 1 : 0,
                    borderColor: isDestructive ? '#FF3B3025' : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: ds(15),
                    fontWeight: isCancel ? '600' : '700',
                    color: isDestructive ? '#FF3B30' : isCancel ? '#888' : '#1A1A2E',
                  }}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
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
  isZen: boolean;
}> = ({ visible, onDismiss, completedSprints, sessionName, modeColor, totalMinutes, isZen }) => {
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
            <Ionicons
              name={isZen ? 'leaf' : 'checkmark-circle'}
              size={ds(44)}
              color={modeColor}
            />
          </View>

          <Text style={{ fontSize: ds(22), fontWeight: '800', color: '#1A1A2E', marginBottom: ds(4) }}>
            {isZen ? 'Zen Complete ✨' : 'Session Complete!'}
          </Text>
          <Text style={{ fontSize: ds(14), color: '#666', marginBottom: ds(24), textAlign: 'center' }}>
            {sessionName || (isZen ? 'Zen Meditation' : 'Focus Session')}
          </Text>

          <View style={{ flexDirection: 'row', gap: ds(16), marginBottom: ds(28) }}>
            {!isZen && (
              <>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: ds(28), fontWeight: '800', color: modeColor }}>{completedSprints}</Text>
                  <Text style={{ fontSize: ds(11), color: '#999', fontWeight: '600' }}>SPRINTS</Text>
                </View>
                <View style={{ width: 1, backgroundColor: '#eee' }} />
              </>
            )}
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
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: ds(16) }}>
              {isZen ? 'Return' : 'Done'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FocusScreen() {
  const { colors, isDark } = useTheme();

  // Keep screen awake ONLY while the timer is actively running
  useEffect(() => {
    if (isActive) {
      activateKeepAwakeAsync();
    } else {
      deactivateKeepAwake();
    }
    return () => { deactivateKeepAwake(); };
  }, [isActive]);

  // ─── State ──────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<TimerStatus>('setup');
  const [activeModeIdx, setActiveModeIdx] = useState(0);
  const [sessionName, setSessionName] = useState('');
  const [sessionTag, setSessionTag] = useState('Work');
  const [linkedTask, setLinkedTask] = useState<LinkedTask | null>(null);

  const route = useRoute<any>();

  useEffect(() => {
    if (route.params?.linkedTask) {
      setLinkedTask(route.params.linkedTask);
    }
  }, [route.params?.linkedTask]);

  const [customFocus, setCustomFocus] = useState({ m: 25, s: 0 });
  const [customBreak, setCustomBreak] = useState({ m: 5, s: 0 });
  const [customSprints, setCustomSprints] = useState(3);

  const [zenDuration, setZenDuration] = useState(10);

  const [totalSprints, setTotalSprints] = useState(4);
  const [currentSprint, setCurrentSprint] = useState(0);
  const [completedSprints, setCompletedSprints] = useState(0);

  const player = useAudioPlayer(require('../../assets/timer_end.wav'));

  const scheduledNotifId = useRef<string | null>(null);

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [totalTime, setTotalTime] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [showComplete, setShowComplete] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(0);
  const lastBgTimestamp = useRef<number | null>(null);

  // ─── Confirm sheet state ─────────────────────────────────────────────────────
  const [exitSheetVisible, setExitSheetVisible] = useState(false);
  const [clearHistorySheetVisible, setClearHistorySheetVisible] = useState(false);
  const [validationSheetVisible, setValidationSheetVisible] = useState(false);
  const [validationMessage, setValidationMessage] = useState({ title: '', message: '' });
  const [focusPickerVisible, setFocusPickerVisible] = useState(false);
  const [breakPickerVisible, setBreakPickerVisible] = useState(false);
  const [taskSelectorVisible, setTaskSelectorVisible] = useState(false);
  const [availableTasks, setAvailableTasks] = useState<LinkedTask[]>([]);

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

  const breakBlue = '#1A73E8';
  const currentThemeColor =
    status === 'break' ? breakBlue : modeColor;

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

  // ─── Persistence & Lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    loadLogs();
    (async () => {
      const { status: notifStatus } = await Notifications.requestPermissionsAsync();
    })();
  }, []);

  const cancelAllNotifs = useCallback(async () => {
    if (scheduledNotifId.current) {
      await Notifications.cancelScheduledNotificationAsync(scheduledNotifId.current).catch(() => { });
      scheduledNotifId.current = null;
    }
  }, []);

  const scheduleNextNotif = useCallback(async (seconds: number, phase: string) => {
    await cancelAllNotifs();
    if (seconds <= 0) return;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: phase === 'focus' ? 'Focus Session Complete!' : 'Break Over!',
        body: phase === 'focus' ? 'Great job! Time for a short rest.' : 'Ready to focus again?',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: { type: 'timeInterval', seconds, repeats: false },
    });
    scheduledNotifId.current = id;
  }, [cancelAllNotifs]);

  const isActiveRef = useRef(isActive);
  const timeLeftRef = useRef(timeLeft);
  const statusRef = useRef(status);

  useEffect(() => {
    isActiveRef.current = isActive;
    timeLeftRef.current = timeLeft;
    statusRef.current = status;
  }, [isActive, timeLeft, status]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && lastBgTimestamp.current) {
        const elapsed = Math.floor((Date.now() - lastBgTimestamp.current) / 1000);
        if (isActiveRef.current) {
          const newTime = timeLeftRef.current - elapsed;
          setTimeLeft(newTime);
          if (newTime > 0) scheduleNextNotif(newTime, statusRef.current);
        }
        lastBgTimestamp.current = null;
      } else if (nextAppState.match(/inactive|background/)) {
        lastBgTimestamp.current = Date.now();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [scheduleNextNotif]);

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

    if (linkedTask) {
      updateTaskProgress(linkedTask.id, linkedTask.type, elapsedSecs);
      setLinkedTask(prev => prev ? { ...prev, timeSpentSeconds: prev.timeSpentSeconds + elapsedSecs } : prev);
    }
  }, [status, sessionName, sessionTag, totalTime, timeLeft, mode.id, completedSprints, logs, isZenMode, linkedTask]);

  const updateTaskProgress = async (id: string, type: 'habit' | 'todo', addedSeconds: number) => {
    try {
      if (type === 'habit') {
        const d = await AsyncStorage.getItem('@habits_v3');
        if (!d) return;
        const arr = JSON.parse(d).map((h: any) => {
          if (h.id === id) {
            const spent = (h.timeSpentSeconds || 0) + addedSeconds;
            const exp = (h.expectedMinutes || 0) * 60;
            let comp = h.completed;
            let count = h.count || 0;
            let last = h.lastCompletedDate;
            if (!comp && exp > 0 && spent >= exp) {
              comp = true;
              count += 1;
              last = new Date().toISOString().split('T')[0];
              recordHabitCompleted({ habitId: h.id, name: h.name, completedAt: Date.now(), streak: count }).catch(()=>{});
            }
            return { ...h, timeSpentSeconds: spent, completed: comp, count, lastCompletedDate: last };
          }
          return h;
        });
        await AsyncStorage.setItem('@habits_v3', JSON.stringify(arr));
      } else {
        const d = await AsyncStorage.getItem('@todos_v3');
        if (!d) return;
        const arr = JSON.parse(d).map((t: any) => {
          if (t.id === id) {
            const spent = (t.timeSpentSeconds || 0) + addedSeconds;
            let comp = t.completed;
            if (!comp && addedSeconds > 0) {
              comp = true;
              t.completedAt = Date.now();
              recordTodoCompleted({ todoId: t.id, text: t.text, completedAt: t.completedAt }).catch(()=>{});
            }
            return { ...t, timeSpentSeconds: spent, completed: comp };
          }
          return t;
        });
        await AsyncStorage.setItem('@todos_v3', JSON.stringify(arr));
      }
    } catch {}
  };

  // ─── Haptic ───────────────────────────────────────────────────────────────────
  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(style);
  };

  // ─── Format ───────────────────────────────────────────────────────────────────
  const formatTime = (secs: number) => {
    const absSecs = Math.abs(secs);
    const m = Math.floor(absSecs / 60);
    const s = absSecs % 60;
    const sign = secs < 0 ? '+' : '';
    return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getFocusSecs = useCallback(() => {
    if (isZenMode) return zenDuration * 60;
    if (isCustomMode) return customFocus.m * 60 + customFocus.s;
    return mode.focus * 60;
  }, [isZenMode, isCustomMode, zenDuration, customFocus, mode.focus]);

  // ─── Timer Engine ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let interval: any = null;

    if (isActive && (status === 'focus' || status === 'break')) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      if (Platform.OS !== 'web') Vibration.vibrate([0, 200, 100, 200]);
    }

    if (isActive) {
      scheduleNextNotif(timeLeft, status);
      if (status === 'focus') {
        interval = setInterval(() => {
          setTimeLeft((prev: number) => {
            const next = prev - 1;
            if (next === 60 || next === 30 || next === 10) {
              triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
              if (Platform.OS !== 'web') Vibration.vibrate(150);
            }
            if (next === 0) {
              triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
              if (Platform.OS !== 'web') Vibration.vibrate([0, 500, 200, 500, 200, 500]);
              player.play();
            }
            return next;
          });
        }, 1000);
      } else if (status === 'break') {
        if (timeLeft > 0) {
          interval = setInterval(() => {
            setTimeLeft((prev: number) => {
              const next = prev - 1;
              if (next === 60 || next === 10) {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                if (Platform.OS !== 'web') Vibration.vibrate(150);
              }
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
  }, [isActive, status, (status === 'break' && timeLeft > 0), handlePhaseEnd]);

  const handlePhaseEnd = useCallback(() => {
    setIsActive(false);
    if (Platform.OS !== 'web') Vibration.vibrate([0, 400, 150, 400]);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    player.play();

    if (status === 'focus') {
      saveSession();
      const newCompleted = completedSprints + 1;
      setCompletedSprints(newCompleted);

      const breakSecs = isZenMode
        ? 0
        : isCustomMode
          ? (customBreak.m * 60 + customBreak.s)
          : mode.break * 60;

      if (breakSecs > 0) {
        setStatus('break');
        setTimeLeft(breakSecs);
        setTotalTime(breakSecs);
        setIsActive(false);
      } else {
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
    cancelAllNotifs();
    handlePhaseEnd();
  };

  const startSession = () => {
    if (isCustomMode) {
      const focusTotal = customFocus.m * 60 + customFocus.s;
      if (focusTotal < 1) {
        setValidationMessage({ title: 'Focus Too Short', message: 'Please set at least 1 second of focus time.' });
        setValidationSheetVisible(true);
        return;
      }
      if (focusTotal > 18000) {
        setValidationMessage({ title: 'Focus Too Long', message: 'Maximum focus duration is 5 hours (300 minutes).' });
        setValidationSheetVisible(true);
        return;
      }
    }

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
    scheduleNextNotif(secs, 'focus');
  };

  const handleCompleteSession = () => {
    const endTs = Date.now();
    if (sessionStartTime > 0) {
      recordFocusSession({
        startTs: sessionStartTime,
        endTs,
        title: linkedTask ? linkedTask.name : (sessionName || (isZenMode ? 'Zen Flow' : 'Focus Session')),
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

  const doExitSession = () => {
    const endTs = Date.now();
    const elapsedMin = sessionStartTime > 0 ? Math.round((endTs - sessionStartTime) / 60000) : 0;
    
    if (status === 'focus' && linkedTask) {
      const currentSprintSecs = totalTime > timeLeft ? totalTime - timeLeft : 0;
      if (currentSprintSecs > 0) {
        updateTaskProgress(linkedTask.id, linkedTask.type, currentSprintSecs);
        setLinkedTask(prev => prev ? { ...prev, timeSpentSeconds: prev.timeSpentSeconds + currentSprintSecs } : prev);
      }
    }

    if (sessionStartTime > 0 && elapsedMin >= 1) {
      recordFocusSession({
        startTs: sessionStartTime,
        endTs,
        title: linkedTask ? linkedTask.name : (sessionName || (isZenMode ? 'Zen Flow' : 'Focus Session')),
        tag: sessionTag,
        mode: mode.id,
      }).catch(() => { });
    }
    cancelAllNotifs();
    setStatus('setup');
    setIsActive(false);
    setCompletedSprints(0);
    setCurrentSprint(0);
  };

  // ─── Exit with confirmation if timer running ───────────────────────────────
  const handleExitTimer = () => {
    triggerHaptic();
    if (isActive) {
      setExitSheetVisible(true);
    } else {
      doExitSession();
    }
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

  const percent = totalTime > 0 ? Math.max(0, (timeLeft / totalTime) * 100) : 0;

  // ─── Styles ─────────────────────────────────────────────────────────────────
  const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },

    // Setup
    header: {
      paddingHorizontal: ds(24),
      paddingTop: Platform.OS === 'ios' ? ds(70) : ds(50),
      marginBottom: ds(4),
    },
    title: {
      fontSize: ds(28),
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.8,
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
      padding: ds(16),
      marginHorizontal: ds(16),
      marginBottom: ds(10),
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: ds(5),
      paddingHorizontal: ds(12),
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
      paddingTop: Platform.OS === 'ios' ? ds(110) : ds(80),
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

    timerCenter: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: ds(40),
      overflow: 'visible',
    },

    timerContent: {
      alignItems: 'center',
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
      marginBottom: ds(24),
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

        {/* Subtle gradient header accent */}
        <LinearGradient
          colors={isDark ? [modeColor + '12', 'transparent'] : [modeColor + '08', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ds(200) }}
          pointerEvents="none"
        />

        <View style={{ height: 30 }} />

        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: ds(10) }}>
            <Text style={s.title}>Focus</Text>
            {/* Live mode accent dot */}
            <View style={{
              width: ds(8), height: ds(8), borderRadius: ds(4),
              backgroundColor: modeColor, marginTop: ds(4),
            }} />
          </View>
          <Text style={s.sub}>
            {isZenMode
              ? 'Find stillness. Be present.'
              : 'Set your intention and begin.'}
          </Text>
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
                    const isSelected = activeModeIdx === i;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[
                          s.gridItem,
                          isSelected && { borderColor: m.color, backgroundColor: m.color + '12' },
                        ]}
                        onPress={() => {
                          setActiveModeIdx(i);
                          if (m.id === 'zen') setSessionTag('Zen');
                          else if (sessionTag === 'Zen') setSessionTag('Work');
                          triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.78}
                      >
                        <View style={s.gridItemRow}>
                          <Text style={{ fontSize: ds(14) }}>{m.emoji}</Text>
                          <Text style={[s.gridItemText, isSelected && { color: m.color }]}>
                            {m.name}
                          </Text>
                          {isSelected && (
                            <View style={{ marginLeft: 'auto' }}>
                              <Ionicons name="checkmark-circle" size={ds(14)} color={m.color} />
                            </View>
                          )}
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
                <Text style={[s.label, { marginBottom: ds(10) }]}>Meditation Duration</Text>
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
                {/* Zen tip */}
                <View style={{
                  marginTop: ds(12),
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: ds(6),
                  backgroundColor: modeColor + '10',
                  borderRadius: ds(12),
                  padding: ds(10),
                }}>
                  <Ionicons name="information-circle-outline" size={ds(14)} color={modeColor} />
                  <Text style={{ fontSize: ds(11), color: modeColor, fontWeight: '600', flex: 1 }}>
                    Breathe in · hold · breathe out. Let the timer guide you.
                  </Text>
                </View>
              </View>
            )}

            {/* Linked Task selector */}
            {!isZenMode && (
              <View style={{ marginTop: ds(16) }}>
                <Text style={[s.label, { marginBottom: ds(10) }]}>Linked Task (Optional)</Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: linkedTask ? modeColor + '12' : colors.surface,
                    borderWidth: 1.5,
                    borderColor: linkedTask ? modeColor : 'transparent',
                    borderRadius: ds(16),
                    padding: ds(14),
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onPress={() => {
                    setTaskSelectorVisible(true);
                    triggerHaptic();
                    // Load tasks
                    (async () => {
                      try {
                        const arr: LinkedTask[] = [];
                        const [hData, tData] = await Promise.all([
                          AsyncStorage.getItem('@habits_v3'),
                          AsyncStorage.getItem('@todos_v3')
                        ]);
                        if (hData) {
                          JSON.parse(hData).filter((x: any) => !x.completed).forEach((x: any) => {
                            arr.push({ id: x.id, type: 'habit', name: x.name, expectedMinutes: x.expectedMinutes, timeSpentSeconds: x.timeSpentSeconds || 0 });
                          });
                        }
                        if (tData) {
                          JSON.parse(tData).filter((x: any) => !x.completed && !x.archived && x.tag !== 'Shopping').forEach((x: any) => {
                            arr.push({ id: x.id, type: 'todo', name: x.text, expectedMinutes: x.expectedMinutes, timeSpentSeconds: x.timeSpentSeconds || 0 });
                          });
                        }
                        setAvailableTasks(arr);
                      } catch {}
                    })();
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: ds(10), flex: 1 }}>
                    <Ionicons name={linkedTask ? "link" : "add-circle-outline"} size={ds(20)} color={linkedTask ? modeColor : colors.textVariant} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: ds(14), fontWeight: '700', color: linkedTask ? modeColor : colors.text }}>
                        {linkedTask ? linkedTask.name : "Select a Ritual or Task"}
                      </Text>
                      {linkedTask && linkedTask.expectedMinutes ? (
                        <Text style={{ fontSize: ds(11), color: colors.textVariant, marginTop: ds(2) }}>
                          Expected: {linkedTask.expectedMinutes}m • Spent: {Math.max(0, Math.floor(linkedTask.timeSpentSeconds / 60))}m
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {linkedTask && (
                    <TouchableOpacity onPress={() => { triggerHaptic(); setLinkedTask(null); }} style={{ padding: ds(6) }}>
                      <Ionicons name="close-circle" size={ds(20)} color={colors.textVariant} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Custom fields */}
            {isCustomMode && (
              <View style={{ marginTop: ds(16) }}>
                {/* Focus & Break tap cards */}
                <View style={{ flexDirection: 'row', gap: ds(12), marginBottom: ds(16) }}>
                  {/* Focus duration card */}
                  <TouchableOpacity
                    onPress={() => setFocusPickerVisible(true)}
                    activeOpacity={0.78}
                    style={{
                      flex: 1,
                      backgroundColor: modeColor + '0E',
                      borderRadius: ds(18),
                      borderWidth: 1.5,
                      borderColor: modeColor + '30',
                      padding: ds(14),
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="timer-outline" size={ds(20)} color={modeColor} style={{ marginBottom: ds(6) }} />
                    <Text style={{
                      fontSize: ds(22), fontWeight: '800', color: modeColor,
                      fontVariant: ['tabular-nums'],
                    }}>
                      {customFocus.h > 0
                        ? `${customFocus.h}h ${String(customFocus.m).padStart(2, '0')}m`
                        : `${customFocus.m}m`}
                    </Text>
                    <Text style={{
                      fontSize: ds(10), fontWeight: '700', color: modeColor,
                      opacity: 0.6, marginTop: ds(3), textTransform: 'uppercase', letterSpacing: 1,
                    }}>Focus</Text>
                  </TouchableOpacity>

                  {/* Break duration card */}
                  <TouchableOpacity
                    onPress={() => setBreakPickerVisible(true)}
                    activeOpacity={0.78}
                    style={{
                      flex: 1,
                      backgroundColor: '#1A73E8' + '0E',
                      borderRadius: ds(18),
                      borderWidth: 1.5,
                      borderColor: '#1A73E8' + '30',
                      padding: ds(14),
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="cafe-outline" size={ds(20)} color="#1A73E8" style={{ marginBottom: ds(6) }} />
                    <Text style={{
                      fontSize: ds(22), fontWeight: '800', color: '#1A73E8',
                      fontVariant: ['tabular-nums'],
                    }}>
                      {customBreak.h > 0
                        ? `${customBreak.h}h ${String(customBreak.m).padStart(2, '0')}m`
                        : customBreak.m > 0
                          ? `${customBreak.m}m`
                          : 'None'}
                    </Text>
                    <Text style={{
                      fontSize: ds(10), fontWeight: '700', color: '#1A73E8',
                      opacity: 0.6, marginTop: ds(3), textTransform: 'uppercase', letterSpacing: 1,
                    }}>Break</Text>
                  </TouchableOpacity>
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
                  backgroundColor: modeColor + '10',
                  borderRadius: ds(12),
                  padding: ds(10),
                }}
              >
                <Ionicons name="repeat-outline" size={ds(14)} color={modeColor} />
                <Text style={{ fontSize: ds(12), color: modeColor, fontWeight: '600' }}>
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
              returnKeyType="done"
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
                  <Ionicons
                    name={TAG_ICONS[t] || 'pricetag-outline'}
                    size={ds(11)}
                    color={t === sessionTag ? '#fff' : colors.textVariant}
                  />
                  <Text style={[s.tagText, t === sessionTag && s.tagActiveText]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Start button */}
          <TouchableOpacity style={s.mainBtn} onPress={startSession} activeOpacity={0.88}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: ds(8) }}>
              <Ionicons name={isZenMode ? 'leaf' : 'play'} size={ds(18)} color="#fff" />
              <Text style={s.mainBtnText}>
                {isZenMode
                  ? `BEGIN ZEN · ${zenDuration < 60 ? `${zenDuration}m` : `${zenDuration / 60}h`}`
                  : `START · ${effectiveSprints} SPRINT${effectiveSprints > 1 ? 'S' : ''}`}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Session history */}
          {logs.length > 0 && (
            <>
              <View style={s.recordsHeader}>
                <Text style={s.recordsTitle}>Recent Sessions</Text>
                <TouchableOpacity
                  onPress={() => {
                    setClearHistorySheetVisible(true);
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
                    <View
                      style={{
                        width: ds(36),
                        height: ds(36),
                        borderRadius: ds(18),
                        backgroundColor: logColor + '15',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: ds(10),
                      }}
                    >
                      <Ionicons
                        name={logMode?.icon || 'timer-outline'}
                        size={ds(16)}
                        color={logColor}
                      />
                    </View>
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
                        {log.completedSprints != null && log.completedSprints > 0 && (
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

      {/* Focus time picker */}
      <TimePickerSheet
        visible={focusPickerVisible}
        title="Focus Duration"
        color={modeColor}
        value={customFocus}
        onChange={setCustomFocus}
        onClose={() => setFocusPickerVisible(false)}
        maxHours={5}
      />

      {/* Break time picker */}
      <TimePickerSheet
        visible={breakPickerVisible}
        title="Break Duration"
        color="#1A73E8"
        value={customBreak}
        onChange={setCustomBreak}
        onClose={() => setBreakPickerVisible(false)}
        maxHours={1}
        allowZero
      />

      {/* Validation sheet */}
      <ConfirmSheet
        visible={validationSheetVisible}
        icon="alert-circle-outline"
        iconColor="#F57C00"
        title={validationMessage.title}
        message={validationMessage.message}
        actions={[
          {
            label: 'Got it',
            variant: 'default',
            onPress: () => setValidationSheetVisible(false),
          },
        ]}
      />

      {/* Clear history sheet */}
      <ConfirmSheet
        visible={clearHistorySheetVisible}
        icon="trash-outline"
        iconColor="#FF3B30"
        title="Clear History?"
        message="All session records will be permanently deleted."
        actions={[
          {
            label: 'Delete All',
            variant: 'destructive',
            onPress: async () => {
              setClearHistorySheetVisible(false);
              await AsyncStorage.removeItem('@focus_logs_v3');
              setLogs([]);
            },
          },
          {
            label: 'Cancel',
            variant: 'cancel',
            onPress: () => setClearHistorySheetVisible(false),
          },
        ]}
      />
      </Animated.View>
    );
  }

  // ─── TIMER SCREEN ─────────────────────────────────────────────────────────────
  const phaseLabel = isZenMode
    ? (status === 'focus' ? 'BREATHING' : 'RESTING')
    : status === 'focus'
      ? (timeLeft < 0 ? 'OVERTIME' : 'FOCUSING')
      : status === 'break'
        ? 'RECOVERING'
        : 'DONE';

  const totalSessionMinutes = Math.max(
    1,
    Math.round((Date.now() - sessionStartTime) / 60000)
  );

  return (
    <View style={[s.root]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Soft background gradient */}
      <LinearGradient
        colors={
          isDark
            ? [colors.background, currentThemeColor + '0A']
            : ['#FFFFFF', currentThemeColor + '08']
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

          {/* Phase transition hint for break */}
          {status === 'break' && (
            <Text style={{
              fontSize: ds(11),
              color: colors.textVariant,
              opacity: 0.6,
              marginTop: ds(4),
              fontWeight: '600',
            }}>
              Press ▶ when you're ready to continue
            </Text>
          )}
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

        {/* Timer section */}
        <View style={s.timerCenter}>
          {/* Inner wave ring */}
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

          <View style={s.timerContent}>
            {/* Breathe label */}
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
              <WaterFill
                percent={percent}
                color={currentThemeColor}
                isActive={isActive}
              />

              <Text style={s.timeText}>{formatTime(timeLeft)}</Text>
              <Text style={s.phaseText}>{phaseLabel}</Text>

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
            onPress={handleExitTimer}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
                setIsActive(false);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
            <TouchableOpacity
              style={s.ctrlBtn}
              onPress={skipPhase}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
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
        isZen={isZenMode}
      />

      {/* Exit confirmation sheet */}
      <ConfirmSheet
        visible={exitSheetVisible}
        icon="stop-circle-outline"
        iconColor="#FF3B30"
        title="End Session?"
        message="Your progress so far will be saved."
        actions={[
          {
            label: 'End Session',
            variant: 'destructive',
            onPress: () => {
              setExitSheetVisible(false);
              doExitSession();
            },
          },
          {
            label: 'Keep Going',
            variant: 'cancel',
            onPress: () => setExitSheetVisible(false),
          },
        ]}
      />

      {/* Task Selector Modal */}
      <Modal visible={taskSelectorVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: ds(24), borderTopRightRadius: ds(24), padding: ds(20), maxHeight: height * 0.7 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: ds(16) }}>
              <Text style={{ fontSize: ds(20), fontWeight: '800', color: colors.text }}>Select a Task</Text>
              <TouchableOpacity onPress={() => setTaskSelectorVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={ds(24)} color={colors.textVariant} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: ds(40) }}>
              {availableTasks.length === 0 ? (
                <Text style={{ textAlign: 'center', color: colors.textVariant, marginTop: ds(30) }}>
                  No active rituals or tasks available.
                </Text>
              ) : (
                availableTasks.map((t) => (
                  <TouchableOpacity
                    key={t.id + t.type}
                    style={{
                      padding: ds(16),
                      backgroundColor: colors.surface,
                      borderRadius: ds(16),
                      marginBottom: ds(10),
                      borderWidth: 1.5,
                      borderColor: linkedTask?.id === t.id ? modeColor : 'transparent'
                    }}
                    onPress={() => {
                      triggerHaptic();
                      setLinkedTask(t);
                      setTaskSelectorVisible(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: ds(10) }}>
                      <Ionicons
                        name={t.type === 'habit' ? 'repeat-outline' : 'checkbox-outline'}
                        size={ds(20)}
                        color={t.type === 'habit' ? '#FF9F0A' : '#30D158'}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: ds(16), fontWeight: '600', color: colors.text }}>{t.name}</Text>
                        <Text style={{ fontSize: ds(12), color: colors.textVariant }}>
                          {t.type === 'habit' ? 'Daily Ritual' : 'Todo Task'}
                          {t.expectedMinutes ? ` • Goal: ${t.expectedMinutes}m` : ''}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}