import React, { useEffect, useState, useRef } from 'react';
import { StatusBar, View, Text, Animated, StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start fade in immediately
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 1000, useNativeDriver: true
    }).start(() => {
       // Hold for 1.5s then fade out
       Animated.timing(fadeAnim, {
          toValue: 0, duration: 800, delay: 1500, useNativeDriver: true
       }).start(() => setShowSplash(false));
    });
  }, []);

  if (showSplash) {
     return (
        <View style={styles.splashContainer}>
          <StatusBar hidden />
          <Animated.View style={{opacity: fadeAnim, alignItems: 'center'}}>
             <Text style={styles.splashText}>Innovated By</Text>
             <Text style={styles.splashTitle}>Anand Aage</Text>
          </Animated.View>
        </View>
     );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <AppNavigator />
    </>
  );
}

const styles = StyleSheet.create({
  splashContainer: { flex: 1, backgroundColor: '#F9F5FF', justifyContent: 'center', alignItems: 'center' },
  splashText: { color: '#5A5781', fontSize: 16, fontWeight: '600', marginBottom: 8, letterSpacing: 4, textTransform: 'uppercase' },
  splashTitle: { color: '#4052B6', fontSize: 42, fontWeight: 'bold', letterSpacing: 1 }
});
