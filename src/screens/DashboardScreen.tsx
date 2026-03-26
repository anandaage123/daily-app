import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  Dimensions,
  Platform,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, NavigationProp, useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

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
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(HABIT_ICONS[0]);
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const habitScale = useRef(new Animated.Value(1)).current;

  // Weather & Quote State
  const [weather, setWeather] = useState<{temp: number, desc: string, icon: any, status: string} | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [quote, setQuote] = useState({ text: "Loading inspiration...", author: "The Muse" });

  // Metrics State
  const [budgetHealth, setBudgetHealth] = useState({ label: 'Calculating...', percentage: 0, status: 'Normal' });

  useEffect(() => {
    loadHabits();
    updateWeatherByLocation(false);
    loadDailyQuote();

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true })
    ]).start();
  }, []);

  useEffect(() => {
    if (isFocused) {
      loadBudgetMetrics();
      updateWeatherByLocation(false);
    }
  }, [isFocused]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadHabits(), updateWeatherByLocation(true), loadDailyQuote(true), loadBudgetMetrics()]);
    setRefreshing(false);
  }, []);

  const loadHabits = async () => {
    try {
      const stored = await AsyncStorage.getItem('@habits_v3');
      if (stored) setHabits(JSON.parse(stored));
      else {
        const defaultHabits = [
          { id: '1', name: 'Meditation', completed: true, count: 1, iconName: 'self-improvement', iconType: 'MaterialIcons' },
          { id: '2', name: 'Hydration', completed: false, count: 0, iconName: 'water', iconType: 'MaterialCommunityIcons' },
          { id: '3', name: 'Reading', completed: false, count: 0, iconName: 'book-open-variant', iconType: 'MaterialCommunityIcons' },
        ];
        setHabits(defaultHabits);
        await AsyncStorage.setItem('@habits_v3', JSON.stringify(defaultHabits));
      }
    } catch(e) {}
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
    } catch (e) {
      console.log('Error loading budget metrics', e);
    }
  };

  const loadDailyQuote = async (forceRefresh = false) => {
    try {
      const today = new Date().toDateString();
      const storedDate = await AsyncStorage.getItem('@quote_date');
      const storedQuote = await AsyncStorage.getItem('@daily_quote');

      if (!forceRefresh && storedDate === today && storedQuote) {
        setQuote(JSON.parse(storedQuote));
      } else {
        const response = await fetch('https://dummyjson.com/quotes/random');
        const data = await response.json();
        const newQuote = { text: data.quote, author: data.author };
        setQuote(newQuote);
        await AsyncStorage.setItem('@quote_date', today);
        await AsyncStorage.setItem('@daily_quote', JSON.stringify(newQuote));
      }
    } catch (error) {
      const randomFallback = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
      setQuote(randomFallback);
    }
  };

  const updateWeatherByLocation = async (manual: boolean = false) => {
    setIsWeatherLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (manual) Alert.alert('Permission Required', 'Please enable location permissions to see local weather.');
        setIsWeatherLoading(false);
        return;
      }

      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        if (manual) {
            Alert.alert(
                'Location Disabled',
                'Please turn on your device GPS to refresh weather.',
                [{ text: 'OK' }]
            );
        }
        setIsWeatherLoading(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = location.coords;
      const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      const cityName = reverseGeocode[0]?.city || reverseGeocode[0]?.subregion || reverseGeocode[0]?.region || 'Current Location';

      await fetchWeatherByCoords(latitude, longitude, cityName);
    } catch (error) {
      console.log('Weather location error:', error);
      setIsWeatherLoading(false);
    }
  };

  const fetchWeatherByCoords = async (lat: number, lon: number, cityName: string) => {
    try {
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
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
    } catch (e) {
      console.log('Weather fetch error:', e);
    } finally {
      setIsWeatherLoading(false);
    }
  };

  const getWeatherStatus = (code: number) => {
    if (code === 0) return 'Clear Sky';
    if (code >= 1 && code <= 3) return 'Partly Cloudy';
    if (code >= 45 && code <= 48) return 'Foggy';
    if (code >= 51 && code <= 67) return 'Rainy';
    if (code >= 71 && code <= 77) return 'Snowy';
    if (code >= 80) return 'Stormy';
    return 'Mostly Clear';
  };

  const toggleHabit = (id: string) => {
    Animated.sequence([
      Animated.timing(habitScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.spring(habitScale, { toValue: 1, friction: 4, useNativeDriver: true })
    ]).start();

    const updated = habits.map(h => {
      if (h.id === id) return { ...h, completed: !h.completed, count: h.completed ? h.count - 1 : h.count + 1 };
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

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[MM_Colors.primary]} tintColor={MM_Colors.primary} />
        }
      >

        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.profileRow}
            onLongPress={() => navigation.navigate('VaultSettingsAuth')}
            delayLongPress={2000}
          >
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200' }}
                style={styles.avatar}
              />
            </View>
            <Text style={styles.logoText}>The Methodic Muse</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.greetingSection}>
          <Text style={styles.dateLabel}>{today}</Text>
          <Text style={styles.greetingTitle}>Good morning,{"\n"}Hero.</Text>
          <Text style={styles.greetingSub}>Your focus today is sharp. You have {habits.filter(h => !h.completed).length} rituals awaiting your rhythm.</Text>
        </View>

        <View style={styles.quoteCardWrapper}>
          <LinearGradient colors={[MM_Colors.primary, MM_Colors.primaryLight]} style={styles.quoteCard}>
            <MaterialCommunityIcons name="format-quote-open" size={40} color="rgba(255,255,255,0.3)" />
            <Text style={styles.quoteText}>{quote.text}</Text>
            <Text style={styles.quoteAuthor}>— {quote.author}</Text>
          </LinearGradient>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Daily Rituals</Text>
          <Text style={styles.sectionBadge}>{habits.filter(h => h.completed).length} OF {habits.length} DONE</Text>
        </View>

        <View style={styles.habitsGrid}>
          {habits.map((habit) => (
            <Animated.View key={habit.id} style={{ transform: [{ scale: habitScale }] }}>
              <TouchableOpacity
                style={[styles.habitItem, habit.completed && styles.habitItemCompleted]}
                onPress={() => toggleHabit(habit.id)}
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
                    <Text style={styles.habitMeta}>{habit.count} streak • Daily</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => deleteHabit(habit.id)} style={styles.deleteBtn}>
                  <Ionicons name="close" size={20} color={MM_Colors.textVariant} />
                </TouchableOpacity>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.weatherCard}
          onLongPress={() => updateWeatherByLocation(true)}
          delayLongPress={1000}
          activeOpacity={0.9}
        >
          <View style={styles.weatherContent}>
            {isWeatherLoading && !weather ? (
              <ActivityIndicator color={MM_Colors.primary} size="large" />
            ) : (
              <>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.cityText}>{weather?.desc || 'Welcome'}</Text>
                      <Ionicons name="location" size={18} color={MM_Colors.primary} />
                  </View>
                  <Text style={styles.weatherStatus}>{weather?.status || 'Setting up weather...'}</Text>
                  <View style={styles.tempRow}>
                    <Text style={styles.tempText}>{weather ? weather.temp : '--'}°</Text>
                    <Text style={styles.tempUnit}>C</Text>
                  </View>
                </View>
                <Ionicons name={weather?.icon || "cloud-outline"} size={48} color={MM_Colors.secondary} />
              </>
            )}
          </View>
          <View style={styles.weatherDecoration} />
        </TouchableOpacity>

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
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Focus')}>
              <Text style={styles.primaryBtnText}>START SESSION</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreBtn}>
               <Ionicons name="ellipsis-vertical" size={20} color={MM_Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setIsAddingHabit(true)}
      >
        <LinearGradient colors={[MM_Colors.primary, MM_Colors.primaryLight]} style={styles.fabInner}>
          <Ionicons name="add" size={32} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={isAddingHabit} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
               <Text style={styles.modalTitle}>New Ritual</Text>
               <TouchableOpacity onPress={() => setIsAddingHabit(false)}>
                 <Ionicons name="close" size={24} color={MM_Colors.textVariant} />
               </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="e.g. 15m Meditation"
              placeholderTextColor={MM_Colors.textVariant}
              value={newHabitName}
              onChangeText={setNewHabitName}
              autoFocus
            />

            <Text style={styles.label}>CHOOSE ICON</Text>
            <View style={styles.iconPicker}>
              {HABIT_ICONS.map((icon, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.iconBox, selectedIcon.name === icon.name && styles.iconBoxSelected]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  {renderHabitIcon(icon.name, icon.type, selectedIcon.name === icon.name ? MM_Colors.white : MM_Colors.primary)}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={addHabit}>
              <Text style={styles.saveBtnText}>Add Ritual</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MM_Colors.background },
  scrollContent: { padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40 },

  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: MM_Colors.surfaceContainer, overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
  logoText: { marginLeft: 12, fontSize: 18, fontWeight: '800', color: MM_Colors.primary, letterSpacing: -0.5 },

  greetingSection: { marginBottom: 32 },
  dateLabel: { fontSize: 12, fontWeight: '700', color: MM_Colors.textVariant, letterSpacing: 1.5, marginBottom: 8 },
  greetingTitle: { fontSize: 44, fontWeight: '800', color: MM_Colors.text, letterSpacing: -2, lineHeight: 46 },
  greetingSub: { fontSize: 16, color: MM_Colors.textVariant, marginTop: 12, lineHeight: 24, maxWidth: '85%' },

  weatherCard: { backgroundColor: '#E9E5FF', borderRadius: 32, padding: 28, marginBottom: 40, overflow: 'hidden', minHeight: 160, justifyContent: 'center' },
  weatherContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cityText: { fontSize: 20, fontWeight: '700', color: MM_Colors.text },
  weatherStatus: { fontSize: 14, fontWeight: '600', color: MM_Colors.textVariant, marginTop: 2 },
  tempRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 16 },
  tempText: { fontSize: 52, fontWeight: '800', color: MM_Colors.text, letterSpacing: -2 },
  tempUnit: { fontSize: 18, fontWeight: '700', color: MM_Colors.textVariant, marginLeft: 2 },
  weatherDecoration: { position: 'absolute', bottom: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255, 202, 83, 0.2)', blurRadius: 40 },

  quoteCardWrapper: { marginBottom: 40 },
  quoteCard: { padding: 32, borderRadius: 32, elevation: 10, shadowColor: MM_Colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  quoteText: { fontSize: 24, fontWeight: '700', color: MM_Colors.white, letterSpacing: -0.5, lineHeight: 32, marginTop: -10 },
  quoteAuthor: { fontSize: 16, color: MM_Colors.white, opacity: 0.7, marginTop: 16, fontWeight: '600' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 },
  sectionTitle: { fontSize: 26, fontWeight: '800', color: MM_Colors.text },
  sectionBadge: { fontSize: 10, fontWeight: '800', color: MM_Colors.primary, letterSpacing: 1.5 },

  habitsGrid: { gap: 12, marginBottom: 40 },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MM_Colors.white,
    padding: 20,
    borderRadius: 24,
    marginBottom: 0,
    shadowColor: '#2C2A51',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2
  },
  habitItemCompleted: { opacity: 0.6 },
  habitMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 28, height: 28, borderRadius: 10, borderWidth: 2, borderColor: MM_Colors.surfaceContainer, marginRight: 16, justifyContent: 'center', alignItems: 'center' },
  habitIconContainer: { width: 40, height: 40, borderRadius: 12, backgroundColor: MM_Colors.surfaceContainer, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  habitName: { fontSize: 18, fontWeight: '700', color: MM_Colors.text },
  habitNameCompleted: { textDecorationLine: 'line-through', color: MM_Colors.textVariant },
  habitMeta: { fontSize: 13, color: MM_Colors.textVariant, marginTop: 2 },
  deleteBtn: { padding: 4 },

  metricsCard: { backgroundColor: '#E3DFFF', borderRadius: 32, padding: 32, marginBottom: 20 },
  metricsTitle: { fontSize: 22, fontWeight: '700', color: MM_Colors.text, marginBottom: 24 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  metricLabel: { fontSize: 15, fontWeight: '600', color: MM_Colors.text },
  metricValue: { fontSize: 22, fontWeight: '800', color: MM_Colors.text },
  progressBg: { height: 10, backgroundColor: MM_Colors.white, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  metricsFooter: { flexDirection: 'row', marginTop: 32, gap: 12 },
  primaryBtn: { flex: 1, height: 60, borderRadius: 30, backgroundColor: MM_Colors.primary, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: '#FFF', fontWeight: '800', letterSpacing: 1 },
  moreBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: MM_Colors.white, justifyContent: 'center', alignItems: 'center' },

  fab: { position: 'absolute', bottom: 40, right: 24, width: 72, height: 72, borderRadius: 28, elevation: 8, shadowColor: MM_Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15 },
  fabInner: { width: '100%', height: '100%', borderRadius: 28, justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(44, 42, 81, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 32, padding: 32, width: '100%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: MM_Colors.text },
  label: { fontSize: 12, fontWeight: '800', color: MM_Colors.textVariant, letterSpacing: 1, marginBottom: 12, marginTop: 12 },
  input: { borderBottomWidth: 1, borderBottomColor: MM_Colors.surfaceContainer, paddingVertical: 12, fontSize: 18, color: MM_Colors.text, marginBottom: 24 },
  iconPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  iconBox: { width: 50, height: 50, borderRadius: 15, backgroundColor: MM_Colors.background, justifyContent: 'center', alignItems: 'center' },
  iconBoxSelected: { backgroundColor: MM_Colors.primary },
  saveBtn: { backgroundColor: MM_Colors.primary, padding: 18, borderRadius: 20, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
