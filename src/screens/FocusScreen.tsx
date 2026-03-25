import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Colors, Typography } from '../theme/Theme';
import { Ionicons } from '@expo/vector-icons';

export default function FocusScreen() {
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [progress] = useState(new Animated.Value(1));

  useEffect(() => {
    let interval: any;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleComplete();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: timeLeft / (mode === 'work' ? 25 * 60 : 5 * 60),
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [timeLeft]);

  const handleComplete = () => {
    setIsActive(false);
    if (mode === 'work') {
      setMode('break');
      setTimeLeft(5 * 60);
    } else {
      setMode('work');
      setTimeLeft(25 * 60);
    }
  };

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(mode === 'work' ? 25 * 60 : 5 * 60);
  };

  const switchMode = (m: 'work' | 'break') => {
    setIsActive(false);
    setMode(m);
    setTimeLeft(m === 'work' ? 25 * 60 : 5 * 60);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Focus Timer</Text>
      
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, mode === 'work' && styles.tabActive]} onPress={() => switchMode('work')}>
          <Text style={[styles.tabText, mode === 'work' && styles.tabTextActive]}>Work</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, mode === 'break' && styles.tabActive]} onPress={() => switchMode('break')}>
          <Text style={[styles.tabText, mode === 'break' && styles.tabTextActive]}>Break</Text>
        </TouchableOpacity>
      </View>

      <View style={{flexDirection: 'row', marginBottom: 20}}>
        {[15, 25, 50].map(min => (
           <TouchableOpacity key={min} onPress={() => { setIsActive(false); setTimeLeft(min * 60); }} style={{ marginHorizontal: 10 }}>
              <Text style={{color: Colors.textSecondary, fontWeight: 'bold'}}>{min} min</Text>
           </TouchableOpacity>
        ))}
      </View>

      <View style={styles.timerCircle}>
        <Animated.View style={[styles.progressBar, {
           height: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%']})
        }]} />
        <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
        <Text style={styles.modeText}>{mode === 'work' ? 'Deep Work' : 'Short Break'}</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.iconBtn} onPress={resetTimer}>
          <Ionicons name="refresh" size={30} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.playBtn} onPress={toggleTimer}>
          <Ionicons name={isActive ? "pause" : "play"} size={40} color={Colors.background} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={handleComplete}>
          <Ionicons name="play-skip-forward" size={30} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 20, paddingTop: 60, alignItems: 'center' },
  header: { ...Typography.header, marginBottom: 30, width: '100%', textAlign: 'left' },
  tabContainer: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, marginBottom: 50, padding: 5 },
  tab: { paddingVertical: 10, paddingHorizontal: 30, borderRadius: 8 },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { ...Typography.body, color: Colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: Colors.text },
  timerCircle: { width: 280, height: 280, borderRadius: 140, borderWidth: 4, borderColor: Colors.surfaceHighlight, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 50 },
  progressBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: Colors.primary + '30' },
  timerText: { fontSize: 64, fontWeight: '800', color: Colors.text, fontVariant: ['tabular-nums'] },
  modeText: { ...Typography.body, color: Colors.textSecondary, marginTop: 10, textTransform: 'uppercase', letterSpacing: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-evenly' },
  iconBtn: { padding: 15, borderRadius: 30, backgroundColor: Colors.surfaceHighlight },
  playBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 }
});
