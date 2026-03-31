import React, { useState, useEffect, useRef } from 'react';
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
  RefreshControl,
  Alert,
  StatusBar,
  PanResponder,
  Easing
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, NavigationProp, useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Typography, Shadows, Spacing } from '../theme/Theme';
import { scaleFontSize } from '../utils/ResponsiveSize';
import { APP_VERSION, APP_BUILD } from '../services/UpdateService';
import { useTheme } from '../context/ThemeContext';

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
];

interface Habit {
  id: string;
  name: string;
  completed: boolean;
  count: number;
  iconName: string;
  iconType: string;
  lastCompletedDate?: string; // Track last completion date (YYYY-MM-DD format)
}

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp<any>>();
  const isFocused = useIsFocused();
  const { colors, isDark, setThemeMode } = useTheme();

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: Spacing.padding, paddingTop: Platform.OS === 'ios' ? 70 : (StatusBar.currentHeight || 0) + 20 },

    headerBlock: { marginBottom: 32 },
    topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    logoText: { ...Typography.title, color: colors.primary, fontWeight: '800' },
    headerBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', ...Shadows.soft },

    greetingSection: {},
    dateLabel: { ...Typography.caption, fontWeight: '700', color: colors.textVariant, letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' },
    greetingTitle: { ...Typography.header, color: colors.text, letterSpacing: -1.5, lineHeight: 40 },
    greetingSub: { ...Typography.body, color: colors.textVariant, marginTop: 12, maxWidth: '90%' },

    quoteCardWrapper: { marginBottom: 40 },
    quoteCard: { width: '100%', borderRadius: 24, ...Shadows.soft, overflow: 'hidden' },
    quoteGradient: { padding: 24 },
    quoteText: { ...Typography.title, color: '#FFFFFF', lineHeight: 28 },
    quoteAuthor: { ...Typography.body, color: '#FFFFFF', opacity: 0.8, marginTop: 12, fontSize: scaleFontSize(15) },

    ritualsContainer: { marginBottom: 40 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 },
    sectionTitle: { ...Typography.header, fontSize: scaleFontSize(24), color: colors.text },
    sectionBadge: { ...Typography.caption, color: colors.primary, fontWeight: '800' },

    habitsGrid: { gap: 12 },
    habitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: Spacing.borderRadius,
      ...Shadows.soft,
    },
    habitItemCompleted: { opacity: 0.6 },
    habitMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.surfaceContainer, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
    habitIconContainer: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    habitName: { ...Typography.body, fontWeight: '600', color: colors.text },
    habitNameCompleted: { textDecorationLine: 'line-through', color: colors.textVariant },
    habitMeta: { ...Typography.caption, color: colors.textVariant, marginTop: 1 },
    deleteBtn: { padding: 4 },

    weatherCard: { backgroundColor: colors.surface, borderRadius: 24, padding: 20, marginBottom: 40, ...Shadows.soft },
    weatherContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    weatherLoadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    loadingText: { ...Typography.caption, color: colors.primary },
    cityText: { ...Typography.title, fontSize: scaleFontSize(18), color: colors.text },
    weatherStatus: { ...Typography.caption, color: colors.textVariant, marginTop: 2 },
    tempRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 12 },
    tempText: { ...Typography.header, fontSize: scaleFontSize(44), color: colors.text },
    tempUnit: { ...Typography.title, marginLeft: 2, color: colors.textVariant },

    metricsCard: { backgroundColor: colors.surface, borderRadius: 24, padding: 24, marginBottom: 20, ...Shadows.soft },
    metricsTitle: { ...Typography.title, color: colors.text, marginBottom: 20 },
    metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
    metricLabel: { ...Typography.body, fontSize: scaleFontSize(15), color: colors.textVariant },
    metricValue: { ...Typography.body, color: colors.text, fontWeight: '700' },
    progressBg: { height: 6, backgroundColor: colors.background, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    metricsFooter: { flexDirection: 'row', marginTop: 24 },
    primaryBtn: { flex: 1, height: 50, borderRadius: 25, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    primaryBtnText: { color: '#FFF', fontWeight: '700', letterSpacing: 0.5 },

    fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, ...Shadows.soft },
    fabInner: { width: '100%', height: '100%', borderRadius: 30, justifyContent: 'center', alignItems: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%', ...Shadows.soft },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: {
      fontFamily: Typography.title.fontFamily,
      fontSize: Typography.title.fontSize,
      fontWeight: Typography.title.fontWeight,
      letterSpacing: Typography.title.letterSpacing,
      color: colors.text
    },
    label: {
      fontFamily: Typography.caption.fontFamily,
      fontSize: Typography.caption.fontSize,
      letterSpacing: Typography.caption.letterSpacing,
      fontWeight: '700',
      marginBottom: 12,
      marginTop: 12,
      color: colors.textVariant
    },
    input: {
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceContainer,
      color: colors.text,
      paddingVertical: 8,
      fontFamily: Typography.body.fontFamily,
      fontSize: Typography.body.fontSize,
      lineHeight: Typography.body.lineHeight,
      marginBottom: 24
    },
    iconPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
    iconBox: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
    iconBoxSelected: { backgroundColor: colors.primary },
    saveBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: scaleFontSize(16) },
  });

  // State
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(HABIT_ICONS[0]);
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [habitToDelete, setHabitToDelete] = useState<string | null>(null);

  // Weather & Quote State
  const [weather, setWeather] = useState<{ temp: number, desc: string, icon: any, status: string } | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [quote, setQuote] = useState({ text: "Crafting your morning inspiration...", author: "Daily Hub" });
  const [budgetHealth, setBudgetHealth] = useState({ label: 'Calculating...', percentage: 0, status: 'Normal' });

  // Choreographed Animation Values
  const sectionAnims = useRef([
    new Animated.Value(0), // Header
    new Animated.Value(0), // Quote
    new Animated.Value(0), // Rituals
    new Animated.Value(0), // Weather
    new Animated.Value(0), // Metrics
  ]).current;

  const slideAnims = useRef(sectionAnims.map(() => new Animated.Value(15))).current;
  const habitScale = useRef(new Animated.Value(1)).current;
  const quoteTranslateX = useRef(new Animated.Value(0)).current;
  const habitDeleteAnim = useRef(new Animated.Value(1)).current;

  /**
   * Get today's date in YYYY-MM-DD format
   */
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  /**
   * Check if a date string is from today
   */
  const isToday = (dateString?: string) => {
    if (!dateString) return false;
    return dateString === getTodayString();
  };

  /**
   * Check if a date string is from yesterday
   */
  const isYesterday = (dateString?: string) => {
    if (!dateString) return false;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split('T')[0];
    return dateString === yesterdayString;
  };

  /**
   * Reset completion status and streaks at the start of each new day
   * - If a habit was completed today, keep it as is
   * - If a habit was last completed yesterday, reset completed to false but keep the streak
   * - If a habit was last completed more than 1 day ago, reset both completed and streak to 0
   */
  const checkAndResetHabitsDaily = async (habitsToCheck: Habit[]) => {
    const today = getTodayString();
    let updated = false;

    const updatedHabits = habitsToCheck.map((habit) => {
      const lastCompleted = habit.lastCompletedDate;

      // If already completed today, don't change anything
      if (isToday(lastCompleted)) {
        return habit;
      }

      // If not completed today, reset the completed flag
      if (!isToday(lastCompleted)) {
        updated = true;
        
        // Check if it was completed yesterday
        if (isYesterday(lastCompleted)) {
          // Keep the streak, just reset the completed flag
          return {
            ...habit,
            completed: false
          };
        } else {
          // More than 1 day has passed, reset the streak
          return {
            ...habit,
            completed: false,
            count: 0
          };
        }
      }

      return habit;
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
    });
    return () => cancelIdleCallback(handle);
  }, []);

  useEffect(() => {
    if (isFocused && isReady) {
      // Check and reset habits daily when screen comes into focus
      checkAndResetHabitsDaily(habits);
      loadBudgetMetrics();
      if (!weather) updateWeatherByLocation(false);
    }
  }, [isFocused, isReady]);

  const loadEssentialData = async () => {
    try {
      const [cachedHabits, cachedWeather, cachedQuote] = await Promise.all([
        AsyncStorage.getItem('@habits_v3'),
        AsyncStorage.getItem('@weather_cache'),
        AsyncStorage.getItem('@quote_cache')
      ]);

      if (cachedHabits) {
        const parsedHabits = JSON.parse(cachedHabits);
        setHabits(parsedHabits);
        // Check and reset habits for the new day
        await checkAndResetHabitsDaily(parsedHabits);
      }
      if (cachedWeather) setWeather(JSON.parse(cachedWeather));
      if (cachedQuote) setQuote(JSON.parse(cachedQuote));

      loadBudgetMetrics();

      setTimeout(() => {
        backgroundQuoteUpdate();
        updateWeatherByLocation(false);
      }, 1000);

    } catch (e) {
      console.log('Error loading essential data', e);
    }
  };

  const startEntranceAnimation = () => {
    const animations = sectionAnims.map((anim, i) => {
      return Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(slideAnims[i], {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1)),
        })
      ]);
    });

    Animated.stagger(120, animations).start();
  };



  const loadHabitsFromStorage = async () => {
    try {
      const stored = await AsyncStorage.getItem('@habits_v3');
      if (stored) {
        const parsedHabits = JSON.parse(stored);
        setHabits(parsedHabits);
        // Check and reset habits for the new day
        await checkAndResetHabitsDaily(parsedHabits);
      }
    } catch (e) { }
  };

  const loadBudgetMetrics = async () => {
    try {
      const storedExpenses = await AsyncStorage.getItem('@daily_expenses_v2');
      const storedLimit = await AsyncStorage.getItem('@budget_limit_v2');

      const expenses = storedExpenses ? JSON.parse(storedExpenses) : [];
      const limit = storedLimit ? parseFloat(storedLimit) : 10000;

      const totalSpent = expenses.reduce((sum: number, item: any) => item.type === 'expense' ? sum + item.amount : sum, 0);
      const percentage = Math.min((totalSpent / limit) * 100, 100);

      let status = 'Good';
      if (percentage > 90) status = 'Critical';
      else if (percentage > 70) status = 'Warning';

      setBudgetHealth({
        label: status,
        percentage: percentage,
        status: status
      });
    } catch (e) { }
  };

  const backgroundQuoteUpdate = async () => {
    try {
      const response = await fetch('https://dummyjson.com/quotes/random');
      const data = await response.json();
      const newQuote = { text: data.quote, author: data.author };
      setQuote(newQuote);
      await AsyncStorage.setItem('@quote_cache', JSON.stringify(newQuote));
    } catch (error) { }
  };

  const fetchNewQuote = async (direction: 'left' | 'right' = 'right') => {
    const exitValue = direction === 'right' ? width : -width;
    const entryValue = direction === 'right' ? -width : width;

    Animated.timing(quoteTranslateX, {
      toValue: exitValue,
      duration: 250,
      useNativeDriver: true
    }).start(async () => {
      try {
        const response = await fetch('https://dummyjson.com/quotes/random');
        const data = await response.json();
        setQuote({ text: data.quote, author: data.author });
      } catch (error) {
        setQuote(FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)]);
      }

      quoteTranslateX.setValue(entryValue);
      Animated.spring(quoteTranslateX, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true
      }).start();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 20,
      onPanResponderMove: (_, gestureState) => {
        quoteTranslateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 80) fetchNewQuote('right');
        else if (gestureState.dx < -80) fetchNewQuote('left');
        else Animated.spring(quoteTranslateX, { toValue: 0, friction: 5, useNativeDriver: true }).start();
      }
    })
  ).current;

  const updateWeatherByLocation = async (manual: boolean = false) => {
    if (manual) setIsWeatherLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (manual) Alert.alert('Permission Required', 'Enable location for atmospheric insights.');
        setIsWeatherLoading(false);
        return;
      }

      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        if (manual) Alert.alert('Location Disabled', 'GPS is required to sense your surroundings.');
        setIsWeatherLoading(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = location.coords;
      const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      const cityName = reverseGeocode[0]?.city || reverseGeocode[0]?.subregion || 'Atmosphere';

      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
      const weatherData = await weatherRes.json();
      const current = weatherData.current_weather;

      const newWeather = {
        temp: Math.round(current.temperature),
        desc: cityName,
        status: getWeatherStatus(current.weathercode),
        icon: current.weathercode === 0 ? 'sunny' : 'partly-sunny'
      };

      setWeather(newWeather);
      await AsyncStorage.setItem('@weather_cache', JSON.stringify(newWeather));
    } catch (error) {
    } finally {
      setIsWeatherLoading(false);
    }
  };

  const getWeatherStatus = (code: number) => {
    if (code === 0) return 'Clear Skies';
    if (code >= 1 && code <= 3) return 'Partly Cloudy';
    if (code >= 51 && code <= 67) return 'Gentle Rain';
    if (code >= 80) return 'Electric Storm';
    return 'Calm Day';
  };

  const toggleHabit = (id: string) => {
    Animated.sequence([
      Animated.timing(habitScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(habitScale, { toValue: 1, friction: 5, useNativeDriver: true })
    ]).start();

    const today = getTodayString();
    const updated = habits.map(h => {
      if (h.id === id) {
        const isCompletingToday = !h.completed && !isToday(h.lastCompletedDate);
        
        return {
          ...h,
          completed: !h.completed,
          // Increment streak only when completing for the first time today
          count: isCompletingToday ? h.count + 1 : h.count,
          // Set lastCompletedDate to today when marking as complete
          lastCompletedDate: !h.completed ? today : h.lastCompletedDate
        };
      }
      return h;
    });
    setHabits(updated);
    AsyncStorage.setItem('@habits_v3', JSON.stringify(updated));
  };

  const deleteHabit = (id: string) => {
    Animated.timing(habitDeleteAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      const updated = habits.filter(h => h.id !== id);
      setHabits(updated);
      AsyncStorage.setItem('@habits_v3', JSON.stringify(updated));
      setDeleteConfirmVisible(false);
      setHabitToDelete(null);
      habitDeleteAnim.setValue(1);
    });
  };

  const addHabit = () => {
    if (newHabitName.trim()) {
      const newHabit: Habit = {
        id: Date.now().toString(),
        name: newHabitName.trim(),
        completed: false,
        count: 0,
        iconName: selectedIcon.name,
        iconType: selectedIcon.type
      };
      const updated = [...habits, newHabit];
      setHabits(updated);
      AsyncStorage.setItem('@habits_v3', JSON.stringify(updated));
      setNewHabitName('');
      setIsAddingHabit(false);
    }
  };

  const renderHabitIcon = (iconName: string, iconType: string, color: string) => {
    if (iconType === 'MaterialIcons') return <MaterialIcons name={iconName as any} size={24} color={color} />;
    return <MaterialCommunityIcons name={iconName as any} size={24} color={color} />;
  };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  const completionRate = habits.length > 0 ? Math.round((habits.filter(h => h.completed).length / habits.length) * 100) : 0;

  const renderAnimatedSection = (index: number, children: React.ReactNode) => (
    <Animated.View style={{
      opacity: sectionAnims[index],
      transform: [{ translateY: slideAnims[index] }]
    }}>
      {children}
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

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

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={() => setThemeMode(isDark ? 'light' : 'dark')}
                  style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Ionicons name={isDark ? "sunny" : "moon"} size={22} color={colors.primary} />
                </Pressable>
                
              </View>
            </View>

            <View style={styles.greetingSection}>
              <Text style={styles.dateLabel}>{today}</Text>
              <Text style={styles.greetingTitle}>Rise & Execute.</Text>
              <Text style={styles.greetingSub}>
                {habits.filter(h => h.completed).length > 0
                  ? `${habits.filter(h => h.completed).length} of ${habits.length} rituals crushed today. Keep the streak alive.`
                  : habits.length > 0
                    ? `${habits.length} rituals await. Start strong.`
                    : 'Add your first ritual and build momentum.'}
              </Text>
            </View>
          </View>
        ))}

        {renderAnimatedSection(1, (
          <View style={styles.quoteCardWrapper}>
            <Animated.View
              {...panResponder.panHandlers}
              style={[styles.quoteCard, { transform: [{ translateX: quoteTranslateX }] }]}
            >
              <LinearGradient colors={[colors.primary, colors.primaryLight]} style={styles.quoteGradient}>
                <MaterialCommunityIcons name="format-quote-open" size={40} color="rgba(255,255,255,0.3)" />
                <Text style={styles.quoteText}>{quote.text}</Text>
                <Text style={styles.quoteAuthor}>— {quote.author}</Text>
              </LinearGradient>
            </Animated.View>
          </View>
        ))}

        {renderAnimatedSection(2, (
          <View style={styles.ritualsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Daily Habits</Text>
              <Text style={styles.sectionBadge}>{habits.filter(h => h.completed).length}/{habits.length} DONE</Text>
            </View>
            <View style={styles.habitsGrid}>
              {habits.map((habit) => (
                <Animated.View key={habit.id} style={{ transform: [{ scale: habitScale }], opacity: habitToDelete === habit.id ? habitDeleteAnim : 1 }}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.habitItem,
                      habit.completed && styles.habitItemCompleted,
                      { opacity: pressed ? 0.7 : (habit.completed ? 0.6 : 1) }
                    ]}
                    onPress={() => toggleHabit(habit.id)}
                    onLongPress={() => {
                      setHabitToDelete(habit.id);
                      setDeleteConfirmVisible(true);
                    }}
                  >
                    <View style={styles.habitMain}>
                      <View style={[styles.checkbox, habit.completed && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                        {habit.completed && <Ionicons name="checkmark" size={18} color={colors.white} />}
                      </View>
                      <View style={styles.habitIconContainer}>
                        {renderHabitIcon(habit.iconName, habit.iconType, colors.primary)}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.habitName, habit.completed && styles.habitNameCompleted]}>{habit.name}</Text>
                        <Text style={styles.habitMeta}>{habit.count} streak</Text>
                      </View>
                    </View>
                    <Pressable onPress={() => {
                      setHabitToDelete(habit.id);
                      setDeleteConfirmVisible(true);
                    }} style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.7 : 1 }]}>
                      <Ionicons name="close" size={18} color={colors.textVariant} />
                    </Pressable>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </View>
        ))}

        {renderAnimatedSection(3, (
          <Pressable
            style={({ pressed }) => [styles.weatherCard, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => updateWeatherByLocation(true)}
          >
            <View style={styles.weatherContent}>
              {isWeatherLoading && !weather ? (
                <View style={styles.weatherLoadingContainer}>
                  <ActivityIndicator color={colors.primary} size="small" />
                  <Text style={styles.loadingText}>Sensing Atmosphere...</Text>
                </View>
              ) : (
                <>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.cityText}>{weather?.desc || 'Atmosphere'}</Text>
                      <Ionicons name="location" size={18} color={colors.primary} />
                    </View>
                    <Text style={styles.weatherStatus}>{weather?.status || 'Setting focus...'}</Text>
                    <View style={styles.tempRow}>
                      <Text style={styles.tempText}>{weather ? weather.temp : '--'}°</Text>
                      <Text style={styles.tempUnit}>C</Text>
                    </View>
                  </View>
                  <Ionicons name={weather?.icon || "cloud-outline"} size={48} color={colors.secondary} />
                </>
              )}
            </View>
          </Pressable>
        ))}

        {renderAnimatedSection(4, (
          <View style={styles.metricsCard}>
            <Text style={styles.metricsTitle}>Focus Metrics</Text>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Ritual Completion</Text>
              <Text style={styles.metricValue}>{completionRate}%</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${completionRate}%`, backgroundColor: colors.primary }]} />
            </View>

            <View style={[styles.metricRow, { marginTop: 20 }]}>
              <Text style={styles.metricLabel}>Budget Health</Text>
              <Text style={[styles.metricValue, { color: budgetHealth.status === 'Critical' ? colors.error : (budgetHealth.status === 'Warning' ? colors.secondary : colors.tertiary) }]}>{budgetHealth.label}</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${budgetHealth.percentage}%`, backgroundColor: budgetHealth.status === 'Critical' ? colors.error : colors.tertiary }]} />
            </View>

            <View style={styles.metricsFooter}>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => navigation.navigate('Focus')}
              >
                <Text style={styles.primaryBtnText}>START FOCUS</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <View style={{ paddingVertical: 40, alignItems: 'center', opacity: 0.3 }}>
          <Text style={{ ...Typography.caption, color: colors.textVariant }}>
            MONOLITH {APP_VERSION} (BUILD {APP_BUILD})
          </Text>
        </View>
        <View style={{ height: 60 }} />
      </ScrollView>

      <Pressable
        style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.7 : 1 }]}
        onPress={() => setIsAddingHabit(true)}
      >
        <LinearGradient colors={[colors.primary, colors.primaryLight]} style={styles.fabInner}>
          <Ionicons name="add" size={32} color="#FFF" />
        </LinearGradient>
      </Pressable>

      <Modal visible={isAddingHabit} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Ritual</Text>
              <Pressable onPress={() => setIsAddingHabit(false)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name="close" size={24} color={colors.textVariant} />
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="e.g. Morning Meditation"
              placeholderTextColor={colors.textVariant}
              value={newHabitName}
              onChangeText={setNewHabitName}
              autoFocus
            />

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
                  onPress={() => setSelectedIcon(icon)}
                >
                  {renderHabitIcon(icon.name, icon.type, selectedIcon.name === icon.name ? colors.white : colors.primary)}
                </Pressable>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [styles.saveBtn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={addHabit}
            >
              <Text style={styles.saveBtnText}>Infuse into Rituals</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Delete Habit Confirmation Modal */}
      <Modal visible={deleteConfirmVisible} transparent animationType="fade">
        <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
          <View style={styles.modalContent}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.error + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                <MaterialCommunityIcons name="trash-can-outline" size={32} color={colors.error} />
              </View>
              <Text style={styles.modalTitle}>Remove Ritual?</Text>
              <Text style={[styles.saveBtnText, { color: colors.textVariant, marginTop: 12, fontSize: 15 }]}>This habit will be permanently removed from your daily rituals.</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <Pressable
                style={({ pressed }) => [
                  styles.saveBtn,
                  {
                    flex: 1,
                    backgroundColor: colors.surface,
                    opacity: pressed ? 0.7 : 1
                  }
                ]}
                onPress={() => setDeleteConfirmVisible(false)}
              >
                <Text style={[styles.saveBtnText, { color: colors.textVariant }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.saveBtn,
                  {
                    flex: 1,
                    backgroundColor: colors.error,
                    opacity: pressed ? 0.7 : 1
                  }
                ]}
                onPress={() => habitToDelete && deleteHabit(habitToDelete)}
              >
                <Text style={styles.saveBtnText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}


