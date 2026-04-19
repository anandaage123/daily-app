import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
  StatusBar,
  PanResponder,
  Easing,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, NavigationProp, useIsFocused } from '@react-navigation/native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Typography, Shadows, Spacing } from '../theme/Theme';
import { scaleFontSize, scaleSize } from '../utils/ResponsiveSize';
import { APP_VERSION, APP_BUILD } from '../services/UpdateService';
import { useTheme } from '../context/ThemeContext';
import { recordHabitCompleted, removeHabitCompleted } from '../services/DailyLogService';
import { startSyncService, getSyncCode, subscribeToSync, broadcastSyncUpdate } from '../services/SyncService';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';

const { width } = Dimensions.get('window');

const HABIT_ICONS = [
  { name: 'self-improvement', type: 'MaterialIcons' },
  { name: 'water', type: 'MaterialCommunityIcons' },
  { name: 'book-open-variant', type: 'MaterialCommunityIcons' },
  { name: 'run', type: 'MaterialCommunityIcons' },
  { name: 'food-apple', type: 'MaterialCommunityIcons' },
  { name: 'sleep', type: 'MaterialCommunityIcons' },
  { name: 'brain', type: 'MaterialCommunityIcons' },
  { name: 'pencil', type: 'MaterialCommunityIcons' },
  { name: 'music', type: 'MaterialCommunityIcons' },
  { name: 'camera', type: 'MaterialCommunityIcons' },
  { name: 'heart', type: 'MaterialCommunityIcons' },
  { name: 'lightbulb', type: 'MaterialCommunityIcons' },
];

const FALLBACK_QUOTES = [
  { text: "The secret of change is to focus all of your energy, not on fighting the old, but on building the new.", author: "Socrates" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "Well begun is half done.", author: "Aristotle" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Hardships often prepare ordinary people for an extraordinary destiny.", author: "C.S. Lewis" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford" },
  { text: "The only limit to our realization of tomorrow is our doubts of today.", author: "Franklin D. Roosevelt" },
  { text: "Do one thing every day that scares you.", author: "Eleanor Roosevelt" },
  { text: "What we achieve inwardly will change outer reality.", author: "Plutarch" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Will Durant" },
  { text: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "The harder I work, the luckier I get.", author: "Samuel Goldwyn" },
];

const RELIGIOUS_KEYWORDS = ['allah', 'quran', 'islam', 'islamic', 'bible', 'biblical', 'jesus', 'christ', 'christian', 'holy spirit', 'heaven', 'prayer', 'praying', 'psalm', 'scripture', 'gospel', 'salvation', 'lord savior', 'god bless', 'blessed be'];

const isCleanQuote = (text: string, author: string) => {
  const combined = (text + ' ' + author).toLowerCase();
  return !RELIGIOUS_KEYWORDS.some(kw => combined.includes(kw));
};

const MOTIVATIONAL_MESSAGES = [
  { threshold: 100, messages: ["🎯 All rituals crushed! You're unstoppable.", "💥 Perfect day. Momentum is yours.", "🏆 Complete! You showed up for yourself."] },
  { threshold: 75, messages: ["🔥 Almost there — finish strong.", "⚡ Nearly done. Don't stop now.", "💪 Final push. You've got this."] },
  { threshold: 50, messages: ["🌊 Halfway through. Keep the wave going.", "⚡ Good pace. Stay in the zone.", "🎯 Past the midpoint. Momentum building."] },
  { threshold: 1, messages: ["🌱 First step taken. Build on it.", "⚡ Started. That's what matters.", "🚀 You began. Now keep going."] },
  { threshold: 0, messages: ["Rise. Execute. Repeat.", "Your rituals await. Begin.", "Today is yours. Start strong."] },
];

interface Habit {
  id: string;
  name: string;
  completed: boolean;
  count: number;
  iconName: string;
  iconType: string;
  lastCompletedDate?: string;
  expectedMinutes?: number;
  timeSpentSeconds?: number;
}

interface HourlyForecast {
  hour: string;
  temp: number;
  weathercode: number;
  precipitation_probability: number;
}

interface WeatherData {
  temp: number;
  desc: string;
  icon: any;
  status: string;
  hourly?: HourlyForecast[];
  feelsLike?: number;
  humidity?: number;
  windspeed?: number;
}

// ─── Hourly Weather Graph ────────────────────────────────────────────────────

const HourlyWeatherGraph = ({ hourly, colors }: { hourly: HourlyForecast[]; colors: any }) => {
  const graphWidth = width - 80;
  const graphHeight = 72;
  const padding = { left: 8, right: 8, top: 10, bottom: 4 };

  if (!hourly || hourly.length === 0) return null;

  const temps = hourly.map(h => h.temp);
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const range = maxTemp - minTemp || 1;

  const xStep = (graphWidth - padding.left - padding.right) / (hourly.length - 1);
  const getY = (temp: number) =>
    padding.top + ((maxTemp - temp) / range) * (graphHeight - padding.top - padding.bottom);
  const getX = (i: number) => padding.left + i * xStep;

  // Build smooth path
  const points = hourly.map((h, i) => ({ x: getX(i), y: getY(h.temp) }));
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    pathD += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  // Fill path (close below graph)
  const fillPath = pathD +
    ` L ${points[points.length - 1].x} ${graphHeight} L ${points[0].x} ${graphHeight} Z`;

  const now = new Date().getHours();
  const currentIdx = hourly.findIndex(h => parseInt(h.hour) >= now);
  const activeIdx = currentIdx < 0 ? 0 : currentIdx;

  const getWeatherIcon = (code: number) => {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 48) return '🌫️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌦️';
    return '⛈️';
  };

  return (
    <View style={{ marginTop: 16 }}>
      {/* Hour labels + icons — show every 3rd */}
      <View style={{ flexDirection: 'row', paddingHorizontal: padding.left, marginBottom: 4 }}>
        {hourly.map((h, i) => {
          const show = i % 3 === 0;
          const isActive = i === activeIdx;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              {show ? (
                <>
                  <Text style={{
                    fontSize: 9,
                    color: isActive ? colors.primary : colors.textVariant,
                    fontWeight: isActive ? '800' : '500',
                    marginBottom: 2,
                  }}>
                    {parseInt(h.hour) === 0 ? '12a' : parseInt(h.hour) < 12 ? `${h.hour}a` : parseInt(h.hour) === 12 ? '12p' : `${parseInt(h.hour) - 12}p`}
                  </Text>
                  <Text style={{ fontSize: 9 }}>{getWeatherIcon(h.weathercode)}</Text>
                </>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* SVG Curve */}
      <Svg width={graphWidth} height={graphHeight} style={{ overflow: 'visible' }}>
        {/* Fill under curve */}
        <Path
          d={fillPath}
          fill={colors.primary}
          opacity={0.12}
        />
        {/* Curve line */}
        <Path
          d={pathD}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Current hour dot */}
        <Circle
          cx={points[activeIdx].x}
          cy={points[activeIdx].y}
          r={4}
          fill={colors.primary}
          stroke={colors.surface}
          strokeWidth={2}
        />
        {/* Current hour vertical dashed line */}
        <Line
          x1={points[activeIdx].x}
          y1={points[activeIdx].y + 5}
          x2={points[activeIdx].x}
          y2={graphHeight}
          stroke={colors.primary}
          strokeWidth={1}
          strokeDasharray="3,3"
          opacity={0.4}
        />
      </Svg>

      {/* Temp labels every 3 */}
      <View style={{ flexDirection: 'row', paddingHorizontal: padding.left, marginTop: 4 }}>
        {hourly.map((h, i) => {
          const show = i % 3 === 0;
          const isActive = i === activeIdx;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              {show ? (
                <Text style={{
                  fontSize: 9,
                  color: isActive ? colors.primary : colors.textVariant,
                  fontWeight: isActive ? '800' : '500',
                }}>
                  {h.temp}°
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
};

// ─── Completion Ring ─────────────────────────────────────────────────────────

const CompletionRing = ({ percent, colors }: { percent: number; colors: any }) => {
  const size = 56;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (percent / 100) * circumference;

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke={colors.background} strokeWidth={strokeWidth} fill="none"
      />
      <Circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke={percent === 100 ? '#22c55e' : colors.primary}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={progress}
        strokeLinecap="round"
      />
    </Svg>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp<any>>();
  const isFocused = useIsFocused();
  const { colors, isDark, setThemeMode } = useTheme();

  // ── State ──────────────────────────────────────────────────────────────────
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [habitExpHours, setHabitExpHours] = useState('');
  const [habitExpMinutes, setHabitExpMinutes] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(HABIT_ICONS[0]);
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [habitToDelete, setHabitToDelete] = useState<string | null>(null);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [showHourlyExpanded, setShowHourlyExpanded] = useState(false);

  const [quote, setQuote] = useState({ text: "Crafting your morning inspiration...", author: "Daily Hub" });

  const [celebrateVisible, setCelebrateVisible] = useState(false);
  const [prevCompletionRate, setPrevCompletionRate] = useState(0);
  const [syncCode, setSyncCode] = useState<string>('------');

  // ── Animation refs ─────────────────────────────────────────────────────────
  const swipeRefs = useRef<{ [key: string]: Swipeable | null }>({}).current;
  const sectionAnims = useRef([
    new Animated.Value(0), // 0 Header
    new Animated.Value(0), // 1 Quote
    new Animated.Value(0), // 2 Rituals
    new Animated.Value(0), // 3 Weather
    new Animated.Value(0), // 4 Metrics
    new Animated.Value(0), // 5 Note
    new Animated.Value(0), // 6 Streak
  ]).current;

  const slideAnims = useRef(sectionAnims.map(() => new Animated.Value(18))).current;
  const habitScale = useRef(new Animated.Value(1)).current;
  const quoteTranslateX = useRef(new Animated.Value(0)).current;
  const habitDeleteAnim = useRef(new Animated.Value(1)).current;
  const celebrateScale = useRef(new Animated.Value(0)).current;
  const celebrateOpacity = useRef(new Animated.Value(0)).current;
  const noteHeight = useRef(new Animated.Value(0)).current;
  const weatherExpandAnim = useRef(new Animated.Value(0)).current;

  // Per-habit completion animations
  const habitCheckAnims = useRef<{ [key: string]: Animated.Value }>({});

  const getHabitCheckAnim = (id: string) => {
    if (!habitCheckAnims.current[id]) {
      habitCheckAnims.current[id] = new Animated.Value(1);
    }
    return habitCheckAnims.current[id];
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getTodayString = () => new Date().toISOString().split('T')[0];

  const isToday = (dateString?: string) => !!dateString && dateString === getTodayString();

  const isYesterday = (dateString?: string) => {
    if (!dateString) return false;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return dateString === yesterday.toISOString().split('T')[0];
  };

  const getMotivationalMessage = (rate: number) => {
    const bucket = MOTIVATIONAL_MESSAGES.find(m => rate >= m.threshold)!;
    return bucket.messages[Math.floor(Math.random() * bucket.messages.length)];
  };

  const getWeatherStatus = (code: number) => {
    if (code === 0) return 'Clear Skies';
    if (code >= 1 && code <= 3) return 'Partly Cloudy';
    if (code >= 45 && code <= 48) return 'Foggy';
    if (code >= 51 && code <= 67) return 'Gentle Rain';
    if (code >= 71 && code <= 77) return 'Snowfall';
    if (code >= 80 && code <= 82) return 'Rain Showers';
    if (code >= 95) return 'Thunderstorm';
    return 'Calm Day';
  };

  const getWeatherIcon = (code: number): any => {
    if (code === 0) return 'sunny';
    if (code <= 3) return 'partly-sunny';
    if (code <= 48) return 'cloud';
    if (code <= 67) return 'rainy';
    if (code <= 77) return 'snow';
    if (code <= 82) return 'rainy';
    return 'thunderstorm';
  };

  // ── Daily reset ────────────────────────────────────────────────────────────
  const checkAndResetHabitsDaily = async (habitsToCheck: Habit[]) => {
    let updated = false;
    const updatedHabits = habitsToCheck.map((habit) => {
      if (isToday(habit.lastCompletedDate)) return habit;
      updated = true;
      if (isYesterday(habit.lastCompletedDate)) return { ...habit, completed: false, timeSpentSeconds: 0 };
      return { ...habit, completed: false, count: 0, timeSpentSeconds: 0 };
    });
    if (updated) {
      setHabits(updatedHabits);
      await AsyncStorage.setItem('@habits_v3', JSON.stringify(updatedHabits));
    }
  };

  useEffect(() => {
    loadEssentialData();
    const handle = requestIdleCallback(() => {
      setIsReady(true);
      startEntranceAnimation();
      initSync();
    });
    return () => cancelIdleCallback(handle);
  }, []);

  const initSync = async () => {
    const code = await getSyncCode();
    setSyncCode(code);
    await startSyncService();
    
    // Process incoming control streams from web
    const unsub = subscribeToSync(async (type, payload) => {
      try {
        const rawTodos = await AsyncStorage.getItem('@todos_v3');
        const tasks = rawTodos ? JSON.parse(rawTodos) : [];
        const formatTasks = (ts: any[]) => ts.filter(t => !t.archived && t.tag !== 'Shopping').map(t => ({ id: t.id, title: t.text, completed: t.completed }));

        const rawNotes = await AsyncStorage.getItem('@daily_notes_v3');
        const notes = rawNotes ? JSON.parse(rawNotes) : [];
        const formatNotes = (ns: any[]) => ns.map(n => ({ id: n.id, title: n.title, content: n.content, date: n.date })).slice(0, 15);

        if (type === 'REQUEST_FULL_STATE') {
          broadcastSyncUpdate('FULL_STATE_SYNC', {
            greeting: 'Good Day.',
            timer: { isRunning: false, timeRemaining: 1500, mode: 'FOCUS' },
            tasks: formatTasks(tasks),
            notes: formatNotes(notes)
          });
        }
        else if (type === 'TASK_ADD') {
          const newTask = {
             id: payload.id || String(Date.now()),
             text: payload.title,
             completed: false,
             archived: false,
             priority: payload.priority || 'med',
             subtasks: [],
             createdAt: Date.now()
          };
          tasks.unshift(newTask);
          await AsyncStorage.setItem('@todos_v3', JSON.stringify(tasks));
          broadcastSyncUpdate('TASK_STATE_UPDATE', { tasks: formatTasks(tasks) });
        }
        else if (type === 'TASK_TOGGLE') {
          const updatedTasks = tasks.map((t: any) => t.id === payload.id ? { ...t, completed: payload.completed } : t);
          await AsyncStorage.setItem('@todos_v3', JSON.stringify(updatedTasks));
          broadcastSyncUpdate('TASK_STATE_UPDATE', { tasks: formatTasks(updatedTasks) });
        }
        else if (['TIMER_START', 'TIMER_PAUSE', 'TIMER_RESET'].includes(type)) {
          // Timer local generic state
          // Native integration would bridge to `FocusScreen` active session context
          broadcastSyncUpdate('TIMER_STATE_UPDATE', {
             isRunning: type === 'TIMER_START',
             timeRemaining: type === 'TIMER_RESET' ? 1500 : (payload?.timeRemaining || 1500),
             mode: payload?.mode || 'FOCUS'
          });
        }
      } catch (e) {
        console.error('Core sync mapping error', e);
      }
    });
    return unsub;
  };

  useEffect(() => {
    if (isFocused && isReady) {
      checkAndResetHabitsDaily(habits);
      if (!weather) updateWeatherByLocation(false);
    }
  }, [isFocused, isReady]);

  // Celebrate on 100% completion
  useEffect(() => {
    const rate = habits.length > 0
      ? Math.round((habits.filter(h => h.completed).length / habits.length) * 100) : 0;
    if (rate === 100 && prevCompletionRate < 100 && habits.length > 0) {
      triggerCelebration();
    }
    setPrevCompletionRate(rate);
  }, [habits]);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadEssentialData = async () => {
    try {
      // Remove stale quote cache from old provider on every load
      await AsyncStorage.removeItem('@quote_cache');

      const [cachedHabits, cachedWeather] = await Promise.all([
        AsyncStorage.getItem('@habits_v3'),
        AsyncStorage.getItem('@weather_cache_v2'),
      ]);

      if (cachedHabits) {
        const parsedHabits = JSON.parse(cachedHabits);
        setHabits(parsedHabits);
        await checkAndResetHabitsDaily(parsedHabits);
      }
      if (cachedWeather) setWeather(JSON.parse(cachedWeather));

      // Fetch fresh quote immediately — no stale cache shown
      backgroundQuoteUpdate();
      setTimeout(() => updateWeatherByLocation(false), 800);
    } catch (e) {
      console.log('Error loading essential data', e);
    }
  };

  // ── Animations ─────────────────────────────────────────────────────────────
  const startEntranceAnimation = () => {
    const animations = sectionAnims.map((anim, i) =>
      Animated.parallel([
        Animated.spring(anim, { toValue: 1, tension: 120, friction: 13, useNativeDriver: true }),
        Animated.spring(slideAnims[i], { toValue: 0, tension: 110, friction: 11, useNativeDriver: true }),
      ])
    );
    Animated.stagger(40, animations).start();
  };

  const triggerCelebration = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCelebrateVisible(true);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(celebrateScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
        Animated.timing(celebrateOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(2000),
      Animated.parallel([
        Animated.timing(celebrateScale, { toValue: 0.8, duration: 300, useNativeDriver: true }),
        Animated.timing(celebrateOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start(() => setCelebrateVisible(false));
  };

  // ── Quote ─────────────────────────────────────────────────────────────────
  const backgroundQuoteUpdate = async () => {
    try {
      // type.fit: free, no auth, ~1600 curated quotes, reliable static endpoint
      const response = await fetch('https://type.fit/api/quotes');
      const data: Array<{ text: string; author: string | null }> = await response.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('empty');

      // Filter out religious content and very short quotes
      const clean = data.filter(q =>
        q.text && q.text.length > 40 && q.text.length < 220 &&
        isCleanQuote(q.text, q.author || '')
      );

      const pool = clean.length > 0 ? clean : data;
      const picked = pool[Math.floor(Math.random() * pool.length)];
      // type.fit appends ", type.fit" to unknown authors — strip it
      const author = (picked.author || 'Unknown').replace(/, type\.fit$/, '').trim();
      setQuote({ text: picked.text, author });
    } catch (error) {
      setQuote(FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)]);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 20,
      onPanResponderMove: (_, gs) => quoteTranslateX.setValue(gs.dx),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 80) fetchNewQuote('right');
        else if (gs.dx < -80) fetchNewQuote('left');
        else Animated.spring(quoteTranslateX, { toValue: 0, friction: 5, useNativeDriver: true }).start();
      },
    })
  ).current;

  const fetchNewQuote = async (direction: 'left' | 'right' = 'right') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const exitValue = direction === 'right' ? width : -width;
    const entryValue = direction === 'right' ? -width : width;
    Animated.timing(quoteTranslateX, { toValue: exitValue, duration: 220, useNativeDriver: true }).start(async () => {
      try {
        const res = await fetch('https://type.fit/api/quotes');
        const data: Array<{ text: string; author: string | null }> = await res.json();
        if (!Array.isArray(data) || data.length === 0) throw new Error('empty');
        const clean = data.filter(q =>
          q.text && q.text.length > 40 && q.text.length < 220 &&
          isCleanQuote(q.text, q.author || '')
        );
        const pool = clean.length > 0 ? clean : data;
        const picked = pool[Math.floor(Math.random() * pool.length)];
        const author = (picked.author || 'Unknown').replace(/, type\.fit$/, '').trim();
        setQuote({ text: picked.text, author });
      } catch {
        setQuote(FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)]);
      }
      quoteTranslateX.setValue(entryValue);
      Animated.spring(quoteTranslateX, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }).start();
    });
  };

  // ── Weather ───────────────────────────────────────────────────────────────
  const updateWeatherByLocation = async (manual: boolean = false) => {
    if (manual) setIsWeatherLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (manual) showToast('Location permission is required for weather.');
        setIsWeatherLoading(false);
        return;
      }
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        if (manual) showToast('Please enable GPS to fetch weather.');
        setIsWeatherLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = location.coords;
      const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      const cityName = reverseGeocode[0]?.city || reverseGeocode[0]?.subregion || 'Atmosphere';

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&current_weather=true&hourly=temperature_2m,weathercode,precipitation_probability` +
        `&current=apparent_temperature,relative_humidity_2m,wind_speed_10m` +
        `&forecast_days=1&timezone=auto`
      );
      const weatherData = await weatherRes.json();
      const current = weatherData.current_weather;

      // Build hourly for today (next 12 hours from now)
      const nowHour = new Date().getHours();
      const hourlyTemps: HourlyForecast[] = [];
      if (weatherData.hourly?.time) {
        weatherData.hourly.time.forEach((t: string, i: number) => {
          const hour = new Date(t).getHours();
          if (hour >= nowHour && hour <= nowHour + 11) {
            hourlyTemps.push({
              hour: String(hour).padStart(2, '0'),
              temp: Math.round(weatherData.hourly.temperature_2m[i]),
              weathercode: weatherData.hourly.weathercode[i],
              precipitation_probability: weatherData.hourly.precipitation_probability?.[i] ?? 0,
            });
          }
        });
      }

      const newWeather: WeatherData = {
        temp: Math.round(current.temperature),
        desc: cityName,
        status: getWeatherStatus(current.weathercode),
        icon: getWeatherIcon(current.weathercode),
        hourly: hourlyTemps,
        feelsLike: weatherData.current?.apparent_temperature != null
          ? Math.round(weatherData.current.apparent_temperature) : undefined,
        humidity: weatherData.current?.relative_humidity_2m,
        windspeed: current.windspeed != null ? Math.round(current.windspeed) : undefined,
      };

      setWeather(newWeather);
      await AsyncStorage.setItem('@weather_cache_v2', JSON.stringify(newWeather));
    } catch (error) {
      console.log('Weather error', error);
    } finally {
      setIsWeatherLoading(false);
    }
  };

  // ── Inline toast ──────────────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  };

  // ── Habits ────────────────────────────────────────────────────────────────
  const toggleHabit = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const anim = getHabitCheckAnim(id);
    Animated.sequence([
      Animated.timing(anim, { toValue: 0.88, duration: 70, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }),
    ]).start();

    const today = getTodayString();
    const updated = habits.map(h => {
      if (h.id !== id) return h;
      const newlyCompleting = !h.completed && !isToday(h.lastCompletedDate);
      const uncompleting = h.completed && isToday(h.lastCompletedDate);

      if (newlyCompleting) {
        recordHabitCompleted({ habitId: h.id, name: h.name, completedAt: Date.now(), streak: h.count + 1 }).catch(() => {});
        return { ...h, completed: true, count: h.count + 1, lastCompletedDate: today };
      } else if (uncompleting) {
        removeHabitCompleted({ habitId: h.id, completedAt: Date.now() }).catch(() => {});
        return { ...h, completed: false, count: Math.max(0, h.count - 1), lastCompletedDate: undefined };
      }
      return { ...h, completed: !h.completed };
    });
    setHabits(updated);
    AsyncStorage.setItem('@habits_v3', JSON.stringify(updated));
  };

  const deleteHabit = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.timing(habitDeleteAnim, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => {
      const updated = habits.filter(h => h.id !== id);
      setHabits(updated);
      AsyncStorage.setItem('@habits_v3', JSON.stringify(updated));
      setDeleteConfirmVisible(false);
      setHabitToDelete(null);
      habitDeleteAnim.setValue(1);
    });
  };

  const addHabit = () => {
    if (!newHabitName.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const h = parseInt(habitExpHours || '0');
    const m = parseInt(habitExpMinutes || '0');
    const totalMins = (h * 60) + m;

    let updated;
    if (editingHabitId) {
      updated = habits.map(hItem => {
        if (hItem.id === editingHabitId) {
           return {
             ...hItem,
             name: newHabitName.trim(),
             iconName: selectedIcon.name,
             iconType: selectedIcon.type,
             expectedMinutes: totalMins > 0 ? totalMins : undefined,
           };
        }
        return hItem;
      });
    } else {
      const newHabit: Habit = {
        id: Date.now().toString(),
        name: newHabitName.trim(),
        completed: false,
        count: 0,
        iconName: selectedIcon.name,
        iconType: selectedIcon.type,
        expectedMinutes: totalMins > 0 ? totalMins : undefined,
        timeSpentSeconds: 0,
      };
      updated = [...habits, newHabit];
    }
    setHabits(updated);
    AsyncStorage.setItem('@habits_v3', JSON.stringify(updated));
    setNewHabitName('');
    setHabitExpHours('');
    setHabitExpMinutes('');
    setEditingHabitId(null);
    setIsAddingHabit(false);
  };

  const openAppModal = (habit?: Habit) => {
    if (habit) {
      setEditingHabitId(habit.id);
      setNewHabitName(habit.name);
      setHabitExpHours(habit.expectedMinutes ? String(Math.floor(habit.expectedMinutes / 60) || '') : '');
      setHabitExpMinutes(habit.expectedMinutes ? String(habit.expectedMinutes % 60 || '') : '');
      setSelectedIcon({ name: habit.iconName, type: habit.iconType, family: '' } as any);
    } else {
      setEditingHabitId(null);
      setNewHabitName('');
      setHabitExpHours('');
      setHabitExpMinutes('');
      setSelectedIcon(HABIT_ICONS[0]);
    }
    setIsAddingHabit(true);
  };



  // ── Computed ──────────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  }).toUpperCase();

  const completedCount = habits.filter(h => h.completed).length;
  const completionRate = habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0;
  const motivationalMsg = getMotivationalMessage(completionRate);

  const maxStreak = habits.length > 0 ? Math.max(...habits.map(h => h.count)) : 0;
  const totalStreakDays = habits.reduce((acc, h) => acc + h.count, 0);

  const renderHabitIcon = (iconName: string, iconType: string, color: string) => {
    if (iconType === 'MaterialIcons') return <MaterialIcons name={iconName as any} size={20} color={color} />;
    return <MaterialCommunityIcons name={iconName as any} size={20} color={color} />;
  };

  const renderAnimatedSection = (index: number, children: React.ReactNode) => (
    <Animated.View style={{ opacity: sectionAnims[index], transform: [{ translateY: slideAnims[index] }] }}>
      {children}
    </Animated.View>
  );

  // ── Styles ────────────────────────────────────────────────────────────────
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: {
      padding: Spacing.padding,
      paddingTop: Platform.OS === 'ios' ? 70 : (StatusBar.currentHeight || 0) + 20,
    },

    // Header
    headerBlock: { marginBottom: 28 },
    topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
    logoText: { ...Typography.title, color: colors.primary, fontWeight: '800', letterSpacing: -0.5 },
    headerBtn: {
      width: 42, height: 42, borderRadius: 12,
      backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
      ...Shadows.soft,
    },
    greetingSection: {},
    dateLabel: { ...Typography.caption, fontWeight: '700', color: colors.textVariant, letterSpacing: 1.5, marginBottom: 6, textTransform: 'uppercase' },
    greetingTitle: { ...Typography.header, color: colors.text, letterSpacing: -1.5, lineHeight: 40 },
    greetingSub: { ...Typography.body, color: colors.textVariant, marginTop: 10, maxWidth: '92%', lineHeight: 22 },

    // Quote
    quoteCardWrapper: { marginBottom: 28 },
    quoteCard: { width: '100%', borderRadius: 20, ...Shadows.soft, overflow: 'hidden' },
    quoteGradient: { padding: 22 },
    quoteText: { ...Typography.title, color: '#FFFFFF', lineHeight: 27, fontSize: scaleFontSize(16) },
    quoteAuthor: { ...Typography.body, color: 'rgba(255,255,255,0.75)', marginTop: 10, fontSize: scaleFontSize(14) },
    quoteHint: { ...Typography.caption, color: 'rgba(255,255,255,0.45)', marginTop: 14, fontSize: scaleFontSize(11), textAlign: 'right' },

    // Rituals
    ritualsContainer: { marginBottom: 28 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { ...Typography.header, fontSize: scaleFontSize(22), color: colors.text, letterSpacing: -0.5 },
    sectionBadge: { ...Typography.caption, color: colors.primary, fontWeight: '800', fontSize: scaleFontSize(12) },

    // Progress bar above habits
    progressBarWrap: { height: 3, backgroundColor: colors.surfaceContainer, borderRadius: 2, marginBottom: 18, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 2 },

    habitsGrid: { gap: 10 },
    habitItem: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface,
      padding: 14, borderRadius: 16, ...Shadows.soft,
    },
    habitMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    checkbox: {
      width: 22, height: 22, borderRadius: 11,
      borderWidth: 1.5, borderColor: colors.surfaceContainer,
      marginRight: 12, justifyContent: 'center', alignItems: 'center',
    },
    habitIconContainer: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    habitName: { ...Typography.body, fontWeight: '600', color: colors.text, fontSize: scaleFontSize(15) },
    habitNameCompleted: { textDecorationLine: 'line-through', color: colors.textVariant },
    habitMeta: { ...Typography.caption, color: colors.textVariant, marginTop: 2 },
    deleteBtn: { padding: 6 },
    emptyHabits: {
      paddingVertical: 32, alignItems: 'center', gap: 10,
      borderWidth: 1.5, borderColor: colors.surfaceContainer,
      borderStyle: 'dashed', borderRadius: 16,
    },
    emptyHabitsText: { ...Typography.body, color: colors.textVariant, textAlign: 'center' },
    addFirstBtn: {
      marginTop: 4, paddingHorizontal: 20, paddingVertical: 10,
      backgroundColor: colors.primary, borderRadius: 20,
    },
    addFirstBtnText: { color: '#FFF', fontWeight: '700', fontSize: scaleFontSize(14) },

    // Weather
    weatherCard: {
      backgroundColor: colors.surface, borderRadius: 20,
      padding: 20, marginBottom: 28, ...Shadows.soft,
    },
    weatherRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    weatherLeft: { flex: 1 },
    cityText: { ...Typography.title, fontSize: scaleFontSize(17), color: colors.text, fontWeight: '700' },
    weatherStatus: { ...Typography.caption, color: colors.textVariant, marginTop: 2 },
    tempRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
    tempText: { ...Typography.header, fontSize: scaleFontSize(42), color: colors.text, lineHeight: 48 },
    tempUnit: { ...Typography.title, marginLeft: 2, color: colors.textVariant, fontSize: scaleFontSize(18) },
    weatherRight: { alignItems: 'center', gap: 4 },
    feelsLikeText: { ...Typography.caption, color: colors.textVariant, fontSize: scaleFontSize(11) },
    weatherMetaRow: { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.background },
    weatherMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    weatherMetaText: { ...Typography.caption, color: colors.textVariant, fontSize: scaleFontSize(12) },
    hourlyToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    hourlyToggleText: { ...Typography.caption, color: colors.primary, fontWeight: '700', fontSize: scaleFontSize(12) },
    weatherLoadingContainer: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 12 },
    loadingText: { ...Typography.caption, color: colors.primary },

    // Metrics
    metricsCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, marginBottom: 28, ...Shadows.soft },
    metricsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    metricsRingWrap: { position: 'relative', width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
    metricsRingLabel: { position: 'absolute', alignItems: 'center' },
    metricsRingPct: { ...Typography.caption, fontWeight: '800', color: colors.text, fontSize: scaleFontSize(12) },
    metricsRight: { flex: 1 },
    metricsTitle: { ...Typography.title, color: colors.text, fontSize: scaleFontSize(17), fontWeight: '700' },
    metricsSubtitle: { ...Typography.caption, color: colors.textVariant, marginTop: 2 },
    metricsFooter: { marginTop: 16 },
    primaryBtn: { height: 46, borderRadius: 23, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
    primaryBtnText: { color: '#FFF', fontWeight: '700', letterSpacing: 0.5, fontSize: scaleFontSize(15) },

    // Streak card
    streakCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, marginBottom: 28, ...Shadows.soft },
    streakRow: { flexDirection: 'row', gap: 12 },
    streakItem: { flex: 1, backgroundColor: colors.background, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
    streakValue: { ...Typography.header, fontSize: scaleFontSize(28), color: colors.text, lineHeight: 34 },
    streakLabel: { ...Typography.caption, color: colors.textVariant, textAlign: 'center', fontSize: scaleFontSize(11) },


    // FAB
    fab: { position: 'absolute', bottom: 30, right: 20, width: 58, height: 58, borderRadius: 29, ...Shadows.soft },
    fabInner: { width: '100%', height: '100%', borderRadius: 29, justifyContent: 'center', alignItems: 'center' },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: colors.surface, borderRadius: 24, padding: 24, width: '100%', ...Shadows.soft },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { ...Typography.title, color: colors.text, fontWeight: '700', fontSize: scaleFontSize(18) },
    label: { ...Typography.caption, fontWeight: '700', marginBottom: 10, marginTop: 10, color: colors.textVariant, letterSpacing: 1 },
    input: {
      borderBottomWidth: 1, borderBottomColor: colors.surfaceContainer,
      color: isDark ? colors.primary : colors.text, paddingVertical: 10,
      ...Typography.body, fontSize: scaleFontSize(16), marginBottom: 20,
    },
    iconPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
    iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
    iconBoxSelected: { backgroundColor: colors.primary },
    saveBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: 14, alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: scaleFontSize(16) },

    // Toast
    toast: {
      position: 'absolute', bottom: 110, alignSelf: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.75)',
      paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
    },
    toastText: { color: '#FFF', fontSize: scaleFontSize(14), fontWeight: '600' },

    // Celebrate banner
    celebrateBanner: {
      position: 'absolute', top: Platform.OS === 'ios' ? 100 : 60,
      alignSelf: 'center', zIndex: 999,
      backgroundColor: colors.primary, borderRadius: 20,
      paddingHorizontal: 24, paddingVertical: 14,
      flexDirection: 'row', alignItems: 'center', gap: 10,
      ...Shadows.soft,
    },
    celebrateText: { color: '#FFF', fontWeight: '800', fontSize: scaleFontSize(16) },
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Celebration banner */}
      {celebrateVisible && (
        <Animated.View style={[styles.celebrateBanner, {
          opacity: celebrateOpacity,
          transform: [{ scale: celebrateScale }],
        }]}>
          <Text style={{ fontSize: 22 }}>🎉</Text>
          <Text style={styles.celebrateText}>All rituals complete!</Text>
        </Animated.View>
      )}

      {/* Toast */}
      {toastVisible && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ─ Header ─ */}
        {renderAnimatedSection(0, (
          <View style={styles.headerBlock}>
            <View style={styles.topHeader}>
              <Pressable
                onLongPress={() => navigation.navigate('VaultSettingsAuth')}
                delayLongPress={2000}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={styles.logoText}>Daily Hub</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setThemeMode(isDark ? 'light' : 'dark'); }}
                  style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Ionicons name={isDark ? 'sunny' : 'moon'} size={20} color={colors.primary} />
                </Pressable>
              </View>
            </View>
            <View style={styles.greetingSection}>
              <Text style={styles.dateLabel}>{today}</Text>
              <Text style={styles.greetingTitle}>
                {completionRate === 100 ? 'All Done. 🏆' : 'Rise & Execute.'}
              </Text>
              <Text style={styles.greetingSub}>{motivationalMsg}</Text>
              
              {syncCode !== '------' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: 'rgba(136, 153, 255, 0.1)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                  <Text style={{ ...Typography.caption, color: colors.primary, fontWeight: '700', fontSize: scaleFontSize(12), letterSpacing: 1 }}>
                    REMOTE LINK: <Text style={{ letterSpacing: 3 }}>{syncCode}</Text>
                  </Text>
                </View>
              )}
            </View>
          </View>
        ))}

        {/* ─ Quote Card ─ */}
        {renderAnimatedSection(1, (
          <View style={styles.quoteCardWrapper}>
            <Animated.View
              {...panResponder.panHandlers}
              style={[styles.quoteCard, { transform: [{ translateX: quoteTranslateX }] }]}
            >
              <LinearGradient colors={[colors.primary, colors.primaryLight]} style={styles.quoteGradient}>
                <MaterialCommunityIcons name="format-quote-open" size={36} color="rgba(255,255,255,0.25)" />
                <Text style={styles.quoteText}>{quote.text}</Text>
                <Text style={styles.quoteAuthor}>— {quote.author}</Text>
                <Text style={styles.quoteHint}>swipe for new quote →</Text>
              </LinearGradient>
            </Animated.View>
          </View>
        ))}

        {/* ─ Daily Rituals ─ */}
        {renderAnimatedSection(2, (
          <View style={styles.ritualsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Daily Rituals</Text>
              <Text style={styles.sectionBadge}>{completedCount}/{habits.length} DONE</Text>
            </View>

            {/* Thin progress bar */}
            {habits.length > 0 && (
              <View style={styles.progressBarWrap}>
                <View style={[
                  styles.progressBarFill,
                  {
                    width: `${completionRate}%`,
                    backgroundColor: completionRate === 100 ? '#22c55e' : colors.primary,
                  }
                ]} />
              </View>
            )}

            <View style={styles.habitsGrid}>
              {habits.length === 0 ? (
                <View style={styles.emptyHabits}>
                  <MaterialCommunityIcons name="star-shooting-outline" size={32} color={colors.textVariant} />
                  <Text style={styles.emptyHabitsText}>No rituals yet.{'\n'}Add one to start building momentum.</Text>
                  <Pressable
                    style={({ pressed }) => [styles.addFirstBtn, { opacity: pressed ? 0.8 : 1 }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openAppModal(); }}
                  >
                    <Text style={styles.addFirstBtnText}>Add First Ritual</Text>
                  </Pressable>
                </View>
              ) : habits.map((habit) => {
                const checkAnim = getHabitCheckAnim(habit.id);

                const renderRightActions = () => (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={() => { swipeRefs[habit.id]?.close(); openAppModal(habit); }}
                      style={{ backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', width: 65, height: '90%', borderRadius: 14, marginLeft: 8 }}
                    >
                      <Ionicons name="create-outline" size={20} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { swipeRefs[habit.id]?.close(); setHabitToDelete(habit.id); setDeleteConfirmVisible(true); }}
                      style={{ backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center', width: 65, height: '90%', borderRadius: 14, marginLeft: 8 }}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                );

                return (
                  <Animated.View
                    key={habit.id}
                    style={{
                      transform: [{ scale: checkAnim }],
                      opacity: habitToDelete === habit.id ? habitDeleteAnim : 1,
                    }}
                  >
                    <Swipeable 
                      ref={ref => { if (ref) swipeRefs[habit.id] = ref; }}
                      renderRightActions={renderRightActions} overshootRight={false} containerStyle={{ overflow: 'visible' }} childrenContainerStyle={{ overflow: 'visible' }}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.habitItem,
                        habit.completed && { borderLeftWidth: 3, borderLeftColor: colors.primary },
                        { opacity: pressed ? 0.75 : 1 },
                      ]}
                      onPress={() => toggleHabit(habit.id)}
                      onLongPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        setHabitToDelete(habit.id);
                        setDeleteConfirmVisible(true);
                      }}
                    >
                      <View style={styles.habitMain}>
                        <View style={[styles.checkbox, habit.completed && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                          {habit.completed && <Ionicons name="checkmark" size={14} color="#FFF" />}
                        </View>
                        <View style={[styles.habitIconContainer, habit.completed && { opacity: 0.6 }]}>
                          {renderHabitIcon(habit.iconName, habit.iconType, habit.completed ? colors.textVariant : colors.primary)}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.habitName, habit.completed && styles.habitNameCompleted]}>
                            {habit.name}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={[styles.habitMeta, habit.count > 0 && { color: colors.secondary, fontWeight: '700' }]}>
                              {habit.count > 0 ? `🔥 ${habit.count} day streak` : 'Start your streak'}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {habit.expectedMinutes ? (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            navigation.navigate('Focus', {
                              linkedTask: {
                                id: habit.id, type: 'habit', name: habit.name,
                                expectedMinutes: habit.expectedMinutes,
                                timeSpentSeconds: habit.timeSpentSeconds || 0
                              }
                            });
                          }}
                          style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.7 : 1 }]}
                        >
                          <Ionicons name="play-circle" size={24} color={colors.primary} />
                        </Pressable>
                      ) : null}
                    </Pressable>
                    </Swipeable>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        ))}

        {/* ─ Focus Metrics ─ */}
        {renderAnimatedSection(4, (
          <View style={styles.metricsCard}>
            <View style={styles.metricsRow}>
              <View style={styles.metricsRingWrap}>
                <CompletionRing percent={completionRate} colors={colors} />
                <View style={styles.metricsRingLabel}>
                  <Text style={styles.metricsRingPct}>{completionRate}%</Text>
                </View>
              </View>
              <View style={styles.metricsRight}>
                <Text style={styles.metricsTitle}>
                  {completionRate === 100 ? 'Perfect Day!' : 'Focus Metrics'}
                </Text>
                <Text style={styles.metricsSubtitle}>
                  {completedCount} of {habits.length} rituals complete today
                </Text>
              </View>
            </View>
            <View style={styles.metricsFooter}>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.8 : 1 }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('Focus'); }}
              >
                <Ionicons name="timer-outline" size={18} color="#FFF" />
                <Text style={styles.primaryBtnText}>START FOCUS SESSION</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {/* ─ Streak Stats ─ */}
        {habits.length > 0 && renderAnimatedSection(6, (
          <View style={styles.streakCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Streak Stats</Text>
              <MaterialCommunityIcons name="fire" size={22} color={colors.primary} />
            </View>
            <View style={styles.streakRow}>
              <View style={styles.streakItem}>
                <Text style={styles.streakValue}>{maxStreak}</Text>
                <Text style={styles.streakLabel}>Best Streak{'\n'}(days)</Text>
              </View>
              <View style={styles.streakItem}>
                <Text style={styles.streakValue}>{habits.filter(h => h.count > 0).length}</Text>
                <Text style={styles.streakLabel}>Active{'\n'}Habits</Text>
              </View>
              <View style={styles.streakItem}>
                <Text style={styles.streakValue}>{totalStreakDays}</Text>
                <Text style={styles.streakLabel}>Total Days{'\n'}Logged</Text>
              </View>
            </View>
          </View>
        ))}

        {/* ─ Weather ─ */}
        {renderAnimatedSection(3, (
          <Pressable
            style={({ pressed }) => [styles.weatherCard, { opacity: pressed ? 0.95 : 1 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowHourlyExpanded(v => !v);
            }}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              updateWeatherByLocation(true);
            }}
          >
            {isWeatherLoading && !weather ? (
              <View style={styles.weatherLoadingContainer}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.loadingText}>Sensing atmosphere…</Text>
              </View>
            ) : (
              <>
                <View style={styles.weatherRow}>
                  <View style={styles.weatherLeft}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.cityText}>{weather?.desc || 'Your City'}</Text>
                      <Ionicons name="location" size={14} color={colors.primary} />
                    </View>
                    <Text style={styles.weatherStatus}>{weather?.status || 'Loading…'}</Text>
                    <View style={styles.tempRow}>
                      <Text style={styles.tempText}>{weather ? weather.temp : '--'}°</Text>
                      <Text style={styles.tempUnit}>C</Text>
                    </View>
                  </View>
                  <View style={styles.weatherRight}>
                    <Ionicons name={weather?.icon || 'cloud-outline'} size={44} color={colors.secondary} />
                    {weather?.feelsLike != null && (
                      <Text style={styles.feelsLikeText}>Feels {weather.feelsLike}°</Text>
                    )}
                  </View>
                </View>

                {/* Weather meta row */}
                {weather && (
                  <View style={styles.weatherMetaRow}>
                    {weather.humidity != null && (
                      <View style={styles.weatherMetaItem}>
                        <Ionicons name="water-outline" size={13} color={colors.textVariant} />
                        <Text style={styles.weatherMetaText}>{weather.humidity}%</Text>
                      </View>
                    )}
                    {weather.windspeed != null && (
                      <View style={styles.weatherMetaItem}>
                        <Ionicons name="speedometer-outline" size={13} color={colors.textVariant} />
                        <Text style={styles.weatherMetaText}>{weather.windspeed} km/h</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }} />
                    <View style={styles.hourlyToggle}>
                      <Text style={styles.hourlyToggleText}>
                        {showHourlyExpanded ? 'Hide' : 'Hourly'}
                      </Text>
                      <Ionicons
                        name={showHourlyExpanded ? 'chevron-up' : 'chevron-down'}
                        size={13}
                        color={colors.primary}
                      />
                    </View>
                  </View>
                )}

                {/* Hourly graph */}
                {showHourlyExpanded && weather?.hourly && weather.hourly.length > 0 && (
                  <HourlyWeatherGraph hourly={weather.hourly} colors={colors} />
                )}
              </>
            )}
          </Pressable>
        ))}

        {/* Footer */}
        <View style={{ paddingVertical: 16, alignItems: 'center', opacity: 0.35 }}>
          <Text style={{ ...Typography.caption, color: colors.textVariant }}>
            MONOLITH {APP_VERSION} (BUILD {APP_BUILD})
          </Text>
        </View>
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.8 : 1 }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openAppModal(); }}
      >
        <LinearGradient colors={[colors.primary, colors.primaryLight]} style={styles.fabInner}>
          <Ionicons name="add" size={30} color="#FFF" />
        </LinearGradient>
      </Pressable>

      {/* ─ Add Habit Modal ─ */}
      <Modal visible={isAddingHabit} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingHabitId ? 'Edit Ritual' : 'New Ritual'}</Text>
              <Pressable onPress={() => {
                  setNewHabitName('');
                  setHabitExpHours('');
                  setHabitExpMinutes('');
                  setEditingHabitId(null);
                  setIsAddingHabit(false);
                }} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name="close" size={22} color={colors.textVariant} />
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="e.g. Morning Meditation"
              placeholderTextColor={colors.textVariant}
              value={newHabitName}
              onChangeText={setNewHabitName}
              autoFocus
              returnKeyType="next"
            />
            <Text style={styles.label}>FOCUS GOAL (OPTIONAL)</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={[styles.input, { paddingHorizontal: 12 }]}
                  placeholder="Hours"
                  placeholderTextColor={colors.textVariant + '80'}
                  keyboardType="number-pad"
                  value={habitExpHours}
                  onChangeText={setHabitExpHours}
                  returnKeyType="next"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={[styles.input, { paddingHorizontal: 12 }]}
                  placeholder="Minutes"
                  placeholderTextColor={colors.textVariant + '80'}
                  keyboardType="number-pad"
                  value={habitExpMinutes}
                  onChangeText={setHabitExpMinutes}
                  returnKeyType="done"
                  onSubmitEditing={addHabit}
                />
              </View>
            </View>
            <Text style={styles.label}>SYMBOL</Text>
            <View style={styles.iconPicker}>
              {HABIT_ICONS.map((icon, idx) => (
                <Pressable
                  key={idx}
                  style={({ pressed }) => [
                    styles.iconBox,
                    selectedIcon.name === icon.name && styles.iconBoxSelected,
                    { opacity: pressed ? 0.7 : 1 }
                  ]}
                  onPress={() => { Haptics.selectionAsync(); setSelectedIcon(icon); }}
                >
                  {renderHabitIcon(icon.name, icon.type, selectedIcon.name === icon.name ? '#FFF' : colors.primary)}
                </Pressable>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [styles.saveBtn, { opacity: pressed ? 0.8 : 1 }]}
              onPress={addHabit}
            >
              <Text style={styles.saveBtnText}>Infuse into Rituals</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ─ Delete Confirm Modal ─ */}
      <Modal visible={deleteConfirmVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ alignItems: 'center', marginBottom: 4 }}>
              <View style={{
                width: 60, height: 60, borderRadius: 30,
                backgroundColor: colors.error + '18',
                justifyContent: 'center', alignItems: 'center', marginBottom: 16,
              }}>
                <MaterialCommunityIcons name="alert-circle-outline" size={28} color={colors.error} />
              </View>
              <Text style={styles.modalTitle}>Remove Ritual</Text>
              <Text style={{ ...Typography.body, color: colors.textVariant, marginTop: 10, textAlign: 'center', fontSize: scaleFontSize(14) }}>
                Are you sure you want to permanently remove this ritual?
              </Text>
            </View>
            <View style={{ gap: 12, marginTop: 20 }}>
              <Pressable
                style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.error, opacity: pressed ? 0.8 : 1 }]}
                onPress={() => habitToDelete && deleteHabit(habitToDelete)}
              >
                <Text style={styles.saveBtnText}>Remove</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.saveBtn, { backgroundColor: 'transparent', opacity: pressed ? 0.8 : 1 }]}
                onPress={() => setDeleteConfirmVisible(false)}
              >
                <Text style={[styles.saveBtnText, { color: colors.textVariant }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </GestureHandlerRootView>
  );
}