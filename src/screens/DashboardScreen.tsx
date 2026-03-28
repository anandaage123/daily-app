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
import { MM_Colors, Typography, Shadows, Spacing } from '../theme/Theme';

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
}

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp<any>>();
  const isFocused = useIsFocused();

  // State
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(HABIT_ICONS[0]);
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Weather & Quote State
  const [weather, setWeather] = useState<{ temp: number, desc: string, icon: any, status: string } | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [quote, setQuote] = useState({ text: "Crafting your morning inspiration...", author: "Methodic Muse" });
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

      if (cachedHabits) setHabits(JSON.parse(cachedHabits));
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

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadHabitsFromStorage(), updateWeatherByLocation(true), fetchNewQuote(), loadBudgetMetrics()]);
    setRefreshing(false);
  }, []);

  const loadHabitsFromStorage = async () => {
    try {
      const stored = await AsyncStorage.getItem('@habits_v3');
      if (stored) setHabits(JSON.parse(stored));
    } catch (e) { }
  };

  const loadBudgetMetrics = async () => {
    try {
      const storedExpenses = await AsyncStorage.getItem('@daily_expenses_v2');
      const storedLimit = await AsyncStorage.getItem('@budget_limit_v2');

      const expenses = storedExpenses ? JSON.parse(storedExpenses) : [];
      const limit = storedLimit ? parseFloat(storedLimit) : 4500;

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

    const updated = habits.map(h => {
      if (h.id === id) return { ...h, completed: !h.completed, count: h.completed ? Math.max(0, h.count - 1) : h.count + 1 };
      return h;
    });
    setHabits(updated);
    AsyncStorage.setItem('@habits_v3', JSON.stringify(updated));
  };

  const deleteHabit = (id: string) => {
    const updated = habits.filter(h => h.id !== id);
    setHabits(updated);
    AsyncStorage.setItem('@habits_v3', JSON.stringify(updated));
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MM_Colors.primary} />
        }
      >

        {renderAnimatedSection(0, (
          <View style={styles.headerBlock}>
            <View style={styles.topHeader}>
              <Pressable
                onLongPress={() => navigation.navigate('VaultSettingsAuth')}
                delayLongPress={2000}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={styles.logoText}>Methodic Muse</Text>
              </Pressable>
            </View>

            <View style={styles.greetingSection}>
              <Text style={styles.dateLabel}>{today}</Text>
              <Text style={styles.greetingTitle}>Rise & Execute,Hero.</Text>
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
              <LinearGradient colors={[MM_Colors.primary, MM_Colors.primaryLight]} style={styles.quoteGradient}>
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
              <Text style={styles.sectionTitle}>Rituals</Text>
              <Text style={styles.sectionBadge}>{habits.filter(h => h.completed).length}/{habits.length} DONE</Text>
            </View>
            <View style={styles.habitsGrid}>
              {habits.map((habit) => (
                <Animated.View key={habit.id} style={{ transform: [{ scale: habitScale }] }}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.habitItem,
                      habit.completed && styles.habitItemCompleted,
                      { opacity: pressed ? 0.7 : (habit.completed ? 0.6 : 1) }
                    ]}
                    onPress={() => toggleHabit(habit.id)}
                    onLongPress={() => deleteHabit(habit.id)}
                  >
                    <View style={styles.habitMain}>
                      <View style={[styles.checkbox, habit.completed && { backgroundColor: MM_Colors.primary, borderColor: MM_Colors.primary }]}>
                        {habit.completed && <Ionicons name="checkmark" size={18} color={MM_Colors.white} />}
                      </View>
                      <View style={styles.habitIconContainer}>
                        {renderHabitIcon(habit.iconName, habit.iconType, MM_Colors.primary)}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.habitName, habit.completed && styles.habitNameCompleted]}>{habit.name}</Text>
                        <Text style={styles.habitMeta}>{habit.count} streak</Text>
                      </View>
                    </View>
                    <Pressable onPress={() => deleteHabit(habit.id)} style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.7 : 1 }]}>
                      <Ionicons name="close" size={18} color={MM_Colors.textVariant} />
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
            onLongPress={() => updateWeatherByLocation(true)}
            delayLongPress={1000}
          >
            <View style={styles.weatherContent}>
              {isWeatherLoading && !weather ? (
                <View style={styles.weatherLoadingContainer}>
                  <ActivityIndicator color={MM_Colors.primary} size="small" />
                  <Text style={styles.loadingText}>Sensing Atmosphere...</Text>
                </View>
              ) : (
                <>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.cityText}>{weather?.desc || 'Atmosphere'}</Text>
                      <Ionicons name="location" size={18} color={MM_Colors.primary} />
                    </View>
                    <Text style={styles.weatherStatus}>{weather?.status || 'Setting focus...'}</Text>
                    <View style={styles.tempRow}>
                      <Text style={styles.tempText}>{weather ? weather.temp : '--'}°</Text>
                      <Text style={styles.tempUnit}>C</Text>
                    </View>
                  </View>
                  <Ionicons name={weather?.icon || "cloud-outline"} size={48} color={MM_Colors.secondary} />
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
              <View style={[styles.progressFill, { width: `${completionRate}%`, backgroundColor: MM_Colors.primary }]} />
            </View>

            <View style={[styles.metricRow, { marginTop: 20 }]}>
              <Text style={styles.metricLabel}>Budget Health</Text>
              <Text style={[styles.metricValue, { color: budgetHealth.status === 'Critical' ? MM_Colors.error : (budgetHealth.status === 'Warning' ? MM_Colors.secondary : MM_Colors.tertiary) }]}>{budgetHealth.label}</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${budgetHealth.percentage}%`, backgroundColor: budgetHealth.status === 'Critical' ? MM_Colors.error : MM_Colors.tertiary }]} />
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

        <View style={{ height: 100 }} />
      </ScrollView>

      <Pressable
        style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.7 : 1 }]}
        onPress={() => setIsAddingHabit(true)}
      >
        <LinearGradient colors={[MM_Colors.primary, MM_Colors.primaryLight]} style={styles.fabInner}>
          <Ionicons name="add" size={32} color="#FFF" />
        </LinearGradient>
      </Pressable>

      <Modal visible={isAddingHabit} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Ritual</Text>
              <Pressable onPress={() => setIsAddingHabit(false)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name="close" size={24} color={MM_Colors.textVariant} />
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="e.g. Morning Meditation"
              placeholderTextColor={MM_Colors.textVariant}
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
                  {renderHabitIcon(icon.name, icon.type, selectedIcon.name === icon.name ? MM_Colors.white : MM_Colors.primary)}
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

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MM_Colors.background },
  scrollContent: { padding: Spacing.padding, paddingTop: Platform.OS === 'ios' ? 70 : (StatusBar.currentHeight || 0) + 20 },

  headerBlock: { marginBottom: 32 },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  logoText: { ...Typography.title, color: MM_Colors.primary, fontWeight: '800' },

  greetingSection: {},
  dateLabel: { ...Typography.caption, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' },
  greetingTitle: { ...Typography.header, letterSpacing: -1.5, lineHeight: 40 },
  greetingSub: { ...Typography.body, color: MM_Colors.textVariant, marginTop: 12, maxWidth: '90%' },

  quoteCardWrapper: { marginBottom: 40 },
  quoteCard: { width: '100%', borderRadius: 24, ...Shadows.soft, overflow: 'hidden' },
  quoteGradient: { padding: 24 },
  quoteText: { ...Typography.title, color: MM_Colors.white, lineHeight: 28 },
  quoteAuthor: { ...Typography.body, color: MM_Colors.white, opacity: 0.8, marginTop: 12, fontSize: 15 },

  ritualsContainer: { marginBottom: 40 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 },
  sectionTitle: { ...Typography.header, fontSize: 24 },
  sectionBadge: { ...Typography.caption, color: MM_Colors.primary, fontWeight: '800' },

  habitsGrid: { gap: 12 },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MM_Colors.white,
    padding: 16,
    borderRadius: Spacing.borderRadius,
    ...Shadows.soft,
  },
  habitItemCompleted: { opacity: 0.6 },
  habitMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: MM_Colors.surfaceContainer, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  habitIconContainer: { width: 40, height: 40, borderRadius: 10, backgroundColor: MM_Colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  habitName: { ...Typography.body, fontWeight: '600' },
  habitNameCompleted: { textDecorationLine: 'line-through', color: MM_Colors.textVariant },
  habitMeta: { ...Typography.caption, marginTop: 1 },
  deleteBtn: { padding: 4 },

  weatherCard: { backgroundColor: MM_Colors.white, borderRadius: 24, padding: 20, marginBottom: 40, ...Shadows.soft },
  weatherContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weatherLoadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { ...Typography.caption, color: MM_Colors.primary },
  cityText: { ...Typography.title, fontSize: 18 },
  weatherStatus: { ...Typography.caption, marginTop: 2 },
  tempRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 12 },
  tempText: { ...Typography.header, fontSize: 44 },
  tempUnit: { ...Typography.title, marginLeft: 2, color: MM_Colors.textVariant },

  metricsCard: { backgroundColor: MM_Colors.white, borderRadius: 24, padding: 24, marginBottom: 20, ...Shadows.soft },
  metricsTitle: { ...Typography.title, marginBottom: 20 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  metricLabel: { ...Typography.body, fontSize: 15, color: MM_Colors.textVariant },
  metricValue: { ...Typography.body, fontWeight: '700' },
  progressBg: { height: 6, backgroundColor: MM_Colors.background, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  metricsFooter: { flexDirection: 'row', marginTop: 24 },
  primaryBtn: { flex: 1, height: 50, borderRadius: 25, backgroundColor: MM_Colors.primary, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: '#FFF', fontWeight: '700', letterSpacing: 0.5 },

  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, ...Shadows.soft },
  fabInner: { width: '100%', height: '100%', borderRadius: 30, justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 24, width: '100%', ...Shadows.soft },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { ...Typography.title },
  label: { ...Typography.caption, fontWeight: '700', marginBottom: 12, marginTop: 12 },
  input: { borderBottomWidth: 1, borderBottomColor: MM_Colors.surfaceContainer, paddingVertical: 8, ...Typography.body, marginBottom: 24 },
  iconPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  iconBox: { width: 44, height: 44, borderRadius: 10, backgroundColor: MM_Colors.background, justifyContent: 'center', alignItems: 'center' },
  iconBoxSelected: { backgroundColor: MM_Colors.primary },
  saveBtn: { backgroundColor: MM_Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});
