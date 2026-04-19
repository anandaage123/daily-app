/**
 * TodosScreen.tsx
 * Full-featured todo list with SAF file persistence (survives uninstall),
 * animations, edit, due dates, subtasks, tags, swipe-to-delete, undo,
 * notifications, export, archive, search & filter.
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Dimensions, StatusBar, KeyboardAvoidingView,
  Platform, Modal, Animated, Easing, Pressable, ScrollView, Share,
  LayoutAnimation,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused, useNavigation, NavigationProp } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as Clipboard from 'expo-clipboard';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Typography, Shadows } from '../theme/Theme';
import { scaleFontSize } from '../utils/ResponsiveSize';
import { useTheme } from '../context/ThemeContext';
import { recordTodoCompleted, removeTodoCompleted } from '../services/DailyLogService';
import { broadcastSyncUpdate } from '../services/SyncService';

const { width } = Dimensions.get('window');

// ─── Notification setup ───────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
    shouldShowBanner: true, shouldShowList: true,
  }),
});

async function scheduleDueNotification(id: string, text: string, dueDate: number) {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => { });
  const trigger = new Date(dueDate);
  if (trigger <= new Date()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title: '📋 Todo Due', body: text, sound: true },
    trigger: trigger,
  });
}

async function cancelNotification(id: string) {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => { });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'low' | 'med' | 'high';
type Tag = 'Work' | 'Personal' | 'Shopping' | 'Health' | 'Finance' | 'Other';

interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  archived: boolean;
  priority: Priority;
  tag?: Tag;
  notes?: string;
  dueDate?: number;
  subtasks: Subtask[];
  createdAt: number;
  completedAt?: number;
  expectedMinutes?: number;
  timeSpentSeconds?: number;
}

// ─── AsyncStorage ─────────────────────────────────────────────────────────────

const TODOS_KEY = '@todos_v3';

async function loadTodosFromStorage(): Promise<Todo[]> {
  try {
    const data = await AsyncStorage.getItem(TODOS_KEY);
    if (!data) return [];
    const parsed: Todo[] = JSON.parse(data);
    return parsed.map(t => ({ ...t, subtasks: t.subtasks || [], archived: t.archived || false }));
  } catch (e) {
    console.error('Load todos error:', e);
    return [];
  }
}

async function saveTodosToStorage(todos: Todo[]): Promise<void> {
  try {
    await AsyncStorage.setItem(TODOS_KEY, JSON.stringify(todos));
    const formatTasks = (ts: any[]) => ts.filter(t => !t.archived && t.tag !== 'Shopping').map(t => ({ id: t.id, title: t.text, completed: t.completed }));
    broadcastSyncUpdate('TASK_STATE_UPDATE', { tasks: formatTasks(todos) });
  } catch (e) {
    console.error('Save todos error:', e);
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<Priority, {
  label: string; emoji: string; gradient: readonly [string, string];
}> = {
  high: { label: 'HIGH', emoji: '🔥', gradient: ['#FF6B6B', '#FF4757'] },
  med: { label: 'MED', emoji: '⚡', gradient: ['#FFA93A', '#FF8C00'] },
  low: { label: 'LOW', emoji: '🌿', gradient: ['#5EE7A0', '#1DB954'] },
};

const TAG_COLORS: Record<Tag, string> = {
  Work: '#6C63FF', Personal: '#FF6584', Shopping: '#43CBFF',
  Health: '#1DB954', Finance: '#FFA93A', Other: '#A0A0B0',
};

const ALL_TAGS: Tag[] = ['Work', 'Personal', 'Shopping', 'Health', 'Finance', 'Other'];

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── TodoItem component ───────────────────────────────────────────────────────

interface TodoItemProps {
  item: Todo;
  onToggle: (id: string) => void;
  onToggleSubtask?: (todoId: string, subId: string) => void;
  onDelete: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onArchive: (id: string) => void;
  colors: any;
  isDark: boolean;
  index: number;
  entryAnim: Animated.Value;
}

const TodoItem = React.memo(({
  item, onToggle, onToggleSubtask, onDelete, onEdit, onArchive, colors, isDark, index, entryAnim,
}: TodoItemProps) => {
  const slideIn = entryAnim.interpolate({ inputRange: [0, 1], outputRange: [24 + index * 5, 0] });
  const fadeIn = entryAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  if ('isHeader' in item) {
    return (
      <Animated.View style={[iStyles.headerRow, { opacity: fadeIn, transform: [{ translateY: slideIn }] }]}>
        <Text style={[iStyles.headerTxt, { color: colors.textVariant }]}>
          {item.title === 'SHOPPING' ? '🛒 ' : '✦ '}{item.title}
        </Text>
        <View style={[iStyles.headerLine, { backgroundColor: colors.textVariant + '15' }]} />
      </Animated.View>
    );
  }

  const isShopping = item.tag === 'Shopping';
  const [expanded, setExpanded] = useState(false);
  const checkAnim = useRef(new Animated.Value(item.completed ? 1 : 0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  const sparkAnim = useRef(new Animated.Value(0)).current;
  const swipeRef = useRef<Swipeable>(null);
  const navigation = useNavigation<NavigationProp<any>>();

  useEffect(() => {
    Animated.spring(checkAnim, {
      toValue: item.completed ? 1 : 0, tension: 80, friction: 6, useNativeDriver: false,
    }).start();
    if (item.completed) {
      sparkAnim.setValue(0);
      Animated.sequence([
        Animated.timing(sparkAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(sparkAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [item.completed]);

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(pressAnim, { toValue: 0.95, tension: 200, friction: 15, useNativeDriver: true }),
      Animated.spring(pressAnim, { toValue: 1, tension: 200, friction: 15, useNativeDriver: true }),
    ]).start(() => onToggle(item.id));
  };

  const handleRowPress = () => {
    if (item.subtasks.length > 0) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded(!expanded);
    } else {
      handleToggle();
    }
  };

  const checkColor = isShopping ? (colors.secondary || '#FFA93A') : colors.primary;
  const checkBg = checkAnim.interpolate({ inputRange: [0, 1], outputRange: ['transparent', checkColor] });
  const cfg = PRIORITY_CONFIG[item.priority];
  const doneSubtasks = (item.subtasks || []).filter(s => s.completed).length;
  const overdue = item.dueDate && !item.completed && item.dueDate < Date.now();
  const dueSoon = item.dueDate && !item.completed && !overdue && (item.dueDate - Date.now()) < 86_400_000;

  const renderRight = () => (
    <View style={iStyles.swipeRight}>
      <TouchableOpacity
        style={[iStyles.swipeBtn, { backgroundColor: '#FFA93A' }]}
        onPress={() => { swipeRef.current?.close(); onArchive(item.id); }}
      >
        <Ionicons name="archive-outline" size={18} color="#FFF" />
        <Text style={iStyles.swipeTxt}>Archive</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[iStyles.swipeBtn, { backgroundColor: '#FF4757' }]}
        onPress={() => { swipeRef.current?.close(); onDelete(item.id); }}
      >
        <Ionicons name="trash-outline" size={18} color="#FFF" />
        <Text style={iStyles.swipeTxt}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLeft = () => (
    <View style={iStyles.swipeLeft}>
      <TouchableOpacity
        style={[iStyles.swipeBtn, { backgroundColor: colors.primary }]}
        onPress={() => { swipeRef.current?.close(); onEdit(item); }}
      >
        <Ionicons name="create-outline" size={18} color="#FFF" />
        <Text style={iStyles.swipeTxt}>Edit</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Animated.View style={{
      opacity: fadeIn, transform: [{ translateY: slideIn }, { scale: pressAnim }],
    }}>
      <Swipeable ref={swipeRef} renderRightActions={renderRight} renderLeftActions={renderLeft}
        overshootRight={false} overshootLeft={false} containerStyle={{ overflow: 'visible' }} childrenContainerStyle={{ overflow: 'visible' }}>
        <Pressable onPress={handleRowPress} onLongPress={() => onEdit(item)} delayLongPress={500}>
          <View style={[
            iStyles.card,
            {
              backgroundColor: isDark
                ? (item.completed ? colors.surface + '88' : colors.surface)
                : (item.completed ? (isShopping ? '#FAFAFA' : '#F7F8FF') : '#FFFFFF'),
            }]}>

            {!item.completed && !isShopping && (
              <View style={[iStyles.priStrip, { backgroundColor: cfg.gradient[0] }]} />
            )}

            <Pressable onPress={handleToggle} hitSlop={16} style={{ marginLeft: (item.completed || isShopping) ? 0 : 6 }}>
              <Animated.View style={[
                iStyles.checkbox,
                {
                  borderColor: item.completed ? checkColor + '33' : checkColor + '55',
                  backgroundColor: checkBg,
                  borderRadius: isShopping ? 6 : 11,
                }
              ]}>
                <Animated.View style={{ opacity: checkAnim, transform: [{ scale: checkAnim }] }}>
                  <Ionicons name="checkmark" size={13} color="#FFF" />
                </Animated.View>
              </Animated.View>
            </Pressable>

            <View style={iStyles.body}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text numberOfLines={2} style={[
                  iStyles.text, { color: item.completed ? colors.textVariant : colors.text, flex: 1, paddingRight: 8 },
                  item.completed && iStyles.textDone,
                  isShopping && { fontSize: scaleFontSize(16), fontWeight: '600' }
                ]}>
                  {item.text}
                </Text>
                
                {item.expectedMinutes && !item.completed ? (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      navigation.navigate('Focus', {
                        linkedTask: { 
                          id: item.id, type: 'todo', name: item.text, 
                          expectedMinutes: item.expectedMinutes, 
                          timeSpentSeconds: item.timeSpentSeconds || 0 
                        } 
                      });
                    }}
                    style={{ padding: 2, marginRight: 24, marginTop: -2 }}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                  >
                    <Ionicons name="play-circle" size={24} color={colors.primary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {!isShopping && (
                <View style={iStyles.meta}>
                  <LinearGradient colors={cfg.gradient} style={iStyles.priPill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={iStyles.priTxt}>{cfg.emoji} {cfg.label}</Text>
                  </LinearGradient>
                  {item.tag && (
                    <View style={[iStyles.tagPill, { borderColor: TAG_COLORS[item.tag] + '33', backgroundColor: TAG_COLORS[item.tag] + '10' }]}>
                      <Text style={[iStyles.tagTxt, { color: TAG_COLORS[item.tag] }]}>#{item.tag.toUpperCase()}</Text>
                    </View>
                  )}
                  {item.dueDate && (
                    <View style={[iStyles.duePill, { backgroundColor: overdue ? '#FF475720' : dueSoon ? '#FFA93A20' : colors.background }]}>
                      <Ionicons name="time-outline" size={9} color={overdue ? '#FF4757' : dueSoon ? '#FFA93A' : colors.textVariant} />
                      <Text style={[iStyles.dueTxt, { color: overdue ? '#FF4757' : dueSoon ? '#FFA93A' : colors.textVariant }]}>
                        {new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {item.subtasks?.length > 0 && (
                <View style={[iStyles.badge, { backgroundColor: colors.primary + '15', flexDirection: 'row', paddingHorizontal: 7, paddingVertical: 3, gap: 4, marginTop: isShopping ? 4 : 0, alignSelf: 'flex-start' }]}>
                  <Text style={[iStyles.subtaskCnt, { color: colors.primary }]}>{doneSubtasks}/{item.subtasks.length}</Text>
                  <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={10} color={colors.primary} />
                </View>
              )}

              {item.subtasks?.length > 0 && (
                <View style={[iStyles.subBar, { backgroundColor: colors.background }]}>
                  <View style={[iStyles.subFill, { backgroundColor: colors.primary, width: `${(doneSubtasks / item.subtasks.length) * 100}%` }]} />
                </View>
              )}

              {item.subtasks?.length > 0 && expanded && (
                <View style={{ marginTop: 14, paddingLeft: 4, gap: 10 }}>
                  {item.subtasks.map(st => (
                    <TouchableOpacity
                      key={st.id}
                      style={[
                        iStyles.subtaskRow,
                        {
                          backgroundColor: st.completed ? 'transparent' : (isDark ? colors.background + '44' : '#F0F2FF'),
                          paddingHorizontal: 8,
                          paddingVertical: 8,
                          borderRadius: 10,
                        }
                      ]}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        onToggleSubtask?.(item.id, st.id);
                      }}
                      hitSlop={8}
                    >
                      <Ionicons
                        name={st.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={st.completed ? colors.primary : colors.textVariant + '80'}
                      />
                      <Text style={{
                        marginLeft: 10,
                        flex: 1,
                        fontSize: scaleFontSize(14),
                        color: st.completed ? colors.textVariant : colors.text,
                        textDecorationLine: st.completed ? 'line-through' : 'none',
                        opacity: st.completed ? 0.5 : 1,
                        fontWeight: '500',
                      }}>
                        {st.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <Animated.View style={{ opacity: sparkAnim, position: 'absolute', right: 14, top: 14 }}>
              <Text style={{ fontSize: 17 }}>✨</Text>
            </Animated.View>
          </View>
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
});

const iStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, paddingLeft: 18, borderRadius: 20, marginBottom: 14, ...Shadows.soft },
  priStrip: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 4, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  checkbox: { width: 22, height: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2, borderWidth: 1.5 },
  body: { flex: 1 },
  text: { fontSize: scaleFontSize(15), fontWeight: '700', lineHeight: 22, marginBottom: 6, letterSpacing: -0.2 },
  textDone: { textDecorationLine: 'line-through', opacity: 0.45 },
  subtaskRow: { flexDirection: 'row', alignItems: 'center' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' },
  priPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  priTxt: { fontSize: scaleFontSize(9), fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
  tagPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  tagTxt: { fontSize: scaleFontSize(9), fontWeight: '700' },
  duePill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  dueTxt: { fontSize: scaleFontSize(9), fontWeight: '700' },
  badge: { borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  subtaskCnt: { fontSize: scaleFontSize(8), fontWeight: '800' },
  subBar: { height: 3, borderRadius: 2, marginTop: 9, overflow: 'hidden' },
  subFill: { height: '100%', borderRadius: 2 },
  swipeRight: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  swipeLeft: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  swipeBtn: { justifyContent: 'center', alignItems: 'center', width: 70, alignSelf: 'stretch', borderRadius: 14, gap: 3, marginHorizontal: 3 },
  swipeTxt: { color: '#FFF', fontSize: scaleFontSize(10), fontWeight: '700' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 12, paddingHorizontal: 4 },
  headerTxt: { fontSize: scaleFontSize(10), fontWeight: '900', letterSpacing: 1.5 },
  headerLine: { flex: 1, height: 1, marginLeft: 12, opacity: 0.5 },
});

// ─── Undo Toast ───────────────────────────────────────────────────────────────

const Toast = ({ message, onUndo, colors }: { message: string; onUndo?: () => void; colors: any }) => (
  <View style={[tStyles.toast, { backgroundColor: colors.surface }]}>
    <Text style={[tStyles.msg, { color: colors.text }]}>{message}</Text>
    {onUndo && (
      <TouchableOpacity onPress={onUndo}>
        <Text style={[tStyles.undo, { color: colors.primary }]}>UNDO</Text>
      </TouchableOpacity>
    )}
  </View>
);
const tStyles = StyleSheet.create({
  toast: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16, marginHorizontal: 20, ...Shadows.soft
  },
  msg: { fontSize: scaleFontSize(13), fontWeight: '600', flex: 1 },
  undo: { fontWeight: '800', fontSize: scaleFontSize(13), marginLeft: 12 },
});

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

interface ModalProps {
  visible: boolean;
  initial?: Todo | null;
  initialTag?: Tag;
  onClose: () => void;
  onSave: (t: Todo) => void;
  onSaveAndNext: (t: Todo) => void;
  onSaveMultiple: (ts: Todo[]) => void;
  colors: any;
  isDark: boolean;
}

function TodoModal({ visible, initial, initialTag, onClose, onSave, onSaveAndNext, onSaveMultiple, colors, isDark }: ModalProps) {
  const isEdit = !!initial;
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<Priority>('low');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [tag, setTag] = useState<Tag | undefined>(initialTag);
  const [showPicker, setShowPicker] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subInput, setSubInput] = useState('');
  const [notes, setNotes] = useState('');
  const [todoExpHours, setTodoExpHours] = useState('');
  const [todoExpMinutes, setTodoExpMinutes] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      if (initial) {
        setText(initial.text); setPriority(initial.priority);
        setSubtasks(initial.subtasks || []);
        setTag(initial.tag);
        setNotes(initial.notes ?? '');
        setTodoExpHours(initial.expectedMinutes ? String(Math.floor(initial.expectedMinutes / 60) || '') : '');
        setTodoExpMinutes(initial.expectedMinutes ? String(initial.expectedMinutes % 60 || '') : '');
        setDueDate(initial.dueDate ? new Date(initial.dueDate) : undefined);
        setShowAdvanced(!!(initial.notes || initial.expectedMinutes || initial.dueDate || initial.subtasks?.length || initial.tag));
      } else {
        setText(''); setPriority('low');
        setTag(initialTag);
        setNotes('');
        setTodoExpHours('');
        setTodoExpMinutes('');
        setDueDate(undefined); setSubtasks([]);
        setShowAdvanced(false);
      }
      Animated.spring(slideAnim, { toValue: 0, tension: 120, friction: 12, velocity: 1.5, useNativeDriver: true }).start();
    } else {
      Animated.spring(slideAnim, { toValue: 600, tension: 100, friction: 15, useNativeDriver: true }).start();
    }
  }, [visible, initial, initialTag]);

  const build = (): Todo => {
    let tMins = 0;
    if (todoExpHours) tMins += parseInt(todoExpHours, 10) * 60;
    if (todoExpMinutes) tMins += parseInt(todoExpMinutes, 10);
    
    return {
      id: initial?.id ?? genId(),
      text: text.trim(), completed: initial?.completed ?? false, archived: initial?.archived ?? false,
      priority, dueDate: dueDate?.getTime(), tag,
      notes: notes.trim() || undefined,
      expectedMinutes: tMins > 0 ? tMins : undefined,
      timeSpentSeconds: initial?.timeSpentSeconds ?? 0,
      subtasks, createdAt: initial?.createdAt ?? Date.now(), completedAt: initial?.completedAt,
    };
  };

  const handleSaveItems = () => {
    if (!text.trim()) return;
    if (tag === 'Shopping') {
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      const newItems = lines.map((line, idx) => ({
        ...build(),
        id: genId(),
        text: line.trim(),
        createdAt: Date.now() + idx
      }));
      onSaveMultiple(newItems);
    } else {
      onSave(build());
    }
    setText('');
    setSubtasks([]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (tag !== 'Shopping') onClose();
  };

  const canSave = text.trim().length > 0;

  const addSub = () => {
    if (!subInput.trim()) return;
    setSubtasks(s => [...s, { id: genId(), text: subInput.trim(), completed: false }]);
    setSubInput('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={mStyles.overlay}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View style={[mStyles.sheet, { backgroundColor: colors.surface, transform: [{ translateY: slideAnim }] }]}>
          <View style={mStyles.handle} />
          <View style={mStyles.hdr}>
            <Text style={[mStyles.title, { color: colors.text }]}>{isEdit ? '✏️ Edit Task' : '✦ New Task'}</Text>
            <TouchableOpacity onPress={onClose} style={[mStyles.closeBtn, { backgroundColor: colors.background }]}>
              <Ionicons name="close" size={18} color={colors.textVariant} />
            </TouchableOpacity>
          </View>

          <View style={mStyles.modeRow}>
            <TouchableOpacity
              style={[mStyles.modeBtn, {
                backgroundColor: tag === 'Shopping' ? colors.primary + '15' : colors.background,
                borderColor: tag === 'Shopping' ? colors.primary + '40' : colors.background,
              }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTag(tag === 'Shopping' ? undefined : 'Shopping'); }}
            >
              <Ionicons name="cart-outline" size={16} color={tag === 'Shopping' ? colors.primary : colors.textVariant} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[mStyles.modeTitle, { color: tag === 'Shopping' ? colors.primary : colors.text }]}>Grocery Mode</Text>
                <Text style={[mStyles.modeSub, { color: colors.textVariant }]}>Type your list like a notepad</Text>
              </View>
              {tag === 'Shopping' && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>
            <TextInput
              ref={inputRef}
              style={[
                mStyles.input,
                { backgroundColor: colors.background, color: isDark ? colors.primary : colors.text, marginBottom: 16 },
                tag === 'Shopping' && { minHeight: 140, textAlignVertical: 'top' }
              ]}
              placeholder={tag === 'Shopping' ? "Milk\nEggs\nBread..." : "What needs to be done?"}
              placeholderTextColor={colors.textVariant + '55'}
              multiline={tag === 'Shopping'}
              value={text} onChangeText={setText} autoFocus={!isEdit}
              maxLength={2000}
            />

            {tag !== 'Shopping' && (
              <>
                {/* Priority */}
                <Text style={[mStyles.lbl, { color: colors.textVariant }]}>PRIORITY</Text>
                <View style={mStyles.priRow}>
                  {(['low', 'med', 'high'] as Priority[]).map(p => {
                    const c = PRIORITY_CONFIG[p]; const active = priority === p;
                    return (
                      <TouchableOpacity key={p}
                        onPress={() => { Haptics.selectionAsync(); setPriority(p); }}
                        style={[mStyles.priBtn, { borderColor: active ? c.gradient[0] : colors.background, backgroundColor: active ? c.gradient[0] + '18' : colors.background }]}
                      >
                        {active
                          ? <LinearGradient colors={c.gradient} style={mStyles.pDot} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                          : <View style={[mStyles.pDot, { backgroundColor: colors.surface }]} />}
                        <Text style={[mStyles.priBtnTxt, { color: active ? c.gradient[0] : colors.textVariant }]}>{c.emoji} {c.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {!showAdvanced ? (
                  <TouchableOpacity 
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowAdvanced(true);
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: colors.background, borderRadius: 14, marginBottom: 20 }}
                  >
                    <Ionicons name="options-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: scaleFontSize(13) }}>Show More Options</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    {/* Tag */}
                    <Text style={[mStyles.lbl, { color: colors.textVariant }]}>TAG</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
                  {ALL_TAGS.filter(t => t !== 'Shopping').map(t => {
                    const active = tag === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        onPress={() => { Haptics.selectionAsync(); setTag(active ? undefined : t); }}
                        style={[mStyles.tagChip, {
                          backgroundColor: active ? TAG_COLORS[t] + '18' : colors.background,
                          borderColor: active ? TAG_COLORS[t] : colors.background,
                        }]}
                      >
                        <Text style={[mStyles.tagChipTxt, { color: active ? TAG_COLORS[t] : colors.textVariant }]}>{t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Notes */}
                <Text style={[mStyles.lbl, { color: colors.textVariant }]}>NOTES</Text>
                <TextInput
                  style={[mStyles.notesInput, { backgroundColor: colors.background, color: isDark ? colors.primary : colors.text, marginBottom: 20 }]}
                  placeholder="Add notes…"
                  placeholderTextColor={colors.textVariant + '50'}
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />

                {/* Expected Time */}
                <Text style={[mStyles.lbl, { color: colors.textVariant }]}>EXPECTED DURATION (OPTIONAL)</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                  <TextInput
                    style={[{ flex: 1, borderRadius: 14, padding: 14, fontSize: 13, backgroundColor: colors.background, color: isDark ? colors.primary : colors.text }]}
                    placeholder="Hours"
                    placeholderTextColor={colors.textVariant + '50'}
                    keyboardType="number-pad"
                    value={todoExpHours}
                    onChangeText={setTodoExpHours}
                  />
                  <TextInput
                    style={[{ flex: 1, borderRadius: 14, padding: 14, fontSize: 13, backgroundColor: colors.background, color: isDark ? colors.primary : colors.text }]}
                    placeholder="Minutes"
                    placeholderTextColor={colors.textVariant + '50'}
                    keyboardType="number-pad"
                    value={todoExpMinutes}
                    onChangeText={setTodoExpMinutes}
                  />
                </View>

                {/* Due date */}
                <Text style={[mStyles.lbl, { color: colors.textVariant }]}>DUE DATE</Text>
                <View style={mStyles.dateRow}>
                  <TouchableOpacity onPress={() => setShowPicker(true)}
                    style={[mStyles.dateBtn, { backgroundColor: colors.background, borderColor: dueDate ? colors.primary : colors.background }]}
                  >
                    <Ionicons name="calendar-outline" size={15} color={dueDate ? colors.primary : colors.textVariant} />
                    <Text style={[mStyles.dateTxt, { color: dueDate ? colors.primary : colors.textVariant }]}>
                      {dueDate ? dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Set due date'}
                    </Text>
                  </TouchableOpacity>
                  {dueDate && (
                    <TouchableOpacity onPress={() => setDueDate(undefined)} style={[mStyles.dateClear, { backgroundColor: colors.background }]}>
                      <Ionicons name="close" size={15} color={colors.textVariant} />
                    </TouchableOpacity>
                  )}
                </View>
                {showPicker && (
                  <DateTimePicker value={dueDate ?? new Date()} mode="date" minimumDate={new Date()}
                    onChange={(_, d) => { setShowPicker(false); if (d) setDueDate(d); }} />
                )}

                {/* Subtasks */}
                <Text style={[mStyles.lbl, { color: colors.textVariant }]}>SUBTASKS</Text>
                {subtasks.map((st, idx) => (
                  <View key={st.id || idx} style={[mStyles.subRow, { backgroundColor: colors.background }]}>
                    <TouchableOpacity onPress={() => setSubtasks(s => s.map(x => x.id === st.id ? { ...x, completed: !x.completed } : x))}>
                      <Ionicons name={st.completed ? 'checkbox' : 'square-outline'} size={17} color={st.completed ? colors.primary : colors.textVariant} />
                    </TouchableOpacity>
                    <Text style={[mStyles.subTxt, { color: colors.text }, st.completed && { textDecorationLine: 'line-through', opacity: 0.5 }]}>{st.text}</Text>
                    <TouchableOpacity onPress={() => setSubtasks(s => s.filter(x => x.id !== st.id))}>
                      <Ionicons name="close-circle-outline" size={15} color={colors.textVariant} />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={mStyles.subInputRow}>
                  <TextInput
                    style={[mStyles.subInput, { backgroundColor: colors.background, color: isDark ? colors.primary : colors.text, flex: 1 }]}
                    placeholder="Add subtask…" placeholderTextColor={colors.textVariant + '50'}
                    value={subInput} onChangeText={setSubInput}
                    onSubmitEditing={addSub} returnKeyType="done"
                  />
                  <TouchableOpacity onPress={addSub} style={[mStyles.subAddBtn, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="add" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                  </>
                )}
              </>
            )}

            <TouchableOpacity onPress={() => canSave && handleSaveItems()} activeOpacity={canSave ? 0.85 : 1} style={{ opacity: canSave ? 1 : 0.35, marginTop: tag === 'Shopping' ? 8 : 12, marginBottom: 4 }}>
              <LinearGradient colors={[colors.primary, colors.primaryLight || colors.primary + 'CC']} style={mStyles.saveBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name={isEdit ? 'checkmark-done-outline' : 'checkmark-circle-outline'} size={19} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={mStyles.saveTxt}>{isEdit ? 'Save Changes' : (tag === 'Shopping' ? 'Add All Items' : 'Add Task')}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: Platform.OS === 'ios' ? 24 : 12 }} />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 22, maxHeight: '93%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#80808030', alignSelf: 'center', marginBottom: 16 },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: scaleFontSize(21), fontWeight: '800' },
  closeBtn: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  input: { borderRadius: 14, padding: 14, fontSize: scaleFontSize(15), fontWeight: '500', marginBottom: 10, minHeight: 48 },
  notesInput: { borderRadius: 14, padding: 14, fontSize: scaleFontSize(13), marginBottom: 18, minHeight: 66, textAlignVertical: 'top' },
  lbl: { fontSize: scaleFontSize(10), fontWeight: '800', letterSpacing: 1.4, marginBottom: 10 },
  priRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  priBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1.5, gap: 5 },
  pDot: { width: 8, height: 8, borderRadius: 4 },
  priBtnTxt: { fontSize: scaleFontSize(11), fontWeight: '800' },
  tagChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, marginRight: 8 },
  tagChipTxt: { fontSize: scaleFontSize(12), fontWeight: '700' },
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 20, alignItems: 'center' },
  dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1.5 },
  dateTxt: { fontSize: scaleFontSize(13), fontWeight: '600' },
  dateClear: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, marginBottom: 6 },
  subTxt: { flex: 1, fontSize: scaleFontSize(13), fontWeight: '500' },
  subInputRow: { flexDirection: 'row', gap: 8, marginBottom: 4, alignItems: 'center' },
  subInput: { borderRadius: 10, padding: 10, fontSize: scaleFontSize(13) },
  subAddBtn: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 16, borderWidth: 1.5 },
  nextTxt: { fontSize: scaleFontSize(15), fontWeight: '800' },
  saveBtn: { flexDirection: 'row', height: 54, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  saveTxt: { color: '#FFF', fontWeight: '800', fontSize: scaleFontSize(16) },
  modeRow: { marginBottom: 18, flexDirection: 'row', gap: 10, alignItems: 'center' },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent' },
  modeTitle: { fontSize: scaleFontSize(14), fontWeight: '700' },
  modeSub: { fontSize: scaleFontSize(10), marginTop: 1 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TodosScreen() {
  const { colors, isDark } = useTheme();
  const isFocused = useIsFocused();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [activeTab, setActiveTab] = useState<'todo' | 'grocery'>('todo');
  const [archived, setArchived] = useState<Todo[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTag, setModalTag] = useState<Tag | undefined>();
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  const openAction = (t?: Tag) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setModalTag(t);
    setModalOpen(true);
  };
  const [clearOpen, setClearOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPri, setFilterPri] = useState<Priority | 'all'>('all');
  const [showDone, setShowDone] = useState(true);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);

  const entryAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const groceryProgressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const fabAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(1)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Entry animation
  useEffect(() => {
    entryAnim.setValue(0); headerAnim.setValue(0); fabAnim.setValue(0);
    Animated.stagger(30, [
      Animated.spring(headerAnim, { toValue: 1, tension: 130, friction: 10, useNativeDriver: true }),
      Animated.spring(entryAnim, { toValue: 1, tension: 120, friction: 11, useNativeDriver: true }),
      Animated.spring(fabAnim, { toValue: 1, tension: 150, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    const all = await loadTodosFromStorage();

    setTodos(all.filter(t => !t.archived));
    setArchived(all.filter(t => t.archived));
    animProg(all.filter(t => !t.archived));
  };

  const animProg = (data: Todo[]) => {
    const rlt = data.filter(t => t.tag !== 'Shopping');
    const gro = data.filter(t => t.tag === 'Shopping');

    const rltPct = rlt.length > 0 ? rlt.filter(t => t.completed).length / rlt.length : 0;
    const groPct = gro.length > 0 ? gro.filter(t => t.completed).length / gro.length : 0;

    Animated.parallel([
      Animated.spring(progressAnim, { toValue: rltPct, tension: 140, friction: 15, useNativeDriver: false }),
      Animated.spring(groceryProgressAnim, { toValue: groPct, tension: 140, friction: 15, useNativeDriver: false }),
      Animated.sequence([
        Animated.spring(successAnim, { toValue: 1.04, tension: 200, friction: 10, useNativeDriver: true }),
        Animated.spring(successAnim, { toValue: 1, tension: 150, friction: 12, useNativeDriver: true }),
      ])
    ]).start();
  };

  const saveAll = useCallback(async (active: Todo[], arch: Todo[] = archived) => {
    setTodos(active); setArchived(arch); animProg(active);
    await saveTodosToStorage([...active, ...arch]);
  }, [archived]);

  const sort = (list: Todo[]) => {
    const pv: Record<Priority, number> = { high: 3, med: 2, low: 1 };
    return [...list].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
      if (a.dueDate) return -1; if (b.dueDate) return 1;
      return pv[b.priority] - pv[a.priority];
    });
  };

  const showToast = (msg: string, undo?: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, undo });
    toastAnim.setValue(0);
    Animated.spring(toastAnim, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setToast(null));
    }, 4200);
  };

  const addOrUpdate = useCallback((todo: Todo) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (todo.dueDate) scheduleDueNotification(todo.id, todo.text, todo.dueDate);
    const exists = todos.some(t => t.id === todo.id);
    const updated = sort(exists ? todos.map(t => t.id === todo.id ? todo : t) : [todo, ...todos]);
    saveAll(updated);
    setModalOpen(false); setEditingTodo(null);
  }, [todos, saveAll]);

  const saveAndNext = useCallback((todo: Todo) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (todo.dueDate) scheduleDueNotification(todo.id, todo.text, todo.dueDate);
    const updated = sort([todo, ...todos]);
    saveAll(updated);
    // Modal state is now partially managed inside TodoModal for "Save & Add Next" 
    // to avoid flickering if it's a grocery list.
    if (todo.tag !== 'Shopping') {
      setModalOpen(false);
      setEditingTodo(null);
    }
  }, [todos, saveAll]);

  const saveMultiple = useCallback((newItems: Todo[]) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    newItems.forEach(t => { if (t.dueDate) scheduleDueNotification(t.id, t.text, t.dueDate); });
    const updated = sort([...newItems, ...todos]);
    saveAll(updated);
    setModalOpen(false);
    setEditingTodo(null);
  }, [todos, saveAll]);

  const toggleTodo = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const now = Date.now();
    const next = todos.map(t => {
      if (t.id !== id) return t;
      const willComplete = !t.completed;
      const completedAt = willComplete ? now : undefined;
      if (willComplete) {
        // Fire-and-forget: journal entry is persisted separately.
        recordTodoCompleted({ todoId: t.id, text: t.text, completedAt: now }).catch(() => { });
      } else if (t.completedAt) {
        // Remove from journal if un-checked
        removeTodoCompleted({ todoId: t.id, completedAt: t.completedAt }).catch(() => { });
      }
      return { ...t, completed: willComplete, completedAt };
    });
    saveAll(sort(next));
  }, [todos, saveAll]);

  const toggleSubtask = useCallback((todoId: string, subtaskId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    saveAll(todos.map(t => {
      if (t.id === todoId) {
        return {
          ...t,
          subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s)
        };
      }
      return t;
    }));
  }, [todos, saveAll]);

  const deleteTodo = useCallback((id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const del = todos.find(t => t.id === id)!;
    const updated = todos.filter(t => t.id !== id);
    cancelNotification(id);
    saveAll(updated);
    showToast(`Deleted "${del.text.slice(0, 24)}…"`, () => saveAll(sort([del, ...updated])));
  }, [todos, saveAll]);

  const archiveTodo = useCallback((id: string) => {
    Haptics.selectionAsync();
    const todo = todos.find(t => t.id === id)!;
    const newArch = [...archived, { ...todo, archived: true }];
    saveAll(todos.filter(t => t.id !== id), newArch);
    showToast('Archived', () => saveAll(sort([{ ...todo, archived: false }, ...todos.filter(t => t.id !== id)]), archived));
  }, [todos, archived, saveAll]);

  const unarchive = (id: string) => {
    const todo = archived.find(t => t.id === id)!;
    saveAll(sort([{ ...todo, archived: false }, ...todos]), archived.filter(t => t.id !== id));
  };

  const exportAll = async () => {
    const lines = todos.map((t, i) =>
      `${i + 1}. [${t.completed ? 'x' : ' '}] ${t.text}` +
      (t.priority !== 'med' ? ` (${t.priority})` : '') +
      (t.dueDate ? ` — Due ${new Date(t.dueDate).toDateString()}` : '')
    ).join('\n');
    const msg = `My Todos — ${new Date().toDateString()}\n${'─'.repeat(28)}\n${lines}`;
    await Clipboard.setStringAsync(msg);
    await Share.share({ message: msg, title: 'My Todos' });
  };

  // Derived
  const filtered = useMemo(() => todos.filter(t => {
    if (activeTab === 'todo' && t.tag === 'Shopping') return false;
    if (activeTab === 'grocery' && t.tag !== 'Shopping') return false;
    if (!showDone && t.completed) return false;
    if (filterPri !== 'all' && t.priority !== filterPri) return false;
    if (search && !t.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [todos, showDone, filterPri, search, activeTab]);

  const active = useMemo(() => filtered.filter(t => !t.completed), [filtered]);
  const done = useMemo(() => filtered.filter(t => t.completed), [filtered]);

  const listData = useMemo(() => {
    let result: any[] = [];
    if (activeTab === 'todo') {
      const groups: Record<string, Todo[]> = {};
      active.forEach(t => {
        let groupKey = 'TODAY';
        if (t.dueDate) {
           const d = new Date(t.dueDate);
           const today = new Date();
           if (d.toDateString() !== today.toDateString()) {
             groupKey = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();
           }
        }
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(t);
      });

      const priorityWeight: Record<Priority, number> = { high: 3, med: 2, low: 1 };
      Object.keys(groups).forEach(k => {
        groups[k].sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);
      });

      const sortedDates = Object.keys(groups).sort((a, b) => {
        if (a === 'TODAY') return -1;
        if (b === 'TODAY') return 1;
        return new Date(groups[a][0].dueDate!).getTime() - new Date(groups[b][0].dueDate!).getTime();
      });

      sortedDates.forEach(k => {
        result.push({ isHeader: true, title: k });
        result.push(...groups[k]);
      });

      if (done.length > 0) {
        result.push({ isHeader: true, title: 'COMPLETED' });
        result.push(...done);
      }
    } else {
      if (active.length > 0) result.push(...active);
      if (done.length > 0) {
        result.push({ isHeader: true, title: 'COMPLETED' });
        result.push(...done);
      }
    }
    return result;
  }, [active, done, activeTab]);

  const ritualTodos = useMemo(() => todos.filter(t => t.tag !== 'Shopping'), [todos]);
  const groceryTodos = useMemo(() => todos.filter(t => t.tag === 'Shopping'), [todos]);

  const ritualDone = useMemo(() => ritualTodos.filter(t => t.completed).length, [ritualTodos]);
  const groceryDone = useMemo(() => groceryTodos.filter(t => t.completed).length, [groceryTodos]);

  const total = ritualTodos.length;
  const gTotal = groceryTodos.length;

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const groceryProgressWidth = groceryProgressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const headerSlide = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-26, 0] });
  const fabScale = fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 5) return '✨ Night owl?';
    if (h < 12) return '☀️ Rise and shine';
    if (h < 17) return '⚡ Good afternoon';
    if (h < 21) return '🌙 Good evening';
    return '🌌 Ready for sleep?';
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[s.blob1, { backgroundColor: colors.primary + '10' }]} />
        <View style={[s.blob2, { backgroundColor: (colors.secondary || '#FFA93A') + '08' }]} />

        <FlatList
          data={listData}
          keyExtractor={item => 'isHeader' in item ? `header-${item.title}` : item.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <Animated.View style={[s.header, { opacity: headerAnim, transform: [{ translateY: headerSlide }] }]}>
                {/* Title row */}
                <View style={{ height: 30 }} />
                <View style={s.headerTop}>
                  <View>
                    <Text style={[s.greeting, { color: colors.textVariant }]}>{getGreeting()}</Text>
                    <Text style={[s.title, { color: colors.text }]}>{activeTab === 'todo' ? 'Ritual List' : 'Grocery List'}</Text>
                    <Text style={[s.dateSub, { color: colors.textVariant + '99' }]}>
                      {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </Text>
                  </View>
                  <View style={s.headerBtns}>
                    <TouchableOpacity onPress={exportAll} style={[s.hBtn, { backgroundColor: colors.surface }]}>
                      <Ionicons name="share-outline" size={17} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setArchiveOpen(true)} style={[s.hBtn, { backgroundColor: colors.surface }]}>
                      <Ionicons name="archive-outline" size={17} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setClearOpen(true); }} style={[s.hBtn, { backgroundColor: colors.surface }]}>
                      <MaterialCommunityIcons name="broom" size={17} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Tabs */}
                <View style={{ flexDirection: 'row', backgroundColor: isDark ? colors.surface + '88' : '#F0F2FF', borderRadius: 14, padding: 4, marginBottom: 18 }}>
                  <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setActiveTab('todo'); }} style={{ flex: 1, paddingVertical: 10, backgroundColor: activeTab === 'todo' ? colors.primary : 'transparent', borderRadius: 10, alignItems: 'center', ...(activeTab === 'todo' ? Shadows.soft : {}) }}>
                    <Text style={{ color: activeTab === 'todo' ? '#FFF' : colors.textVariant, fontWeight: '700', fontSize: scaleFontSize(13) }}>To-Do List</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setActiveTab('grocery'); }} style={{ flex: 1, paddingVertical: 10, backgroundColor: activeTab === 'grocery' ? (colors.secondary || '#FFA93A') : 'transparent', borderRadius: 10, alignItems: 'center', ...(activeTab === 'grocery' ? Shadows.soft : {}) }}>
                    <Text style={{ color: activeTab === 'grocery' ? '#FFF' : colors.textVariant, fontWeight: '700', fontSize: scaleFontSize(13) }}>Grocery List</Text>
                  </TouchableOpacity>
                </View>

                {/* Progress */}
                <Animated.View style={[s.progCard, {
                  backgroundColor: colors.surface,
                  transform: [{ scale: successAnim }],
                }]}>
                  <LinearGradient colors={isDark ? ['#1A1A2E', '#16213E'] : ['#F8F9FF', '#EEF0FF']} style={s.progInner}>
                    {activeTab === 'todo' ? (
                      <>
                        <View style={s.progTop}>
                          <View>
                            <Text style={[s.progLbl, { color: colors.textVariant }]}>RITUAL TASKS</Text>
                            <Text style={[s.progFrac, { color: colors.text }]}>
                              {ritualDone}<Text style={{ color: colors.textVariant, fontSize: scaleFontSize(14) }}>/{total}</Text>
                            </Text>
                          </View>
                          <Text style={[s.progPct, { color: colors.primary }]}>
                            {total > 0 ? Math.round((ritualDone / total) * 100) : 0}%
                          </Text>
                        </View>
                        <View style={[s.progBg, { backgroundColor: colors.background }]}>
                          <Animated.View style={[s.progFill, { width: progressWidth }]}>
                            <LinearGradient colors={[colors.primary, colors.primaryLight || colors.primary + 'AA']} style={{ flex: 1, borderRadius: 5 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                          </Animated.View>
                        </View>
                        {total > 0 && ritualDone === total && (
                          <Text style={[s.allDone, { color: colors.primary, marginTop: 10 }]}>🎉 Rituals crushed!</Text>
                        )}
                      </>
                    ) : (
                      <>
                        <View style={s.progTop}>
                          <View>
                            <Text style={[s.progLbl, { color: colors.textVariant }]}>SHOPPING LIST</Text>
                            <Text style={[s.progFrac, { color: colors.text }]}>
                              {groceryDone}<Text style={{ color: colors.textVariant, fontSize: scaleFontSize(14) }}>/{gTotal}</Text>
                            </Text>
                          </View>
                          <Text style={[s.progPct, { color: colors.secondary || '#FFA93A' }]}>
                            {gTotal > 0 ? Math.round((groceryDone / gTotal) * 100) : 0}%
                          </Text>
                        </View>
                        <View style={[s.progBg, { backgroundColor: colors.background }]}>
                          <Animated.View style={[s.progFill, { width: groceryProgressWidth }]}>
                            <LinearGradient colors={[colors.secondary || '#FFA93A', '#FFD700']} style={{ flex: 1, borderRadius: 5 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                          </Animated.View>
                        </View>
                        {gTotal > 0 && groceryDone === gTotal && (
                          <Text style={[s.allDone, { color: colors.secondary || '#FFA93A', marginTop: 10 }]}>🎉 All items collected!</Text>
                        )}
                      </>
                    )}
                  </LinearGradient>
                </Animated.View>

                {/* Search */}
                <View style={[s.searchBar, { backgroundColor: isDark ? colors.surface + 'CC' : '#FFFFFF', borderWidth: 1.5, borderColor: colors.primary + '18' }]}>
                  <Ionicons name="search" size={16} color={colors.primary} />
                  <TextInput
                    style={[s.searchInput, { color: isDark ? colors.primary : colors.text }]}
                    placeholder="Find a task..." placeholderTextColor={colors.textVariant + '66'}
                    value={search} onChangeText={setSearch} returnKeyType="search"
                  />
                  {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                      <Ionicons name="close-circle-sharp" size={18} color={colors.textVariant} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filter chips */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16, alignItems: 'center' }}>
                  {activeTab === 'todo' && (['all', 'high', 'med', 'low'] as const).map(f => (
                    <TouchableOpacity key={f}
                      onPress={() => { Haptics.selectionAsync(); setFilterPri(f); }}
                      style={[s.chip, { backgroundColor: filterPri === f ? colors.primary : colors.surface }]}
                    >
                      <Text style={[s.chipTxt, { color: filterPri === f ? '#FFF' : colors.textVariant }]}>
                        {f === 'all' ? '✦ All' : `${PRIORITY_CONFIG[f].emoji} ${f.toUpperCase()}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {activeTab === 'todo' && <View style={[s.divider, { backgroundColor: colors.textVariant + '28', marginHorizontal: 2 }]} />}
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); setShowDone(v => !v); }}
                    style={[s.chip, { backgroundColor: !showDone ? (activeTab === 'grocery' ? (colors.secondary || '#FFA93A') + '18' : colors.primary + '18') : colors.surface, borderWidth: 1.5, borderColor: !showDone ? (activeTab === 'grocery' ? (colors.secondary || '#FFA93A') : colors.primary) : 'transparent' }]}
                  >
                    <Ionicons name={showDone ? 'eye-outline' : 'eye-off-outline'} size={13} color={colors.textVariant} />
                  </TouchableOpacity>
                </View>

                {active.length > 0 && <Text style={[s.secLbl, { color: colors.textVariant }]}>ACTIVE · {active.length}</Text>}
              </Animated.View>
            </>
          }
          renderItem={({ item, index }) => {
            if (item.isHeader) {
               return <Text style={[s.secLbl, { color: colors.textVariant, marginTop: index > 0 ? 12 : 0 }]}>{item.title}</Text>;
            }

            return (
              <TodoItem item={item} onToggle={toggleTodo} onToggleSubtask={toggleSubtask} onDelete={deleteTodo}
                onEdit={t => { setEditingTodo(t); setModalOpen(true); }}
                onArchive={archiveTodo} colors={colors} isDark={isDark} index={index} entryAnim={entryAnim} />
            );
          }}
          ListEmptyComponent={
            <Animated.View style={[s.empty, { opacity: entryAnim }]}>
              <LinearGradient colors={activeTab === 'grocery' ? [(colors.secondary || '#FFA93A') + '05', (colors.secondary || '#FFA93A') + '15'] : [colors.primary + '05', colors.primary + '15']} style={s.emptyCircle}>
                <Ionicons name={activeTab === 'grocery' ? "basket-outline" : "sparkles-outline"} size={40} color={activeTab === 'grocery' ? (colors.secondary || '#FFA93A') : colors.primary} />
              </LinearGradient>
              <Text style={[s.emptyTitle, { color: colors.text }]}>{activeTab === 'grocery' ? 'Your cart is empty' : 'All clear today'}</Text>
              <Text style={[s.emptySub, { color: colors.textVariant }]}>{activeTab === 'grocery' ? 'Add some items to your grocery list.' : 'No tasks found. Enjoy your focus time or add a new goal.'}</Text>
            </Animated.View>
          }
          ListFooterComponent={<View style={{ height: 170 }} />}
        />

        {/* Direct Action FABs */}
        <Animated.View style={[s.fabBase, { transform: [{ scale: fabScale }] }]}>
          <TouchableOpacity
            onPress={() => openAction(activeTab === 'grocery' ? 'Shopping' : undefined)}
            activeOpacity={0.8}
            style={[s.fabAlways, { backgroundColor: activeTab === 'grocery' ? (colors.secondary || '#FFA93A') : colors.primary }]}
          >
            <LinearGradient 
              colors={activeTab === 'grocery' ? [(colors.secondary || '#FFA93A'), (colors.secondary || '#FFA93A') + 'CC'] : [colors.primary, colors.primaryLight || colors.primary + 'DD']} 
              style={s.fabAlwaysGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Ionicons name={activeTab === 'grocery' ? "cart" : "add"} size={30} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Toast */}
        {toast && (
          <Animated.View style={[s.toastWrap, { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
            <Toast message={toast.msg} onUndo={toast.undo} colors={colors} />
          </Animated.View>
        )}

        {/* Add/Edit Modal */}
        <TodoModal visible={modalOpen} initial={editingTodo} initialTag={modalTag}
          onClose={() => { setModalOpen(false); setEditingTodo(null); setModalTag(undefined); }}
          onSave={addOrUpdate} onSaveAndNext={saveAndNext} onSaveMultiple={saveMultiple} colors={colors} isDark={isDark} />

        {/* Archive Sheet */}
        <Modal visible={archiveOpen} animationType="slide" transparent statusBarTranslucent>
          <View style={s.archOverlay}>
            <View style={[s.archSheet, { backgroundColor: colors.surface }]}>
              <View style={mStyles.handle} />
              <View style={[mStyles.hdr, { marginBottom: 14 }]}>
                <Text style={[mStyles.title, { color: colors.text }]}>📦 Archive</Text>
                <TouchableOpacity onPress={() => setArchiveOpen(false)} style={[mStyles.closeBtn, { backgroundColor: colors.background }]}>
                  <Ionicons name="close" size={18} color={colors.textVariant} />
                </TouchableOpacity>
              </View>
              {archived.length === 0 ? (
                <View style={[s.empty, { paddingTop: 30 }]}>
                  <Text style={{ fontSize: 38, marginBottom: 8 }}>📭</Text>
                  <Text style={[s.emptySub, { color: colors.textVariant }]}>Nothing archived.</Text>
                </View>
              ) : (
                <FlatList data={archived} keyExtractor={i => i.id}
                  renderItem={({ item }) => (
                    <View style={[s.archItem, { backgroundColor: colors.background }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.archTxt, { color: colors.text }]} numberOfLines={1}>{item.text}</Text>
                        <Text style={[s.archSub, { color: colors.textVariant }]}>
                          {PRIORITY_CONFIG[item.priority].emoji} {item.priority.toUpperCase()}{item.tag ? `  ·  ${item.tag}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => unarchive(item.id)} style={[s.restoreBtn, { backgroundColor: colors.primary + '18' }]}>
                        <Ionicons name="arrow-undo-outline" size={14} color={colors.primary} />
                        <Text style={[s.restoreTxt, { color: colors.primary }]}>Restore</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>

        {/* Clear Modal */}
        <Modal visible={clearOpen} transparent animationType="fade" statusBarTranslucent>
          <View style={s.clearOverlay}>
            <View style={[s.clearCard, { backgroundColor: colors.surface }]}>
              <View style={[s.clearIcon, { backgroundColor: colors.error + '15' }]}>
                <MaterialCommunityIcons name="broom" size={28} color={colors.error} />
              </View>
              <Text style={[s.clearTitle, { color: colors.text }]}>The Big Sweep</Text>
              <Text style={[s.clearSub, { color: colors.textVariant }]}>Which list would you like to clear? This cannot be undone.</Text>

              <View style={s.clearBtnsVertical}>
                <TouchableOpacity
                  onPress={() => { saveAll(groceryTodos); setClearOpen(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); }}
                  style={[s.clearOptionBtn, { backgroundColor: colors.background }]}
                >
                  <Ionicons name="flash-outline" size={18} color={colors.primary} />
                  <Text style={[s.clearOptionTxt, { color: colors.text }]}>Clear Rituals Only</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { saveAll(ritualTodos); setClearOpen(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); }}
                  style={[s.clearOptionBtn, { backgroundColor: colors.background }]}
                >
                  <Ionicons name="cart-outline" size={18} color={colors.secondary || '#FFA93A'} />
                  <Text style={[s.clearOptionTxt, { color: colors.text }]}>Clear Grocery List Only</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { saveAll([]); setClearOpen(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }}
                  style={[s.clearOptionBtn, { backgroundColor: colors.error + '15' }]}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                  <Text style={[s.clearOptionTxt, { color: colors.error }]}>Clear Everything</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setClearOpen(false)} style={{ marginTop: 10 }}>
                  <Text style={{ color: colors.textVariant, fontWeight: '700', fontSize: scaleFontSize(13) }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}

// ─── Static styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingTop: Platform.OS === 'ios' ? 56 : 40 },
  blob1: { position: 'absolute', top: -70, right: -70, width: 230, height: 230, borderRadius: 115 },
  blob2: { position: 'absolute', bottom: 180, left: -50, width: 180, height: 180, borderRadius: 90 },

  header: { marginBottom: 18 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  greeting: { fontSize: scaleFontSize(12), fontWeight: '600', letterSpacing: 0.4, marginBottom: 2 },
  title: { fontSize: scaleFontSize(31), fontWeight: '800', letterSpacing: -0.5 },
  headerBtns: { flexDirection: 'row', gap: 7, marginTop: 3 },
  hBtn: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', ...Shadows.soft },

  progCard: { borderRadius: 20, marginBottom: 14, ...Shadows.soft },
  progInner: { padding: 17, borderRadius: 20 },
  progTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 11 },
  progLbl: { fontSize: scaleFontSize(9), fontWeight: '800', letterSpacing: 1.5, marginBottom: 2 },
  progFrac: { fontSize: scaleFontSize(25), fontWeight: '800' },
  progPct: { fontSize: scaleFontSize(21), fontWeight: '800' },
  progBg: { height: 10, borderRadius: 6, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 6 },
  allDone: { marginTop: 7, fontSize: scaleFontSize(12), fontWeight: '700', textAlign: 'center' },

  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 12, height: 44, gap: 8, marginBottom: 12, ...Shadows.soft },
  searchInput: { flex: 1, fontSize: scaleFontSize(13), fontWeight: '500' },

  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18 },
  chipTxt: { fontSize: scaleFontSize(11), fontWeight: '700' },
  divider: { width: 1, height: 22, alignSelf: 'center', marginHorizontal: 5 },
  secLbl: { fontSize: scaleFontSize(10), fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: scaleFontSize(20), fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  emptySub: { fontSize: scaleFontSize(14), textAlign: 'center', lineHeight: 22, opacity: 0.6 },
  dateSub: { fontSize: scaleFontSize(11), fontWeight: '700', marginTop: 2, letterSpacing: 0.1, opacity: 0.6 },
  progSummary: { fontSize: scaleFontSize(10), fontWeight: '700', marginTop: -4, marginBottom: 10, letterSpacing: 0.2 },

  fabBase: { position: 'absolute', bottom: 36, right: 28, alignItems: 'center', gap: 12 },
  fabAlways: { width: 58, height: 58, borderRadius: 29, ...Shadows.strong },
  fabAlwaysGrad: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 29 },

  toastWrap: { position: 'absolute', bottom: 100, left: 0, right: 0 },

  archOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  archSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, maxHeight: '72%' },
  archItem: { flexDirection: 'row', alignItems: 'center', padding: 13, borderRadius: 13, marginBottom: 7, gap: 11 },
  archTxt: { fontSize: scaleFontSize(14), fontWeight: '600', marginBottom: 2 },
  archSub: { fontSize: scaleFontSize(10), fontWeight: '600' },
  restoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9 },
  restoreTxt: { fontSize: scaleFontSize(11), fontWeight: '700' },

  clearOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 22 },
  clearCard: { borderRadius: 26, padding: 26, alignItems: 'center' },
  clearIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  clearTitle: { fontSize: scaleFontSize(18), fontWeight: '800', marginBottom: 6 },
  clearSub: { fontSize: scaleFontSize(13), textAlign: 'center', lineHeight: 20, marginBottom: 20, opacity: 0.7 },
  clearBtnsVertical: { width: '100%', gap: 10, alignItems: 'center' },
  clearOptionBtn: { flexDirection: 'row', alignItems: 'center', width: '100%', padding: 14, borderRadius: 14, gap: 12 },
  clearOptionTxt: { fontSize: scaleFontSize(14), fontWeight: '700' },
});