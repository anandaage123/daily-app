import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  Platform,
  Modal,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { cacheDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { scaleFontSize } from '../utils/ResponsiveSize';
import { useTheme } from '../context/ThemeContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { broadcastSyncUpdate } from '../services/SyncService';
import { JSX } from 'react/jsx-runtime';

const { width } = Dimensions.get('window');

type Mood = '😀' | '❤️' | '😐' | '😩' | '😡';
const MOODS: Mood[] = ['😀', '❤️', '😐', '😩', '😡'];
type ViewMode = 'list' | 'grid' | 'bento' | 'compact';

const PALETTE = [
  '#FF6B6B', '#FF8E53', '#FFE66D', '#4ECDC4', '#45B7D1',
  '#A8E6CF', '#C9B1FF', '#FF9ECD', '#B5EAD7', '#FFDAC1',
  '#E2B4BD', '#9EC1CF', '#F7AEF8', '#72DDF7', '#8EE3EF',
];

interface Category {
  name: string;
  color: string;
  icon: string;
}

// Categories were removed from the journal UI (kept only for backward compatibility with stored notes).

interface JournalNote {
  id: string;
  text: string;
  time: string;
}

interface NoteExtras {
  manualNotes?: string;
  journalNotes?: JournalNote[];
}

interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
  dateRaw: number;
  mood?: Mood;
  category: string; // legacy field kept for existing stored data
  isPinned?: boolean;
  extras?: NoteExtras;
}

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

type DailyLogSection =
  | { kind: 'title'; text: string }
  | { kind: 'row'; text: string };

export default function NotesScreen() {
  const { colors, isDark } = useTheme();
  const { periodTrackerEnabled, setPeriodTrackerEnabled } = useAppSettings();
  const isFocused = useIsFocused();

  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const secondaryText = isDark ? '#A1A1AA' : '#666666';
  const surfaceVariant = isDark ? '#2C2C2E' : '#F2F2F7';
  const outlineColor = isDark ? '#3A3A3C' : '#E5E5EA';
  const placeholderColor = isDark ? '#55555A' : '#A0A0B0';
  const glass = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.78)';

  // ── State ──────────────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasRegisteredPin, setHasRegisteredPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [setupStep, setSetupStep] = useState<'none' | 'set' | 'confirm'>('none');
  const [tempPin, setTempPin] = useState('');

  const [notes, setNotes] = useState<Note[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const [calendarVisible, setCalendarVisible] = useState(false);
  const [filterFrom, setFilterFrom] = useState<Date | null>(null);
  const [filterTo, setFilterTo] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const [isEditing, setIsEditing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [currentNote, setCurrentNote] = useState<Partial<Note>>({});

  const [isSettingsVisible, setIsSettingsVisible] = useState(false);

  const [hint, setHint] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [contentSelection, setContentSelection] = useState({ start: 0, end: 0 });
  const [manualSelection, setManualSelection] = useState({ start: 0, end: 0 });

  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; buttons: { text: string; onPress?: () => void; destructive?: boolean }[]; visible: boolean } | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;

  // Custom alert handler
  const showAlert = (title: string, message: string, buttons?: { text: string; onPress?: () => void; destructive?: boolean }[]) => {
    setAlertConfig({
      title,
      message,
      buttons: buttons || [{ text: 'OK' }],
      visible: true,
    });
  };

  const closeAlert = () => {
    setAlertConfig(null);
  };

  // ── Boot ───────────────────────────────────────────────────────────────────
  // PIN check only on mount — no need to re-check on every tab focus
  useEffect(() => {
    checkPinStatus();
  }, []);

  // Notes reload on every focus (another screen may have added notes)
  useEffect(() => {
    if (isFocused) loadNotes();
  }, [isFocused]);

  const checkPinStatus = async () => {
    const saved = await AsyncStorage.getItem('@journal_pin_v3');
    setHasRegisteredPin(!!saved);
    setIsAuthenticated(!saved);
  };

  const loadNotes = async () => {
    const stored = await AsyncStorage.getItem('@daily_notes_v3');
    if (stored) setNotes(JSON.parse(stored));
  };

  const hashToIndex = (s: string, mod: number) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % mod;
  };

  const accentForNote = (note?: Partial<Note>) => {
    if (!note) return colors.primary;
    if (isDailyLogNote(note)) return colors.primary;
    const key = note.id || `${note.title ?? ''}-${note.dateRaw ?? ''}`;
    return PALETTE[hashToIndex(key, PALETTE.length)];
  };

  const iconForNote = (note?: Partial<Note>) => {
    if (!note) return '📝';
    if (isDailyLogNote(note)) return '📅';
    return note.mood || '📝';
  };

  const isDailyLogNote = (note?: Partial<Note>) =>
    !!note?.id?.startsWith('daily-log-') ||
    (note?.content?.includes('\nTIMESHEET\n') && note?.content?.includes('\nCOMPLETED\n'));

  const insertCurrentTimeAtCursor = () => {
    const isAuto = isDailyLogNote(currentNote);
    const target = isAuto ? (currentNote.extras?.manualNotes ?? '') : (currentNote.content ?? '');
    const selection = isAuto ? manualSelection : contentSelection;
    const selStart = Math.max(0, Math.min(selection.start, target.length));
    const selEnd = Math.max(selStart, Math.min(selection.end, target.length));
    const before = target.slice(0, selStart);
    const after = target.slice(selEnd);
    const needsNewline = before.length > 0 && !before.endsWith('\n');
    const time = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const stamp = `${needsNewline ? '\n' : ''}${time} `;
    const nextText = `${before}${stamp}${after}`;
    const caret = before.length + stamp.length;
    if (isAuto) {
      setCurrentNote({
        ...currentNote,
        extras: { ...(currentNote.extras ?? {}), manualNotes: nextText },
      });
      setManualSelection({ start: caret, end: caret });
    } else {
      setCurrentNote({ ...currentNote, content: nextText });
      setContentSelection({ start: caret, end: caret });
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const parseTimestampLine = (line: string) => {
    const match = line.match(/^(\d{1,2}:\d{2}\s?[APMapm]{2})(.*)$/);
    if (!match) return null;
    return {
      time: match[1].trim(),
      body: (match[2] ?? '').trim(),
    };
  };

  const getManualText = (note?: Partial<Note>) => {
    if (!note?.extras) return '';
    if ((note.extras.manualNotes ?? '').trim().length > 0) return note.extras.manualNotes ?? '';
    const legacy = note.extras.journalNotes ?? [];
    return legacy.map(j => `${j.time} ${j.text}`.trim()).join('\n');
  };

  const parseJournalBlocks = (text?: string): { time?: string; body: string }[] => {
    const lines = (text ?? '').split('\n').map(l => l.trimEnd());
    const blocks: { time?: string; body: string }[] = [];
    let current: { time?: string; bodyLines: string[] } | null = null;

    const pushCurrent = () => {
      if (!current) return;
      const body = current.bodyLines.join('\n').trim();
      if (body.length > 0 || current.time) blocks.push({ time: current.time, body });
      current = null;
    };

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const parsed = parseTimestampLine(line);
      if (parsed) {
        pushCurrent();
        current = { time: parsed.time, bodyLines: parsed.body ? [parsed.body] : [] };
      } else {
        if (!current) current = { bodyLines: [] };
        current.bodyLines.push(line);
      }
    }
    pushCurrent();
    return blocks;
  };

  const parseDailyLog = (content?: string): { timesheet: DailyLogSection[]; completed: DailyLogSection[] } => {
    const safe = content ?? '';
    const lines = safe.split('\n').map(l => l.trimEnd());

    const findIdx = (label: string) => lines.findIndex(l => l.trim() === label);
    const timesheetIdx = findIdx('TIMESHEET');
    const completedIdx = findIdx('COMPLETED');

    const sliceBetween = (start: number, end: number) => {
      if (start < 0) return [];
      const from = start + 1;
      const to = end >= 0 ? end : lines.length;
      return lines.slice(from, to);
    };

    // Skip underline rows like "───────"
    const normalize = (arr: string[]) => arr.filter(l => !(l.trim() && /^[-─]{3,}$/.test(l.trim())));

    const timesheetLines = normalize(sliceBetween(timesheetIdx, completedIdx));
    const completedLines = normalize(sliceBetween(completedIdx, -1));

    const toSections = (arr: string[]) =>
      arr
        .filter(Boolean)
        .map((l): DailyLogSection => {
          const t = l.trim();
          if (t.endsWith(':') && !t.startsWith('-')) return { kind: 'title', text: t.slice(0, -1) };
          return { kind: 'row', text: t.replace(/^-+\s*/, '') };
        });

    return { timesheet: toSections(timesheetLines), completed: toSections(completedLines) };
  };

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredNotes = notes.filter(n => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!n.title.toLowerCase().includes(q) && !n.content.toLowerCase().includes(q)) return false;
    }
    if (filterFrom) {
      const from = new Date(filterFrom); from.setHours(0, 0, 0, 0);
      if (n.dateRaw < from.getTime()) return false;
    }
    if (filterTo) {
      const to = new Date(filterTo); to.setHours(23, 59, 59, 999);
      if (n.dateRaw > to.getTime()) return false;
    }
    return true;
  });

  const pinnedNotes = filteredNotes.filter(n => n.isPinned);
  const unpinnedNotes = filteredNotes.filter(n => !n.isPinned);
  const displayNotes = [...pinnedNotes, ...unpinnedNotes];

  // ── PIN ────────────────────────────────────────────────────────────────────
  const handlePinInput = async (digit: string) => {
    // Prevent input if already at 6 digits
    if (pin.length >= 6) return;

    const newPin = pin + digit;
    setPin(newPin);

    // Haptic feedback on input
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Easter egg: show hint with custom code
    if (newPin === '198921') {
      const saved = await AsyncStorage.getItem('@journal_pin_v3');
      if (saved) {
        setHint(saved.split('').reverse().join(''));
        setShowHint(true);
        blinkAnim.setValue(1);
        Animated.sequence([
          ...Array(5).fill(null).flatMap(() => [
            Animated.timing(blinkAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
            Animated.timing(blinkAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
          ])
        ]).start(() => setTimeout(() => setShowHint(false), 1500));
      }
      setPin('');
      return;
    }

    // Handle when PIN is complete (6 digits)
    if (newPin.length === 6) {
      // During PIN setup - first entry
      if (setupStep === 'set') {
        setTempPin(newPin);
        setSetupStep('confirm');
        setPin('');
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      // During PIN setup - confirmation entry
      else if (setupStep === 'confirm') {
        if (newPin === tempPin) {
          await AsyncStorage.setItem('@journal_pin_v3', newPin);
          setHasRegisteredPin(true);
          setIsAuthenticated(true);
          setSetupStep('none');
          setPin('');
          setTempPin('');
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showAlert('✓ Security Set', 'Your journal is now protected with PIN security.');
        } else {
          setPin('');
          setSetupStep('set');
          setTempPin('');
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          showAlert('✗ PIN Mismatch', 'The two PINs do not match. Please try again.');
        }
      }
      // During authentication - unlock attempt
      else {
        const saved = await AsyncStorage.getItem('@journal_pin_v3');
        if (newPin === saved) {
          setIsAuthenticated(true);
          setPin('');
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          setPin('');
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
          ]).start();
        }
      }
    }
  };

  const handleBackspace = async () => {
    if (pin.length === 0) return;
    setPin(p => p.slice(0, -1));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ── Note CRUD ──────────────────────────────────────────────────────────────
  const saveCurrentNote = async () => {
    if (!currentNote.title?.trim() && !currentNote.content?.trim()) { setIsEditing(false); return; }
    const ts = Date.now();
    const newNote: Note = {
      id: currentNote.id || ts.toString(),
      title: currentNote.title || 'Untitled',
      content: currentNote.content || '',
      date: formatDate(ts),
      dateRaw: currentNote.dateRaw || ts,
      mood: currentNote.mood || '😀',
      category: currentNote.category || 'General',
      isPinned: currentNote.isPinned || false,
      extras: currentNote.extras,
    };
    const updated = currentNote.id
      ? notes.map(n => n.id === currentNote.id ? newNote : n)
      : [newNote, ...notes];
    setNotes(updated);
    await AsyncStorage.setItem('@daily_notes_v3', JSON.stringify(updated));
    const formatNotes = (ns: any[]) => ns.map(n => ({ id: n.id, title: n.title, content: n.content, date: n.date })).slice(0, 15);
    broadcastSyncUpdate('FULL_STATE_SYNC', { notes: formatNotes(updated) });
    setIsEditing(false); setIsViewing(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const deleteNote = async (id: string) => {
    showAlert('Delete Entry', 'Remove this note permanently?', [
      { text: 'Cancel' },
      {
        text: 'Delete', destructive: true, onPress: async () => {
          const updated = notes.filter(n => n.id !== id);
          setNotes(updated);
          await AsyncStorage.setItem('@daily_notes_v3', JSON.stringify(updated));
          const formatNotes = (ns: any[]) => ns.map(n => ({ id: n.id, title: n.title, content: n.content, date: n.date })).slice(0, 15);
          broadcastSyncUpdate('FULL_STATE_SYNC', { notes: formatNotes(updated) });
          setIsEditing(false); setIsViewing(false);
        }
      },
    ]);
  };

  const togglePin = async (id: string) => {
    const updated = notes.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n);
    setNotes(updated);
    await AsyncStorage.setItem('@daily_notes_v3', JSON.stringify(updated));
    const formatNotes = (ns: any[]) => ns.map(n => ({ id: n.id, title: n.title, content: n.content, date: n.date })).slice(0, 15);
    broadcastSyncUpdate('FULL_STATE_SYNC', { notes: formatNotes(updated) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportJournal = async () => {
    if (notes.length === 0) { showAlert('Empty Journal', 'No entries to export.'); return; }
    const exportContent = notes
      .map(n => `DATE: ${n.date}\nTITLE: ${n.title}\nCATEGORY: ${n.category}\nMOOD: ${n.mood ?? ''}\n\n${n.content ?? ''}\n\n${'─'.repeat(40)}`)
      .join('\n\n');
    const filePath = `${cacheDirectory}Journal_Backup_${Date.now()}.txt`;
    try {
      await writeAsStringAsync(filePath, exportContent, { encoding: EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, { mimeType: 'text/plain', dialogTitle: 'Export Journal' });
      }
      setIsSettingsVisible(false);
    } catch { showAlert('Export Error', 'Failed to generate file.'); }
  };

  const startPinSetup = () => {
    setIsSettingsVisible(false);
    setSetupStep('set');
    setIsAuthenticated(false);
    setPin('');
  };

  const disablePinProtection = async () => {
    showAlert('Disable PIN Protection', 'Remove PIN security? Your journal will be unprotected.', [
      { text: 'Keep PIN' },
      {
        text: 'Disable', destructive: true, onPress: async () => {
          await AsyncStorage.removeItem('@journal_pin_v3');
          setHasRegisteredPin(false);
          setIsAuthenticated(true);
          setIsSettingsVisible(false);
          showAlert('✓ PIN Disabled', 'Your journal is now unprotected.');
        }
      }
    ]);
  };

  // ── Calendar helpers ───────────────────────────────────────────────────────
  const calDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    return { first, days, year, month };
  };

  const hasNotesOnDay = (d: Date) =>
    notes.some(n => {
      const nd = new Date(n.dateRaw);
      return nd.getFullYear() === d.getFullYear() && nd.getMonth() === d.getMonth() && nd.getDate() === d.getDate();
    });

  // ── Styles ─────────────────────────────────────────────────────────────────
  const s = StyleSheet.create({
    // layout
    mainContainer: { flex: 1, backgroundColor: colors.background },
    appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    logoText: { fontSize: scaleFontSize(30), fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
    headerIcons: { flexDirection: 'row', gap: 8 },
    headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: surfaceVariant, justifyContent: 'center', alignItems: 'center' },
    // stats
    statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 16 },
    statCard: { flex: 1, backgroundColor: surfaceVariant, borderRadius: 16, padding: 14 },
    statLabel: { fontSize: scaleFontSize(11), color: secondaryText, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    statVal: { fontSize: scaleFontSize(26), fontWeight: '800', color: colors.text, marginTop: 2 },
    // search
    searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 14, backgroundColor: surfaceVariant, borderRadius: 14, paddingHorizontal: 14, height: 44, gap: 8 },
    searchInput: { flex: 1, fontSize: scaleFontSize(15), color: colors.text },
    // chips
    filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: surfaceVariant, borderWidth: 1.5, borderColor: 'transparent', marginRight: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
    filterChipText: { fontSize: scaleFontSize(13), fontWeight: '700', color: secondaryText },
    // date badge
    dateBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: surfaceVariant, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 5 },
    dateBadgeText: { fontSize: scaleFontSize(12), fontWeight: '700', color: secondaryText },
    // cards
    noteCard: { backgroundColor: cardBg, borderRadius: 20, padding: 18, marginHorizontal: 20, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: isDark ? 0 : 0.07, shadowRadius: 10 },
    noteTitle: { fontSize: scaleFontSize(17), fontWeight: '700', color: colors.text, flex: 1 },
    noteSnippet: { fontSize: scaleFontSize(14), color: secondaryText, lineHeight: 20, marginTop: 4 },
    noteMeta: { fontSize: scaleFontSize(11), fontWeight: '700', marginTop: 10, letterSpacing: 0.3 },
    gridCard: { backgroundColor: cardBg, borderRadius: 20, padding: 16, margin: 6, flex: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: isDark ? 0 : 0.07, shadowRadius: 10 },
    compactCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: outlineColor, gap: 12 },
    compactDot: { width: 10, height: 10, borderRadius: 5 },
    bentoContainer: { paddingHorizontal: 20, gap: 10 },
    bentoRow: { flexDirection: 'row', gap: 10 },
    bentoCard: { backgroundColor: cardBg, borderRadius: 20, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: isDark ? 0 : 0.07, shadowRadius: 10 },
    sectionLabel: { fontSize: scaleFontSize(11), fontWeight: '800', color: secondaryText, textTransform: 'uppercase', letterSpacing: 1, marginHorizontal: 20, marginBottom: 8, marginTop: 4 },
    // auth
    authContainer: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 30 },
    authInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    hintBadge: { position: 'absolute', top: 16, right: 16, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, zIndex: 999 },
    hintText: { color: '#FFF', fontWeight: '800', fontSize: scaleFontSize(13) },
    authHeading: { fontSize: scaleFontSize(26), fontWeight: '800', textAlign: 'center', color: colors.text, marginBottom: 8 },
    authSubtext: { fontSize: scaleFontSize(15), color: secondaryText, textAlign: 'center', marginBottom: 20 },
    pinDisplay: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginVertical: 40 },
    pinDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2.5, borderColor: colors.primary, backgroundColor: 'transparent' },
    pinDotActive: { backgroundColor: colors.primary },
    keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 30, justifyContent: 'space-between', width: '100%' },
    keypadBtn: { width: 80, height: 80, borderRadius: 16, backgroundColor: surfaceVariant, justifyContent: 'center', alignItems: 'center' },
    keypadText: { fontSize: scaleFontSize(28), fontWeight: '600', color: colors.text },
    // editor
    editorHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, gap: 10 },
    titleInput: { fontSize: scaleFontSize(28), fontWeight: '800', paddingHorizontal: 20, color: colors.text, marginBottom: 8 },
    contentInput: { fontSize: scaleFontSize(17), paddingHorizontal: 20, color: colors.text, lineHeight: 26, minHeight: 280, textAlignVertical: 'top' },
    bottomActions: { flexDirection: 'row', padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, backgroundColor: cardBg, borderTopWidth: 1, borderTopColor: outlineColor, gap: 10 },
    actionBtn: { flex: 1, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    cancelBtn: { backgroundColor: surfaceVariant },
    saveBtn: { backgroundColor: colors.primary },
    btnText: { fontSize: scaleFontSize(15), fontWeight: '700' },
    fabMain: { position: 'absolute', bottom: 28, right: 20, width: 60, height: 60, borderRadius: 18, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
    // modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: cardBg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 36 },
    modalTitle: { fontSize: scaleFontSize(18), fontWeight: '800', color: colors.text, marginBottom: 18 },
    actionRow: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: surfaceVariant, borderRadius: 14, marginBottom: 10 },
    actionText: { fontSize: scaleFontSize(15), fontWeight: '700', color: colors.text, marginLeft: 14 },
    // category mgr
    catRow: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: surfaceVariant, borderRadius: 14, marginBottom: 10 },
    catColorDot: { width: 22, height: 22, borderRadius: 11, marginRight: 12 },
    // calendar
    calNavRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    calMonthText: { fontSize: scaleFontSize(16), fontWeight: '800', color: colors.text },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCell: { width: (width - 80) / 7, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
    calDayHeader: { fontSize: scaleFontSize(11), fontWeight: '700', color: secondaryText },
    calDayText: { fontSize: 13, color: colors.text },
  });

  // ── Auth Screen ────────────────────────────────────────────────────────────
  if (hasRegisteredPin === null) {
    return (
      <View style={[s.authContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if ((hasRegisteredPin && !isAuthenticated) || setupStep !== 'none') {
    return (
      <SafeAreaView style={s.authContainer}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        {showHint && (
          <Animated.View style={[s.hintBadge, { opacity: blinkAnim }]}>
            <Text style={s.hintText}>{hint}</Text>
          </Animated.View>
        )}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.authInner}>
            <Animated.View style={{ transform: [{ translateX: shakeAnim }], alignItems: 'center', width: '100%' }}>
              <Text style={s.authHeading}>
                {setupStep === 'set' ? 'Set Security PIN' : setupStep === 'confirm' ? 'Confirm PIN' : 'Unlock Journal'}
              </Text>
              {setupStep !== 'none' && <Text style={s.authSubtext}>Create a 6-digit PIN to protect your notes.</Text>}
            </Animated.View>
            <View style={s.pinDisplay}>
              {[...Array(6)].map((_, i) => (
                <View key={i} style={[s.pinDot, pin.length > i && s.pinDotActive]} />
              ))}
            </View>
            <View style={s.keypad}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                <TouchableOpacity
                  key={d}
                  style={s.keypadBtn}
                  onPress={() => handlePinInput(d.toString())}
                  activeOpacity={0.6}
                >
                  <Text style={s.keypadText}>{d}</Text>
                </TouchableOpacity>
              ))}
              {/* bottom row: spacer | 0 | backspace */}
              <View style={[s.keypadBtn, { backgroundColor: 'transparent', elevation: 0 }]} />
              <TouchableOpacity
                style={s.keypadBtn}
                onPress={() => handlePinInput('0')}
                activeOpacity={0.6}
              >
                <Text style={s.keypadText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.keypadBtn, { backgroundColor: pin.length === 0 ? surfaceVariant + '50' : surfaceVariant }]}
                onPress={handleBackspace}
                activeOpacity={0.6}
                disabled={pin.length === 0}
              >
                <Ionicons name="backspace-outline" size={28} color={pin.length === 0 ? secondaryText + '50' : colors.text} />
              </TouchableOpacity>
            </View>
            {setupStep !== 'none' && (
              <TouchableOpacity style={{ marginTop: 28 }} onPress={() => { setSetupStep('none'); setPin(''); setIsAuthenticated(true); }}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Card renderers ─────────────────────────────────────────────────────────
  const openNote = (note: Note) => {
    setCurrentNote(note);
    setContentSelection({ start: (note.content ?? '').length, end: (note.content ?? '').length });
    const manual = note.extras?.manualNotes ?? '';
    setManualSelection({ start: manual.length, end: manual.length });
    setIsViewing(true);
  };

  const renderListCard = (note: Note) => {
    const color = accentForNote(note);
    const icon = iconForNote(note);
    return (
      <TouchableOpacity
        key={note.id}
        style={[s.noteCard, { borderLeftWidth: 4, borderLeftColor: color }]}
        onPress={() => openNote(note)}
        onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); togglePin(note.id); }}
        activeOpacity={0.75}
      >
        <LinearGradient
          colors={[color + '22', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={s.noteTitle} numberOfLines={1}>{note.isPinned ? '📌 ' : ''}{note.title}</Text>
          <Text style={{ fontSize: 20, marginLeft: 8 }}>{note.mood}</Text>
        </View>
        <Text style={s.noteSnippet} numberOfLines={2}>{note.content}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 }}>
          <View style={{ backgroundColor: color + '25', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12 }}>{icon}</Text>
            <Text style={{ fontSize: 11, fontWeight: '900', color, letterSpacing: 0.4 }}>{isDailyLogNote(note) ? 'DAILY LOG' : 'ENTRY'}</Text>
          </View>
          <Text style={{ fontSize: 11, color: secondaryText, fontWeight: '600' }}>{note.date}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderGridCard = (note: Note) => {
    const color = accentForNote(note);
    return (
      <TouchableOpacity
        key={note.id}
        style={[s.gridCard, { borderTopWidth: 4, borderTopColor: color, minHeight: 150 }]}
        onPress={() => openNote(note)}
        onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); togglePin(note.id); }}
        activeOpacity={0.75}
      >
        <LinearGradient
          colors={[color + '18', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '900', color, letterSpacing: 0.3 }}>{iconForNote(note)} {isDailyLogNote(note) ? 'DAILY LOG' : 'ENTRY'}</Text>
          <Text style={{ fontSize: 14 }}>{note.mood}</Text>
        </View>
        <Text style={[s.noteTitle, { fontSize: 15 }]} numberOfLines={2}>{note.isPinned ? '📌 ' : ''}{note.title}</Text>
        <Text style={[s.noteSnippet, { fontSize: 13, marginTop: 4 }]} numberOfLines={3}>{note.content}</Text>
        <Text style={{ fontSize: 11, color: secondaryText, fontWeight: '600', marginTop: 8 }}>{note.date}</Text>
      </TouchableOpacity>
    );
  };

  const renderCompactCard = (note: Note) => {
    const color = accentForNote(note);
    return (
      <TouchableOpacity key={note.id} style={s.compactCard} onPress={() => openNote(note)} activeOpacity={0.7}>
        <View style={[s.compactDot, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
          <Text style={[s.noteTitle, { fontSize: 15 }]} numberOfLines={1}>{note.isPinned ? '📌 ' : ''}{note.title}</Text>
          <Text style={[s.noteSnippet, { fontSize: 12, marginTop: 0 }]} numberOfLines={1}>{note.content}</Text>
        </View>
        <Text style={{ fontSize: 18 }}>{note.mood}</Text>
        <Text style={{ fontSize: 11, color: secondaryText, fontWeight: '600' }}>{note.date}</Text>
      </TouchableOpacity>
    );
  };

  const renderBento = (noteList: Note[]) => {
    const rows: JSX.Element[] = [];
    let i = 0;
    while (i < noteList.length) {
      const pattern = Math.floor(i / 2) % 3;
      if (pattern === 0 && i + 1 < noteList.length) {
        // wide + narrow
        const [a, b] = [noteList[i], noteList[i + 1]];
        const ca = accentForNote(a), cb = accentForNote(b);
        rows.push(
          <View key={i} style={s.bentoRow}>
            <TouchableOpacity style={[s.bentoCard, { flex: 2, borderTopWidth: 4, borderTopColor: ca, minHeight: 160 }]} onPress={() => openNote(a)} activeOpacity={0.75}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: ca, marginBottom: 6 }}>{iconForNote(a)} {isDailyLogNote(a) ? 'DAILY LOG' : 'ENTRY'}</Text>
              <Text style={s.noteTitle} numberOfLines={2}>{a.isPinned ? '📌 ' : ''}{a.title}</Text>
              <Text style={s.noteSnippet} numberOfLines={3}>{a.content}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ fontSize: 11, color: secondaryText, fontWeight: '600' }}>{a.date}</Text>
                <Text>{a.mood}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[s.bentoCard, { flex: 1, borderTopWidth: 4, borderTopColor: cb, minHeight: 160 }]} onPress={() => openNote(b)} activeOpacity={0.75}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: cb, marginBottom: 6 }}>{iconForNote(b)}</Text>
              <Text style={[s.noteTitle, { fontSize: 14 }]} numberOfLines={3}>{b.isPinned ? '📌 ' : ''}{b.title}</Text>
              <Text style={[s.noteSnippet, { fontSize: 12 }]} numberOfLines={3}>{b.content}</Text>
              <Text style={{ fontSize: 10, color: secondaryText, marginTop: 6 }}>{b.date}</Text>
            </TouchableOpacity>
          </View>
        );
        i += 2;
      } else if (pattern === 1 && i + 2 < noteList.length) {
        // three equal
        const trio = [noteList[i], noteList[i + 1], noteList[i + 2]];
        rows.push(
          <View key={i} style={s.bentoRow}>
            {trio.map(n => {
              const c = accentForNote(n);
              return (
                <TouchableOpacity key={n.id} style={[s.bentoCard, { flex: 1, borderTopWidth: 4, borderTopColor: c, minHeight: 120 }]} onPress={() => openNote(n)} activeOpacity={0.75}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: c, marginBottom: 4 }}>{iconForNote(n)}</Text>
                  <Text style={[s.noteTitle, { fontSize: 13 }]} numberOfLines={2}>{n.title}</Text>
                  <Text style={[s.noteSnippet, { fontSize: 11 }]} numberOfLines={2}>{n.content}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
        i += 3;
      } else {
        // full width accent row
        const n = noteList[i];
        const c = accentForNote(n);
        rows.push(
          <TouchableOpacity key={n.id} style={[s.bentoCard, { borderLeftWidth: 5, borderLeftColor: c, flexDirection: 'row', alignItems: 'center', gap: 14 }]} onPress={() => openNote(n)} activeOpacity={0.75}>
            <Text style={{ fontSize: 28 }}>{n.mood}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.noteTitle} numberOfLines={1}>{n.isPinned ? '📌 ' : ''}{n.title}</Text>
              <Text style={s.noteSnippet} numberOfLines={1}>{n.content}</Text>
              <Text style={{ fontSize: 11, color: secondaryText, marginTop: 4 }}>{n.date}</Text>
            </View>
          </TouchableOpacity>
        );
        i++;
      }
    }
    return <View style={s.bentoContainer}>{rows}</View>;
  };

  // ── Calendar render ────────────────────────────────────────────────────────
  const renderCalendar = () => {
    const { first, days, year, month } = calDays();
    const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    return (
      <View>
        <View style={s.calNavRow}>
          <TouchableOpacity onPress={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.calMonthText}>
            {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={s.calGrid}>
          {DAY_LABELS.map(d => (
            <View key={d} style={s.calCell}><Text style={s.calDayHeader}>{d}</Text></View>
          ))}
          {Array(first).fill(null).map((_, i) => <View key={'b' + i} style={s.calCell} />)}
          {Array.from({ length: days }, (_, idx) => {
            const d = idx + 1;
            const date = new Date(year, month, d);
            const fromMs = filterFrom ? new Date(filterFrom).setHours(0, 0, 0, 0) : null;
            const toMs = filterTo ? new Date(filterTo).setHours(23, 59, 59, 999) : null;
            const dMs = date.getTime();
            const inRange = fromMs !== null && toMs !== null && dMs >= fromMs && dMs <= toMs;
            const isEndpoint = (filterFrom && date.toDateString() === filterFrom.toDateString()) ||
              (filterTo && date.toDateString() === filterTo.toDateString());
            const hasNote = hasNotesOnDay(date);
            return (
              <TouchableOpacity
                key={d}
                style={[s.calCell, inRange && { backgroundColor: colors.primary + '20' }, isEndpoint && { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (!filterFrom || (filterFrom && filterTo)) { setFilterFrom(date); setFilterTo(null); }
                  else { date < filterFrom ? setFilterFrom(date) : setFilterTo(date); }
                }}
              >
                <Text style={[s.calDayText, isEndpoint && { color: '#FFF', fontWeight: '800' }]}>{d}</Text>
                {hasNote && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isEndpoint ? '#FFF' : colors.primary, marginTop: 1 }} />}
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <TouchableOpacity style={[s.actionBtn, s.cancelBtn, { flex: 1 }]} onPress={() => { setFilterFrom(null); setFilterTo(null); setCalendarVisible(false); }}>
            <Text style={[s.btnText, { color: colors.text }]}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.saveBtn, { flex: 1 }]} onPress={() => setCalendarVisible(false)}>
            <Text style={[s.btnText, { color: '#FFF' }]}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── View toggle component ──────────────────────────────────────────────────
  const ViewToggle = () => (
    <View style={{ flexDirection: 'row', backgroundColor: surfaceVariant, borderRadius: 12, padding: 3, gap: 2 }}>
      {([['list', 'list-outline'], ['grid', 'grid-outline'], ['bento', 'apps-outline'], ['compact', 'reorder-four-outline']] as [ViewMode, string][]).map(([mode, icon]) => (
        <TouchableOpacity
          key={mode}
          style={[{ width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' }, viewMode === mode && { backgroundColor: cardBg, elevation: 2 }]}
          onPress={() => setViewMode(mode)}
        >
          <Ionicons name={icon as any} size={17} color={viewMode === mode ? colors.primary : secondaryText} />
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Category Manager modal ─────────────────────────────────────────────────
  // ── Stats ──────────────────────────────────────────────────────────────────
  const todayStr = formatDate(Date.now());
  const todayCount = notes.filter(n => n.date === todayStr).length;
  const hasDateFilter = !!(filterFrom || filterTo);

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={s.mainContainer}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* App Bar */}
      <View style={{ height: 40 }} />
      <View style={s.appBar}>
        <Text style={s.logoText}>Journal</Text>
        <View style={s.headerIcons}>
          <TouchableOpacity style={s.headerIcon} onPress={() => { setIsSearching(v => !v); setSearchQuery(''); }}>
            <Ionicons name={isSearching ? 'close' : 'search-outline'} size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerIcon} onPress={() => setIsSettingsVisible(true)}>
            <Ionicons name="settings-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      {isSearching && (
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={18} color={secondaryText} />
          <TextInput
            style={s.searchInput}
            placeholder="Search notes…"
            placeholderTextColor={placeholderColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={secondaryText} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Total</Text>
            <Text style={s.statVal}>{notes.length}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Today</Text>
            <Text style={s.statVal}>{todayCount}</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[s.statLabel, { color: colors.primary }]}>Pinned</Text>
            <Text style={[s.statVal, { color: colors.primary }]}>{notes.filter(n => n.isPinned).length}</Text>
          </View>
        </View>

        {/* Categories removed */}

        {/* Date filter + View toggle row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 }}>
          <TouchableOpacity
            style={[s.dateBadge, hasDateFilter && { backgroundColor: colors.primary + '20' }]}
            onPress={() => setCalendarVisible(true)}
          >
            <Ionicons name="calendar-outline" size={14} color={hasDateFilter ? colors.primary : secondaryText} />
            <Text style={[s.dateBadgeText, hasDateFilter && { color: colors.primary }]}>
              {hasDateFilter
                ? `${filterFrom ? filterFrom.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '…'} → ${filterTo ? filterTo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '…'}`
                : 'Date Filter'}
            </Text>
            {hasDateFilter && (
              <TouchableOpacity onPress={() => { setFilterFrom(null); setFilterTo(null); }}>
                <Ionicons name="close-circle" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          <ViewToggle />
        </View>

        {/* Notes */}
        {displayNotes.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 40 }}>
            <Text style={{ fontSize: 48 }}>📝</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 16 }}>
              {searchQuery || hasDateFilter ? 'No matches' : 'Start writing'}
            </Text>
            <Text style={{ fontSize: 14, color: secondaryText, textAlign: 'center', marginTop: 8 }}>
              {searchQuery || hasDateFilter
                ? 'Try adjusting your filters.'
                : 'Tap the + button to create your first entry.'}
            </Text>
          </View>
        ) : (
          <>
            {pinnedNotes.length > 0 && viewMode !== 'compact' && (
              <Text style={s.sectionLabel}>📌 Pinned</Text>
            )}
            {viewMode === 'list' && displayNotes.map(renderListCard)}
            {viewMode === 'grid' && (
              <View style={{ paddingHorizontal: 14 }}>
                {Array.from({ length: Math.ceil(displayNotes.length / 2) }, (_, i) => (
                  <View key={i} style={{ flexDirection: 'row' }}>
                    {renderGridCard(displayNotes[i * 2])}
                    {displayNotes[i * 2 + 1] ? renderGridCard(displayNotes[i * 2 + 1]) : <View style={{ flex: 1, margin: 6 }} />}
                  </View>
                ))}
              </View>
            )}
            {viewMode === 'bento' && renderBento(displayNotes)}
            {viewMode === 'compact' && (
              <View style={{ backgroundColor: cardBg, marginHorizontal: 20, borderRadius: 20, overflow: 'hidden', elevation: 2 }}>
                {displayNotes.map(renderCompactCard)}
              </View>
            )}
          </>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={s.fabMain}
        onPress={() => { setCurrentNote({ mood: '😀', category: 'General', extras: { journalNotes: [] } }); setIsEditing(true); }}
      >
        <Ionicons name="add" size={30} color="#FFF" />
      </TouchableOpacity>

      {/* ═══ Editor Modal ═══ */}
      <Modal visible={isEditing || isViewing} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ height: 20 }} />
          <View style={s.editorHeader}>
            <TouchableOpacity onPress={() => { setIsEditing(false); setIsViewing(false); }} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ flex: 1, fontSize: 12, color: colors.primary, fontWeight: '800', letterSpacing: 1, marginLeft: 4 }}>
              {isViewing ? 'READING' : currentNote.id ? 'EDIT ENTRY' : 'NEW ENTRY'}
            </Text>
            {isViewing && currentNote.id && (
              <TouchableOpacity onPress={() => togglePin(currentNote.id!)} style={{ padding: 6, marginRight: 2 }}>
                <Ionicons name={currentNote.isPinned ? 'bookmark' : 'bookmark-outline'} size={22} color={colors.primary} />
              </TouchableOpacity>
            )}
            {isViewing && currentNote.id && (
              <TouchableOpacity onPress={() => deleteNote(currentNote.id!)} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              </TouchableOpacity>
            )}
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {isEditing ? (
                <>
                  {/* Mood picker + quick time insert */}
                  <View style={{ paddingHorizontal: 20, marginTop: 10, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                      {MOODS.map(m => (
                        <TouchableOpacity
                          key={m}
                          onPress={() => setCurrentNote({ ...currentNote, mood: m })}
                          style={[{ width: 46, height: 46, borderRadius: 23, backgroundColor: surfaceVariant, justifyContent: 'center', alignItems: 'center' },
                          currentNote.mood === m && { backgroundColor: colors.primary + '30', borderWidth: 2, borderColor: colors.primary }]}
                        >
                          <Text style={{ fontSize: 22 }}>{m}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={insertCurrentTimeAtCursor}
                      style={{
                        height: 42,
                        borderRadius: 16,
                        backgroundColor: cardBg,
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexDirection: 'row',
                        gap: 7,
                        paddingHorizontal: 13,
                        borderWidth: 1.5,
                        borderColor: accentForNote(currentNote) + '55',
                        alignSelf: 'flex-start',
                      }}
                    >
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: accentForNote(currentNote) + '20', justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="time-outline" size={14} color={accentForNote(currentNote)} />
                      </View>
                      <Text style={{ color: accentForNote(currentNote), fontWeight: '900', fontSize: 12, letterSpacing: 0.3 }}>
                        Insert Timestamp
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {/* Color accent bar */}
                  <View style={{ height: 3, backgroundColor: accentForNote(currentNote), marginHorizontal: 20, borderRadius: 2, marginBottom: 16 }} />
                  <TextInput
                    style={s.titleInput}
                    placeholder="Title"
                    placeholderTextColor={placeholderColor}
                    value={currentNote.title}
                    onChangeText={t => setCurrentNote({ ...currentNote, title: t })}
                  />
                  {!isDailyLogNote(currentNote) ? (
                    <TextInput
                      style={s.contentInput}
                      placeholder="Write something meaningful…"
                      placeholderTextColor={placeholderColor}
                      multiline
                      value={currentNote.content}
                      onChangeText={c => setCurrentNote({ ...currentNote, content: c })}
                      onSelectionChange={(e) => setContentSelection(e.nativeEvent.selection)}
                    />
                  ) : (
                    <View>
                      <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
                        <TextInput
                          style={s.contentInput}
                          placeholder="Write your manual notes here..."
                          placeholderTextColor={placeholderColor}
                          multiline
                          value={currentNote.extras?.manualNotes ?? ''}
                          onChangeText={(t) => setCurrentNote({ ...currentNote, extras: { ...(currentNote.extras ?? {}), manualNotes: t } })}
                          onSelectionChange={(e) => setManualSelection(e.nativeEvent.selection)}
                        />
                      </View>

                      <View style={{ marginHorizontal: 20, marginTop: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: secondaryText, letterSpacing: 1.1, marginBottom: 8 }}>
                          AUTO GENERATED LOG
                        </Text>
                        <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: cardBg, borderWidth: 1, borderColor: outlineColor }}>
                          <LinearGradient colors={[accentForNote(currentNote) + '18', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                          <View style={{ padding: 14 }}>
                            {(() => {
                              const parsed = parseDailyLog(currentNote.content);
                              const sectionTitle = (label: string, emoji: string) => (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                  <Text style={{ fontSize: 16 }}>{emoji}</Text>
                                  <Text style={{ fontSize: 13, fontWeight: '900', color: colors.text }}>{label}</Text>
                                </View>
                              );
                              const row = (text: string, key: string) => (
                                <View key={key} style={{ flexDirection: 'row', gap: 8, paddingVertical: 6 }}>
                                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accentForNote(currentNote), marginTop: 8 }} />
                                  <Text style={{ flex: 1, fontSize: 13, lineHeight: 20, color: colors.text, fontWeight: '600' }}>{text}</Text>
                                </View>
                              );
                              return (
                                <>
                                  {sectionTitle('Timesheet', '⏱️')}
                                  {parsed.timesheet.length > 0
                                    ? parsed.timesheet.map((s, idx) => row(s.text, `ts-${idx}`))
                                    : row('No focus sessions logged.', 'ts-empty')}
                                  <View style={{ height: 10 }} />
                                  {sectionTitle('Completed', '✅')}
                                  {parsed.completed.length > 0
                                    ? parsed.completed.map((s, idx) => row(s.text, `cp-${idx}`))
                                    : row('Nothing completed yet.', 'cp-empty')}
                                </>
                              );
                            })()}
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <View style={{ paddingBottom: 28 }}>
                  {/* Colorful header */}
                  <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18 }}>
                    <LinearGradient
                      colors={[
                        accentForNote(currentNote) + '55',
                        accentForNote(currentNote) + '18',
                        'transparent',
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        borderRadius: 22,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: outlineColor,
                      }}
                    >
                      <View style={{ padding: 18 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                          <View
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: 16,
                              backgroundColor: glass,
                              borderWidth: 1,
                              borderColor: outlineColor,
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ fontSize: 24 }}>{iconForNote(currentNote)}</Text>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '900',
                                letterSpacing: 1.2,
                                color: accentForNote(currentNote),
                              }}
                            >
                              {isDailyLogNote(currentNote) ? 'DAILY LOG' : 'JOURNAL ENTRY'}
                            </Text>
                            <Text style={{ fontSize: 13, color: secondaryText, fontWeight: '700', marginTop: 2 }}>
                              {currentNote.date}
                            </Text>
                          </View>

                          <View
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 16,
                              backgroundColor: glass,
                              borderWidth: 1,
                              borderColor: outlineColor,
                            }}
                          >
                            <Text style={{ fontSize: 22 }}>{currentNote.mood}</Text>
                          </View>
                        </View>

                        <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text, lineHeight: 34 }}>
                          {currentNote.title}
                        </Text>
                      </View>
                    </LinearGradient>
                  </View>

                  {/* Content */}
                  {isDailyLogNote(currentNote) ? (
                    (() => {
                      const accent = accentForNote(currentNote);
                      const parsed = parseDailyLog(currentNote.content);
                      const pill = (label: string, bg: string) => (
                        <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: bg, borderWidth: 1, borderColor: outlineColor }}>
                          <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1.1, color: colors.text }}>
                            {label}
                          </Text>
                        </View>
                      );

                      const SectionCard = ({ title, icon, children, tint }: { title: string; icon: string; children: React.ReactNode; tint: string }) => (
                        <View style={{ marginHorizontal: 18, marginTop: 14 }}>
                          <View
                            style={{
                              borderRadius: 22,
                              overflow: 'hidden',
                              backgroundColor: cardBg,
                              borderWidth: 1,
                              borderColor: outlineColor,
                            }}
                          >
                            <LinearGradient
                              colors={[tint + '28', 'transparent']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={StyleSheet.absoluteFill}
                            />
                            <View style={{ padding: 16 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                  <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: glass, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: outlineColor }}>
                                    <Text style={{ fontSize: 18 }}>{icon}</Text>
                                  </View>
                                  <Text style={{ fontSize: 14, fontWeight: '900', color: colors.text, letterSpacing: 0.2 }}>
                                    {title}
                                  </Text>
                                </View>
                                {title === 'Timesheet' ? pill('FOCUS', accent + '20') : pill('DONE', colors.primary + '18')}
                              </View>
                              {children}
                            </View>
                          </View>
                        </View>
                      );

                      const Row = ({ text, tone }: { text: string; tone: 'normal' | 'muted' }) => (
                        <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 10 }}>
                          <View style={{ width: 10, alignItems: 'center', paddingTop: 2 }}>
                            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tone === 'muted' ? outlineColor : accent }} />
                          </View>
                          <Text style={{ flex: 1, fontSize: 14, lineHeight: 22, color: tone === 'muted' ? secondaryText : colors.text, fontWeight: '600' }}>
                            {text}
                          </Text>
                        </View>
                      );

                      const TitleRow = ({ text }: { text: string }) => (
                        <View style={{ marginTop: 10, marginBottom: 6 }}>
                          <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1.3, color: secondaryText }}>
                            {text.toUpperCase()}
                          </Text>
                        </View>
                      );

                      return (
                        <View>
                          {/* Manual journal notes */}
                          {!!(parseJournalBlocks(getManualText(currentNote)).length > 0) && (
                            <View style={{ marginHorizontal: 18, marginTop: 4 }}>
                              <View style={{ borderRadius: 22, overflow: 'hidden', backgroundColor: cardBg, borderWidth: 1, borderColor: outlineColor }}>
                                <LinearGradient colors={[accent + '18', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                                <View style={{ padding: 16 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: accent + '20', justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name="book-outline" size={14} color={accent} />
                                      </View>
                                      <Text style={{ fontSize: 14, fontWeight: '900', color: colors.text }}>Journal Notes</Text>
                                    </View>
                                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: accent + '15', borderWidth: 1, borderColor: accent + '35' }}>
                                      <Text style={{ fontSize: 10, fontWeight: '900', color: accent, letterSpacing: 0.5 }}>
                                        {parseJournalBlocks(getManualText(currentNote)).length} ENTRY{parseJournalBlocks(getManualText(currentNote)).length > 1 ? 'IES' : ''}
                                      </Text>
                                    </View>
                                  </View>
                                  {parseJournalBlocks(getManualText(currentNote)).map((block, idx) => {
                                    return (
                                      <View key={`${idx}-${(block.body || '').slice(0, 12)}`} style={{ backgroundColor: glass, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: outlineColor, marginBottom: 10 }}>
                                        {!!block.time && (
                                          <LinearGradient
                                            colors={[accent + 'BB', accent + '66']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={{ alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, marginBottom: 9 }}
                                          >
                                            <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 }}>{block.time}</Text>
                                          </LinearGradient>
                                        )}
                                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 22 }}>
                                          {block.body}
                                        </Text>
                                      </View>
                                    );
                                  })}
                                </View>
                              </View>
                            </View>
                          )}

                          <View style={{ marginHorizontal: 18, marginTop: 12, marginBottom: 2 }}>
                            <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: secondaryText }}>
                              AUTO GENERATED LOG
                            </Text>
                          </View>
                          <SectionCard title="Timesheet" icon="⏱️" tint={accent}>
                            {parsed.timesheet.length === 0 ? (
                              <Row text="No focus sessions logged." tone="muted" />
                            ) : (
                              parsed.timesheet.map((s, idx) =>
                                s.kind === 'title'
                                  ? <TitleRow key={`t-${idx}`} text={s.text} />
                                  : <Row key={`r-${idx}`} text={s.text} tone="normal" />
                              )
                            )}
                          </SectionCard>

                          <SectionCard title="Completed" icon="✅" tint={colors.primary}>
                            {parsed.completed.length === 0 ? (
                              <Row text="Nothing completed yet." tone="muted" />
                            ) : (
                              parsed.completed.map((s, idx) =>
                                s.kind === 'title'
                                  ? <TitleRow key={`ct-${idx}`} text={s.text} />
                                  : <Row key={`cr-${idx}`} text={s.text} tone="normal" />
                              )
                            )}
                          </SectionCard>
                        </View>
                      );
                    })()
                  ) : (
                    <View style={{ paddingHorizontal: 18 }}>
                      <View
                        style={{
                          borderRadius: 22,
                          backgroundColor: cardBg,
                          borderWidth: 1,
                          borderColor: outlineColor,
                          padding: 18,
                          overflow: 'hidden',
                        }}
                      >
                        <LinearGradient
                          colors={[
                            accentForNote(currentNote) + '16',
                            'transparent',
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                        {parseJournalBlocks(getManualText(currentNote)).length > 0 && (
                          <View style={{ marginBottom: 14 }}>
                            <Text style={{ fontSize: 12, fontWeight: '900', color: secondaryText, letterSpacing: 1.1, marginBottom: 8 }}>JOURNAL NOTES</Text>
                            {parseJournalBlocks(getManualText(currentNote)).map((block, idx) => {
                              return (
                                <View key={`${idx}-${(block.body || '').slice(0, 12)}`} style={{ backgroundColor: glass, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: outlineColor, marginBottom: 10 }}>
                                  {!!block.time && (
                                    <LinearGradient
                                      colors={[accentForNote(currentNote) + 'BB', accentForNote(currentNote) + '66']}
                                      start={{ x: 0, y: 0 }}
                                      end={{ x: 1, y: 0 }}
                                      style={{ alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, marginBottom: 9 }}
                                    >
                                      <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 }}>{block.time}</Text>
                                    </LinearGradient>
                                  )}
                                  <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ width: 3, borderRadius: 2, backgroundColor: accentForNote(currentNote) + '99' }} />
                                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: colors.text, lineHeight: 22 }}>{block.body}</Text>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        )}
                        <View style={{ gap: 10 }}>
                          {parseJournalBlocks(currentNote.content).map((block, idx) => {
                            if (!block.time) {
                              return (
                                <Text key={`plain-${idx}`} style={{ fontSize: 16, color: colors.text, lineHeight: 26, fontWeight: '600' }}>
                                  {block.body}
                                </Text>
                              );
                            }

                            return (
                              <View
                                key={`ts-${idx}-${(block.body || '').slice(0, 8)}`}
                                style={{
                                  backgroundColor: glass,
                                  borderRadius: 16,
                                  padding: 14,
                                  borderWidth: 1,
                                  borderColor: outlineColor,
                                }}
                              >
                                <LinearGradient
                                  colors={[accentForNote(currentNote) + 'CC', accentForNote(currentNote) + '77']}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 0 }}
                                  style={{ alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, marginBottom: 9 }}
                                >
                                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 }}>
                                    {block.time}
                                  </Text>
                                </LinearGradient>
                                {block.body.length > 0 && (
                                  <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ width: 3, borderRadius: 2, backgroundColor: accentForNote(currentNote) + '99' }} />
                                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: colors.text, lineHeight: 22 }}>
                                      {block.body}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>

          <View style={s.bottomActions}>
            <TouchableOpacity style={[s.actionBtn, s.cancelBtn]} onPress={() => { setIsEditing(false); setIsViewing(false); }}>
              <Text style={[s.btnText, { color: colors.text }]}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, s.saveBtn]} onPress={isViewing ? () => { setIsViewing(false); setIsEditing(true); } : saveCurrentNote}>
              <Text style={[s.btnText, { color: '#FFF' }]}>{isViewing ? 'Edit Entry' : 'Save Entry'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ═══ Calendar Modal ═══ */}
      <Modal visible={calendarVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setCalendarVisible(false)} />
          <SafeAreaView style={[s.modalContent, { paddingBottom: 30 }]}>
            <Text style={s.modalTitle}>Filter by Date Range</Text>
            {renderCalendar()}
          </SafeAreaView>
        </View>
      </Modal>

      {/* ═══ Settings Modal ═══ */}
      <Modal visible={isSettingsVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setIsSettingsVisible(false)} />
          <SafeAreaView style={s.modalContent}>
            <Text style={s.modalTitle}>Settings</Text>
            <TouchableOpacity style={s.actionRow} onPress={exportJournal}>
              <Ionicons name="cloud-download-outline" size={22} color={colors.primary} />
              <Text style={s.actionText}>Export Journal (.txt)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionRow} onPress={startPinSetup}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.text} />
              <Text style={s.actionText}>{hasRegisteredPin ? 'Reset Security PIN' : 'Set Security PIN'}</Text>
            </TouchableOpacity>
            {hasRegisteredPin && (
              <TouchableOpacity style={[s.actionRow, { backgroundColor: '#FF3B3012' }]} onPress={disablePinProtection}>
                <Ionicons name="lock-open-outline" size={22} color="#FF3B30" />
                <Text style={[s.actionText, { color: '#FF3B30' }]}>Disable PIN Protection</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[s.actionRow, { backgroundColor: '#FF3B3012', marginBottom: 0 }]} onPress={() => {
              showAlert('Delete All', 'Clear all entries permanently?', [
                { text: 'Cancel' },
                { text: 'Wipe', destructive: true, onPress: async () => { setNotes([]); await AsyncStorage.removeItem('@daily_notes_v3'); setIsSettingsVisible(false); } },
              ]);
            }}>
              <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              <Text style={[s.actionText, { color: '#FF3B30' }]}>Wipe All Data</Text>
            </TouchableOpacity>

            <View style={{ height: 1.5, backgroundColor: outlineColor, marginVertical: 18, opacity: 0.5 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FF6B6B15', justifyContent: 'center', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="calendar-heart" size={22} color="#FF6B6B" />
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Period Tracker</Text>
                  <Text style={{ fontSize: 12, color: secondaryText }}>Cycle tracking and predictions</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPeriodTrackerEnabled(!periodTrackerEnabled);
                }}
                style={{
                  width: 50,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: periodTrackerEnabled ? colors.primary : surfaceVariant,
                  paddingHorizontal: 4,
                  justifyContent: 'center',
                }}
              >
                <Animated.View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: '#FFF',
                  transform: [{ translateX: periodTrackerEnabled ? 22 : 0 }]
                }} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ═══ Custom Alert Modal ═══ */}
      {alertConfig?.visible && (
        <Modal visible={alertConfig.visible} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
            <View style={{ backgroundColor: cardBg, borderRadius: 20, padding: 24, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, maxWidth: '90%' }}>
              {/* Title */}
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 }}>
                {alertConfig.title}
              </Text>
              {/* Message */}
              <Text style={{ fontSize: 15, color: secondaryText, lineHeight: 22, marginBottom: 24 }}>
                {alertConfig.message}
              </Text>
              {/* Buttons */}
              <View style={{ gap: 10 }}>
                {alertConfig.buttons.map((btn, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderRadius: 12,
                      backgroundColor: btn.destructive ? '#FF3B30' : btn.text === 'OK' || btn.text === 'Keep PIN' ? surfaceVariant : colors.primary,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => {
                      btn.onPress?.();
                      closeAlert();
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '700', color: btn.destructive || (btn.text !== 'OK' && btn.text !== 'Keep PIN') ? '#FFF' : colors.text }}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}
