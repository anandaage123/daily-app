import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  VersionManifest,
  downloadUpdate,
  triggerInstall,
  APP_VERSION,
  APP_BUILD,
} from '../services/UpdateService';

const { width } = Dimensions.get('window');

// ─── Color tokens (matches AGENTS.md palette) ─────────────────────────────────
const C = {
  bg: '#0F0E17',
  surface: '#1A1929',
  surfaceHigh: '#22203A',
  primary: '#4052B6',
  primaryLight: '#8899FF',
  gold: '#FFCF5C',
  text: '#F0EEFF',
  textSub: '#9E9BB8',
  success: '#34C759',
  error: '#FF3B60',
  border: 'rgba(136,153,255,0.15)',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface UpdateModalProps {
  manifest: VersionManifest;
  onDismiss: () => void;
}

type DownloadState = 'idle' | 'downloading' | 'done' | 'error';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseReleaseNotes(notes: string): string[] {
  return notes
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .filter((l) => !l.toLowerCase().includes('http')); // Strip any links
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function UpdateModal({ manifest, onDismiss }: UpdateModalProps) {
  const [dlState, setDlState] = useState<DownloadState>('idle');
  const [dlProgress, setDlProgress] = useState(0);
  const [dlStatus, setDlStatus] = useState('');
  const [localUri, setLocalUri] = useState<string | null>(null);

  // Animations
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(400)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const badgeScale = useRef(new Animated.Value(0.7)).current;

  // ── Mount animation ──────────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        tension: 60,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.spring(badgeScale, {
        toValue: 1,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Badge pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // ── Sync progress bar animation ──────────────────────────────────────────
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: dlProgress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [dlProgress]);

  // ── Dismiss animation ────────────────────────────────────────────────────
  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 500,
        duration: 300,
        easing: Easing.in(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start(onDismiss);
  };

  // ── Primary action ────────────────────────────────────────────────────────
  const handleUpdate = async () => {
    if (dlState === 'done' && localUri) {
      // APK already downloaded → install it
      await triggerInstall(localUri);
      return;
    }

    if (dlState === 'downloading') return;

    setDlState('downloading');
    setDlProgress(0);

    const uri = await downloadUpdate(
      manifest.downloadUrl,
      setDlProgress,
      setDlStatus
    );

    if (uri) {
      setLocalUri(uri);
      setDlState('done');
      // Auto-trigger install immediately
      await triggerInstall(uri);
    } else {
      setDlState('error');
      setDlStatus('Download failed — please try again later');
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const isForce = manifest.forceUpdate;
  const releaseLines = parseReleaseNotes(manifest.releaseNotes);
  const progressPercent = Math.round(dlProgress * 100);
  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const btnLabel = () => {
    switch (dlState) {
      case 'downloading': return `Downloading… ${progressPercent}%`;
      case 'done': return 'Tap to Install';
      default: return `Update to v${manifest.version}`;
    }
  };

  const btnColor = dlState === 'error' ? C.error : dlState === 'done' ? C.success : C.primary;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={isForce ? undefined : handleDismiss}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={isForce ? undefined : handleDismiss} />
      </Animated.View>

      {/* Bottom Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>

        {/* Header drag indicator */}
        <View style={styles.dragHandle} />

        {/* Version badge */}
        <View style={styles.badgeRow}>
          <Animated.View style={[styles.badge, { transform: [{ scale: Animated.multiply(badgeScale, pulseAnim) }] }]}>
            <Ionicons name="arrow-up-circle" size={18} color={C.primaryLight} />
            <Text style={styles.badgeText}>UPDATE AVAILABLE</Text>
          </Animated.View>
          {isForce && (
            <View style={styles.forceBadge}>
              <Text style={styles.forceBadgeText}>REQUIRED</Text>
            </View>
          )}
        </View>

        {/* Version headline */}
        <View style={styles.versionRow}>
          <View>
            <Text style={styles.versionNew}>v{manifest.version}#{manifest.build || manifest.versionCode}</Text>
            <Text style={styles.versionCurrent}>Installed: v{APP_VERSION}#{APP_BUILD}</Text>
          </View>
          <View style={styles.releaseInfo}>
            <Ionicons name="calendar-outline" size={12} color={C.textSub} />
            <Text style={styles.releaseDate}>{manifest.releaseDate}</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Release notes */}
        <Text style={styles.sectionLabel}>WHAT'S NEW</Text>
        <ScrollView style={styles.notesScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {releaseLines.map((line, i) => (
            <View key={i} style={styles.noteLine}>
              <View style={styles.noteDot} />
              <Text style={styles.noteText}>{line.replace(/^[•\-\*]\s*/, '')}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Progress bar (shown during download) */}
        {(dlState === 'downloading' || dlState === 'done') && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: barWidth,
                    backgroundColor: dlState === 'done' ? C.success : C.primaryLight,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>
              {dlState === 'done' ? '✓ Download complete' : dlStatus}
            </Text>
          </View>
        )}

        {/* Error state */}
        {dlState === 'error' && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={14} color={C.error} />
            <Text style={styles.errorText}>{dlStatus}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.btnPrimary, { backgroundColor: btnColor }]}
            onPress={handleUpdate}
            disabled={dlState === 'downloading'}
          >
            {dlState === 'downloading' ? (
              <Text style={styles.btnPrimaryText}>{btnLabel()}</Text>
            ) : (
              <>
                <Ionicons
                  name={dlState === 'done' ? 'phone-portrait-outline' : dlState === 'error' ? 'refresh-outline' : 'download-outline'}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.btnPrimaryText}>{btnLabel()}</Text>
              </>
            )}
          </Pressable>

          {!isForce && (
            <Pressable style={styles.btnSecondary} onPress={handleDismiss}>
              <Text style={styles.btnSecondaryText}>Remind me later</Text>
            </Pressable>
          )}
        </View>

        {/* Safe area spacer */}
        {Platform.OS === 'android' && <View style={{ height: 12 }} />}
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: C.border,
    // Shadow
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(64,82,182,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(136,153,255,0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: {
    color: C.primaryLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  forceBadge: {
    backgroundColor: 'rgba(255,60,80,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,60,80,0.3)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  forceBadgeText: {
    color: C.error,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  versionNew: {
    color: C.text,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  versionCurrent: {
    color: C.textSub,
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  releaseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  releaseDate: {
    color: C.textSub,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 16,
  },
  sectionLabel: {
    color: C.textSub,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },
  notesScroll: {
    maxHeight: 140,
    marginBottom: 16,
  },
  noteLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  noteDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.primaryLight,
    marginTop: 6,
    flexShrink: 0,
  },
  noteText: {
    color: C.text,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    opacity: 0.85,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    color: C.textSub,
    fontSize: 12,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,59,96,0.12)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: C.error,
    fontSize: 12,
    flex: 1,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  btnSecondary: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  btnSecondaryText: {
    color: C.textSub,
    fontSize: 14,
    fontWeight: '500',
  },
});
