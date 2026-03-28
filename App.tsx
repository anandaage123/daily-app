import React, { useEffect, useState, useRef } from 'react';
import { StatusBar, View, Text, Animated, StyleSheet, Easing, Dimensions, Platform } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import UpdateModal from './src/components/UpdateModal';
import { checkForUpdates, VersionManifest } from './src/services/UpdateService';

const { width, height } = Dimensions.get('window');

// Premium Dark Theme for Splash
const SPLASH_THEME = {
  bg: '#0F0E17',
  accent: '#4052B6',
  accentLight: '#8899FF',
  gold: '#765600',
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [updateManifest, setUpdateManifest] = useState<VersionManifest | null>(null);

  // Animation Refs
  const mainFade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const brandTranslateY = useRef(new Animated.Value(30)).current;
  const letterSpacing = useRef(new Animated.Value(15)).current;

  // Background Orbs
  const orb1Pos = useRef(new Animated.ValueXY({ x: -100, y: -100 })).current;
  const orb2Pos = useRef(new Animated.ValueXY({ x: width, y: height })).current;
  const orbOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Ambient Background Drifting
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(orb1Pos, {
            toValue: { x: width * 0.3, y: height * 0.2 },
            duration: 12000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(orb1Pos, {
            toValue: { x: -100, y: -100 },
            duration: 12000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          })
        ]),
        Animated.sequence([
          Animated.timing(orb2Pos, {
            toValue: { x: width * 0.2, y: height * 0.6 },
            duration: 15000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(orb2Pos, {
            toValue: { x: width, y: height },
            duration: 15000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          })
        ])
      ])
    ).start();

    // 2. Main Entrance Sequence
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(mainFade, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(orbOpacity, { toValue: 0.3, duration: 2500, useNativeDriver: true }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 8,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.timing(brandTranslateY, {
          toValue: 0,
          duration: 1500,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.timing(letterSpacing, {
          toValue: 2,
          duration: 2000,
          easing: Easing.out(Easing.exp),
          useNativeDriver: false,
        })
      ])
    ]).start();

    // 3. Exit Sequence
    const timer = setTimeout(() => {
      Animated.timing(mainFade, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start(async () => {
        setShowSplash(false);
        // Check for updates silently after splash — avoids blocking launch
        try {
          const manifest = await checkForUpdates();
          if (manifest) setUpdateManifest(manifest);
        } catch (_) {
          // Never let update check crash the app
        }
      });
    }, 4500);

    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={SPLASH_THEME.bg} translucent />

        {/* Cinematic Background Atmosphere (Contained) */}
        <Animated.View style={[
          styles.orb,
          {
            backgroundColor: SPLASH_THEME.accent,
            opacity: orbOpacity,
            transform: orb1Pos.getTranslateTransform()
          }
        ]} />
        <Animated.View style={[
          styles.orb,
          {
            width: width * 0.9,
            height: width * 0.9,
            backgroundColor: SPLASH_THEME.accentLight,
            opacity: Animated.multiply(orbOpacity, 0.4),
            transform: orb2Pos.getTranslateTransform()
          }
        ]} />

        {/* Branding Content */}
        <Animated.View style={[
          styles.content,
          {
            opacity: mainFade,
            transform: [
              { scale: logoScale },
              { translateY: brandTranslateY }
            ]
          }
        ]}>
          <View style={styles.headerDecoration}>
             <View style={styles.dash} />
             <Text style={styles.prefixText}>INNOVATED BY</Text>
             <View style={styles.dash} />
          </View>

          <View style={styles.nameWrapper}>
             <Animated.Text style={[styles.firstName, { letterSpacing }]}>
                ANAND
             </Animated.Text>
             <Animated.Text style={[styles.lastName, { letterSpacing }]}>
                AAGE
             </Animated.Text>
          </View>

          <View style={styles.footerDecoration}>
             <View style={styles.line} />
             <Text style={styles.tagline}>METHODIC MUSE SYSTEM</Text>
             <View style={styles.line} />
          </View>
        </Animated.View>

        {/* Border Accents - Purely Aesthetic */}
        <View style={styles.borderFrame} pointerEvents="none" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <AppNavigator />
      {updateManifest && (
        <UpdateModal
          manifest={updateManifest}
          onDismiss={() => setUpdateManifest(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SPLASH_THEME.bg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    // Android doesn't support blur natively on View, so we rely on large soft shapes and low opacity
    // On iOS, we could add a BlurView if expo-blur was available, but standard View is safer for compatibility.
  },
  content: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 30,
    zIndex: 10,
  },
  headerDecoration: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  dash: {
    width: 20,
    height: 1,
    backgroundColor: SPLASH_THEME.accentLight,
    opacity: 0.3,
  },
  prefixText: {
    color: SPLASH_THEME.accentLight,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 6,
    marginHorizontal: 15,
    opacity: 0.9,
  },
  nameWrapper: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  firstName: {
    color: '#FFFFFF',
    fontSize: width * 0.12,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: width * 0.14,
  },
  lastName: {
    color: SPLASH_THEME.accentLight,
    fontSize: width * 0.12,
    fontWeight: '200',
    textAlign: 'center',
    lineHeight: width * 0.14,
    marginTop: -5,
  },
  footerDecoration: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    width: '80%',
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tagline: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 3,
    marginHorizontal: 12,
    opacity: 0.5,
    textTransform: 'uppercase',
  },
  borderFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 20,
    borderColor: 'transparent',
    // Adds a subtle internal shadow feel if we wanted, but keeping it clean for now
  }
});
