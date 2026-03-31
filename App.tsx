import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  StatusBar,
  View,
  Text,
  Animated,
  StyleSheet,
  Easing,
  Dimensions,
  AppState,
  Pressable,
  Platform,
  TouchableOpacity,
} from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import UpdateModal from './src/components/UpdateModal';
import { ThemeProvider } from './src/context/ThemeContext';
import { checkForUpdates, VersionManifest } from './src/services/UpdateService';
import { scaleFontSize } from './src/utils/ResponsiveSize';

const { width, height } = Dimensions.get('window');

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  bg: '#080612',
  accent: '#5B4FE8',
  accentMid: '#8B7FF5',
  accentLight: '#C4BDFF',
  gold: '#E8C547',
  white: '#FFFFFF',
  muted: 'rgba(196, 189, 255, 0.45)',
  border: 'rgba(139, 127, 245, 0.2)',
  rose: '#FF6B9D',
  roseDim: '#C44B73',
  roseFaint: 'rgba(255,107,157,0.12)',
  blush: '#FFB3C6',
  roseDeep: '#8B1A4A',
};

// ─────────────────────────────────────────────────────────────────────────────
// OrbitalArc
// ─────────────────────────────────────────────────────────────────────────────
function OrbitalArc({
  size, thickness = 1.5, color, duration, reverse = false,
}: {
  size: number; thickness?: number; color: string;
  duration: number; reverse?: boolean;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1, duration, easing: Easing.linear, useNativeDriver: true,
      }),
    ).start();
  }, []);
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'],
  });
  return (
    <Animated.View
      style={{
        position: 'absolute', width: size, height: size,
        borderRadius: size / 2, borderWidth: thickness,
        borderColor: color,
        borderTopColor: 'transparent', borderRightColor: 'transparent',
        borderBottomColor: color, borderLeftColor: 'transparent',
        transform: [{ rotate }],
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StarField
// ─────────────────────────────────────────────────────────────────────────────
const STARS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: Math.random() * width,
  y: Math.random() * height,
  size: Math.random() * 2 + 0.5,
  op: Math.random() * 0.4 + 0.1,
  dur: 1500 + Math.random() * 2500,
}));

function TwinklingStar({ star }: { star: typeof STARS[0] }) {
  const anim = useRef(new Animated.Value(star.op)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: star.op * 0.15, duration: star.dur,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: star.op, duration: star.dur,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.View
      style={{
        position: 'absolute', left: star.x, top: star.y,
        width: star.size, height: star.size,
        borderRadius: star.size / 2,
        backgroundColor: T.accentLight,
        opacity: anim,
      }}
    />
  );
}

function StarField({ opacity }: { opacity: Animated.Value }) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {STARS.map((s) => <TwinklingStar key={s.id} star={s} />)}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GlowOrb
// ─────────────────────────────────────────────────────────────────────────────
function GlowOrb({
  cx, cy, size, color, opacity, dur,
}: {
  cx: number; cy: number; size: number; color: string; opacity: number; dur: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.18, duration: dur,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1, duration: dur,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: cx - size / 2, top: cy - size / 2,
        width: size, height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity, transform: [{ scale }],
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CornerBracket
// ─────────────────────────────────────────────────────────────────────────────
function CornerBracket({
  pos, size = 18, color, opacity,
}: {
  pos: 'tl' | 'tr' | 'bl' | 'br';
  size?: number; color: string; opacity: Animated.Value;
}) {
  const abs: Record<string, number> = {};
  if (pos === 'tl' || pos === 'bl') abs.left = 0; else abs.right = 0;
  if (pos === 'tl' || pos === 'tr') abs.top = 0; else abs.bottom = 0;
  const sx = pos === 'tr' || pos === 'br' ? -1 : 1;
  const sy = pos === 'bl' || pos === 'br' ? -1 : 1;
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: size, opacity },
        abs,
        { transform: [{ scaleX: sx }, { scaleY: sy }] },
      ]}
    >
      <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: 1, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: 0, left: 0, width: 1, height: size, backgroundColor: color }} />
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SeekBar
// ─────────────────────────────────────────────────────────────────────────────
function SeekBar({ progress }: { progress: Animated.Value }) {
  const barWidth = progress.interpolate({
    inputRange: [0, 1], outputRange: ['0%', '100%'],
  });
  return (
    <View style={styles.seekBarTrack}>
      <Animated.View style={[styles.seekBarFill, { width: barWidth }]} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EnterButton
// ─────────────────────────────────────────────────────────────────────────────
function EnterButton({ onPress, visible }: { onPress: () => void; visible: Animated.Value }) {
  const ripple = useRef(new Animated.Value(0)).current;
  const rippleOp = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const borderGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(borderGlow, {
          toValue: 1, duration: 1800,
          easing: Easing.inOut(Easing.sin), useNativeDriver: false,
        }),
        Animated.timing(borderGlow, {
          toValue: 0, duration: 1800,
          easing: Easing.inOut(Easing.sin), useNativeDriver: false,
        }),
      ]),
    ).start();
  }, []);

  const handlePressIn = () =>
    Animated.spring(pressScale, {
      toValue: 0.93, useNativeDriver: true, tension: 200, friction: 10,
    }).start();

  const handlePressOut = () =>
    Animated.spring(pressScale, {
      toValue: 1, useNativeDriver: true, tension: 200, friction: 10,
    }).start();

  const handlePress = () => {
    ripple.setValue(0);
    rippleOp.setValue(0.5);
    Animated.parallel([
      Animated.timing(ripple, {
        toValue: 1, duration: 480,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(rippleOp, {
        toValue: 0, duration: 480, useNativeDriver: true,
      }),
    ]).start(() => onPress());
  };

  const rippleScale = ripple.interpolate({
    inputRange: [0, 1], outputRange: [0.2, 2.4],
  });
  const borderColor = borderGlow.interpolate({
    inputRange: [0, 1], outputRange: [T.border, T.accentMid],
  });

  return (
    <Animated.View style={{ opacity: visible, transform: [{ scale: pressScale }] }}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{ alignItems: 'center' }}
      >
        <Animated.View style={[styles.enterBtn, { borderColor }]}>
          <Animated.View
            style={[styles.ripple, { opacity: rippleOp, transform: [{ scale: rippleScale }] }]}
          />
          <View style={styles.enterBtnInner}>
            <View style={styles.chevronLeft} />
            <Text style={styles.enterBtnText}>ENTER</Text>
            <View style={styles.chevronRight} />
          </View>
        </Animated.View>
        <Text style={styles.enterSubtext}>tap to continue</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FloatingHeart — rises from bottom with drift
// ─────────────────────────────────────────────────────────────────────────────
function FloatingHeart({ x, delay, size = 18 }: { x: number; delay: number; size?: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.3 + Math.random() * 0.7)).current;

  useEffect(() => {
    const drift = (Math.random() - 0.5) * 60;
    const run = () => {
      translateY.setValue(0);
      translateX.setValue(0);
      opacity.setValue(0);
      Animated.sequence([
        Animated.delay(delay + Math.random() * 400),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.85, duration: 400, useNativeDriver: true }),
          Animated.timing(translateY, {
            toValue: -(height * 0.7 + Math.random() * 100),
            duration: 3200 + Math.random() * 1600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: drift,
            duration: 3200 + Math.random() * 1600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start(() => setTimeout(run, Math.random() * 800 + 200));
    };
    run();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', bottom: 80, left: x,
        opacity, transform: [{ translateY }, { translateX }, { scale }],
      }}
    >
      <Text style={{ fontSize: size, color: T.rose }}>♥</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LetterReveal — staggered per-letter spring entrance
// ─────────────────────────────────────────────────────────────────────────────
function LetterReveal({
  text, style, baseDelay = 0, color,
}: {
  text: string; style?: object; baseDelay?: number; color?: string;
}) {
  const letters = text.split('');
  const anims = useRef(letters.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.sequence([
        Animated.delay(baseDelay + i * 100),
        Animated.spring(anim, { toValue: 1, tension: 70, friction: 7, useNativeDriver: true }),
      ]),
    );
    Animated.parallel(animations).start();
  }, []);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'nowrap' }}>
      {letters.map((letter, i) => {
        const translateY = anims[i].interpolate({
          inputRange: [0, 1], outputRange: [40, 0],
        });
        const scale = anims[i].interpolate({
          inputRange: [0, 0.6, 1], outputRange: [0.5, 1.15, 1],
        });
        return (
          <Animated.Text
            key={i}
            style={[style, color ? { color } : {}, { opacity: anims[i], transform: [{ translateY }, { scale }] }]}
          >
            {letter === ' ' ? '\u00A0' : letter}
          </Animated.Text>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PulsingRing — expands outward and fades, like a sonar ping
// ─────────────────────────────────────────────────────────────────────────────
function PulsingRing({ delay, color }: { delay: number; color: string }) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = () => {
      scale.setValue(0.3);
      opacity.setValue(0.6);
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 2.2, duration: 2000,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0, duration: 2000,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]).start(() => setTimeout(run, delay));
    };
    setTimeout(run, delay);
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: 120, height: 120,
        borderRadius: 60,
        borderWidth: 1.5,
        borderColor: color,
        opacity, transform: [{ scale }],
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EasterEgg — multi-step cinematic journey
//
//  Step 0 → "Classified" screen (redacted style)
//  Step 1 → Rose backdrop + AMRUTA letter reveal
//  Step 2 → Poem lines appear one by one
//  Step 3 → Signature + close
// ─────────────────────────────────────────────────────────────────────────────
const HEART_POSITIONS = [
  { x: width * 0.04, size: 14 },
  { x: width * 0.16, size: 20 },
  { x: width * 0.30, size: 12 },
  { x: width * 0.44, size: 18 },
  { x: width * 0.58, size: 22 },
  { x: width * 0.70, size: 14 },
  { x: width * 0.82, size: 18 },
  { x: width * 0.92, size: 12 },
];

function EasterEggOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);

  // ── Step 0: "Classified" screen ──
  const s0Fade = useRef(new Animated.Value(0)).current;
  const s0SlideY = useRef(new Animated.Value(30)).current;
  const scanLine = useRef(new Animated.Value(0)).current;    // 0→1 top to bottom
  const redactW1 = useRef(new Animated.Value(0)).current;
  const redactW2 = useRef(new Animated.Value(0)).current;
  const redactW3 = useRef(new Animated.Value(0)).current;
  const unlockScale = useRef(new Animated.Value(0)).current;
  const unlockFade = useRef(new Animated.Value(0)).current;

  // ── Step 1: Name reveal ──
  const s1Fade = useRef(new Animated.Value(0)).current;
  const roseGlow = useRef(new Animated.Value(0)).current;
  const forFade = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartPulse = useRef(new Animated.Value(1)).current;

  // ── Step 2: Poem ──
  const s2Fade = useRef(new Animated.Value(0)).current;
  const p1Fade = useRef(new Animated.Value(0)).current;
  const p1Slide = useRef(new Animated.Value(20)).current;
  const p2Fade = useRef(new Animated.Value(0)).current;
  const p2Slide = useRef(new Animated.Value(20)).current;
  const p3Fade = useRef(new Animated.Value(0)).current;
  const p3Slide = useRef(new Animated.Value(20)).current;
  const p4Fade = useRef(new Animated.Value(0)).current;
  const p4Slide = useRef(new Animated.Value(20)).current;
  const nextBtnFade = useRef(new Animated.Value(0)).current;

  // ── Step 3: Signature ──
  const s3Fade = useRef(new Animated.Value(0)).current;
  const sigFade = useRef(new Animated.Value(0)).current;
  const sigSlide = useRef(new Animated.Value(30)).current;
  const closeFade = useRef(new Animated.Value(0)).current;
  const finalGlow = useRef(new Animated.Value(0)).current;

  // Master overlay
  const masterFade = useRef(new Animated.Value(0)).current;

  // Heart pulse loop
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(heartPulse, {
          toValue: 1.2, duration: 600,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
        Animated.timing(heartPulse, {
          toValue: 1, duration: 600,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  // ── Step entrance animations ──
  useEffect(() => {
    Animated.timing(masterFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (step === 0) playStep0();
    if (step === 1) playStep1();
    if (step === 2) playStep2();
    if (step === 3) playStep3();
  }, [step]);

  const playStep0 = () => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(s0Fade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(s0SlideY, {
          toValue: 0, duration: 600,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]),
      Animated.delay(300),
      // Scan line sweeps down
      Animated.timing(scanLine, {
        toValue: 1, duration: 1000,
        easing: Easing.inOut(Easing.cubic), useNativeDriver: false,
      }),
      Animated.delay(200),
      // Redacted bars wipe in
      Animated.stagger(120, [
        Animated.timing(redactW1, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.timing(redactW2, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.timing(redactW3, { toValue: 1, duration: 400, useNativeDriver: false }),
      ]),
      Animated.delay(400),
      // "UNLOCKED" springs in
      Animated.spring(unlockScale, {
        toValue: 1, tension: 60, friction: 6, useNativeDriver: true,
      }),
      Animated.timing(unlockFade, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(800),
    ]).start();
  };

  const playStep1 = () => {
    // Fade out step0, fade in step1
    Animated.sequence([
      Animated.timing(s0Fade, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(s1Fade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(roseGlow, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
      Animated.delay(200),
      Animated.timing(forFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(300),
      // Heart springs in
      Animated.spring(heartScale, {
        toValue: 1, tension: 50, friction: 5, useNativeDriver: true,
      }),
      // Name letters stagger — handled by LetterReveal internally (baseDelay=800)
      Animated.delay(1200),
      Animated.timing(nextBtnFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  };

  const playStep2 = () => {
    Animated.sequence([
      Animated.timing(s1Fade, { toValue: 0, duration: 350, useNativeDriver: true }),
      Animated.timing(s2Fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(p1Fade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(p1Slide, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(p2Fade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(p2Slide, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(p3Fade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(p3Slide, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(p4Fade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(p4Slide, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(600),
      Animated.timing(nextBtnFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  };

  const playStep3 = () => {
    Animated.sequence([
      Animated.timing(s2Fade, { toValue: 0, duration: 350, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(s3Fade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(finalGlow, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(sigFade, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(sigSlide, { toValue: 0, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(800),
      Animated.timing(closeFade, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  };

  const goNext = () => {
    nextBtnFade.setValue(0);
    setStep((s) => s + 1);
  };

  const handleClose = () => {
    Animated.timing(masterFade, {
      toValue: 0, duration: 400, useNativeDriver: true,
    }).start(() => onClose());
  };

  // Derived animated styles
  const scanTop = scanLine.interpolate({
    inputRange: [0, 1], outputRange: ['0%', '100%'],
  });
  const redact1Width = redactW1.interpolate({ inputRange: [0, 1], outputRange: ['0%', '75%'] });
  const redact2Width = redactW2.interpolate({ inputRange: [0, 1], outputRange: ['0%', '60%'] });
  const redact3Width = redactW3.interpolate({ inputRange: [0, 1], outputRange: ['0%', '60%'] });
  const roseGlowOp = roseGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.eggBackdrop, { opacity: masterFade }]}>

      {/* Floating hearts — always visible once overlay opens */}
      {HEART_POSITIONS.map((h, i) => (
        <FloatingHeart key={i} x={h.x} delay={i * 180} size={h.size} />
      ))}

      {/* ── STEP 0: CLASSIFIED ───────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.eggStep,
          {
            opacity: s0Fade,
            transform: [{ translateY: s0SlideY }],
            display: step === 0 ? 'flex' : 'none',
          },
        ]}
      >
        {/* Top label */}
        <View style={styles.classifiedTopRow}>
          <View style={styles.classifiedPill}>
            <Text style={styles.classifiedPillText}>❤️ CLASSIFIED</Text>
          </View>
        </View>

        {/* Scan line sweep */}
        <Animated.View
          pointerEvents="none"
          style={[styles.scanLine, { top: scanTop }]}
        />

        {/* File content */}
        <View style={styles.classifiedBody}>
          <Text style={styles.classifiedFileId}>FILE · AA-2016-∞</Text>

          <View style={styles.redactRow}>
            <Text style={styles.classifiedLabel}>LOVE  </Text>
            <Animated.View style={[styles.redactBar, { width: redact1Width }]} />
          </View>

          <View style={styles.redactRow}>
            <Text style={styles.classifiedLabel}>LAUGHS </Text>
            <Animated.View style={[styles.redactBar, { width: redact2Width }]} />
          </View>

          <View style={styles.redactRow}>
            <Text style={styles.classifiedLabel}>FUN   </Text>
            <Animated.View style={[styles.redactBar, { width: redact3Width }]} />
          </View>

          <View style={styles.classifiedDivider} />

          <Text style={styles.classifiedSmall}>
            ACCESS GRANTED — CLEARANCE LV. ∞
          </Text>
        </View>

        {/* UNLOCKED badge */}
        <Animated.View
          style={[
            styles.unlockedBadge,
            {
              opacity: unlockFade,
              transform: [{ scale: unlockScale }],
            },
          ]}
        >
          <Text style={styles.unlockedText}>♥  UNLOCKED</Text>
        </Animated.View>

        {/* Next */}
        <Animated.View style={[styles.nextWrap, { opacity: unlockFade }]}>
          <TouchableOpacity onPress={goNext} style={styles.nextBtn}>
            <Text style={styles.nextBtnText}>REVEAL  ›</Text>
          </TouchableOpacity>
        </Animated.View>
        <View style={{ height: 40 }} />
      </Animated.View>

      {/* ── STEP 1: NAME REVEAL ──────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.eggStep,
          { opacity: s1Fade, display: step === 1 ? 'flex' : 'none' },
        ]}
      >
        {/* Rose ambient glow */}
        <Animated.View style={[styles.roseAmbient, { opacity: roseGlowOp }]} />

        {/* Pulsing sonar rings */}
        <View style={styles.ringContainer}>
          <PulsingRing delay={0} color={T.rose} />
          <PulsingRing delay={700} color={T.rose} />
          <PulsingRing delay={1400} color={T.rose} />
        </View>

        {/* Heart */}
        <Animated.View
          style={[
            styles.bigHeartWrap,
            { transform: [{ scale: Animated.multiply(heartScale, heartPulse) }] },
          ]}
        >
          <Text style={styles.bigHeart}>♥</Text>
        </Animated.View>

        {/* Name */}
        <Animated.View style={[styles.nameBlock, { opacity: s1Fade }]}>
          <Animated.Text style={[styles.dedicatedTo, { opacity: forFade }]}>
            in every version of me,
          </Animated.Text>
          <Animated.Text style={[styles.dedicatedTo, { opacity: forFade }]}>
            past, present, and becoming,
          </Animated.Text>
          <Animated.Text style={[styles.dedicatedSub, { opacity: forFade }]}>
            you were always the destination.
          </Animated.Text>
        </Animated.View>

        <Animated.View style={[styles.nextWrap, { opacity: nextBtnFade }]}>
          <TouchableOpacity onPress={goNext} style={styles.nextBtn}>
            <Text style={styles.nextBtnText}>continue  ›</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* ── STEP 2: POEM ─────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.eggStep,
          { opacity: s2Fade, display: step === 2 ? 'flex' : 'none' },
        ]}
      >
        <View style={styles.poemCard}>
          <Animated.View style={{ opacity: p1Fade, transform: [{ translateY: p1Slide }] }}>
            <Text style={styles.poemLine}>
              You are the reason the late nights
            </Text>
          </Animated.View>

          <Animated.View style={{ opacity: p2Fade, transform: [{ translateY: p2Slide }] }}>
            <Text style={[styles.poemLine, styles.poemAccent]}>
              felt worth it.
            </Text>
          </Animated.View>

          <View style={styles.poemGap} />

          <Animated.View style={{ opacity: p3Fade, transform: [{ translateY: p3Slide }] }}>
            <Text style={styles.poemLine}>
              Every quiet moment I have,
            </Text>
          </Animated.View>

          <Animated.View style={{ opacity: p4Fade, transform: [{ translateY: p4Slide }] }}>
            <Text style={[styles.poemLine, styles.poemAccent]}>
              I spend thinking of you.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.nextWrap, { opacity: nextBtnFade }]}>
          <TouchableOpacity onPress={goNext} style={styles.nextBtn}>
            <Text style={styles.nextBtnText}>continue  ›</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* ── STEP 3: FINAL SIGNATURE ──────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.eggStep,
          { opacity: s3Fade, display: step === 3 ? 'flex' : 'none' },
        ]}
      >
        <Animated.View
          style={[
            styles.sigCard,
            { opacity: sigFade, transform: [{ translateY: sigSlide }] },
          ]}
        >


          {/* Small heart icon top */}
          <View style={styles.sigIconRow}>
            <Text style={styles.sigSmallHeart}>♥</Text>
          </View>

          {/* Quote */}
          <Text style={styles.sigQuote}>
            "Amruta, you’re my favorite constant in every changing phase."
            {'\n'}{'\n'}{'\n'}I love you
          </Text>

          {/* Divider */}
          <View style={styles.sigDivider} />

          {/* Sign-off */}
          <Text style={styles.sigFrom}>yours,</Text>
          <LetterReveal
            text="ANAND"
            style={styles.sigName}
            baseDelay={200}
          />
        </Animated.View>

        {/* Close button — in normal flow below the card, not absolute */}
        <Animated.View style={[styles.closeWrap, { opacity: closeFade }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>close</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [updateManifest, setUpdateManifest] = useState<VersionManifest | null>(null);

  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const masterFade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoRotate = useRef(new Animated.Value(-30)).current;
  const nameFade = useRef(new Animated.Value(0)).current;
  const nameSlide = useRef(new Animated.Value(50)).current;
  const bracketFade = useRef(new Animated.Value(0)).current;
  const creatorFade = useRef(new Animated.Value(0)).current;
  const seekProgress = useRef(new Animated.Value(0)).current;
  const btnFade = useRef(new Animated.Value(0)).current;
  const exitFade = useRef(new Animated.Value(1)).current;
  const corePulse = useRef(new Animated.Value(1)).current;
  const logoShake = useRef(new Animated.Value(0)).current;
  const detectedFade = useRef(new Animated.Value(0)).current;
  const detectedSlide = useRef(new Animated.Value(8)).current;

  const handleLogoTap = useCallback(() => {
    tapCount.current += 1;

    Animated.sequence([
      Animated.timing(logoShake, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(logoShake, { toValue: -5, duration: 50, useNativeDriver: true }),
      Animated.timing(logoShake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();

    // At 10 taps show the "AMRUTA DETECTED" hint
    if (tapCount.current === 10) {
      detectedFade.setValue(0);
      detectedSlide.setValue(8);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(detectedFade, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(detectedSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.delay(1800),
        Animated.timing(detectedFade, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }

    if (tapCount.current >= 20) {
      tapCount.current = 0;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      setShowEasterEgg(true);
      return;
    }
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 2000);
  }, []);

  const navigateToDashboard = useCallback(async () => {
    Animated.timing(exitFade, {
      toValue: 0, duration: 450,
      easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(async () => {
      setShowSplash(false);
      try {
        const manifest = await checkForUpdates();
        if (manifest) setUpdateManifest(manifest);
      } catch (_) { }
    });
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(corePulse, {
          toValue: 1.12, duration: 1600,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
        Animated.timing(corePulse, {
          toValue: 1, duration: 1600,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.sequence([
      Animated.delay(200),
      Animated.timing(masterFade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 8, friction: 4, useNativeDriver: true }),
        Animated.timing(logoRotate, {
          toValue: 0, duration: 900,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(bracketFade, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
      Animated.delay(180),
      Animated.parallel([
        Animated.timing(nameFade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(nameSlide, {
          toValue: 0, duration: 600,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]),
      Animated.delay(120),
      Animated.timing(creatorFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(200),
      Animated.timing(seekProgress, {
        toValue: 1, duration: 1800,
        easing: Easing.inOut(Easing.cubic), useNativeDriver: false,
      }),
      Animated.delay(200),
      Animated.timing(btnFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        try {
          const manifest = await checkForUpdates();
          if (manifest) setUpdateManifest(manifest);
        } catch (_) { }
      }
    });
    return () => { sub.remove(); };
  }, []);

  if (showSplash) {
    const logoRot = logoRotate.interpolate({
      inputRange: [-30, 0], outputRange: ['-30deg', '0deg'],
    });

    return (
      <Animated.View style={[styles.container, { opacity: exitFade }]}>
        <StatusBar barStyle="light-content" backgroundColor={T.bg} translucent />

        <GlowOrb cx={width * 0.15} cy={height * 0.2} size={320} color={T.accent} opacity={0.06} dur={7000} />
        <GlowOrb cx={width * 0.85} cy={height * 0.75} size={260} color={T.accentMid} opacity={0.05} dur={9000} />
        <GlowOrb cx={width * 0.5} cy={height * 0.48} size={200} color={T.gold} opacity={0.025} dur={5500} />

        <StarField opacity={masterFade} />
        <View style={styles.topRule} />

        <View style={styles.centerContent}>

          {/* Logo — tappable */}
          <TouchableOpacity activeOpacity={1} onPress={handleLogoTap} style={styles.logoTouchable}>
            <Animated.View
              style={[
                styles.logoWrap,
                { transform: [{ scale: logoScale }, { rotate: logoRot }, { translateX: logoShake }] },
              ]}
            >
              <OrbitalArc size={170} color={T.accentLight} duration={6000} thickness={1} />
              <OrbitalArc size={130} color={T.accentMid} duration={4000} thickness={1.5} reverse />
              <OrbitalArc size={92} color={T.accentLight} duration={3000} thickness={1} />

              <View style={styles.logoInner}>
                <CornerBracket pos="tl" color={T.accentLight} opacity={bracketFade} size={20} />
                <CornerBracket pos="tr" color={T.accentLight} opacity={bracketFade} size={20} />
                <CornerBracket pos="bl" color={T.accentLight} opacity={bracketFade} size={20} />
                <CornerBracket pos="br" color={T.accentLight} opacity={bracketFade} size={20} />
                <Animated.View
                  style={[
                    styles.coreDiamond,
                    { transform: [{ scale: corePulse }, { rotate: '45deg' }] },
                  ]}
                >
                  <View style={styles.coreDiamondInner} />
                </Animated.View>
              </View>
            </Animated.View>
          </TouchableOpacity>

          {/* ── AMRUTA DETECTED hint — appears at tap 10, gone at tap 20 ── */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.detectedWrap,
              {
                opacity: detectedFade,
                transform: [{ translateY: detectedSlide }],
              },
            ]}
          >
            <View style={styles.detectedPill}>
              <Text style={styles.detectedDot}>◆</Text>
              <Text style={styles.detectedText}>AMRUTA DETECTED</Text>
            </View>
          </Animated.View>
          <Animated.View
            style={[
              styles.titleBlock,
              { opacity: nameFade, transform: [{ translateY: nameSlide }] },
            ]}
          >
            <Text style={styles.appName} numberOfLines={1} adjustsFontSizeToFit>
              MONOLITH
            </Text>
            <View style={styles.goldLine} />
            <Text style={styles.appSubtitle}>BY ANAND AAGE</Text>
          </Animated.View>

          <Animated.View style={[styles.seekWrap, { opacity: creatorFade }]}>
            <SeekBar progress={seekProgress} />
            <View style={styles.seekLabels}>
              <Text style={styles.seekLabel}>LOADING SYSTEM</Text>
              <Animated.Text style={[styles.seekLabel, { opacity: btnFade }]}>READY</Animated.Text>
            </View>
          </Animated.View>

          <EnterButton onPress={navigateToDashboard} visible={btnFade} />
        </View>

        <Animated.View style={[styles.watermark, { opacity: creatorFade }]}>
          <Text style={styles.watermarkLabel}>CRAFTED BY</Text>
          <Text style={styles.watermarkName}>ANAND AAGE</Text>
        </Animated.View>

        <View style={styles.bottomRule} />

        {showEasterEgg && (
          <EasterEggOverlay onClose={() => setShowEasterEgg(false)} />
        )}
      </Animated.View>
    );
  }

  return (
    <>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
      {updateManifest && (
        <UpdateModal manifest={updateManifest} onDismiss={() => setUpdateManifest(null)} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: T.bg,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  topRule: {
    position: 'absolute', top: Platform.OS === 'android' ? 44 : 52,
    left: 0, right: 0, height: 0.5, backgroundColor: T.border,
  },
  bottomRule: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 2, backgroundColor: T.accentMid, opacity: 0.4,
  },
  centerContent: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, width: '100%',
  },

  // Logo
  logoTouchable: { alignItems: 'center', justifyContent: 'center' },
  logoWrap: {
    width: 180, height: 180,
    alignItems: 'center', justifyContent: 'center', marginBottom: 36,
  },
  logoInner: {
    position: 'absolute', width: 64, height: 64,
    alignItems: 'center', justifyContent: 'center',
  },
  coreDiamond: {
    width: 40, height: 40, backgroundColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
    elevation: 16, shadowColor: T.accentLight,
    shadowOpacity: 0.8, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
  },
  coreDiamondInner: {
    width: 18, height: 18, backgroundColor: T.accentLight,
    opacity: 0.8, transform: [{ rotate: '-45deg' }],
  },

  // ── AMRUTA DETECTED hint ──
  detectedWrap: {
    marginTop: -24,
    marginBottom: 16,
    alignItems: 'center',
  },
  detectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.4)',
    backgroundColor: 'rgba(255,107,157,0.08)',
  },
  detectedDot: {
    fontSize: 6,
    color: T.rose,
  },
  detectedText: {
    fontSize: scaleFontSize(9),
    fontWeight: '600',
    color: T.rose,
    letterSpacing: 3,
  },

  // ── FIX: tighter letterSpacing + bounded width prevents wrapping ──
  titleBlock: { alignItems: 'center', marginBottom: 36, width: '100%' },
  appName: {
    fontSize: scaleFontSize(36),   // reduced from 48
    fontWeight: '800',
    color: T.white,
    letterSpacing: 8,              // reduced from 12
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: 10,
    width: '100%',
  },
  goldLine: {
    width: 80, height: 2, backgroundColor: T.gold, marginBottom: 10, borderRadius: 1,
  },
  appSubtitle: {
    fontSize: scaleFontSize(11), fontWeight: '400', color: T.muted,
    letterSpacing: 5, textAlign: 'center',
  },

  // Seek
  seekWrap: { width: '75%', marginBottom: 36 },
  seekBarTrack: {
    width: '100%', height: 1.5,
    backgroundColor: 'rgba(139,127,245,0.15)',
    borderRadius: 1, marginBottom: 10, overflow: 'hidden',
  },
  seekBarFill: { height: 1.5, backgroundColor: T.accentMid, borderRadius: 1 },
  seekLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  seekLabel: { fontSize: scaleFontSize(9), fontWeight: '400', color: T.muted, letterSpacing: 2 },

  // Enter button
  enterBtn: {
    width: 220, height: 54, borderRadius: 4, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 12,
    backgroundColor: 'rgba(91,79,232,0.08)',
  },
  enterBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  enterBtnText: {
    fontSize: scaleFontSize(15), fontWeight: '700', color: T.accentLight, letterSpacing: 6,
  },
  chevronLeft: {
    width: 8, height: 8, borderTopWidth: 1.5, borderLeftWidth: 1.5,
    borderColor: T.accentMid, transform: [{ rotate: '-45deg' }],
  },
  chevronRight: {
    width: 8, height: 8, borderTopWidth: 1.5, borderRightWidth: 1.5,
    borderColor: T.accentMid, transform: [{ rotate: '45deg' }],
  },
  ripple: {
    position: 'absolute', width: 220, height: 54,
    borderRadius: 4, backgroundColor: T.accentMid,
  },
  enterSubtext: {
    fontSize: scaleFontSize(9), fontWeight: '300', color: T.muted, letterSpacing: 3, opacity: 0.6,
  },

  // Watermark
  watermark: { position: 'absolute', bottom: 24, alignItems: 'center' },
  watermarkLabel: {
    fontSize: scaleFontSize(8), fontWeight: '400', color: T.muted,
    letterSpacing: 3, opacity: 0.5, marginBottom: 2,
  },
  watermarkName: {
    fontSize: scaleFontSize(11), fontWeight: '600', color: T.accentLight,
    letterSpacing: 4, opacity: 0.7,
  },

  // ── Easter Egg ────────────────────────────────────────────────────────────
  eggBackdrop: {
    backgroundColor: 'rgba(4,2,14,0.97)',
    alignItems: 'center', justifyContent: 'center', zIndex: 999,
  },
  eggStep: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 0,
  },

  // Step 0 — Classified
  classifiedTopRow: { marginBottom: 28, alignItems: 'center' },
  classifiedPill: {
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 4, borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.3)',
    backgroundColor: 'rgba(255,107,157,0.08)',
  },
  classifiedPillText: {
    fontSize: scaleFontSize(10), fontWeight: '600',
    color: T.rose, letterSpacing: 4,
  },
  classifiedBody: {
    width: '85%', borderWidth: 0.5,
    borderColor: 'rgba(255,107,157,0.2)',
    borderRadius: 8,
    backgroundColor: 'rgba(10,5,20,0.9)',
    padding: 24, marginBottom: 32,
  },
  classifiedFileId: {
    fontSize: scaleFontSize(9), color: T.muted,
    letterSpacing: 3, marginBottom: 20,
  },
  redactRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 14,
  },
  classifiedLabel: {
    fontSize: scaleFontSize(9), color: T.muted,
    letterSpacing: 2, width: 76, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  redactBar: {
    height: 14, backgroundColor: T.roseDim,
    borderRadius: 2, opacity: 0.85,
  },
  classifiedDivider: {
    height: 0.5, backgroundColor: 'rgba(255,107,157,0.15)',
    marginVertical: 16,
  },
  classifiedSmall: {
    fontSize: scaleFontSize(8), color: 'rgba(255,107,157,0.4)',
    letterSpacing: 2, textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  scanLine: {
    position: 'absolute', left: 0, right: 0,
    height: 1.5, backgroundColor: T.rose, opacity: 0.25, zIndex: 10,
  },
  unlockedBadge: {
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 6, borderWidth: 1.5,
    borderColor: T.rose,
    backgroundColor: 'rgba(255,107,157,0.1)',
    marginBottom: 28,
  },
  unlockedText: {
    fontSize: scaleFontSize(18), fontWeight: '800',
    color: T.rose, letterSpacing: 6,
  },

  // Step 1 — Name reveal
  roseAmbient: {
    position: 'absolute',
    width: 200, height: 200,
    borderRadius: 100,
    backgroundColor: T.rose,
    top: height * 0.5 - 100,
    left: width * 0.5 - 100,
  },
  ringContainer: {
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, height: 120,
  },
  bigHeartWrap: { marginBottom: 16 },
  bigHeart: { fontSize: 48, color: T.rose },
  nameBlock: { alignItems: 'center', marginBottom: 32 },
  dedicatedTo: {
    fontSize: scaleFontSize(11), color: T.muted,
    letterSpacing: 2, marginBottom: 10, fontStyle: 'italic', textAlign: 'center',
  },
  dedicatedSub: {
    fontSize: scaleFontSize(13), color: T.blush,
    letterSpacing: 1, marginTop: 10, fontStyle: 'italic', fontWeight: '300',
  },
  eggName: {
    fontSize: scaleFontSize(44), fontWeight: '900',
    color: T.rose, letterSpacing: 8,
  },

  // Step 2 — Poem
  poemCard: {
    width: '88%', borderWidth: 0.5,
    borderColor: 'rgba(255,107,157,0.2)',
    borderRadius: 12, padding: 28,
    backgroundColor: 'rgba(10,4,20,0.85)',
    marginBottom: 36, gap: 10,
  },
  poemLine: {
    fontSize: scaleFontSize(16), fontWeight: '300',
    color: 'rgba(255,220,230,0.75)',
    textAlign: 'center', lineHeight: 26,
    fontStyle: 'italic', letterSpacing: 0.3,
  },
  poemAccent: { color: T.blush, fontWeight: '500' },
  poemGap: { height: 12 },

  // Step 3 — Signature card (contained, no overflow)
  sigCard: {
    width: width * 0.82,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.2)',
    backgroundColor: 'rgba(12,5,22,0.96)',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 32,
    overflow: 'hidden',
  },
  sigCardGlow: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: T.rose,
    opacity: 0.12,
    top: -100, alignSelf: 'center',
  },
  sigIconRow: { marginBottom: 20 },
  sigSmallHeart: { fontSize: 28, color: T.rose },
  sigQuote: {
    fontSize: scaleFontSize(18), fontWeight: '300',
    color: 'rgba(255,220,230,0.85)',
    textAlign: 'center', lineHeight: 28,
    fontStyle: 'italic', letterSpacing: 0.3,
    marginBottom: 4,
  },
  sigDivider: {
    width: 40, height: 1,
    backgroundColor: T.roseDim, opacity: 0.35,
    marginVertical: 22,
  },
  sigFrom: {
    fontSize: scaleFontSize(11), color: T.muted,
    letterSpacing: 3, marginBottom: 10, fontStyle: 'italic',
  },
  sigName: {
    fontSize: scaleFontSize(30), fontWeight: '900',
    color: T.rose, letterSpacing: 6,
  },

  // Shared — Next / Close buttons
  nextWrap: { alignItems: 'center' },
  nextBtn: {
    paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 30, borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.3)',
    backgroundColor: 'rgba(255,107,157,0.07)',
  },
  nextBtnText: {
    fontSize: scaleFontSize(12), fontWeight: '500',
    color: T.rose, letterSpacing: 3,
  },
  closeWrap: { marginTop: 24, alignItems: 'center' },
  closeBtn: {
    paddingHorizontal: 36, paddingVertical: 12,
    borderRadius: 30, borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.2)',
    backgroundColor: 'rgba(255,107,157,0.05)',
  },
  closeBtnText: {
    fontSize: scaleFontSize(12), fontWeight: '400',
    color: T.muted, letterSpacing: 4,
  },
});