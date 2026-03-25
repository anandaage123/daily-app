import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography } from '../theme/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';

interface Habit {
  id: string;
  name: string;
  completed: boolean;
  count: number;
}

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp<any>>();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  
  const [habitToDelete, setHabitToDelete] = useState<string | null>(null);

  // Weather & Quote State
  const [cityInput, setCityInput] = useState('');
  const [isCityModalVisible, setIsCityModalVisible] = useState(false);
  const [weather, setWeather] = useState<{temp: number, desc: string, icon: any} | null>(null);
  const [quote, setQuote] = useState({text: "The secret of getting ahead is getting started.", author: "Mark Twain"});

  useEffect(() => {
    loadHabits();
    loadDailyData();
  }, []);

  const loadHabits = async () => {
    try {
      const stored = await AsyncStorage.getItem('@habits_v2');
      if (stored) {
        setHabits(JSON.parse(stored));
      } else {
        const defaultHabits = [
          { id: '1', name: 'Drink Water', completed: false, count: 0 },
          { id: '2', name: 'Read 10 mins', completed: false, count: 0 },
        ];
        setHabits(defaultHabits);
      }
    } catch(e) {}
  };

  const loadDailyData = async () => {
    try {
      const lastFetch = await AsyncStorage.getItem('@quote_date');
      const todayStr = new Date().toDateString();
      if (lastFetch === todayStr) {
         const cached = await AsyncStorage.getItem('@quote_cache');
         if (cached) setQuote(JSON.parse(cached));
      } else {
         const res = await fetch('https://zenquotes.io/api/today');
         const data = await res.json();
         if(data && data[0]) {
           const newQ = {text: data[0].q, author: data[0].a};
           setQuote(newQ);
           await AsyncStorage.setItem('@quote_cache', JSON.stringify(newQ));
           await AsyncStorage.setItem('@quote_date', todayStr);
         }
      }
    } catch(e) { console.log('Quote fetch failed'); }

    try {
      const cachedCity = await AsyncStorage.getItem('@weather_city') || 'London';
      setCityInput(cachedCity);
      fetchWeather(cachedCity);
    } catch(e) {}
  };

  const fetchWeather = async (cityName: string) => {
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`);
      const geoData = await geoRes.json();
      
      if (geoData.results && geoData.results.length > 0) {
        const { latitude, longitude, name, country } = geoData.results[0];
        
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
        const weatherData = await weatherRes.json();
        const current = weatherData.current_weather;
        
        let iconStr = 'partly-sunny';
        if (current.weathercode === 0) iconStr = current.is_day ? 'sunny' : 'moon';
        else if (current.weathercode >= 60 && current.weathercode <= 69) iconStr = 'rainy';
        else if (current.weathercode >= 71 && current.weathercode <= 79) iconStr = 'snow';
        else if (current.weathercode >= 95) iconStr = 'thunderstorm';

        setWeather({ temp: Math.round(current.temperature), desc: `${name}, ${country}`, icon: iconStr });
        await AsyncStorage.setItem('@weather_city', cityName);
        setIsCityModalVisible(false);
      } else {
        setIsCityModalVisible(false);
      }
    } catch(e) {
      setIsCityModalVisible(false);
    }
  };

  const saveHabits = async (newHabits: Habit[]) => {
    setHabits(newHabits);
    try {
      await AsyncStorage.setItem('@habits_v2', JSON.stringify(newHabits));
    } catch(e) {}
  };

  const onSecretGesture = () => navigation.navigate('VaultSettingsAuth');

  const toggleHabit = (id: string) => {
    const updated = habits.map(h => {
      if (h.id === id) {
        return { ...h, completed: !h.completed, count: h.completed ? h.count - 1 : h.count + 1 };
      }
      return h;
    });
    saveHabits(updated);
  };

  const addHabit = () => {
    if (newHabitName.trim()) {
      const newHabit = { id: Date.now().toString(), name: newHabitName.trim(), completed: false, count: 0 };
      saveHabits([...habits, newHabit]);
      setNewHabitName('');
      setIsAddingHabit(false);
    }
  };

  const confirmDelete = () => {
    if (habitToDelete) {
      saveHabits(habits.filter(h => h.id !== habitToDelete));
      setHabitToDelete(null);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <View style={{flex: 1}}>
      <ScrollView style={styles.container}>
        <Pressable onLongPress={onSecretGesture} delayLongPress={2000} style={styles.headerArea}>
          <Text style={styles.dateText}>{today}</Text>
          <Text style={styles.greeting}>{getGreeting()}, Hero</Text>
        </Pressable>

        <View style={styles.quoteCard}>
          <Ionicons name="bulb-outline" size={24} color={Colors.primary} style={styles.quoteIcon} />
          <Text style={styles.quoteText}>"{quote.text}"</Text>
          <Text style={styles.quoteAuthor}>- {quote.author}</Text>
        </View>

        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
          <Text style={styles.sectionTitle}>Daily Habits</Text>
          <TouchableOpacity onPress={() => setIsAddingHabit(!isAddingHabit)}>
            <Ionicons name={isAddingHabit ? "close-circle" : "add-circle"} size={28} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {isAddingHabit && (
          <View style={styles.addHabitContainer}>
            <TextInput 
              style={styles.input} 
              placeholder="Type new habit & press enter..." 
              placeholderTextColor={Colors.textMuted}
              value={newHabitName}
              onChangeText={setNewHabitName}
              onSubmitEditing={addHabit}
              autoFocus
            />
          </View>
        )}

        <View style={styles.habitsContainer}>
          {habits.map((habit) => (
            <TouchableOpacity 
              key={habit.id} 
              style={[styles.habitCard, habit.completed && styles.habitCardCompleted]}
              onPress={() => toggleHabit(habit.id)}
              onLongPress={() => setHabitToDelete(habit.id)}
            >
              <View style={styles.habitCircle}>
                {habit.completed && <Ionicons name="checkmark" size={18} color={Colors.text} />}
              </View>
              <Text style={[styles.habitName, habit.completed && styles.habitNameCompleted]}>{habit.name}</Text>
            </TouchableOpacity>
          ))}
          {habits.length === 0 && <Text style={{color: Colors.textMuted, textAlign: 'center'}}>No habits added yet!</Text>}
        </View>
        
        <View style={styles.weatherWidget}>
           <View style={{flexDirection: 'row', alignItems: 'center'}}>
             <Ionicons name={weather?.icon || "partly-sunny"} size={40} color="#FFD700" />
             <View style={{marginLeft: 15}}>
               <Text style={styles.weatherTemp}>{weather ? `${weather.temp}°C` : '--°C'}</Text>
               <Text style={styles.weatherDesc}>{weather?.desc || 'Loading location...'}</Text>
             </View>
           </View>
           <TouchableOpacity onPress={() => setIsCityModalVisible(true)} style={styles.locationBtn}>
             <Ionicons name="location" size={22} color={Colors.text} />
           </TouchableOpacity>
        </View>
        
        <View style={{height: 40}} />
      </ScrollView>

      {/* Delete Habit Modal */}
      <Modal visible={!!habitToDelete} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="trash-outline" size={40} color={Colors.accent} style={{marginBottom: 10}} />
            <Text style={styles.modalTitle}>Delete Habit</Text>
            <Text style={styles.modalMessage}>Are you sure you want to completely remove this habit?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, {backgroundColor: Colors.surfaceHighlight}]} onPress={() => setHabitToDelete(null)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, {backgroundColor: Colors.accent}]} onPress={confirmDelete}>
                <Text style={styles.modalBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change City Modal */}
      <Modal visible={isCityModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="map-outline" size={40} color={Colors.primary} style={{marginBottom: 10}} />
            <Text style={styles.modalTitle}>Set Weather City</Text>
            <TextInput 
              style={[styles.input, { width: '100%', marginBottom: 20 }]} 
              placeholder="e.g. San Francisco, Tokyo" 
              placeholderTextColor={Colors.textMuted}
              value={cityInput}
              onChangeText={setCityInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, {backgroundColor: Colors.surfaceHighlight}]} onPress={() => setIsCityModalVisible(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, {backgroundColor: Colors.secondary}]} onPress={() => fetchWeather(cityInput)}>
                <Text style={styles.modalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 20, paddingTop: 60 },
  headerArea: { marginBottom: 30 },
  dateText: { ...Typography.caption, textTransform: 'uppercase', letterSpacing: 1.5, color: Colors.primary },
  greeting: { ...Typography.header, marginTop: 5 },
  quoteCard: { backgroundColor: Colors.surface, padding: 20, borderRadius: 16, marginBottom: 30, borderWidth: 1, borderColor: Colors.surfaceHighlight },
  quoteIcon: { marginBottom: 10 },
  quoteText: { ...Typography.body, fontStyle: 'italic', lineHeight: 24 },
  quoteAuthor: { ...Typography.caption, marginTop: 10, textAlign: 'right' },
  sectionTitle: { ...Typography.title },
  addHabitContainer: { marginBottom: 15 },
  input: { backgroundColor: Colors.background, color: Colors.text, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  habitsContainer: { marginBottom: 30 },
  habitCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  habitCardCompleted: { backgroundColor: '#1E4031', borderColor: Colors.secondary },
  habitCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.primary, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  habitName: { ...Typography.body },
  habitNameCompleted: { color: Colors.secondary, textDecorationLine: 'line-through' },
  weatherWidget: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surfaceHighlight, padding: 20, borderRadius: 16, marginBottom: 50 },
  weatherTemp: { ...Typography.title, fontSize: 24 },
  weatherDesc: { ...Typography.caption, marginTop: 4 },
  locationBtn: { padding: 10, backgroundColor: Colors.surface, borderRadius: 8 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.surface, padding: 25, borderRadius: 20, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  modalTitle: { ...Typography.title, marginBottom: 20 },
  modalMessage: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: 25 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalBtn: { flex: 1, padding: 15, borderRadius: 12, alignItems: 'center', marginHorizontal: 5 },
  modalBtnText: { color: Colors.text, fontWeight: '700' }
});
