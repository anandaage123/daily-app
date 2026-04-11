import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  TextInput,
  Animated,
  Easing,
  Alert,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { scaleFontSize, scaleSize } from '../utils/ResponsiveSize';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');
import periodData from '../data/periodTrackerData.json';

const SYMPTOMS = periodData.SYMPTOMS;
const MOOD_COLORS = periodData.MOOD_COLORS;
const FLOW_OPTIONS = periodData.FLOW_OPTIONS;
const PROTECTION_OPTIONS = periodData.PROTECTION_OPTIONS;
const EMERGENCY_RESOURCES = periodData.EMERGENCY_RESOURCES;
const INSIGHTS_KNOWLEDGE = periodData.INSIGHTS_KNOWLEDGE;
const CYCLE_PHASES: Record<string, CyclePhase> = periodData.CYCLE_PHASES;
const PHASES = Object.values(CYCLE_PHASES);

// Pre-calculated symptom groups to avoid runtime overhead and fix invalid keys
const SYMPTOM_GROUPS = [
  { title: 'Physical', items: ['cramps', 'headache', 'bloating', 'backache', 'breast_tenderness', 'hot_flashes'] },
  { title: 'Mood & Wellbeing', items: ['fatigue', 'insomnia', 'nausea'] },
  { title: 'Cycle Markers', items: ['spotting', 'discharge', 'acne'] }
];

// ─── TYPES ───────────────────────────────────────────────────────────────────
type FlowIntensity = 'spotting' | 'light' | 'normal' | 'heavy' | 'very_heavy';
type MoodType = 'happy' | 'sad' | 'anxious' | 'irritable' | 'calm' | 'energetic' | 'fatigued' | 'neutral';
type ProtectionType = 'condom' | 'pill' | 'iud' | 'implant' | 'none' | 'other';
type SymptomType =
  | 'cramps' | 'headache' | 'bloating' | 'backache'
  | 'breast_tenderness' | 'acne' | 'nausea' | 'fatigue'
  | 'insomnia' | 'hot_flashes' | 'spotting' | 'discharge';

interface PeriodLog {
  id: string;
  startDate: string;
  endDate?: string;
  isActive?: boolean;
  duration: number;
  flowIntensity: FlowIntensity;
  symptoms: SymptomType[];
  mood?: MoodType;
  painLevel?: number;
  notes?: string;
}

interface IntimacyLog {
  id: string;
  date: string;
  protection: ProtectionType;
  notes?: string;
}

interface CyclePhase {
  name: string;
  startDay: number;
  endDay: number;
  icon: string;
  color: string;
  desc: string;
  characteristics: string[];
  recommendations: string[];
}


// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
const toDateStr = (d: Date) => d.toISOString().split('T')[0];
const todayStr = () => toDateStr(new Date());
const parseDate = (s: string) => new Date(s + 'T00:00:00');
const daysBetween = (a: string, b: string) =>
  Math.floor((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);

// ─── MINI CALENDAR PICKER ─────────────────────────────────────────────────────
interface CalendarPickerProps {
  value: string;
  onChange: (date: string) => void;
  maxDate?: string;
  minDate?: string;
  highlightStart?: string;
  highlightEnd?: string;
  label?: string;
  accentColor?: string;
  colors: any;
  isDark: boolean;
}

function CalendarPicker({ value, onChange, maxDate, minDate, highlightStart, highlightEnd, label, accentColor = '#4052B6', colors, isDark }: CalendarPickerProps) {
  const [open, setOpen] = useState(false);
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const surfaceVar = isDark ? '#2C2C2E' : '#F2F2F7';
  const outline = isDark ? '#3A3A3C' : '#E5E5EA';
  const secText = isDark ? '#A1A1AA' : '#666666';
  const initDate = value ? parseDate(value) : new Date();
  const [calView, setCalView] = useState(new Date(initDate.getFullYear(), initDate.getMonth(), 1));

  const animHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animHeight, {
      toValue: open ? 1 : 0,
      duration: 300,
      useNativeDriver: false, // Animating height/layout
    }).start();
  }, [open]);

  useEffect(() => {
    if (value) {
      const d = parseDate(value);
      setCalView(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [value]);

  const month = calView.getMonth();
  const year = calView.getFullYear();
  const daysInM = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInM; i++) cells.push(new Date(year, month, i));

  const displayLabel = value
    ? parseDate(value).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    : 'Select Date';

  return (
    <View style={{ marginBottom: scaleSize(12) }}>
      {label ? <Text style={{ fontSize: scaleFontSize(10), fontWeight: '800', color: secText, textTransform: 'uppercase', letterSpacing: 1, marginBottom: scaleSize(6), marginLeft: 4 }}>{label}</Text> : null}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => { setOpen(!open); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: surfaceVar, borderRadius: scaleSize(16),
          padding: scaleSize(14), borderWidth: 1.5, borderColor: open ? accentColor : 'transparent'
        }}
      >
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: accentColor + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
          <MaterialCommunityIcons name="calendar-month" size={18} color={accentColor} />
        </View>
        <Text style={{ flex: 1, fontSize: scaleFontSize(15), fontWeight: '700', color: value ? colors.text : secText }}>{displayLabel}</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'calendar-search'} size={18} color={open ? accentColor : secText} />
      </TouchableOpacity>

      <Animated.View style={{
        marginTop: scaleSize(10),
        overflow: 'hidden',
        maxHeight: animHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 500] }),
        opacity: animHeight
      }}>
        <View style={{ backgroundColor: cardBg, borderRadius: scaleSize(20), borderWidth: 1.5, borderColor: outline, padding: scaleSize(16) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scaleSize(14) }}>
            <TouchableOpacity onPress={() => setCalView(new Date(year, month - 1, 1))} style={{ width: 32, height: 32, backgroundColor: surfaceVar, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={16} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: scaleFontSize(15), fontWeight: '900', color: colors.text }}>
              {calView.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity
              onPress={() => { const next = new Date(year, month + 1, 1); if (!maxDate || toDateStr(next) <= maxDate) setCalView(next); }}
              style={{ width: 32, height: 32, backgroundColor: surfaceVar, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', marginBottom: scaleSize(10) }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: scaleFontSize(10), fontWeight: '800', color: secText }}>{d}</Text>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((date, idx) => {
              const cellW = (width - scaleSize(96)) / 7;
              if (!date) return <View key={`e-${idx}`} style={{ width: cellW, height: scaleSize(40) }} />;
              const ds = toDateStr(date);
              const isToday = ds === todayStr();
              const isSel = ds === value;
              const disabled = (maxDate ? ds > maxDate : false) || (minDate ? ds < minDate : false);
              const inRange = highlightStart && highlightEnd && ds >= highlightStart && ds <= highlightEnd;

              return (
                <TouchableOpacity
                  key={idx} disabled={disabled}
                  onPress={() => { onChange(ds); setOpen(false); Haptics.selectionAsync(); }}
                  style={{ width: cellW, height: scaleSize(40), alignItems: 'center', justifyContent: 'center' }}
                >
                  <View style={{
                    width: scaleSize(32), height: scaleSize(32), borderRadius: scaleSize(12), alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isSel ? accentColor : inRange ? accentColor + '15' : 'transparent',
                    borderWidth: isToday && !isSel ? 1.5 : 0, borderColor: accentColor,
                    opacity: disabled ? 0.2 : 1,
                  }}>
                    <Text style={{ fontSize: scaleFontSize(13), fontWeight: isSel || isToday ? '900' : '600', color: isSel ? '#FFF' : colors.text }}>
                      {date.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── STYLED ALERT BANNER ──────────────────────────────────────────────────────
const ALERT_ACCENT: Record<string, { border: string; iconColor: string }> = {
  danger: { border: '#E24B4A', iconColor: '#E24B4A' },
  warning: { border: '#BA7517', iconColor: '#BA7517' },
  info: { border: '#378ADD', iconColor: '#378ADD' },
  success: { border: '#1D9E75', iconColor: '#1D9E75' },
};

interface AlertBannerProps {
  type: 'danger' | 'warning' | 'info' | 'success';
  icon: string;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
  _isDark?: boolean;
  _secondaryText?: string;
}

function AlertBanner({ type, icon, title, message, action, _isDark, _secondaryText }: AlertBannerProps) {
  const a = ALERT_ACCENT[type];
  return (
    <View style={{ marginHorizontal: scaleSize(16), marginBottom: scaleSize(10), borderRadius: scaleSize(12), borderWidth: 1, borderColor: a.border + '30', backgroundColor: a.border + (_isDark ? '0F' : '08'), overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: scaleSize(14), paddingVertical: scaleSize(11), flexDirection: 'row', alignItems: 'center' }}>
        <MaterialCommunityIcons name={icon} size={15} color={a.iconColor + 'CC'} style={{ marginRight: scaleSize(10) }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: scaleFontSize(12), fontWeight: '700', color: a.iconColor + 'DD' }}>{title}</Text>
          {message ? <Text style={{ fontSize: scaleFontSize(11), color: _secondaryText || '#888', marginTop: 2, lineHeight: 16 }}>{message}</Text> : null}
          {action ? (
            <TouchableOpacity onPress={action.onPress} style={{ marginTop: scaleSize(8), alignSelf: 'flex-start' }}>
              <Text style={{ fontSize: scaleFontSize(11), fontWeight: '800', color: a.iconColor }}>{action.label} →</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ── REIMAGINED PAIN SELECTOR ──────────────────────────────────────────────────
function PainSelector({ value, onChange, colors }: { value: number; onChange: (v: number) => void; colors: any; }) {
  const PAIN_STEPS = [
    { v: 1, label: 'None', emoji: '😌', color: '#1D9E75' },
    { v: 2, label: 'Mild', emoji: '🙂', color: '#BA7517' },
    { v: 3, label: 'Mod.', emoji: '😣', color: '#E58E26' },
    { v: 4, label: 'Sev.', emoji: '😫', color: '#E24B4A' },
    { v: 5, label: 'Extr.', emoji: '🤯', color: '#791F1F' },
  ];

  return (
    <View style={{ marginBottom: scaleSize(24) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scaleSize(10) }}>
        <Text style={{ fontSize: scaleFontSize(11), fontWeight: '900', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 1 }}>Pain Level</Text>
        {value > 0 && (
          <View style={{ backgroundColor: PAIN_STEPS[value - 1].color + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: PAIN_STEPS[value - 1].color }}>{PAIN_STEPS[value - 1].label.toUpperCase()}</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surfaceVariant, padding: 6, borderRadius: 20 }}>
        {PAIN_STEPS.map((step) => {
          const isActive = value === step.v;
          return (
            <TouchableOpacity
              key={step.v}
              onPress={() => { onChange(step.v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              activeOpacity={0.7}
              style={{
                flex: 1,
                height: scaleSize(48),
                backgroundColor: isActive ? step.color : 'transparent',
                borderRadius: 16,
                justifyContent: 'center',
                alignItems: 'center',
                marginHorizontal: 2,
                shadowColor: step.color,
                shadowOffset: { width: 0, height: isActive ? 4 : 0 },
                shadowOpacity: isActive ? 0.35 : 0,
                shadowRadius: 6,
                elevation: isActive ? 4 : 0
              }}
            >
              <Text style={{ fontSize: scaleFontSize(18), opacity: isActive ? 1 : 0.6 }}>{step.emoji}</Text>
              {!isActive && <Text style={{ fontSize: 9, fontWeight: '900', color: '#8E8E93', marginTop: 1 }}>{step.v}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const PAIN_COLORS = ['#1D9E75', '#BA7517', '#E58E26', '#E24B4A', '#791F1F'];

export default function PeriodTrackerScreen() {
  const { colors, isDark } = useTheme();
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const secondaryText = isDark ? '#A1A1AA' : '#666666';
  const surfaceVariant = isDark ? '#2C2C2E' : '#F2F2F7';
  const outlineColor = isDark ? '#3A3A3C' : '#E5E5EA';
  const dangerRed = '#E24B4A';

  // ── Data ─────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'home' | 'calendar' | 'insights' | 'intimacy'>('home');
  const [periodLogs, setPeriodLogs] = useState<PeriodLog[]>([]);
  const [intimacyLogs, setIntimacyLogs] = useState<IntimacyLog[]>([]);
  const [cycleLength, setCycleLength] = useState(28);
  const [periodDuration, setPeriodDuration] = useState(5);
  const [currentCycleDay, setCurrentCycleDay] = useState(1);
  const [currentPhase, setCurrentPhase] = useState<CyclePhase>(CYCLE_PHASES.menstrual);

  // ── Calendar ──────────────────────────────────────────────────────────────────
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // ── Log modal ─────────────────────────────────────────────────────────────────
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [quickLogType, setQuickLogType] = useState<'period' | 'intimacy'>('period');
  const [editingIntimacyId, setEditingIntimacyId] = useState<string | null>(null);

  // ── Period form ───────────────────────────────────────────────────────────────
  const [periodStartDate, setPeriodStartDate] = useState(todayStr());
  const [periodEndDate, setPeriodEndDate] = useState('');
  const [isOngoing, setIsOngoing] = useState(true);
  const [flowIntensity, setFlowIntensity] = useState<FlowIntensity>('normal');
  const [selectedSymptoms, setSelectedSymptoms] = useState<SymptomType[]>([]);
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [painLevel, setPainLevel] = useState(0);
  const [periodNotes, setPeriodNotes] = useState('');
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);

  // ── Intimacy form ─────────────────────────────────────────────────────────────
  const [intimacyDate, setIntimacyDate] = useState(todayStr());
  const [intimacyProtection, setIntimacyProtection] = useState<ProtectionType>('condom');
  const [intimacyNotes, setIntimacyNotes] = useState('');

  // ── Intimacy PIN lock ─────────────────────────────────────────────────────────
  const [intimacyUnlocked, setIntimacyUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinSet, setPinSet] = useState(false);
  const [pinError, setPinError] = useState('');
  const [settingPin, setSettingPin] = useState(false);
  const [confirmPin, setConfirmPin] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const PIN_KEY = '@intimacy_pin_v2';

  // ── Misc modals ───────────────────────────────────────────────────────────────
  const [showPhaseDetail, setShowPhaseDetail] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmCfg, setConfirmCfg] = useState<{ title: string; message: string; onConfirm: () => void; isDanger?: boolean } | null>(null);
  const [showOverlapConfirm, setShowOverlapConfirm] = useState(false);
  const [pendingLog, setPendingLog] = useState<PeriodLog | null>(null);
  const [expandedInsight, setExpandedInsight] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [cycleLengthInput, setCycleLengthInput] = useState('28');
  const [durationInput, setDurationInput] = useState('5');
  const [logStep, setLogStep] = useState(0); // 0: Intent, 1: Date, 2: Details

  // ── Toast ─────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const toastAnim = useRef(new Animated.Value(-120)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logScrollRef = useRef<ScrollView>(null);
  const pinShakeAnim = useRef(new Animated.Value(0)).current;

  // ── Tab slide animations ───────────────────────────────────────────────────
  const TABS_ORDER = ['home', 'calendar', 'insights', 'intimacy'] as const;
  const screenWidth = Dimensions.get('window').width;
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  const openLog = (type: 'period' | 'intimacy') => {
    if (type === 'intimacy') {
      openIntimacySection();
      return;
    }
    resetPeriodForm();
    setShowQuickLog(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Ref so PanResponder (created once) always reads the latest tab
  const activeTabRef = useRef<'home' | 'calendar' | 'insights' | 'intimacy'>('home');
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  useEffect(() => {
    // Basic auto-lock when screen is hidden (e.g. user goes back to dashboard)
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
      easing: Easing.out(Easing.back(0.8)),
    }).start();
    return () => setIntimacyUnlocked(false);
  }, []);

  const switchTab = useCallback((newTab: 'home' | 'calendar' | 'insights' | 'intimacy') => {
    const newIdx = TABS_ORDER.indexOf(newTab);
    setActiveTab(newTab);
    activeTabRef.current = newTab;

    Animated.spring(tabIndicatorAnim, {
      toValue: newIdx,
      tension: 240,
      friction: 28,
      useNativeDriver: true
    }).start();

    Haptics.selectionAsync();
  }, [tabIndicatorAnim]);


  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ message, type });
    toastAnim.setValue(-120);
    Animated.spring(toastAnim, { toValue: 0, useNativeDriver: true, tension: 40, friction: 7 }).start();
    setTimeout(() => {
      Animated.timing(toastAnim, { toValue: -120, duration: 300, useNativeDriver: true }).start(() => setToast(null));
    }, 3200);
  }, [toastAnim]);

  // ── Heading Double-Tap (Easter Egg for Private) ────────────────────────────
  const lastHeadingTap = useRef(0);
  const handleHeadingTap = () => {
    const now = Date.now();
    if (now - lastHeadingTap.current < 300) {
      openIntimacySection();
    } else {
      lastHeadingTap.current = now;
    }
  };

  // ── Computed ──────────────────────────────────────────────────────────────────
  const lastPeriodLog = periodLogs[0] ?? null;
  const expectedDate = lastPeriodLog ? (() => { const d = parseDate(lastPeriodLog.startDate); d.setDate(d.getDate() + cycleLength); return d; })() : null;
  const daysUntilPeriod = expectedDate ? Math.ceil((expectedDate.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000) : null;
  const isLate = daysUntilPeriod !== null && daysUntilPeriod < 0 && !lastPeriodLog?.isActive;
  const daysLate = isLate ? Math.abs(daysUntilPeriod!) : 0;
  const lastIntimacy = intimacyLogs[0] ?? null;
  const daysSinceIntimacy = lastIntimacy ? daysBetween(lastIntimacy.date, todayStr()) : null;

  // ── Smart Averages for Adaptive Forecasting ──────────────────────────────
  const gapsHistory: number[] = [];
  for (let i = 0; i < periodLogs.length - 1; i++) gapsHistory.push(daysBetween(periodLogs[i + 1].startDate, periodLogs[i].startDate));
  const effectiveCL = gapsHistory.length >= 1 ? Math.round(gapsHistory.reduce((a, b) => a + b, 0) / gapsHistory.length) : cycleLength;
  const effectivePD = periodLogs.length >= 1 ? Math.round(periodLogs.reduce((a, l) => a + l.duration, 0) / periodLogs.length) : periodDuration;
  const lastWasUnprotected = lastIntimacy?.protection === 'none';
  const riskWindowActive = lastIntimacy && daysSinceIntimacy !== null && daysSinceIntimacy <= 5 && lastWasUnprotected;

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  const computeCycleDay = useCallback((logs?: PeriodLog[], cl?: number) => {
    const useLogs = logs ?? periodLogs;
    const useCl = cl ?? cycleLength;
    const last = useLogs[0];
    if (!last) return;
    const diff = daysBetween(last.startDate, todayStr());
    const day = (diff % useCl) + 1;
    setCurrentCycleDay(day);
    for (const phase of Object.values(CYCLE_PHASES)) {
      if (day >= phase.startDay && day <= phase.endDay) { setCurrentPhase(phase); break; }
    }
  }, [periodLogs, cycleLength]);

  const loadAll = async () => {
    try {
      const [pl, il, cl, pd, pin] = await Promise.all([
        AsyncStorage.getItem('@period_logs_v2'),
        AsyncStorage.getItem('@intimacy_logs_v2'),
        AsyncStorage.getItem('@cycle_length'),
        AsyncStorage.getItem('@period_duration'),
        AsyncStorage.getItem('@intimacy_pin_v2'),
      ]);
      const parsedLogs: PeriodLog[] = pl ? JSON.parse(pl) : [];
      if (parsedLogs.length) setPeriodLogs(parsedLogs);
      if (il) setIntimacyLogs(JSON.parse(il));
      const parsedCl = cl ? parseInt(cl) : 28;
      const parsedPd = pd ? parseInt(pd) : 5;
      if (cl) { setCycleLength(parsedCl); setCycleLengthInput(cl); }
      if (pd) { setPeriodDuration(parsedPd); setDurationInput(pd); }
      if (pin) setPinSet(true);
      // Compute cycle day immediately with fresh data from storage
      if (parsedLogs.length) computeCycleDay(parsedLogs, parsedCl);
    } catch (e) { console.error('Load error:', e); }
  };

  useEffect(() => {
    loadAll();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => { computeCycleDay(); }, [periodLogs.length, cycleLength]);

  // Pre-fill form state when the log modal opens with an active ongoing period
  useEffect(() => {
    if (showQuickLog && quickLogType === 'period' && !editingPeriodId && lastPeriodLog?.isActive) {
      setEditingPeriodId(lastPeriodLog.id);
      setPeriodStartDate(lastPeriodLog.startDate);
      setPeriodEndDate(todayStr());
      setIsOngoing(false);
      setFlowIntensity(lastPeriodLog.flowIntensity);
      setSelectedSymptoms(lastPeriodLog.symptoms);
      setPainLevel(lastPeriodLog.painLevel || 0);
    }
  }, [showQuickLog, quickLogType]);

  // ── Save helpers ──────────────────────────────────────────────────────────────
  const savePeriodLogs = async (logs: PeriodLog[]) => {
    const sorted = [...logs].sort((a, b) => parseDate(b.startDate).getTime() - parseDate(a.startDate).getTime());
    try {
      await AsyncStorage.setItem('@period_logs_v2', JSON.stringify(sorted));
      setPeriodLogs(sorted);
      computeCycleDay(sorted, cycleLength);
    } catch (e) {
      console.error('Save period error:', e);
      showToast('Failed to save — storage error', 'error');
    }
  };

  const saveIntimacyLogs = async (logs: IntimacyLog[]) => {
    const sorted = [...logs].sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());
    try {
      await AsyncStorage.setItem('@intimacy_logs_v2', JSON.stringify(sorted));
      setIntimacyLogs(sorted);
    } catch (e) {
      console.error('Save intimacy error:', e);
      showToast('Failed to save — storage error', 'error');
    }
  };

  // ── Period save ───────────────────────────────────────────────────────────────
  const handleSavePeriod = () => {
    if (!periodStartDate) { showToast('Select a start date', 'error'); return; }
    if (periodStartDate > todayStr()) { showToast('Start date cannot be in the future', 'error'); return; }
    if (!isOngoing && !periodEndDate) { showToast('Select an end date, or mark as ongoing', 'error'); return; }
    if (!isOngoing && periodEndDate < periodStartDate) { showToast('End date must be after start date', 'error'); return; }
    if (!isOngoing && periodEndDate > todayStr()) { showToast('End date cannot be in the future', 'error'); return; }

    const dur = isOngoing
      ? daysBetween(periodStartDate, todayStr()) + 1
      : daysBetween(periodStartDate, periodEndDate) + 1;

    const newLog: PeriodLog = {
      id: editingPeriodId || Date.now().toString(),
      startDate: periodStartDate,
      endDate: isOngoing ? undefined : periodEndDate,
      isActive: isOngoing,
      duration: Math.max(1, dur),
      flowIntensity,
      symptoms: selectedSymptoms,
      mood: selectedMood || undefined,
      painLevel,
      notes: periodNotes || undefined,
    };

    const hasOverlap = periodLogs.some(l => {
      if (l.id === newLog.id) return false;
      const le = l.endDate || todayStr();
      const ne = newLog.endDate || todayStr();
      return newLog.startDate <= le && ne >= l.startDate;
    });

    if (hasOverlap && !editingPeriodId) {
      setConfirmCfg({
        title: 'Date Overlap',
        message: 'This period overlaps with an existing entry. Replace it?',
        isDanger: true,
        onConfirm: () => executePeriodSave(newLog)
      });
      setShowConfirm(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    executePeriodSave(newLog);
  };

  const executePeriodSave = (log: PeriodLog) => {
    let updated: PeriodLog[];
    if (editingPeriodId) {
      updated = periodLogs.map(l => l.id === editingPeriodId ? log : l);
    } else {
      const nonConflicting = periodLogs.filter(l => {
        const le = l.endDate || todayStr();
        const ne = log.endDate || todayStr();
        return !(log.startDate <= le && ne >= l.startDate);
      });
      updated = [log, ...nonConflicting];
    }
    savePeriodLogs(updated);
    resetPeriodForm();
    setShowQuickLog(false);
    setShowOverlapConfirm(false);
    setPendingLog(null);
    showToast(editingPeriodId ? 'Period updated ✓' : 'Period logged ✓', 'success');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const resetPeriodForm = () => {
    setPeriodStartDate(todayStr()); setPeriodEndDate(''); setIsOngoing(true);
    setFlowIntensity('normal'); setSelectedSymptoms([]); setSelectedMood(null);
    setPainLevel(0); setPeriodNotes(''); setEditingPeriodId(null);
  };

  // ── Intimacy save ─────────────────────────────────────────────────────────────
  const resetIntimacyForm = () => {
    setIntimacyDate(todayStr());
    setIntimacyProtection('condom');
    setIntimacyNotes('');
    setEditingIntimacyId(null);
  };

  const handleSaveIntimacy = () => {
    if (!intimacyDate) { showToast('Select a date', 'error'); return; }
    if (intimacyDate > todayStr()) { showToast('Date cannot be in the future', 'error'); return; }

    if (editingIntimacyId) {
      const updated = intimacyLogs.map(l => l.id === editingIntimacyId ? { ...l, date: intimacyDate, protection: intimacyProtection, notes: intimacyNotes || undefined } : l);
      saveIntimacyLogs(updated);
    } else {
      const log: IntimacyLog = { id: Date.now().toString(), date: intimacyDate, protection: intimacyProtection, notes: intimacyNotes || undefined };
      saveIntimacyLogs([log, ...intimacyLogs]);
    }

    resetIntimacyForm();
    setShowQuickLog(false);
    showToast('Entry saved ✓', 'success');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const editIntimacyEntry = (log: IntimacyLog) => {
    setEditingIntimacyId(log.id);
    setIntimacyDate(log.date);
    setIntimacyProtection(log.protection);
    setIntimacyNotes(log.notes || '');
    setQuickLogType('intimacy');
    setShowQuickLog(true);
  };

  const deleteIntimacyEntry = (id: string) => {
    setConfirmCfg({
      title: 'Delete Entry',
      message: 'Remove this private log permanently?',
      isDanger: true,
      onConfirm: () => {
        saveIntimacyLogs(intimacyLogs.filter(l => l.id !== id));
        showToast('Entry deleted', 'warning');
      }
    });
    setShowConfirm(true);
  };

  const toggleSym = (sym: SymptomType, list: SymptomType[], set: (v: SymptomType[]) => void) =>
    set(list.includes(sym) ? list.filter(s => s !== sym) : [...list, sym]);

  // ── PIN logic ─────────────────────────────────────────────────────────────────
  const openIntimacySection = async () => {
    const stored = await AsyncStorage.getItem(PIN_KEY);
    if (!stored) {
      setSettingPin(true); setConfirmStep(false); setPinInput(''); setConfirmPin(''); setPinError('');
    } else {
      setSettingPin(false); setPinInput(''); setPinError('');
    }
    setShowPinModal(true);
  };

  const handlePinDigit = (digit: number | string) => {
    if (digit === '⌫') { setPinInput(p => p.slice(0, -1)); setPinError(''); return; }
    if (typeof digit === 'number' && pinInput.length < 4) {
      const next = pinInput + digit;
      setPinInput(next);
      setPinError('');
      if (next.length === 4) setTimeout(() => submitPin(next), 150);
    }
  };

  const triggerPinShake = () => {
    pinShakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(pinShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(pinShakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(pinShakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(pinShakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const submitPin = async (pin: string) => {
    if (settingPin) {
      if (!confirmStep) {
        setConfirmPin(pin); setPinInput(''); setPinError(''); setConfirmStep(true);
      } else {
        if (pin !== confirmPin) {
          setPinError('PINs do not match — try again');
          setPinInput('');
          triggerPinShake();
          return;
        }
        await AsyncStorage.setItem(PIN_KEY, pin);
        setPinSet(true); setIntimacyUnlocked(true); setShowPinModal(false);
        setPinInput(''); setConfirmPin(''); setConfirmStep(false);
        showToast('PIN set — section unlocked ✓', 'success');
        switchTab('intimacy');
      }
    } else {
      const stored = await AsyncStorage.getItem(PIN_KEY);
      if (pin === stored) {
        setIntimacyUnlocked(true); setShowPinModal(false); setPinInput(''); setPinError('');
        switchTab('intimacy');
      } else {
        setPinError('Incorrect PIN');
        setPinInput('');
        triggerPinShake();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  // ─── STYLES ──────────────────────────────────────────────────────────────────
  const s = StyleSheet.create({
    root: { flex: 1 },
    container: { flex: 1, backgroundColor: colors.background },
    card: { marginHorizontal: scaleSize(16), borderRadius: scaleSize(20), backgroundColor: cardBg, borderWidth: 1, borderColor: outlineColor, marginBottom: scaleSize(12), overflow: 'hidden' },
    cardPad: { padding: scaleSize(16) },
    sectionTitle: { fontSize: scaleFontSize(10), fontWeight: '800', color: secondaryText, textTransform: 'uppercase', letterSpacing: 1.1, marginHorizontal: scaleSize(16), marginTop: scaleSize(18), marginBottom: scaleSize(8) },
    row: { flexDirection: 'row', alignItems: 'center' },
    label: { fontSize: scaleFontSize(11), fontWeight: '800', color: secondaryText, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: scaleSize(8) },
    chip: { paddingHorizontal: scaleSize(10), paddingVertical: scaleSize(6), borderRadius: scaleSize(10), borderWidth: 1, marginRight: scaleSize(7), marginBottom: scaleSize(7), flexDirection: 'row', alignItems: 'center' },
    chipText: { fontSize: scaleFontSize(12), fontWeight: '700' },
    input: { backgroundColor: surfaceVariant, borderRadius: scaleSize(12), padding: scaleSize(13), color: colors.text, fontSize: scaleFontSize(14), fontWeight: '600' },
    tabBar: { flexDirection: 'row', backgroundColor: cardBg, borderTopWidth: 1, borderTopColor: outlineColor, paddingBottom: scaleSize(22), paddingTop: scaleSize(10) },
    tabBtn: { flex: 1, alignItems: 'center', paddingVertical: scaleSize(4) },
    tabLabel: { fontSize: scaleFontSize(10), fontWeight: '700', marginTop: 2 },
    primaryBtn: { backgroundColor: dangerRed, borderRadius: scaleSize(14), padding: scaleSize(15), alignItems: 'center', marginTop: scaleSize(20) },
    primaryBtnTx: { color: '#FFF', fontWeight: '800', fontSize: scaleFontSize(15) },
    secondaryBtn: { backgroundColor: surfaceVariant, borderRadius: scaleSize(14), padding: scaleSize(15), alignItems: 'center', marginTop: scaleSize(10) },
  });

  // ─── HOME ─────────────────────────────────────────────────────────────────────
  const renderHome = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: scaleSize(120) }}>

      {/* Alerts */}
      {periodLogs.length === 0 && (
        <AlertBanner type="info" icon="heart-circle-outline" _isDark={isDark} _secondaryText={secondaryText}
          title="Private Mode Available"
          message="Double-tap the 'Cycle' heading at any time to access your safe, PIN-protected private logs." />
      )}
      {isLate && (
        <AlertBanner type="danger" icon="calendar-alert" _isDark={isDark} _secondaryText={secondaryText}
          title={`Period is ${daysLate} day${daysLate > 1 ? 's' : ''} late`}
          message="Minor variations are normal. If this is unusual for you, consider consulting a doctor." />
      )}

      {lastPeriodLog?.isActive && (
        <AlertBanner type="info" icon="water" _isDark={isDark} _secondaryText={secondaryText}
          title={`Period ongoing — Day ${daysBetween(lastPeriodLog.startDate, todayStr()) + 1}`}
          message="When your flow stops, tap below to mark it as finished and log the end date."
          action={{
            label: 'Mark as Finished',
            onPress: () => {
              setEditingPeriodId(lastPeriodLog.id);
              setPeriodStartDate(lastPeriodLog.startDate);
              setPeriodEndDate(todayStr());
              setIsOngoing(false);
              setFlowIntensity(lastPeriodLog.flowIntensity);
              setSelectedSymptoms(lastPeriodLog.symptoms);
              setSelectedMood(lastPeriodLog.mood || null);
              setPainLevel(lastPeriodLog.painLevel || 0);
              setPeriodNotes(lastPeriodLog.notes || '');
              setQuickLogType('period');
              setShowQuickLog(true);
            },
          }} />
      )}

      {/* Phase hero */}
      <TouchableOpacity activeOpacity={0.85} onPress={() => setShowPhaseDetail(true)} style={s.card}>
        <LinearGradient colors={[currentPhase.color + '18', currentPhase.color + '04']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={s.cardPad}>
          <Text style={{ fontSize: scaleFontSize(10), fontWeight: '800', color: currentPhase.color, textTransform: 'uppercase', letterSpacing: 1 }}>
            Current Phase · Day {currentCycleDay} of {cycleLength}
          </Text>
          <View style={[s.row, { marginTop: scaleSize(8), justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: scaleFontSize(26), fontWeight: '900', color: currentPhase.color }}>{currentPhase.name}</Text>
              <Text style={{ fontSize: scaleFontSize(12), color: secondaryText, marginTop: scaleSize(5), lineHeight: 18 }}>{currentPhase.desc}</Text>
            </View>
            <MaterialCommunityIcons name={currentPhase.icon} size={48} color={currentPhase.color + 'BB'} style={{ marginLeft: scaleSize(10) }} />
          </View>
          <Text style={{ fontSize: scaleFontSize(11), color: currentPhase.color + 'CC', fontWeight: '700', marginTop: scaleSize(10) }}>Tap for full phase details →</Text>
        </View>
      </TouchableOpacity>

      {/* Stat cards */}
      <View style={[s.row, { paddingHorizontal: scaleSize(16), gap: scaleSize(10), marginBottom: scaleSize(12) }]}>
        <View style={[s.card, { flex: 1, marginHorizontal: 0, marginBottom: 0 }]}>
          <View style={s.cardPad}>
            <Text style={{ fontSize: scaleFontSize(10), fontWeight: '700', color: secondaryText, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {lastPeriodLog?.isActive ? 'Ongoing' : 'Next period'}
            </Text>
            <Text style={{ fontSize: scaleFontSize(28), fontWeight: '900', color: isLate ? dangerRed : colors.text, marginTop: 2 }}>
              {lastPeriodLog?.isActive
                ? `Day ${daysBetween(lastPeriodLog.startDate, todayStr()) + 1}`
                : daysUntilPeriod !== null
                  ? isLate ? `${daysLate}d late` : daysUntilPeriod === 0 ? 'Today' : `${daysUntilPeriod}d`
                  : '--'}
            </Text>
            {expectedDate && !lastPeriodLog?.isActive && (
              <Text style={{ fontSize: scaleFontSize(11), color: secondaryText, fontWeight: '600', marginTop: 1 }}>
                ~{expectedDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
              </Text>
            )}
          </View>
        </View>

      </View>

      {/* Period history */}
      {periodLogs.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Period History</Text>
          {periodLogs.slice(0, 3).map(log => (
            <View key={log.id} style={s.card}>
              <View style={[s.cardPad, s.row, { justifyContent: 'space-between' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: scaleFontSize(14), fontWeight: '800', color: colors.text }}>
                    {parseDate(log.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    {log.endDate ? ` – ${parseDate(log.endDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}` : ' (Ongoing)'}
                  </Text>
                  <View style={[s.row, { marginTop: 3, gap: 6 }]}>
                    <Text style={{ fontSize: scaleFontSize(12), color: secondaryText }}>{log.isActive ? 'Ongoing' : `${log.duration}d`}</Text>
                    <Text style={{ color: secondaryText }}>·</Text>
                    <Text style={{ fontSize: scaleFontSize(12), color: secondaryText, textTransform: 'capitalize' }}>{log.flowIntensity.replace('_', ' ')}</Text>
                    {(log.painLevel ?? 0) > 0 && <><Text style={{ color: secondaryText }}>·</Text><Text style={{ fontSize: scaleFontSize(12), color: secondaryText }}>Pain {log.painLevel}/5</Text></>}
                  </View>
                </View>
                <View style={[s.row, { gap: scaleSize(14) }]}>
                  <TouchableOpacity onPress={() => {
                    setEditingPeriodId(log.id); setPeriodStartDate(log.startDate); setPeriodEndDate(log.endDate || '');
                    setIsOngoing(!!log.isActive); setFlowIntensity(log.flowIntensity); setSelectedSymptoms(log.symptoms);
                    setSelectedMood(log.mood || null); setPainLevel(log.painLevel || 0); setPeriodNotes(log.notes || '');
                    setQuickLogType('period'); setShowQuickLog(true);
                  }}>
                    <Ionicons name="pencil" size={17} color={secondaryText} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    setConfirmCfg({
                      title: 'Delete Period',
                      message: 'Remove this period log?',
                      isDanger: true,
                      onConfirm: () => {
                        savePeriodLogs(periodLogs.filter(l => l.id !== log.id));
                        showToast('Deleted', 'warning');
                      }
                    });
                    setShowConfirm(true);
                  }}>
                    <Ionicons name="trash-outline" size={17} color={dangerRed} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </>
      )}



      {/* Emergency */}
      <TouchableOpacity onPress={() => setShowEmergency(true)} style={s.card}>
        <View style={[s.cardPad, s.row]}>
          <View style={{ width: scaleSize(30), height: scaleSize(30), borderRadius: scaleSize(9), backgroundColor: dangerRed + '15', justifyContent: 'center', alignItems: 'center', marginRight: scaleSize(12) }}>
            <MaterialCommunityIcons name="phone-alert-outline" size={16} color={dangerRed} />
          </View>
          <Text style={{ fontSize: scaleFontSize(14), fontWeight: '700', color: dangerRed, flex: 1 }}>Support & Emergency Helplines</Text>
          <Ionicons name="chevron-forward" size={16} color={secondaryText} />
        </View>
      </TouchableOpacity>
    </ScrollView>
  );

  // ─── CALENDAR ────────────────────────────────────────────────────────────────
  const renderCalendar = () => {
    const vm = viewDate.getMonth(), vy = viewDate.getFullYear();
    const daysInM = new Date(vy, vm + 1, 0).getDate();
    const firstDay = new Date(vy, vm, 1).getDay();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let i = 1; i <= daysInM; i++) cells.push(new Date(vy, vm, i));

    const ds = toDateStr(selectedDate);
    const selPer = periodLogs.find(l => { const end = l.endDate || (l.isActive ? todayStr() : l.startDate); return ds >= l.startDate && ds <= end; });
    const selInt = intimacyLogs.filter(l => l.date === ds);

    const getDayInfo = (date: Date) => {
      const ds = toDateStr(date);
      const hasPeriod = periodLogs.some(l => { const end = l.endDate || (l.isActive ? todayStr() : l.startDate); return ds >= l.startDate && ds <= end; });
      const hasIntimacy = intimacyLogs.some(l => l.date === ds);
      let phaseColor = 'transparent';
      let status: 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | 'none' = 'none';
      if (hasPeriod) { status = 'menstrual'; phaseColor = dangerRed; }
      else if (lastPeriodLog) {
        const diff = daysBetween(lastPeriodLog.startDate, ds);
        const cycleDay = ((diff % effectiveCL) + effectiveCL) % effectiveCL;
        if (cycleDay < effectivePD) { status = 'menstrual'; phaseColor = dangerRed + '40'; }
        else if (cycleDay < 12) { status = 'follicular'; phaseColor = '#1D9E7530'; }
        else if (cycleDay < 16) { status = 'ovulation'; phaseColor = '#BA751740'; }
        else { status = 'luteal'; phaseColor = '#7F77DD30'; }
      }
      return { status, phaseColor, hasIntimacy };
    };

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: scaleSize(120) }}>
        <View style={[s.row, { justifyContent: 'space-between', paddingHorizontal: scaleSize(16), paddingTop: scaleSize(14), paddingBottom: scaleSize(12) }]}>
          <TouchableOpacity onPress={() => setViewDate(new Date(vy, vm - 1, 1))} style={{ padding: scaleSize(10), backgroundColor: surfaceVariant, borderRadius: scaleSize(12) }}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: scaleFontSize(17), fontWeight: '900', color: colors.text }}>
            {viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => setViewDate(new Date(vy, vm + 1, 1))} style={{ padding: scaleSize(10), backgroundColor: surfaceVariant, borderRadius: scaleSize(12) }}>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={[s.row, { paddingHorizontal: scaleSize(16), gap: scaleSize(12), marginBottom: scaleSize(10), flexWrap: 'wrap' }]}>
          {[{ color: dangerRed, label: 'Period' }, { color: '#1D9E75', label: 'Follicular' }, { color: '#BA7517', label: 'Ovulation' }, { color: '#7F77DD', label: 'Luteal' }].map(l => (
            <View key={l.label} style={[s.row, { gap: 5 }]}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.color }} />
              <Text style={{ fontSize: scaleFontSize(10), color: secondaryText, fontWeight: '600' }}>{l.label}</Text>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <View style={s.cardPad}>
            <View style={[s.row, { marginBottom: scaleSize(8) }]}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: scaleFontSize(10), fontWeight: '800', color: secondaryText }}>{d}</Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cells.map((date, idx) => {
                const cellW = Math.floor((width - scaleSize(72)) / 7);
                if (!date) return <View key={`e-${idx}`} style={{ width: cellW, height: scaleSize(46) }} />;
                const isToday = toDateStr(date) === todayStr();
                const isSel = toDateStr(date) === toDateStr(selectedDate);
                const info = getDayInfo(date);
                return (
                  <TouchableOpacity key={idx} onPress={() => { setSelectedDate(date); Haptics.selectionAsync(); }} style={{ width: cellW, height: scaleSize(46), padding: 2 }}>
                    <View style={{ flex: 1, borderRadius: scaleSize(10), backgroundColor: isSel ? colors.primary + '25' : info.phaseColor, borderWidth: isSel ? 2 : isToday ? 1 : 0, borderColor: isSel ? colors.primary : dangerRed, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: scaleFontSize(13), fontWeight: (isSel || isToday || info.status === 'menstrual') ? '900' : '500', color: (info.status === 'menstrual' && info.phaseColor === dangerRed) ? '#FFF' : colors.text }}>
                        {date.getDate()}
                      </Text>
                      <View style={[s.row, { gap: 2, marginTop: 1 }]}>
                        {info.hasIntimacy && intimacyUnlocked && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#D4537E' }} />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <Text style={s.sectionTitle}>{selectedDate.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        <View style={s.card}>
          <View style={s.cardPad}>
            {selPer && (
              <View style={{ padding: scaleSize(12), backgroundColor: dangerRed + '10', borderRadius: scaleSize(12), marginBottom: scaleSize(10), borderLeftWidth: 3, borderLeftColor: dangerRed }}>
                <Text style={{ fontSize: scaleFontSize(13), fontWeight: '800', color: dangerRed }}>Period day</Text>
                <Text style={{ fontSize: scaleFontSize(12), color: secondaryText, marginTop: 2 }}>{selPer.flowIntensity.replace('_', ' ')} flow{selPer.painLevel ? ` · Pain ${selPer.painLevel}/5` : ''}</Text>
              </View>
            )}
            {intimacyUnlocked && selInt.map(il => (
              <View key={il.id} style={{ padding: scaleSize(12), backgroundColor: '#D4537E10', borderRadius: scaleSize(12), marginBottom: scaleSize(10), borderLeftWidth: 3, borderLeftColor: '#D4537E' }}>
                <Text style={{ fontSize: scaleFontSize(13), fontWeight: '800', color: '#D4537E' }}>Intimacy logged</Text>
                <Text style={{ fontSize: scaleFontSize(12), color: secondaryText, marginTop: 2 }}>{il.protection === 'none' ? 'Unprotected' : il.protection}{il.notes ? ` · ${il.notes}` : ''}</Text>
              </View>
            ))}
            {(() => {
              const info = getDayInfo(selectedDate);
              if (info.status === 'none' || !lastPeriodLog) return null;

              const diff = daysBetween(lastPeriodLog.startDate, toDateStr(selectedDate));
              const cycleDay = ((diff % effectiveCL) + effectiveCL) % effectiveCL + 1;

              // Hormone Approximation Logic (0-100 scale)
              let estrogen = 0, progesterone = 0, testosterone = 0;
              let vibe = '', energyLvl = 0;

              if (cycleDay <= 5) { // Menstrual
                estrogen = 5 + (cycleDay * 2); progesterone = 5; testosterone = 10;
                vibe = 'Deep Reset & Intuition'; energyLvl = 20 + (cycleDay * 5);
              } else if (cycleDay <= 12) { // Follicular
                estrogen = 20 + ((cycleDay - 5) * 10); progesterone = 5; testosterone = 15 + (cycleDay - 5) * 5;
                vibe = 'Creative Power & Socializing'; energyLvl = 50 + (cycleDay - 5) * 6;
              } else if (cycleDay <= 16) { // Ovulation
                estrogen = 90 - (cycleDay - 13) * 10; progesterone = 10 + (cycleDay - 13) * 10; testosterone = 40;
                vibe = 'Peak Confidence & Glow'; energyLvl = 90;
              } else { // Luteal
                const lutealDay = cycleDay - 16;
                estrogen = 40 - (lutealDay * 2); progesterone = 20 + (lutealDay * 8);
                if (lutealDay > 7) { progesterone = 80 - (lutealDay - 7) * 15; estrogen = 20 - (lutealDay - 7) * 3; }
                testosterone = 20 - (lutealDay);
                vibe = lutealDay > 10 ? 'Nesting & Emotional Release' : 'Focused Work & Grounding';
                energyLvl = 70 - (lutealDay * 4);
              }

              const forecastColor = { menstrual: dangerRed, follicular: '#1D9E75', ovulation: '#BA7517', luteal: '#7F77DD' }[info.status];

              return (
                <View style={{ marginTop: scaleSize(12), paddingTop: scaleSize(14), borderTopWidth: 1, borderTopColor: outlineColor }}>
                  <View style={[s.row, { marginBottom: 16, justifyContent: 'space-between' }]}>
                    <View style={[s.row, { gap: 8 }]}>
                      <MaterialCommunityIcons name="auto-fix" size={16} color={forecastColor} />
                      <Text style={{ fontSize: scaleFontSize(12), fontWeight: '900', color: forecastColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>Atmospheric Forecast</Text>
                    </View>
                    <View style={{ backgroundColor: forecastColor + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: forecastColor }}>DAY {cycleDay}</Text>
                    </View>
                  </View>

                  <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 16 }}>{vibe}</Text>

                  {/* Energy Meter */}
                  <View style={{ marginBottom: 18 }}>
                    <View style={[s.row, { justifyContent: 'space-between', marginBottom: 6 }]}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: secondaryText }}>Expected Energy</Text>
                      <Text style={{ fontSize: 11, fontWeight: '900', color: colors.text }}>{Math.max(0, energyLvl)}%</Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: surfaceVariant, borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{ width: `${Math.max(5, energyLvl)}%`, height: '100%', backgroundColor: forecastColor }} />
                    </View>
                  </View>

                  {/* Hormone Symphony */}
                  <Text style={{ fontSize: 10, fontWeight: '900', color: secondaryText, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Hormone Symphony & Use Cases</Text>
                  <View style={{ gap: 14 }}>
                    {[
                      { label: 'Estrogen', alias: 'Glow & Mood', val: estrogen, color: '#E24B4A', effect: 'Confidance & Radiance' },
                      { label: 'Progesterone', alias: 'Calm & Sleep', val: progesterone, color: '#BA7517', effect: 'Emotional Grounding' },
                      { label: 'Testosterone', alias: 'Drive & Focus', val: testosterone, color: '#378ADD', effect: 'Vitality & Strength' }
                    ].map(h => (
                      <View key={h.label}>
                        <View style={[s.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
                          <View style={[s.row, { gap: 6 }]}>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>{h.alias}</Text>
                            <Text style={{ fontSize: 10, color: secondaryText, fontWeight: '600' }}>({h.label})</Text>
                          </View>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: h.color }}>{h.effect}</Text>
                        </View>
                        <View style={{ height: 4, backgroundColor: surfaceVariant, borderRadius: 2, overflow: 'hidden' }}>
                          <View style={{ width: `${Math.max(2, h.val)}%`, height: '100%', backgroundColor: h.color }} />
                        </View>
                      </View>
                    ))}
                  </View>

                  <View style={[s.row, { marginTop: 20, padding: 12, backgroundColor: surfaceVariant, borderRadius: 12, gap: 10 }]}>
                    <MaterialCommunityIcons name="information-outline" size={16} color={secondaryText} />
                    <Text style={{ fontSize: 11, color: secondaryText, fontWeight: '600', flex: 1, fontStyle: 'italic' }}>
                      Daily estimates derived from your {cycleLength}-day cycle data. Actual levels vary based on biology.
                    </Text>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      </ScrollView>
    );
  };

  // ─── INSIGHTS ────────────────────────────────────────────────────────────────
  const renderInsights = () => {
    const totalPeriods = periodLogs.length;
    const avgCycle = effectiveCL;
    const avgDuration = effectivePD;
    const cyclesCount = gapsHistory.length;

    // Variance calculation for regularity
    const clVariance = cyclesCount > 1 ? Math.round(Math.sqrt(gapsHistory.reduce((a, b) => a + Math.pow(b - avgCycle, 2), 0) / cyclesCount)) : 0;

    // Mood counts (using MoodType)
    const moodCounts: Record<string, number> = {};
    periodLogs.forEach(l => { if (l.mood) moodCounts[l.mood] = (moodCounts[l.mood] || 0) + 1; });
    const totalMoods = Object.values(moodCounts).reduce((a, b) => a + b, 0);

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: scaleSize(120) }}>

        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, marginBottom: 8 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text }}>Insights</Text>
          <Text style={{ fontSize: 13, color: secondaryText, fontWeight: '600' }}>Cycle patterns & trends</Text>
        </View>

        {/* 1. STATS BENTO BOX */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginTop: 12 }}>
          <View style={{ flex: 1.2, backgroundColor: '#4052B6' + '15', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#4052B630' }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color: '#4052B6', textTransform: 'uppercase', letterSpacing: 0.5 }}>Average Cycle</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
              <Text style={{ fontSize: 28, fontWeight: '950', color: colors.text }}>{avgCycle}</Text>
              <Text style={{ fontSize: 12, fontWeight: '800', color: secondaryText, marginBottom: 5, marginLeft: 4 }}>days</Text>
            </View>
          </View>
          <View style={{ flex: 1, backgroundColor: dangerRed + '10', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: dangerRed + '20' }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color: dangerRed, textTransform: 'uppercase', letterSpacing: 0.5 }}>Period</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
              <Text style={{ fontSize: 28, fontWeight: '950', color: colors.text }}>{avgDuration}</Text>
              <Text style={{ fontSize: 12, fontWeight: '800', color: secondaryText, marginBottom: 5, marginLeft: 4 }}>days</Text>
            </View>
          </View>
        </View>

        {/* 2. REGULARITY METER */}
        <Text style={s.sectionTitle}>Cycle Regularity</Text>
        <View style={s.card}>
          <View style={s.cardPad}>
            <View style={[s.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '900', color: colors.text }}>{clVariance <= 2 ? 'Highly Predictable' : clVariance <= 5 ? 'Moderate Variation' : 'Irregular'}</Text>
                <Text style={{ fontSize: 11, color: secondaryText, marginTop: 2 }}>Based on your last {cyclesCount + 1} records</Text>
              </View>
              <MaterialCommunityIcons name="pulse" size={20} color="#4052B6" />
            </View>
            <View style={{ height: 8, backgroundColor: surfaceVariant, borderRadius: 4, flexDirection: 'row', overflow: 'hidden' }}>
              <View style={{ width: `${Math.max(10, 100 - (clVariance * 10))}%`, height: '100%', backgroundColor: '#4052B6', borderRadius: 4 }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: secondaryText }}>IRREGULAR</Text>
              <Text style={{ fontSize: 9, fontWeight: '700', color: secondaryText }}>STABLE</Text>
            </View>
          </View>
        </View>

        {/* 3. MOST COMMON SYMPTOMS */}
        <Text style={s.sectionTitle}>Top Symptoms</Text>
        <View style={s.card}>
          <View style={s.cardPad}>
            {(() => {
              const symCounts: Record<string, number> = {};
              periodLogs.forEach(l => l.symptoms.forEach(s => symCounts[s] = (symCounts[s] || 0) + 1));
              const top = Object.entries(symCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);

              if (top.length === 0) return <Text style={{ fontSize: 13, color: secondaryText, textAlign: 'center', marginVertical: 10 }}>Log symptoms to see frequency trends</Text>;

              return top.map(([sym, count]) => {
                const pct = Math.round((count / totalPeriods) * 100);
                return (
                  <View key={sym} style={{ marginBottom: 12 }}>
                    <View style={[s.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text, textTransform: 'capitalize' }}>{sym.replace('_', ' ')}</Text>
                      <Text style={{ fontSize: 11, color: secondaryText, fontWeight: '700' }}>{pct}%</Text>
                    </View>
                    <View style={{ height: 4, backgroundColor: surfaceVariant, borderRadius: 2 }}>
                      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#4052B6', borderRadius: 2 }} />
                    </View>
                  </View>
                );
              });
            })()}
          </View>
        </View>

        {/* 4. PAIN TREND */}
        <Text style={s.sectionTitle}>Pain Intensity History</Text>
        <View style={s.card}>
          <View style={s.cardPad}>
            {totalPeriods === 0 ? (
              <View style={{ height: 100, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: secondaryText, fontSize: 13 }}>No data yet</Text></View>
            ) : (
              <View style={{ flexVertical: 1 }}>
                <View style={{ height: scaleSize(100), flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
                  {periodLogs.slice(0, 6).reverse().map((log) => {
                    const d = parseDate(log.startDate);
                    const lvl = log.painLevel || 0;
                    const h = Math.max(10, (lvl / 5) * 100);
                    const col = PAIN_COLORS[lvl - 1] || '#4052B6';
                    return (
                      <View key={log.id} style={{ flex: 1, alignItems: 'center' }}>
                        <View style={{ width: '100%', height: `${h}%`, backgroundColor: col, borderRadius: 8, opacity: 0.9 }}>
                          {lvl > 0 && <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900', textAlign: 'center', marginTop: -15 }}>{lvl}</Text>}
                        </View>
                        <Text style={{ fontSize: 8, color: secondaryText, marginTop: 8, fontWeight: '800' }}>{d.getDate()}/{d.getMonth() + 1}</Text>
                      </View>
                    );
                  })}
                  {/* Placeholder for future bars if only 1 entry */}
                  {totalPeriods === 1 && [1, 2, 3].map(i => (
                    <View key={i} style={{ flex: 1, height: 100, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <View style={{ width: '100%', height: 10, backgroundColor: surfaceVariant, borderRadius: 8, opacity: 0.4 }} />
                      <Text style={{ fontSize: 8, color: secondaryText, marginTop: 8, opacity: 0.4 }}>—</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* 5. HISTORY */}
        <Text style={s.sectionTitle}>Period History</Text>
        {periodLogs.length === 0 ? (
          <View style={[s.card, { padding: 40, alignItems: 'center' }]}>
            <MaterialCommunityIcons name="calendar-heart" size={32} color={outlineColor} />
            <Text style={{ color: secondaryText, marginTop: 12, fontSize: 13 }}>No historical logs yet</Text>
          </View>
        ) : (
          periodLogs.map((log) => {
            const d1 = parseDate(log.startDate);
            const d2 = log.endDate ? parseDate(log.endDate) : null;
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const dateRange = `${months[d1.getMonth()]} ${d1.getDate()} — ${d2 ? `${months[d2.getMonth()]} ${d2.getDate()}` : 'Ongoing'}`;

            return (
              <TouchableOpacity key={log.id} style={s.card} onPress={() => { setEditingPeriodId(log.id); setQuickLogType('period'); setShowQuickLog(true); }}>
                <View style={[s.cardPad, s.row, { justifyContent: 'space-between' }]}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: colors.text }}>{dateRange}</Text>
                    <Text style={{ fontSize: 11, color: secondaryText, marginTop: 2 }}>{log.duration} days · {log.flowIntensity.toUpperCase()} flow</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={outlineColor} />
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* 6. LEARN */}
        <Text style={s.sectionTitle}>Knowledge</Text>
        {INSIGHTS_KNOWLEDGE.map((item, idx) => (
          <TouchableOpacity key={idx} style={s.card} activeOpacity={0.85} onPress={() => { setExpandedInsight(expandedInsight === idx ? null : idx); Haptics.selectionAsync(); }}>
            <View style={s.cardPad}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <View style={[s.row, { flex: 1 }]}>
                  <View style={{ width: scaleSize(36), height: scaleSize(36), borderRadius: scaleSize(10), backgroundColor: item.color + '20', justifyContent: 'center', alignItems: 'center', marginRight: scaleSize(12) }}>
                    <MaterialCommunityIcons name={item.icon} size={17} color={item.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: scaleFontSize(10), fontWeight: '700', color: item.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.category}</Text>
                    <Text style={{ fontSize: scaleFontSize(14), fontWeight: '800', color: colors.text, marginTop: 2 }}>{item.title}</Text>
                  </View>
                </View>
                <Ionicons name={expandedInsight === idx ? 'chevron-up' : 'chevron-down'} size={15} color={secondaryText} />
              </View>
              {expandedInsight === idx && (
                <Text style={{ fontSize: scaleFontSize(13), color: secondaryText, marginTop: scaleSize(14), lineHeight: 21 }}>{item.content}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // ─── LOG MODAL ───────────────────────────────────────────────────────────────
  const modalTitle =
    quickLogType === 'intimacy' ? 'Private Log'
      : editingPeriodId ? 'Edit Period'
        : 'Log Period';

  const modalAccent =
    quickLogType === 'intimacy' ? '#D4537E'
      : '#4052B6';

  const renderIntimacy = () => {
    const cycleDay = currentCycleDay;
    const cl = cycleLength;

    // Risk estimation: Rhythm-based (simplified for UI guidance)
    // 0: Very Low, 1: Low, 2: Moderate, 3: High, 4: Peak
    let riskLevel = 0;
    let riskColor = '#1D9E75';
    let riskTag = 'Low Risk';

    if (cycleDay >= 11 && cycleDay <= 17) { riskLevel = 4; riskColor = '#E24B4A'; riskTag = 'Peak Fertility'; }
    else if (cycleDay >= 8 && cycleDay <= 10) { riskLevel = 2; riskColor = '#BA7517'; riskTag = 'Moderate Risk'; }
    else if (cycleDay >= 18 && cycleDay <= 21) { riskLevel = 1; riskColor = '#BA7517'; riskTag = 'Low Risk'; }
    else { riskLevel = 0; riskColor = '#1D9E75'; riskTag = 'Low Risk'; }

    // Estimate safe/unsafe ranges
    const fertileStart = 11;
    const fertileEnd = 17;
    const clNum = parseInt(cl.toString()) || 28;
    const lastStart = lastPeriodLog?.startDate;
    const formatDate = (days: number) => {
      if (!lastStart) return '--';
      const d = parseDate(lastStart);
      d.setDate(d.getDate() + days - 1);
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    };

    const fertileDates = `${formatDate(fertileStart)} – ${formatDate(fertileEnd)}`;
    const follicularSafe = `${formatDate(1)} – ${formatDate(7)}`;
    const lutealSafe = `${formatDate(22)} – ${formatDate(clNum)}`;

    const getRecommendation = () => {
      if (riskLevel >= 3) return "Avoid unprotected contact if not planning pregnancy. You are currently in the peak fertile window.";
      if (riskLevel >= 1) return "Cycle is in a transitional phase. Protection is still highly recommended for pregnancy prevention.";
      return "Statistically lower risk phase, but remember: no date is 100% safe without clinical tracking.";
    };

    return (
      <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: scaleSize(120), paddingTop: scaleSize(10) }}>

          {/* Top Stats */}
          <View style={[s.row, { paddingHorizontal: scaleSize(16), gap: scaleSize(10), marginBottom: scaleSize(12) }]}>
            <View style={[s.card, { flex: 1, marginHorizontal: 0, marginBottom: 0 }]}>
              <View style={s.cardPad}>
                <Text style={{ fontSize: scaleFontSize(10), fontWeight: '700', color: secondaryText, textTransform: 'uppercase', letterSpacing: 0.5 }}>Days Since Last</Text>
                <Text style={{ fontSize: scaleFontSize(28), fontWeight: '900', color: colors.text, marginTop: 2 }}>
                  {daysSinceIntimacy === null ? '--' : daysSinceIntimacy === 0 ? 'Today' : `${daysSinceIntimacy}d`}
                </Text>
                {lastIntimacy && (
                  <Text style={{ fontSize: scaleFontSize(11), color: secondaryText, fontWeight: '600', marginTop: 1 }}>
                    {parseDate(lastIntimacy.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Risk Card */}
          <View style={[s.card, { backgroundColor: '#D4537E10', borderColor: '#D4537E30' }]}>
            <View style={s.cardPad}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <View>
                  <Text style={{ fontSize: scaleFontSize(10), fontWeight: '900', color: '#D4537E', textTransform: 'uppercase', letterSpacing: 0.5 }}>Current Risk Level</Text>
                  <Text style={{ fontSize: scaleFontSize(24), fontWeight: '900', color: riskColor, marginTop: 4 }}>{riskTag}</Text>
                </View>
                <MaterialCommunityIcons name={riskLevel >= 4 ? "fire-circle" : "shield-check"} size={40} color={riskColor} />
              </View>
              <View style={{ height: 8, backgroundColor: surfaceVariant, borderRadius: 4, marginTop: 16, flexDirection: 'row', overflow: 'hidden' }}>
                <View style={{ width: `${(riskLevel + 1) * 20}%`, backgroundColor: riskColor }} />
              </View>
              <Text style={{ fontSize: scaleFontSize(12), color: colors.text, marginTop: 12, lineHeight: 18, fontWeight: '700' }}>
                {getRecommendation()}
              </Text>
            </View>
          </View>

          {/* Forecast Card */}
          <Text style={s.sectionTitle}>Cycle Planning & Risk Windows</Text>
          <View style={s.card}>
            <View style={s.cardPad}>
              <View style={{ marginBottom: 20 }}>
                <View style={[s.row, { gap: 12, marginBottom: 6 }]}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#E24B4A' }} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>Peak Fertile Window</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#E24B4A', marginLeft: 22 }}>{fertileDates}</Text>
                <Text style={{ fontSize: 11, color: secondaryText, marginLeft: 22, marginTop: 2 }}>Days {fertileStart} – {fertileEnd} of your cycle</Text>
              </View>

              <View style={{ marginBottom: 20 }}>
                <View style={[s.row, { gap: 12, marginBottom: 6 }]}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#1D9E75' }} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>Statistically Safer (Follicular)</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text, marginLeft: 22 }}>{follicularSafe}</Text>
                <Text style={{ fontSize: 11, color: secondaryText, marginLeft: 22, marginTop: 2 }}>Days 1 – 7 (approx. menstruation + early follicular)</Text>
              </View>

              <View>
                <View style={[s.row, { gap: 12, marginBottom: 6 }]}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#1D9E75' }} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>Statistically Safer (Luteal)</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text, marginLeft: 22 }}>{lutealSafe}</Text>
                <Text style={{ fontSize: 11, color: secondaryText, marginLeft: 22, marginTop: 2 }}>Days 22 – {clNum} (post-ovulation phase)</Text>
              </View>

              <View style={{ marginTop: 24, padding: 12, backgroundColor: surfaceVariant, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#7F77DD' }}>
                <Text style={{ fontSize: 11, color: secondaryText, lineHeight: 16, fontWeight: '600' }}>
                  <Text style={{ color: colors.text, fontWeight: '800' }}>Disclaimer:</Text> This rhythm-based forecast assumes a regular ovulation mid-cycle. It is not a substitute for clinical contraception.
                </Text>
              </View>
            </View>
          </View>

          <Text style={s.sectionTitle}>Activity History</Text>
          {intimacyLogs.length === 0 ? (
            <View style={[s.card, { alignItems: 'center', padding: 32 }]}>
              <MaterialCommunityIcons name="heart-outline" size={32} color={outlineColor} />
              <Text style={{ color: secondaryText, marginTop: 8, fontWeight: '600' }}>No logs yet</Text>
            </View>
          ) : (
            intimacyLogs.map(log => (
              <View key={log.id} style={s.card}>
                <View style={[s.cardPad, s.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>{parseDate(log.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                    <Text style={{ fontSize: 12, color: secondaryText, marginTop: 2, textTransform: 'capitalize', fontWeight: '600' }}>
                      {log.protection === 'none' ? 'Unprotected' : log.protection}
                    </Text>
                  </View>
                  <View style={[s.row, { gap: 12 }]}>
                    <TouchableOpacity onPress={() => editIntimacyEntry(log)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: surfaceVariant, justifyContent: 'center', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="pencil-outline" size={16} color={secondaryText} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteIntimacyEntry(log.id)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: dangerRed + '15', justifyContent: 'center', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="trash-can-outline" size={16} color={dangerRed} />
                    </TouchableOpacity>
                  </View>
                </View>
                {log.notes && (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                    <View style={{ padding: 12, backgroundColor: surfaceVariant, borderRadius: 12 }}>
                      <Text style={{ fontSize: 12, color: colors.text, fontStyle: 'italic', lineHeight: 18 }}>"{log.notes}"</Text>
                    </View>
                  </View>
                )}
              </View>
            ))
          )}

          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: '#D4537E', marginHorizontal: 16, marginTop: 8, borderRadius: 16 }]}
            onPress={() => { setQuickLogType('intimacy'); setShowQuickLog(true); }}
          >
            <Text style={s.primaryBtnTx}>Log New Activity</Text>
          </TouchableOpacity>

          <Text style={s.sectionTitle}>Privacy & Security</Text>
          <TouchableOpacity
            style={[s.card, { marginBottom: 40 }]}
            onPress={() => {
              setConfirmCfg({
                title: 'Reset Security',
                message: 'This will remove your PIN and lock the section.',
                isDanger: true,
                onConfirm: async () => {
                  await AsyncStorage.removeItem(PIN_KEY);
                  setPinSet(false);
                  setIntimacyUnlocked(false);
                  switchTab('home');
                  showToast('Security PIN removed', 'warning');
                }
              });
              setShowConfirm(true);
            }}
          >
            <View style={[s.cardPad, s.row, { justifyContent: 'space-between' }]}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>PIN Protection</Text>
                <Text style={{ fontSize: 11, color: secondaryText, marginTop: 2 }}>Enabled · Tap to reset or disable</Text>
              </View>
              <MaterialCommunityIcons name="shield-key-outline" size={20} color={secondaryText} />
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  const renderLogModal = () => {
    // Moved scrollRef to top level to follow Rules of Hooks

    return (
      <Modal visible={showQuickLog} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => { setShowQuickLog(false); resetPeriodForm(); }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>

          {/* Premium Header */}
          <View style={{ paddingHorizontal: scaleSize(20), paddingVertical: scaleSize(16), borderBottomWidth: 1, borderBottomColor: outlineColor, backgroundColor: cardBg }}>
            <View style={[s.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
              <View>
                <Text style={{ fontSize: scaleFontSize(20), fontWeight: '900', color: colors.text }}>
                  {quickLogType === 'intimacy' ? 'Private Entry' : editingPeriodId ? 'Edit Period' : 'Log Period'}
                </Text>
                <Text style={{ fontSize: scaleFontSize(11), color: secondaryText, fontWeight: '700' }}>{todayStr()}</Text>
              </View>
              <TouchableOpacity onPress={() => { setShowQuickLog(false); resetPeriodForm(); }}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: surfaceVariant, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>


          </View>

          <ScrollView ref={logScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: scaleSize(20), paddingBottom: scaleSize(40) }}>

            {/* PERIOD SECTION */}
            {quickLogType === 'period' && (() => {
              // Context: is there an active period right now (and we're not editing)?
              const hasActivePeriod = !editingPeriodId && !!lastPeriodLog?.isActive;

              return (
                <>
                  {/* Contextual banner */}
                  {hasActivePeriod ? (
                    <View style={{ marginBottom: scaleSize(20), padding: scaleSize(14), borderRadius: scaleSize(14), backgroundColor: '#E24B4A12', borderWidth: 1.5, borderColor: '#E24B4A40', flexDirection: 'row', alignItems: 'center', gap: scaleSize(10) }}>
                      <MaterialCommunityIcons name="water" size={18} color="#E24B4A" />
                      <Text style={{ fontSize: scaleFontSize(13), fontWeight: '900', color: '#E24B4A' }}>
                        Period Day {daysBetween(lastPeriodLog!.startDate, todayStr()) + 1} · started {parseDate(lastPeriodLog!.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                  ) : !editingPeriodId && periodLogs.length === 0 ? (
                    <View style={{ marginBottom: scaleSize(20), padding: scaleSize(16), borderRadius: scaleSize(16), backgroundColor: '#4052B610', borderWidth: 1.5, borderColor: '#4052B630' }}>
                      <Text style={{ fontSize: scaleFontSize(13), fontWeight: '800', color: '#4052B6', marginBottom: 4 }}>First period log</Text>
                      <Text style={{ fontSize: scaleFontSize(12), color: secondaryText, lineHeight: 18, fontWeight: '600' }}>Log your most recent period to start tracking your cycle.</Text>
                    </View>
                  ) : null}

                  {/* 1. STATUS SELECTOR — 2-way: Ongoing | Completed */}
                  {!hasActivePeriod && (
                    <View style={{ marginBottom: scaleSize(24) }}>
                      <Text style={[s.label, { marginBottom: scaleSize(12) }]}>Current Status</Text>
                      <View style={{ flexDirection: 'row', backgroundColor: surfaceVariant, borderRadius: 16, padding: 4, marginBottom: scaleSize(16) }}>
                        {(['ongoing', 'completed'] as const).map(st => {
                          const active = st === 'ongoing' ? isOngoing : !isOngoing;
                          const label = st === 'ongoing' ? 'Ongoing' : 'Completed';
                          return (
                            <TouchableOpacity
                              key={st}
                              onPress={() => {
                                Haptics.selectionAsync();
                                if (st === 'ongoing') {
                                  setIsOngoing(true); setPeriodEndDate('');
                                } else {
                                  setIsOngoing(false); if (!periodEndDate) setPeriodEndDate(todayStr());
                                }
                              }}
                              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: active ? '#4052B6' : 'transparent' }}
                            >
                              <Text style={{ fontSize: scaleFontSize(11), fontWeight: '900', color: active ? '#FFF' : secondaryText }}>{label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Always show start date picker when Ongoing — user can pick today or an earlier date */}
                      {isOngoing && (
                        <CalendarPicker label="Start Date" value={periodStartDate} onChange={setPeriodStartDate} maxDate={todayStr()} accentColor="#4052B6" colors={colors} isDark={isDark} />
                      )}
                      {!isOngoing && (
                        <>
                          <CalendarPicker label="Cycle Start" value={periodStartDate} onChange={setPeriodStartDate} maxDate={todayStr()} accentColor="#4052B6" colors={colors} isDark={isDark} />
                          <CalendarPicker label="Cycle End" value={periodEndDate} onChange={setPeriodEndDate} minDate={periodStartDate} maxDate={todayStr()} accentColor="#E24B4A" colors={colors} isDark={isDark} />
                        </>
                      )}
                    </View>
                  )}

                  {/* When active period: show only end-date picker */}
                  {hasActivePeriod && (
                    <View style={{ marginBottom: scaleSize(20) }}>
                      <CalendarPicker label="End Date (today if finished)" value={periodEndDate || todayStr()} onChange={setPeriodEndDate} minDate={lastPeriodLog!.startDate} maxDate={todayStr()} accentColor="#E24B4A" colors={colors} isDark={isDark} />
                    </View>
                  )}

                  {/* 2. FLOW */}
                  <View style={{ marginBottom: scaleSize(24) }}>
                    <View style={[s.row, { justifyContent: 'space-between', marginBottom: scaleSize(12) }]}>
                      <Text style={s.label}>Flow Intensity</Text>
                      <Text style={{ fontSize: scaleFontSize(13), fontWeight: '800', color: '#4052B6' }}>{FLOW_OPTIONS.find(f => f.key === flowIntensity)?.label}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', backgroundColor: surfaceVariant, borderRadius: scaleSize(16), padding: 4 }}>
                      {FLOW_OPTIONS.map(f => {
                        const active = flowIntensity === f.key;
                        return (
                          <TouchableOpacity key={f.key} onPress={() => { setFlowIntensity(f.key); Haptics.selectionAsync(); }} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: active ? '#FFF' : 'transparent' }}>
                            <View style={{ flexDirection: 'row', gap: 1.5, marginBottom: 2 }}>
                              {Array.from({ length: f.dots }).map((_, i) => <View key={i} style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: active ? '#4052B6' : secondaryText }} />)}
                            </View>
                            <Text style={{ fontSize: scaleFontSize(10), fontWeight: '800', color: active ? '#4052B6' : secondaryText }}>{f.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* 3. PAIN */}
                  <PainSelector value={painLevel} onChange={setPainLevel} colors={colors} />

                  {!hasActivePeriod && (
                    <View style={{ marginBottom: scaleSize(24) }}>
                      <Text style={[s.label, { marginBottom: 12 }]}>Symptoms</Text>
                      {SYMPTOM_GROUPS.map((cat) => (
                        <View key={cat.title} style={{ marginBottom: 14 }}>
                          <Text style={{ fontSize: 9, fontWeight: '900', color: secondaryText, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>{cat.title}</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {cat.items.map(sk => {
                              const isActive = selectedSymptoms.includes(sk as SymptomType);
                              return (
                                <TouchableOpacity key={sk} onPress={() => toggleSym(sk as SymptomType, selectedSymptoms, setSelectedSymptoms)}
                                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: isActive ? '#4052B6' : outlineColor, backgroundColor: isActive ? '#4052B615' : 'transparent' }}>
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? '#4052B6' : secondaryText }}>{sk.replace('_', ' ')}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity
                    style={[s.primaryBtn, { backgroundColor: hasActivePeriod ? '#E24B4A' : '#4052B6', borderRadius: 16 }]}
                    onPress={handleSavePeriod}
                  >
                    <Text style={s.primaryBtnTx}>{hasActivePeriod ? 'Mark as Finished' : editingPeriodId ? 'Update Period' : 'Save Period'}</Text>
                  </TouchableOpacity>
                </>
              );
            })()}

            {/* INTIMACY SECTION */}
            {quickLogType === 'intimacy' && (
              <>
                <View style={{ marginBottom: 24, padding: 20, borderRadius: 24, backgroundColor: '#D4537E08', borderWidth: 1, borderColor: '#D4537E30', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="heart-flash" size={32} color="#D4537E" style={{ marginBottom: 12 }} />
                  <Text style={{ fontSize: scaleFontSize(16), fontWeight: '900', color: '#D4537E', textAlign: 'center', marginBottom: 6 }}>Nurture Your Bond</Text>
                  <Text style={{ fontSize: scaleFontSize(12), color: secondaryText, textAlign: 'center', lineHeight: 18, fontWeight: '600' }}>
                    "Did you know? Intimacy triggers a surge in oxytocin, reducing cortisol levels by up to 40%."
                  </Text>
                </View>

                <CalendarPicker label="Date of Connection" value={intimacyDate} onChange={setIntimacyDate} maxDate={todayStr()} accentColor="#D4537E" colors={colors} isDark={isDark} />

                <Text style={s.label}>Romantic Details</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                  {PROTECTION_OPTIONS.map(p => (
                    <TouchableOpacity key={p.key} onPress={() => setIntimacyProtection(p.key)} style={{ flex: 1, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: intimacyProtection === p.key ? '#D4537E' : outlineColor, backgroundColor: intimacyProtection === p.key ? '#D4537E15' : 'transparent' }}>
                      <MaterialCommunityIcons name={p.icon} size={22} color={intimacyProtection === p.key ? '#D4537E' : secondaryText} style={{ alignSelf: 'center', marginBottom: 4 }} />
                      <Text style={{ fontSize: 10, fontWeight: '900', color: intimacyProtection === p.key ? '#D4537E' : secondaryText, textAlign: 'center' }}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top', marginBottom: 24 }]} value={intimacyNotes} onChangeText={setIntimacyNotes} multiline placeholder="Share your thoughts..." placeholderTextColor={secondaryText} />

                <TouchableOpacity style={[s.primaryBtn, { backgroundColor: '#D4537E', borderRadius: 20, shadowColor: '#D4537E', shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 }]} onPress={handleSaveIntimacy}>
                  <Text style={s.primaryBtnTx}>Log Connection</Text>
                </TouchableOpacity>
              </>
            )}

          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  // ─── PIN MODAL ───────────────────────────────────────────────────────────────
  const renderPinModal = () => {
    const handleNumPress = (num: number) => {
      if (pinInput.length < 4) {
        const next = pinInput + num;
        setPinInput(next);
        Haptics.selectionAsync();
        if (next.length === 4) setTimeout(() => submitPin(next), 150);
      }
    };

    const isSetup = settingPin;
    const step = confirmStep ? 2 : 1;
    const title = isSetup
      ? (step === 1 ? 'Create a PIN' : 'Confirm PIN')
      : 'Private Log';
    const subtitle = isSetup
      ? (step === 1 ? 'Choose a 4-digit PIN to protect your private log' : 'Re-enter your PIN to confirm')
      : 'Enter your 4-digit PIN to continue';

    return (
      <Modal visible={showPinModal} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000055' }}>
          <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={{ borderTopLeftRadius: scaleSize(28), borderTopRightRadius: scaleSize(28), overflow: 'hidden' }}>
            <Animated.View style={{ transform: [{ translateX: pinShakeAnim }], backgroundColor: cardBg, paddingTop: scaleSize(24), paddingBottom: scaleSize(40), paddingHorizontal: scaleSize(24), alignItems: 'center' }}>

              {/* Handle bar */}
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: outlineColor, marginBottom: scaleSize(24) }} />

              {/* Icon */}
              <View style={{ width: scaleSize(64), height: scaleSize(64), borderRadius: scaleSize(20), backgroundColor: '#D4537E18', justifyContent: 'center', alignItems: 'center', marginBottom: scaleSize(16) }}>
                <Ionicons name={isSetup ? 'lock-open-outline' : 'lock-closed-outline'} size={28} color="#D4537E" />
              </View>

              {/* Title + subtitle */}
              <Text style={{ fontSize: scaleFontSize(20), fontWeight: '900', color: colors.text, marginBottom: scaleSize(6) }}>{title}</Text>
              <Text style={{ fontSize: scaleFontSize(12), color: secondaryText, textAlign: 'center', marginBottom: scaleSize(28), lineHeight: 18, fontWeight: '600', paddingHorizontal: scaleSize(16) }}>{subtitle}</Text>

              {/* Step progress for setup */}
              {isSetup && (
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: scaleSize(20) }}>
                  {[1, 2].map(s => (
                    <View key={s} style={{ height: 3, width: 28, borderRadius: 2, backgroundColor: step >= s ? '#D4537E' : outlineColor }} />
                  ))}
                </View>
              )}

              {/* PIN dots */}
              <View style={{ flexDirection: 'row', gap: scaleSize(16), marginBottom: scaleSize(32) }}>
                {[0, 1, 2, 3].map(i => (
                  <View key={i} style={{
                    width: scaleSize(16), height: scaleSize(16), borderRadius: scaleSize(8),
                    backgroundColor: pinInput.length > i ? '#D4537E' : 'transparent',
                    borderWidth: 2, borderColor: pinInput.length > i ? '#D4537E' : outlineColor,
                  }} />
                ))}
              </View>

              {/* Error message */}
              {!!pinError && (
                <Text style={{ fontSize: scaleFontSize(12), color: '#E24B4A', fontWeight: '700', marginBottom: scaleSize(16), marginTop: scaleSize(-16) }}>{pinError}</Text>
              )}

              {/* Numpad */}
              <View style={{ width: '100%', maxWidth: 280 }}>
                {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row, ri) => (
                  <View key={ri} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: scaleSize(12) }}>
                    {row.map(n => (
                      <TouchableOpacity key={n} onPress={() => handleNumPress(n)}
                        style={{ width: scaleSize(72), height: scaleSize(72), borderRadius: scaleSize(36), backgroundColor: surfaceVariant, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: scaleFontSize(22), fontWeight: '600', color: colors.text }}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {/* Biometric placeholder / empty */}
                  <View style={{ width: scaleSize(72) }} />
                  <TouchableOpacity onPress={() => handleNumPress(0)}
                    style={{ width: scaleSize(72), height: scaleSize(72), borderRadius: scaleSize(36), backgroundColor: surfaceVariant, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: scaleFontSize(22), fontWeight: '600', color: colors.text }}>0</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setPinInput(p => p.slice(0, -1)); setPinError(''); }}
                    style={{ width: scaleSize(72), height: scaleSize(72), alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="backspace-outline" size={24} color={secondaryText} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Cancel */}
              <TouchableOpacity onPress={() => { setShowPinModal(false); setPinInput(''); setPinError(''); setConfirmStep(false); }} style={{ marginTop: scaleSize(24) }}>
                <Text style={{ fontSize: scaleFontSize(14), color: secondaryText, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>

            </Animated.View>
          </BlurView>
        </View>
      </Modal>
    );
  };

  const renderConfirmModal = () => {
    if (!confirmCfg) return null;
    return (
      <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => setShowConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: scaleSize(24) }}>
          <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={{ borderRadius: scaleSize(28), overflow: 'hidden' }}>
            <View style={{ backgroundColor: cardBg, padding: scaleSize(24), alignItems: 'center' }}>
              <View style={{ width: scaleSize(54), height: scaleSize(54), borderRadius: scaleSize(18), backgroundColor: confirmCfg.isDanger ? (isDark ? '#4F1A1A' : '#FEE2E2') : (isDark ? '#2C2C2E' : '#F3F4F6'), justifyContent: 'center', alignItems: 'center', marginBottom: scaleSize(16) }}>
                <MaterialCommunityIcons name={confirmCfg.isDanger ? "alert-circle-outline" : "help-circle-outline"} size={28} color={confirmCfg.isDanger ? dangerRed : secondaryText} />
              </View>
              <Text style={{ fontSize: scaleFontSize(18), fontWeight: '900', color: colors.text, textAlign: 'center' }}>{confirmCfg.title}</Text>
              <Text style={{ fontSize: scaleFontSize(13), color: secondaryText, textAlign: 'center', marginTop: scaleSize(8), lineHeight: 20 }}>{confirmCfg.message}</Text>
              <View style={{ width: '100%', marginTop: scaleSize(24), gap: scaleSize(10) }}>
                <TouchableOpacity onPress={() => { confirmCfg.onConfirm(); setShowConfirm(false); }} style={{ backgroundColor: confirmCfg.isDanger ? dangerRed : '#4052B6', padding: scaleSize(14), borderRadius: scaleSize(16), alignItems: 'center' }}>
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: scaleFontSize(14) }}>Confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowConfirm(false)} style={{ backgroundColor: surfaceVariant, padding: scaleSize(14), borderRadius: scaleSize(16), alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: scaleFontSize(14) }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>
    );
  };

  // ─── MAIN RENDER ─────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[s.root, { 
      opacity: fadeAnim,
      transform: [{ 
        translateY: fadeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0]
        })
      }]
    }]}>
      <SafeAreaView style={s.container} edges={['top']}>

      {/* ── Top Header Bar ── */}
      <View style={{ paddingHorizontal: scaleSize(16), paddingTop: scaleSize(12), paddingBottom: scaleSize(10), backgroundColor: cardBg, borderBottomWidth: 1, borderBottomColor: outlineColor }}>
        {/* Row 1: title + settings */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scaleSize(12) }}>
          <TouchableOpacity onPress={handleHeadingTap} activeOpacity={0.9}>
            <Text style={{ fontSize: scaleFontSize(20), fontWeight: '900', color: colors.text }}>Cycle</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={{ width: scaleSize(36), height: scaleSize(36), borderRadius: scaleSize(18), backgroundColor: surfaceVariant, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
        {/* Row 2: pill tabs with animated sliding indicator */}
        <View style={{ flexDirection: 'row', backgroundColor: surfaceVariant, borderRadius: scaleSize(12), padding: 3 }}>
          {([
            { key: 'home', label: 'Today', icon: 'home-outline', activeIcon: 'home' },
            { key: 'calendar', label: 'Calendar', icon: 'calendar-outline', activeIcon: 'calendar' },
            { key: 'insights', label: 'Insights', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
            ...(activeTab === 'intimacy' ? [{ key: 'intimacy' as const, label: 'Private', icon: 'heart-outline', activeIcon: 'heart' }] : []),
          ] as const).map((tab, idx) => {
            const isActive = activeTab === tab.key;
            // Compute per-tab scale from indicator animation
            const tabScale = tabIndicatorAnim.interpolate({
              inputRange: [idx - 1, idx, idx + 1],
              outputRange: [0.95, 1.04, 0.95],
              extrapolate: 'clamp',
            });
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => switchTab(tab.key)}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: scaleSize(8), borderRadius: scaleSize(10) }}
              >
                <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: scaleSize(5), transform: [{ scale: tabScale }] }}>
                  <Ionicons name={(isActive ? tab.activeIcon : tab.icon) as any} size={14} color={isActive ? (tab.key === 'intimacy' ? '#D4537E' : dangerRed) : secondaryText} />
                  <Text style={{ fontSize: scaleFontSize(12), fontWeight: '800', color: isActive ? (tab.key === 'intimacy' ? '#D4537E' : dangerRed) : secondaryText }}>{tab.label}</Text>
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Sliding Viewport Content: All tabs rendered side-by-side for zero-latency switching */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View
          style={{
            flex: 1,
            flexDirection: 'row',
            width: screenWidth * 4,
            transform: [{
              translateX: tabIndicatorAnim.interpolate({
                inputRange: [0, 1, 2, 3],
                outputRange: [0, -screenWidth, -screenWidth * 2, -screenWidth * 3]
              })
            }]
          }}
        >
          <View style={{ width: screenWidth }}>{renderHome()}</View>
          <View style={{ width: screenWidth }}>{renderCalendar()}</View>
          <View style={{ width: screenWidth }}>{renderInsights()}</View>
          <View style={{ width: screenWidth }}>{intimacyUnlocked ? renderIntimacy() : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="lock-outline" size={48} color={outlineColor} /><Text style={{ color: secondaryText, marginTop: 12 }}>Unlock to view private logs</Text></View>}</View>
        </Animated.View>
      </View>

      <View style={{ position: 'absolute', bottom: scaleSize(24), right: scaleSize(20), alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => openLog('period')}
          style={{ width: scaleSize(56), height: scaleSize(56), borderRadius: scaleSize(28), backgroundColor: dangerRed, justifyContent: 'center', alignItems: 'center', shadowColor: dangerRed, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10, elevation: 12 }}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>

      {renderLogModal()}
      {renderPinModal()}
      {renderConfirmModal()}

      {/* Phase Detail */}
      <Modal visible={showPhaseDetail} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPhaseDetail(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[s.row, { justifyContent: 'space-between', padding: scaleSize(18) }]}>
            <Text style={{ fontSize: scaleFontSize(18), fontWeight: '900', color: colors.text }}>Phase Detail</Text>
            <TouchableOpacity onPress={() => setShowPhaseDetail(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: scaleSize(18), paddingTop: 0 }}>
            <View style={{ alignItems: 'center', marginBottom: scaleSize(18) }}>
              <View style={{ width: scaleSize(68), height: scaleSize(68), borderRadius: scaleSize(20), backgroundColor: currentPhase.color + '20', justifyContent: 'center', alignItems: 'center', marginBottom: scaleSize(10) }}>
                <MaterialCommunityIcons name={currentPhase.icon} size={34} color={currentPhase.color} />
              </View>
              <Text style={{ fontSize: scaleFontSize(24), fontWeight: '900', color: currentPhase.color }}>{currentPhase.name}</Text>
              <Text style={{ fontSize: scaleFontSize(12), color: secondaryText, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>{currentPhase.desc}</Text>
            </View>
            {(['characteristics', 'recommendations'] as const).map(sec => (
              <View key={sec} style={[s.card, { marginHorizontal: 0 }]}>
                <View style={s.cardPad}>
                  <Text style={{ fontSize: scaleFontSize(13), fontWeight: '800', color: colors.text, textTransform: 'capitalize', marginBottom: scaleSize(10) }}>{sec}</Text>
                  {currentPhase[sec].map((item, i) => (
                    <View key={i} style={[s.row, { marginBottom: scaleSize(8) }]}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: currentPhase.color, marginRight: scaleSize(10), marginTop: 5 }} />
                      <Text style={{ fontSize: scaleFontSize(13), color: colors.text, flex: 1, lineHeight: 20 }}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Emergency */}
      <Modal visible={showEmergency} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEmergency(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[s.row, { justifyContent: 'space-between', padding: scaleSize(18) }]}>
            <Text style={{ fontSize: scaleFontSize(18), fontWeight: '900', color: colors.text }}>Support & Resources</Text>
            <TouchableOpacity onPress={() => setShowEmergency(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: scaleSize(16), paddingTop: 0 }}>
            <AlertBanner type="danger" icon="alert-circle-outline" _isDark={isDark} _secondaryText={secondaryText} title="Medical emergency? Call 112 immediately." />
            {EMERGENCY_RESOURCES.map((r, i) => (
              <View key={i} style={s.card}><View style={s.cardPad}>
                <Text style={{ fontSize: scaleFontSize(14), fontWeight: '900', color: colors.text }}>{r.type}</Text>
                <Text style={{ fontSize: scaleFontSize(12), color: secondaryText, marginTop: 3 }}>{r.service} · {r.available}</Text>
                <View style={{ marginTop: scaleSize(10), backgroundColor: dangerRed, borderRadius: scaleSize(10), padding: scaleSize(11), alignItems: 'center' }}>
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: scaleFontSize(13) }}>📞 {r.hotline}</Text>
                </View>
              </View></View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Settings */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSettings(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[s.row, { justifyContent: 'space-between', padding: scaleSize(18) }]}>
            <Text style={{ fontSize: scaleFontSize(18), fontWeight: '900', color: colors.text }}>Settings</Text>
            <TouchableOpacity onPress={() => setShowSettings(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: scaleSize(18), paddingTop: 0 }}>
            <Text style={[s.label, { marginBottom: scaleSize(8) }]}>Average cycle length (days)</Text>
            <TextInput style={[s.input, { marginBottom: scaleSize(14) }]} value={cycleLengthInput} onChangeText={setCycleLengthInput} keyboardType="number-pad" placeholder="28" placeholderTextColor={secondaryText} />
            <Text style={[s.label, { marginBottom: scaleSize(8) }]}>Average period duration (days)</Text>
            <TextInput style={[s.input, { marginBottom: scaleSize(22) }]} value={durationInput} onChangeText={setDurationInput} keyboardType="number-pad" placeholder="5" placeholderTextColor={secondaryText} />
            <TouchableOpacity style={s.primaryBtn} onPress={async () => {
              const cl = parseInt(cycleLengthInput), pd = parseInt(durationInput);
              if (isNaN(cl) || cl < 21 || cl > 45) { showToast('Cycle length must be 21–45 days', 'error'); return; }
              if (isNaN(pd) || pd < 1 || pd > 10) { showToast('Duration must be 1–10 days', 'error'); return; }
              setCycleLength(cl); setPeriodDuration(pd);
              await AsyncStorage.setItem('@cycle_length', String(cl));
              await AsyncStorage.setItem('@period_duration', String(pd));
              setShowSettings(false); showToast('Settings saved ✓', 'success');
            }}>
              <Text style={s.primaryBtnTx}>Save Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.secondaryBtn}
              onPress={() => {
                setConfirmCfg({
                  title: 'Clear All Data',
                  message: 'Permanently deletes all logs. Cannot be undone.',
                  isDanger: true,
                  onConfirm: async () => {
                    await AsyncStorage.multiRemove(['@period_logs_v2', '@intimacy_logs_v2', '@cycle_length', '@period_duration', PIN_KEY]);
                    setPeriodLogs([]); setIntimacyLogs([]); setPinSet(false); setIntimacyUnlocked(false);
                    setShowSettings(false); showToast('All data cleared', 'warning');
                  }
                });
                setShowConfirm(true);
              }}
            >
              <Text style={{ color: dangerRed, fontWeight: '800', fontSize: scaleFontSize(14) }}>Clear All Data</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>


      {/* Toast */}
      {toast && (
        <Animated.View style={{
          position: 'absolute', top: scaleSize(14), left: scaleSize(14), right: scaleSize(14),
          transform: [{ translateY: toastAnim }],
          backgroundColor: toast.type === 'error' ? '#791F1F' : toast.type === 'success' ? '#27500A' : toast.type === 'warning' ? '#633806' : '#0C447C',
          borderRadius: scaleSize(14), padding: scaleSize(14), flexDirection: 'row', alignItems: 'center',
          zIndex: 9999, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10,
        }}>
          <View style={{ width: scaleSize(28), height: scaleSize(28), borderRadius: scaleSize(8), backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: scaleSize(10) }}>
            <MaterialCommunityIcons name={toast.type === 'error' ? 'alert-circle-outline' : toast.type === 'success' ? 'check-circle-outline' : toast.type === 'warning' ? 'alert-outline' : 'information-outline'} size={16} color="#FFF" />
          </View>
          <Text style={{ flex: 1, color: '#FFF', fontWeight: '700', fontSize: scaleFontSize(13) }}>{toast.message}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
    </Animated.View>
  );
}