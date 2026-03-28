import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image, Alert, Modal,
  AppState, Dimensions, Platform, Animated, StatusBar,
  TextInput, FlatList, ScrollView, Switch, TouchableOpacity,
  SectionList, Clipboard, KeyboardAvoidingView, PanResponder,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Typography, Shadows, Spacing } from '../theme/Theme';
import { useTheme } from '../context/ThemeContext';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenCapture from 'expo-screen-capture';
import * as Haptics from 'expo-haptics';
const hapticImpact = (style: 'Light' | 'Medium' | 'Heavy' = 'Light') => {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle[style]); } catch (e) {}
};

const { width, height } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

interface HiddenItem {
  id: string;
  uri: string;
  type: 'image' | 'video';
  name?: string;
  size?: number;
  addedAt: number;
  tags?: string[];
  albumId?: string;
  favorite?: boolean;
  duration?: number; // video duration in seconds
}

interface PasswordItem {
  id: string;
  site: string;
  username: string;
  pass: string;
  category?: string;
  addedAt: number;
  updatedAt?: number;
  notes?: string;
  url?: string;
  lastUsed?: number;
}

interface Album {
  id: string;
  name: string;
  coverUri?: string;
  coverItemId?: string; // which item is the cover
  itemCount?: number;
  createdAt: number;
}

type SortOption = 'newest' | 'oldest' | 'name' | 'type';
type ViewMode = 'grid' | 'list';
type GridSize = 'small' | 'medium' | 'large';

// ─── Constants ────────────────────────────────────────────────────────────────

const PASS_CATEGORIES = ['All', 'Social', 'Work', 'Finance', 'Other'];
const AUTO_LOCK_OPTIONS = [
  { label: 'Immediately', value: 0 },
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '15 minutes', value: 900 },
  { label: 'Never', value: -1 },
];

const PASSWORD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const generatePassword = (length = 16) => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += PASSWORD_CHARS[Math.floor(Math.random() * PASSWORD_CHARS.length)];
  }
  return result;
};

export default function VaultScreen() {
  const { colors, isDark } = useTheme();
  
  // ── Auth state ──
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [vaultMode, setVaultMode] = useState<'primary' | 'decoy' | null>(null);
  const [hasPrimaryPin, setHasPrimaryPin] = useState<boolean | null>(null);
  const [hasDecoyPin, setHasDecoyPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [setupStep, setSetupStep] = useState<'none' | 'primary' | 'primary_confirm' | 'decoy' | 'decoy_confirm' | 'change_decoy' | 'change_decoy_confirm'>('none');
  const [tempPin, setTempPin] = useState('');
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [showWrongPin, setShowWrongPin] = useState(false);
  const [recoveryHint, setRecoveryHint] = useState(''); // scooby dooby doo
  const wrongPinAnim = useRef(new Animated.Value(0)).current;

  // ── Content state ──
  const [activeTab, setActiveTab] = useState<'media' | 'passwords' | 'albums'>('media');
  const [hiddenItems, setHiddenItems] = useState<HiddenItem[]>([]);
  const [passwords, setPasswords] = useState<PasswordItem[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);

  // ── Album folder-navigation state ──
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null); // null = album grid, string = inside album

  // ── CSV import modal ──
  const [isCsvImportVisible, setIsCsvImportVisible] = useState(false);
  const [csvImportText, setCsvImportText] = useState('');

  // ── Username copy tracking ──
  const [copiedUsernameId, setCopiedUsernameId] = useState<string | null>(null);

  // ── Media controls ──
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [gridSize, setGridSize] = useState<GridSize>('medium');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [activeAlbumFilter, setActiveAlbumFilter] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // ── Media viewer state ──
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerItems, setViewerItems] = useState<HiddenItem[]>([]);
  const [showViewerControls, setShowViewerControls] = useState(true);
  const viewerControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewerFlatRef = useRef<FlatList>(null);

  // ── Password controls ──
  const [passCategory, setPassCategory] = useState('All');
  const [passSearch, setPassSearch] = useState('');
  const [showPasswords, setShowPasswords] = useState<Set<string>>(new Set());
  const [clipboardTimer, setClipboardTimerState] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Modals ──
  const [isPassModalVisible, setIsPassModalVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isAlbumModalVisible, setIsAlbumModalVisible] = useState(false);
  const [viewingPassword, setViewingPassword] = useState<PasswordItem | null>(null);
  const [isTagModalVisible, setIsTagModalVisible] = useState(false);
  const [isTagManagerVisible, setIsTagManagerVisible] = useState(false);
  const [isMoveAlbumVisible, setIsMoveAlbumVisible] = useState(false);
  const [isSortVisible, setIsSortVisible] = useState(false);
  const [isAlbumCoverPickerVisible, setIsAlbumCoverPickerVisible] = useState(false);
  const [coverPickingAlbumId, setCoverPickingAlbumId] = useState<string | null>(null);
  const [isRenamingAlbum, setIsRenamingAlbum] = useState(false);
  const [renamingAlbumId, setRenamingAlbumId] = useState<string | null>(null);
  const [renameAlbumText, setRenameAlbumText] = useState('');
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);

  // ── Add password form ──
  const [newSite, setNewSite] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newPassCategory, setNewPassCategory] = useState('Other');
  const [editingPassword, setEditingPassword] = useState<PasswordItem | null>(null);
  const [showNewPass, setShowNewPass] = useState(false);

  
  const navigation = useNavigation<any>();
  const appState = useRef(AppState.currentState);
  const skipLock = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const currentViewerItem = viewerItems[viewerIndex] ?? null;

  const videoPlayer = useVideoPlayer(
    currentViewerItem?.type === 'video' ? currentViewerItem.uri : null,
    (player) => { player.loop = true; player.play(); }
  );

  // Stop video when viewer closes
  useEffect(() => {
    if (!viewerVisible) {
      try { videoPlayer?.pause(); } catch (e) {}
    }
  }, [viewerVisible]);

  
  const categoryIcon = (cat?: string): any => {
    switch (cat) {
      case 'Social': return 'people-outline';
      case 'Work': return 'briefcase-outline';
      case 'Finance': return 'card-outline';
      case 'Shopping': return 'bag-handle-outline';
      default: return 'key-outline';
    }
  };

  const categoryColor = (cat?: string) => {
    switch (cat) {
      case 'Social': return '#4D96FF';
      case 'Work': return '#6BCB77';
      case 'Finance': return '#FF8C42';
      case 'Shopping': return '#9C27B0';
      default: return colors.primary;
    }
  };

  const TagPill = ({
    tag, active, onPress, onRemove
  }: {
    tag: string; active?: boolean; onPress?: () => void; onRemove?: () => void;
  }) => (
    <Pressable onPress={onPress} style={[styles.tagPill, active && styles.tagPillActive]}>
      <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
      {active && onRemove && (
        <Pressable onPress={onRemove} hitSlop={8} style={{ marginLeft: 4 }}>
          <Ionicons name="close" size={12} color={active ? '#FFF' : colors.textVariant} />
        </Pressable>
      )}
    </Pressable>
  );

  const PasswordStrengthBar = ({ password }: { password: string }) => {
    const score = (() => {
      let s = 0;
      if (password.length >= 8) s++;
      if (password.length >= 12) s++;
      if (/[A-Z]/.test(password)) s++;
      if (/[0-9]/.test(password)) s++;
      if (/[^A-Za-z0-9]/.test(password)) s++;
      return s;
    })();
    const cBar = ['#FF4B4B', '#FF8C42', '#FFC300', '#6BCB77', '#4D96FF'];
    const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
    if (!password) return null;
    return (
      <View style={styles.strengthContainer}>
        <View style={styles.strengthBars}>
          {[1, 2, 3, 4, 5].map(i => (
            <View key={i} style={[styles.strengthBar, { backgroundColor: i <= score ? cBar[score - 1] : colors.surfaceContainer }]} />
          ))}
        </View>
        <Text style={[styles.strengthLabel, { color: cBar[score - 1] ?? colors.textVariant }]}>{labels[score - 1] ?? ''}</Text>
      </View>
    );
  };

  const EmptyState = ({
    icon, title, subtitle, onAction
  }: {
    icon: any; title: string; subtitle: string; onAction?: () => void;
  }) => (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={56} color={colors.primaryLight ?? '#C5C0FF'} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {onAction && (
        <TouchableOpacity
          onPress={onAction}
          style={styles.emptyActionBtn}
        >
          <Ionicons name="add" size={16} color="#FFF" />
          <Text style={styles.emptyActionBtnText}>Get Started</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const SwipeablePasswordRow = ({
    item, copiedId, copiedUsernameId, showPasswords,
    onPress, onCopyPassword, onCopyUsername, onToggleShow, onDelete,
  }: {
    item: PasswordItem;
    copiedId: string | null;
    copiedUsernameId: string | null;
    showPasswords: Set<string>;
    onPress: () => void;
    onCopyPassword: () => void;
    onCopyUsername: () => void;
    onToggleShow: () => void;
    onDelete: () => void;
  }) => {
    const swipeAnim = useRef(new Animated.Value(0)).current;
    const [open, setOpen] = useState(false);

    const panResponder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) swipeAnim.setValue(Math.max(g.dx, -80));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) {
          Animated.timing(swipeAnim, { toValue: -80, duration: 150, useNativeDriver: true }).start();
          setOpen(true);
        } else {
          Animated.spring(swipeAnim, { toValue: 0, useNativeDriver: true }).start();
          setOpen(false);
        }
      },
    });

    return (
      <View style={{ marginHorizontal: 8, marginBottom: 8 }}>
        <View style={styles.swipeDeleteBg}>
          <TouchableOpacity style={styles.swipeDeleteBtn} onPress={onDelete}>
            <Ionicons name="trash-outline" size={22} color="#FFF" />
            <Text style={styles.swipeDeleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
        <Animated.View style={{ transform: [{ translateX: swipeAnim }] }} {...panResponder.panHandlers}>
          <TouchableOpacity
            onPress={() => {
              if (open) {
                Animated.spring(swipeAnim, { toValue: 0, useNativeDriver: true }).start();
                setOpen(false);
              } else {
                onPress();
              }
            }}
            style={styles.passItem}
          >
            <View style={[styles.passIconContainer, { backgroundColor: categoryColor(item.category) + '22' }]}>
              <Ionicons name={categoryIcon(item.category)} size={20} color={categoryColor(item.category)} />
            </View>
            <View style={styles.passInfo}>
              <Text style={styles.passSite}>{item.site}</Text>
              <Text style={styles.passUser}>{item.username}</Text>
            </View>
            <View style={styles.passRight}>
              <TouchableOpacity onPress={onCopyUsername} style={[styles.quickCopyBtn, copiedUsernameId === item.id && styles.quickCopyBtnActive]} hitSlop={6}>
                <Ionicons name={copiedUsernameId === item.id ? 'checkmark' : 'person-outline'} size={15} color={copiedUsernameId === item.id ? '#34A853' : colors.textVariant} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onCopyPassword} style={[styles.quickCopyBtn, copiedId === item.id && styles.quickCopyBtnActive]} hitSlop={6}>
                <Ionicons name={copiedId === item.id ? 'checkmark' : 'copy-outline'} size={15} color={copiedId === item.id ? '#34A853' : colors.textVariant} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onToggleShow} style={styles.passEyeBtn}>
                <Ionicons name={showPasswords.has(item.id) ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textVariant} />
              </TouchableOpacity>
              {showPasswords.has(item.id) && <Text style={styles.passRevealed} numberOfLines={1}>{item.pass}</Text>}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    authContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
    logoContainer: { alignItems: 'center', marginBottom: 60 },
    logoTitle: { fontSize: 32, fontWeight: '800', color: colors.text, marginTop: 16, letterSpacing: -0.5 },
    logoSub: { fontSize: 13, color: colors.textVariant, letterSpacing: 1.5, fontWeight: '700' },
    pinDisplay: { flexDirection: 'row', gap: 15, marginBottom: 50 },
    pinDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.outlineVariant },
    pinDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    wrongPinText: { color: colors.error, fontSize: 14, fontWeight: '600', marginBottom: 20 },
    numpadGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 280, gap: 20, justifyContent: 'center' },
    numBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...Shadows.soft },
    numBtnText: { fontSize: 28, fontWeight: '600', color: colors.text },
    setupBanner: { marginBottom: 40, alignItems: 'center', paddingHorizontal: 40 },
    setupTitle: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' },
    setupSub: { fontSize: 14, color: colors.textVariant, textAlign: 'center', marginTop: 10, lineHeight: 20 },

    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 15 },
    headerTitleBox: { flex: 1, marginHorizontal: 12 },
    headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
    headerSub: { fontSize: 12, color: colors.textVariant, marginTop: 2 },
    tabBar: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: colors.surface, ...Shadows.soft },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 14, fontWeight: '700', color: colors.textVariant },
    tabTextActive: { color: '#FFF' },

    controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
    searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceContainer, borderRadius: 12, paddingHorizontal: 12, height: 40 },
    searchInput: { flex: 1, fontSize: 14, color: colors.text },
    iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainer, borderRadius: 12 },
    statsBar: { paddingHorizontal: 16, paddingBottom: 4 },
    statsBarText: { fontSize: 12, color: colors.textVariant, fontWeight: '500' },
    filterRowWrapper: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
    filterRow: { paddingBottom: 8 },
    filterRowContent: { paddingHorizontal: 15, gap: 8, alignItems: 'center' },
    tagManagerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainer, borderRadius: 10 },
    tagPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: 'transparent' },
    tagPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tagText: { fontSize: 13, fontWeight: '600', color: colors.textVariant, lineHeight: 16 },
    tagTextActive: { color: '#FFF' },
    bulkBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.outlineVariant, gap: 8 },
    bulkCount: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
    bulkBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: colors.surfaceContainer },
    bulkBtnText: { fontSize: 13, fontWeight: '600', color: colors.text },
    listContent: { padding: 8 },
    mediaItem: { borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surfaceContainer, margin: 2 },
    mediaItemSelected: { opacity: 0.85 },
    videoBadge: { position: 'absolute', top: 5, right: 5, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 8 },
    videoDuration: { fontSize: 10, color: '#FFF', fontWeight: '700' },
    favBadge: { position: 'absolute', top: 5, left: 5, backgroundColor: 'rgba(255,255,255,0.9)', padding: 4, borderRadius: 8 },
    selectedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(99,102,241,0.45)', alignItems: 'center', justifyContent: 'center' },
    listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, marginHorizontal: 8, marginBottom: 8, padding: 12, ...Shadows.soft, borderWidth: 1, borderColor: 'transparent' },
    listThumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: colors.surfaceContainer, marginRight: 12 },
    listItemInfo: { flex: 1 },
    listItemName: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
    listItemMeta: { fontSize: 12, color: colors.textVariant },
    listItemTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
    listItemRight: { alignItems: 'center', gap: 6, paddingLeft: 8 },
    microTag: { backgroundColor: colors.surfaceContainer, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
    microTagText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
    albumCard: { flex: 1, margin: 8, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface, ...Shadows.soft },
    albumCover: { width: '100%', height: 130 },
    albumCoverEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainer },
    albumInfo: { padding: 12 },
    albumName: { fontSize: 14, fontWeight: '700', color: colors.text },
    albumCount: { fontSize: 12, color: colors.textVariant, marginTop: 2 },
    albumBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
    albumBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
    passItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.surface, borderRadius: 18, marginHorizontal: 8, marginBottom: 12, ...Shadows.soft },
    passIconContainer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    passInfo: { flex: 1 },
    passSite: { fontSize: 16, fontWeight: '700', color: colors.text },
    passUser: { fontSize: 13, color: colors.textVariant, marginTop: 2 },
    passRight: { alignItems: 'flex-end', gap: 4 },
    passEyeBtn: { padding: 4 },
    passRevealed: { fontSize: 11, color: colors.textVariant, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', maxWidth: 100 },
    quickCopyBtn: { padding: 6, borderRadius: 8, backgroundColor: colors.background },
    quickCopyBtnActive: { backgroundColor: colors.tertiary + '20' },
    strengthContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
    strengthBar: { flex: 1, height: 4, borderRadius: 2 },
    strengthLabel: { fontSize: 12, fontWeight: '700', minWidth: 70, textAlign: 'right' },
    fab: { position: 'absolute', bottom: 32, right: 24, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 10 },
    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 20 },
    emptySubtitle: { textAlign: 'center', color: colors.textVariant, marginTop: 8, lineHeight: 20, fontSize: 14 },
    emptyActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
    emptyActionBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 32, maxHeight: height * 0.88 },
    detailSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 32 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.surfaceContainerHigh, alignSelf: 'center', marginBottom: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
    compactModal: { backgroundColor: colors.surface, margin: 24, borderRadius: 24, padding: 24, ...Shadows.soft },
    settingSection: { fontSize: 11, fontWeight: '700', color: colors.textVariant, letterSpacing: 1.2, marginTop: 16, marginBottom: 4, paddingHorizontal: 4 },
    settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
    settingIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    settingLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
    settingSubLabel: { fontSize: 12, color: colors.textVariant, marginTop: 2 },
    autoLockChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.surfaceContainer },
    autoLockChipActive: { backgroundColor: colors.primary },
    autoLockChipText: { fontSize: 13, fontWeight: '600', color: colors.textVariant },
    autoLockChipTextActive: { color: '#FFF' },
    vaultStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 20, backgroundColor: colors.background, borderRadius: 16, padding: 16, justifyContent: 'space-between' },
    statLabel: { fontSize: 12, color: colors.textVariant, fontWeight: '600' },
    statValue: { fontSize: 12, fontWeight: '800', color: colors.primary },
    passModal: { backgroundColor: colors.surface, borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 32, maxHeight: height * 0.9 },
    passModalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 20 },
    inputLabel: { fontSize: 12, fontWeight: '700', color: colors.textVariant, marginBottom: 6, letterSpacing: 0.5 },
    input: { height: 50, backgroundColor: colors.background, borderRadius: 14, paddingHorizontal: 16, marginBottom: 14, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.outlineVariant },
    passInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    passInputActions: { position: 'absolute', right: 14, flexDirection: 'row', alignItems: 'center', top: 0, height: 50 },
    modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
    cancelBtn: { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainer },
    saveBtn: { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
    cancelBtnText: { fontWeight: '700', color: colors.textVariant, fontSize: 15 },
    saveBtnText: { fontWeight: '700', color: '#FFF', fontSize: 15 },
    detailRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
    detailLabel: { fontSize: 11, fontWeight: '700', color: colors.textVariant, letterSpacing: 0.8, marginBottom: 4 },
    detailValue: { fontSize: 15, color: colors.text, fontWeight: '500' },
    detailActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
    detailBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, backgroundColor: colors.surfaceContainer },
    detailBtnText: { fontSize: 15, fontWeight: '700', color: colors.text },
    viewerContainer: { flex: 1, backgroundColor: '#000' },
    viewerCounter: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 36, alignSelf: 'center', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
    viewerCounterText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
    viewerClose: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 36, left: 20, zIndex: 10 },
    favBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 36, right: 20, zIndex: 10 },
    viewerCloseBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    fullMedia: { width: '100%', height: '60%' },
    viewerBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
    viewerMeta: { paddingHorizontal: 24, paddingTop: 16 },
    viewerMetaName: { fontSize: 16, fontWeight: '700', color: '#FFF' },
    viewerMetaDate: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
    viewerTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    viewerTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
    viewerTagText: { fontSize: 12, color: '#FFF', fontWeight: '600' },
    addTagBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
    addTagBtnText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
    viewerActions: { flexDirection: 'row', justifyContent: 'center', gap: 32, paddingHorizontal: 24, marginTop: 16 },
    viewerActionBtn: { alignItems: 'center', gap: 8 },
    viewerActionIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
    viewerBtnText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
    viewerChevronLeft: { position: 'absolute', left: 12, top: '40%', zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    viewerChevronRight: { position: 'absolute', right: 12, top: '40%', zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    tagManagerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
    tagManagerName: { fontSize: 15, fontWeight: '700', color: colors.text },
    tagManagerCount: { fontSize: 12, color: colors.textVariant, marginTop: 2 },
    tagManagerAction: { padding: 10 },
    recoveryHintWrapper: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, right: 25, zIndex: 9999 },
    recoveryHintText: { color: 'rgba(255, 255, 255, 0.3)', fontSize: 20, fontWeight: '800', letterSpacing: 5 },
    albumSubHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
    albumBackBtn: { flexDirection: 'row', alignItems: 'center', width: 70 },
    albumBackText: { fontSize: 15, fontWeight: '600', color: colors.primary, marginLeft: 2 },
    albumSubTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.text },
    swipeDeleteBg: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, backgroundColor: colors.error, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    swipeDeleteBtn: { alignItems: 'center', justifyContent: 'center', width: 80, height: '100%' as any },
    swipeDeleteText: { color: '#FFF', fontSize: 11, fontWeight: '700', marginTop: 2 },
    csvImportBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 8, marginBottom: 8, marginTop: 2, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary + '40', backgroundColor: colors.primary + '0A' },
    csvImportBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
    toast: { position: 'absolute', bottom: 100, alignSelf: 'center', zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25 },
    toastText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
    onboardingContainer: { flex: 1, backgroundColor: colors.background },
    authBg: { position: 'absolute', width, height, overflow: 'hidden' },
    authBgCircle1: { position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: colors.primary + '10' },
    authBgCircle2: { position: 'absolute', bottom: -50, left: -50, width: 250, height: 250, borderRadius: 125, backgroundColor: colors.secondary + '08' },
    onboardingContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    onboardingTitle: { fontSize: 28, fontWeight: '900', color: colors.text, textAlign: 'center', marginBottom: 12 },
    onboardingSubtitle: { fontSize: 16, color: colors.textVariant, textAlign: 'center', marginBottom: 40, lineHeight: 24 },
    onboardingFeatureList: { width: '100%', gap: 20, marginBottom: 48 },
    onboardingFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    onboardingFeatureIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
    onboardingFeatureText: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
    onboardingCTA: { width: '100%', height: 56, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadows.soft },
    onboardingCTAText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    onboardingSkip: { marginTop: 24, padding: 8 },
    authMain: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', padding: 24 },
    identityContainer: { alignItems: 'center', marginBottom: 40 },
    authHeading: { fontSize: 26, fontWeight: '900', color: colors.text, marginTop: 16 },
    authSubtitle: { fontSize: 14, color: colors.textVariant, marginTop: 4, fontWeight: '500' },
    numpadBtn: { width: 75, height: 75, borderRadius: 40, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...Shadows.soft },
    numpadText: { fontSize: 28, fontWeight: '600', color: colors.text },
    numpadBtnGhost: { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
    headerBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, alignItems: 'center' },
    primaryBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 4 },
    primaryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
    primaryBadgeText: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 },
    title: { fontSize: 18, fontWeight: '800', color: colors.text },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tabContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
    activeTab: { backgroundColor: colors.primary },
    activeTabText: { color: '#FFF' },
    tabBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.1)' },
    tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
    tabBadgeText: { fontSize: 10, fontWeight: '800', color: colors.textVariant },
    tabBadgeTextActive: { color: '#FFF' },
  });

  // Lock on exit
  useEffect(() => {
    const unsubBlur = navigation.addListener('blur', () => {
      setIsAuthenticated(false);
      setPin('');
    });
    return unsubBlur;
  }, [navigation]);

  // ── Add album form ──
  const [newAlbumName, setNewAlbumName] = useState('');

  // ── Tag form ──
  const [newTag, setNewTag] = useState('');
  const [taggingItemId, setTaggingItemId] = useState<string | null>(null);

  // ── Settings ──
  const [autoLock, setAutoLock] = useState<number>(0);
  const [screenshotProtection, setScreenshotProtection] = useState(true);

  // ── Onboarding ──
  const [onboardingStep, setOnboardingStep] = useState<'welcome' | 'done'>('done');

  // ── Toast ──
  const [toastMsg, setToastMsg] = useState('');
  const toastAnim = useRef(new Animated.Value(0)).current;


  // ── Computed ──

  const allTags = Array.from(new Set(hiddenItems.flatMap(i => i.tags ?? [])));

  const filteredItems = hiddenItems
    .filter(item => {
      if (activeAlbumFilter && item.albumId !== activeAlbumFilter) return false;
      if (showFavoritesOnly && !item.favorite) return false;
      if (activeTags.length && !activeTags.every(t => item.tags?.includes(t))) return false;
      if (searchQuery && !(item.name ?? item.uri).toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return b.addedAt - a.addedAt;
      if (sortBy === 'oldest') return a.addedAt - b.addedAt;
      if (sortBy === 'name') return (a.name ?? '').localeCompare(b.name ?? '');
      if (sortBy === 'type') return a.type.localeCompare(b.type);
      return 0;
    });

  const filteredPasswords = passwords
    .filter(p => {
      if (passCategory !== 'All' && p.category !== passCategory) return false;
      if (passSearch && !p.site.toLowerCase().includes(passSearch.toLowerCase()) && !p.username.toLowerCase().includes(passSearch.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => b.addedAt - a.addedAt);

  const gridItemSize = gridSize === 'small' ? (width - 50) / 4 : gridSize === 'large' ? (width - 32) / 2 : (width - 42) / 3;
  const numColumns = gridSize === 'small' ? 4 : gridSize === 'large' ? 2 : 3;

  // Total storage used
  const totalStorageBytes = hiddenItems.reduce((sum, i) => sum + (i.size ?? 0), 0);

  // Primary vault stats for settings
  const [primaryItemsCount, setPrimaryItemsCount] = useState(0);
  const [primaryPassCount, setPrimaryPassCount] = useState(0);
  const [decoyItemsCount, setDecoyItemsCount] = useState(0);
  const [decoyPassCount, setDecoyPassCount] = useState(0);

  // ── Lifecycle ──

  useEffect(() => {
    checkPinStatus();
    loadSettings();
    // Restore last active tab
    AsyncStorage.getItem('@vault_last_tab').then(t => {
      if (t === 'media' || t === 'passwords' || t === 'albums') setActiveTab(t as any);
    }).catch(() => {});
    // App drawer privacy & auto-lock
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current === 'active' && nextAppState !== 'active') {
        // LOCK IMMEDIATELY when user exits (presses home, switches app, or drawer)
        lockVault();
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (vaultMode && isAuthenticated) {
      loadHiddenItems(vaultMode);
      loadPasswords(vaultMode);
      loadAlbums(vaultMode);
      if (vaultMode === 'primary') loadVaultStats();
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [vaultMode, isAuthenticated]);

  // Screenshot protection via expo-screen-capture
  useEffect(() => {
    if (!isAuthenticated) return;
    if (screenshotProtection && ScreenCapture) {
      ScreenCapture.preventScreenCaptureAsync().catch(() => {});
      return () => { ScreenCapture?.allowScreenCaptureAsync().catch(() => {}); };
    } else if (ScreenCapture) {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    }
  }, [screenshotProtection, isAuthenticated]);

  // Cooldown timer
  useEffect(() => {
    if (!cooldownEnd) return;
    const tick = setInterval(() => {
      const left = Math.ceil((cooldownEnd - Date.now()) / 1000);
      if (left <= 0) {
        setCooldownLeft(0);
        setCooldownEnd(null);
        setWrongAttempts(0);
        clearInterval(tick);
      } else {
        setCooldownLeft(left);
      }
    }, 500);
    return () => clearInterval(tick);
  }, [cooldownEnd]);

  // Auto-fade viewer controls
  useEffect(() => {
    if (viewerVisible) {
      resetViewerControlsTimer();
    }
  }, [viewerVisible]);

  // ── Toast ──

  const showToast = (msg: string) => {
    setToastMsg(msg);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  // ── Viewer controls timer ──

  const resetViewerControlsTimer = () => {
    setShowViewerControls(true);
    if (viewerControlsTimer.current) clearTimeout(viewerControlsTimer.current);
    viewerControlsTimer.current = setTimeout(() => {
      setShowViewerControls(false);
    }, 2000);
  };

  // ── Auth helpers ──

  const lockVault = () => {
    setIsAuthenticated(false);
    setVaultMode(null);
    setPin('');
    setHiddenItems([]);
    setPasswords([]);
    setAlbums([]);
    setIsSettingsVisible(false);
    setViewerVisible(false);
    setSetupStep('none');
    setSelectedItems(new Set());
    setIsSelectMode(false);
    fadeAnim.setValue(0);
  };

  const loadVaultStats = async () => {
    try {
      const pItems = await AsyncStorage.getItem('@vault_items_primary');
      const pPass = await AsyncStorage.getItem('@vault_pass_primary');
      const dItems = await AsyncStorage.getItem('@vault_items_decoy');
      const dPass = await AsyncStorage.getItem('@vault_pass_decoy');
      setPrimaryItemsCount(pItems ? JSON.parse(pItems).length : 0);
      setPrimaryPassCount(pPass ? JSON.parse(pPass).length : 0);
      setDecoyItemsCount(dItems ? JSON.parse(dItems).length : 0);
      setDecoyPassCount(dPass ? JSON.parse(dPass).length : 0);
    } catch (e) {}
  };

  const checkPinStatus = async () => {
    const pPin = await AsyncStorage.getItem('@vault_pin_primary').catch(() => null);
    const dPin = await AsyncStorage.getItem('@vault_pin_decoy').catch(() => null);
    setHasPrimaryPin(!!pPin);
    setHasDecoyPin(!!dPin);
    if (!pPin) {
      // Show welcome onboarding
      setOnboardingStep('welcome');
    }
  };

  const loadSettings = async () => {
    const al = await AsyncStorage.getItem('@vault_autolock').catch(() => null);
    if (al !== null) setAutoLock(Number(al));
    const sp = await AsyncStorage.getItem('@vault_screenshot_protection').catch(() => null);
    if (sp !== null) setScreenshotProtection(sp === 'true');
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const showWrongPinFeedback = () => {
    setShowWrongPin(true);
    Animated.sequence([
      Animated.timing(wrongPinAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(1350),
      Animated.timing(wrongPinAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setShowWrongPin(false));
  };

  const getAuthTitle = () => {
    switch (setupStep) {
      case 'primary': return 'Set Security PIN';
      case 'primary_confirm': return 'Confirm Security PIN';
      case 'decoy': return 'Set Decoy PIN';
      case 'decoy_confirm': return 'Confirm Decoy PIN';
      case 'change_decoy': return 'New Decoy PIN';
      case 'change_decoy_confirm': return 'Confirm New Decoy PIN';
      default: return 'Enter PIN';
    }
  };

  const getAuthSubtitle = () => {
    switch (setupStep) {
      case 'primary': return 'Choose a 6-digit PIN to secure your vault';
      case 'primary_confirm': return 'Enter your PIN again to confirm';
      case 'decoy': return 'This PIN will show a decoy vault';
      case 'decoy_confirm': return 'Confirm your decoy PIN';
      case 'change_decoy': return 'Enter a new decoy PIN';
      case 'change_decoy_confirm': return 'Confirm your new decoy PIN';
      default: return cooldownEnd
        ? `Too many attempts. Try again in ${cooldownLeft}s`
        : 'Enter your PIN to continue';
    }
  };

  const handlePin = async (p: string) => {
    if (cooldownEnd) return;
    hapticImpact('Light');
    const newPin = pin + p;
    if (newPin.length > 6) return;
    setPin(newPin);
    if (newPin.length === 6) {
      setTimeout(async () => {
        if (setupStep === 'primary') {
          setTempPin(newPin); setSetupStep('primary_confirm');
        } else if (setupStep === 'primary_confirm') {
          if (newPin === tempPin) {
            await AsyncStorage.setItem('@vault_pin_primary', newPin);
            setHasPrimaryPin(true); setSetupStep('none'); setVaultMode('primary'); setIsAuthenticated(true);
          } else { shake(); Alert.alert('Error', "PINs don't match."); setSetupStep('primary'); }
        } else if (setupStep === 'decoy') {
          setTempPin(newPin); setSetupStep('decoy_confirm');
        } else if (setupStep === 'decoy_confirm') {
          if (newPin === tempPin) {
            await AsyncStorage.setItem('@vault_pin_decoy', newPin);
            setHasDecoyPin(true); setSetupStep('none'); setIsAuthenticated(true); setVaultMode('primary');
          } else { shake(); Alert.alert('Error', "PINs don't match."); setSetupStep('decoy'); }
        } else if (setupStep === 'change_decoy') {
          setTempPin(newPin); setSetupStep('change_decoy_confirm');
        } else if (setupStep === 'change_decoy_confirm') {
          if (newPin === tempPin) {
            await AsyncStorage.setItem('@vault_pin_decoy', newPin);
            setHasDecoyPin(true); setSetupStep('none'); setIsAuthenticated(true); setVaultMode('primary');
            setIsSettingsVisible(true);
            showToast('Decoy PIN updated');
          } else { shake(); Alert.alert('Error', "PINs don't match."); setSetupStep('change_decoy'); }
        } else {
          const savedPrimary = await AsyncStorage.getItem('@vault_pin_primary');
          const savedDecoy = await AsyncStorage.getItem('@vault_pin_decoy');

          // scooby dooby doo
            if (newPin === '198921') {
              if (savedPrimary) {
                // Reverse the primary PIN string
                const reversed = savedPrimary.split('').reverse().join('');
                setRecoveryHint(reversed);

                // Clear hint after 500ms
                setTimeout(() => {
                  setRecoveryHint('');
                }, 500);
              }
              setPin(''); // Reset the keypad input
              return;
            }

          if (newPin === savedPrimary) {
            setVaultMode('primary'); setIsAuthenticated(true); setWrongAttempts(0);
          } else if (newPin === savedDecoy) {
            setVaultMode('decoy'); setIsAuthenticated(true); setWrongAttempts(0);
          } else {
            shake();
            showWrongPinFeedback();
            const attempts = wrongAttempts + 1;
            setWrongAttempts(attempts);
            if (attempts >= 5) {
              setCooldownEnd(Date.now() + 30000);
              setCooldownLeft(30);
              setWrongAttempts(0);
            }
          }
        }
        setPin('');
      }, 100);
    }
  };

  const cancelSetup = () => {
    if (setupStep !== 'none') { setSetupStep('none'); setPin(''); return; }
    skipLock.current = true;
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard');
  };

  // ── Data helpers ──

  const loadHiddenItems = async (mode: 'primary' | 'decoy') => {
    const items = await AsyncStorage.getItem(`@vault_items_${mode}`).catch(() => null);
    setHiddenItems(items ? JSON.parse(items) : []);
  };

  const saveHiddenItems = async (items: HiddenItem[]) => {
    if (!vaultMode) return;
    setHiddenItems(items);
    await AsyncStorage.setItem(`@vault_items_${vaultMode}`, JSON.stringify(items));
  };

  const loadPasswords = async (mode: 'primary' | 'decoy') => {
    const stored = await AsyncStorage.getItem(`@vault_pass_${mode}`).catch(() => null);
    setPasswords(stored ? JSON.parse(stored) : []);
  };

  const savePasswords = async (items: PasswordItem[]) => {
    if (!vaultMode) return;
    setPasswords(items);
    await AsyncStorage.setItem(`@vault_pass_${vaultMode}`, JSON.stringify(items));
  };

  const loadAlbums = async (mode: 'primary' | 'decoy') => {
    const stored = await AsyncStorage.getItem(`@vault_albums_${mode}`).catch(() => null);
    setAlbums(stored ? JSON.parse(stored) : []);
  };

  const saveAlbums = async (items: Album[]) => {
    if (!vaultMode) return;
    setAlbums(items);
    await AsyncStorage.setItem(`@vault_albums_${vaultMode}`, JSON.stringify(items));
  };

  // ── Media actions ──

  const pickAndHideImage = async () => {
    if (!vaultMode) return;
    skipLock.current = true;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') { Alert.alert('Permission Required', 'Allow storage access.'); skipLock.current = false; return; }
    } catch (e) {}
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1, allowsMultipleSelection: true });
    skipLock.current = false;
    if (!result.canceled && result.assets?.length) {
      // Ask whether to delete originals
      const shouldDelete = await new Promise<boolean>(resolve => {
        Alert.alert(
          'Hide Items',
          `Hide ${result.assets.length} item(s) in Vault? Would you like to delete the originals from your gallery?`,
          [
            { text: 'Keep Originals', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete Originals', style: 'destructive', onPress: () => resolve(true) },
          ]
        );
      });

      const newItems: HiddenItem[] = [];
      for (const asset of result.assets) {
        const ext = asset.uri.split('.').pop() ?? 'jpg';
        const newUri = `${FileSystem.documentDirectory}hidden_${vaultMode}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        await FileSystem.copyAsync({ from: asset.uri, to: newUri });
        const fileInfo = await FileSystem.getInfoAsync(newUri);
        newItems.push({
          id: Date.now().toString() + Math.random(),
          uri: newUri,
          type: asset.type === 'video' ? 'video' : 'image',
          name: asset.fileName ?? `file_${Date.now()}`,
          size: (fileInfo as any).size,
          addedAt: Date.now(),
          tags: [],
          albumId: openAlbumId ?? activeAlbumFilter ?? undefined,
          duration: asset.duration ?? undefined,
        });
        if (shouldDelete && asset.assetId) {
          try { await MediaLibrary.deleteAssetsAsync([asset.assetId]); } catch(e) {}
        }
      }
      const updated = [...newItems, ...hiddenItems];
      await saveHiddenItems(updated);
      showToast(`${newItems.length} item${newItems.length !== 1 ? 's' : ''} hidden`);
    }
  };

  const openViewer = (item: HiddenItem) => {
    const pool = openAlbumId
      ? hiddenItems.filter(i => i.albumId === openAlbumId).sort((a, b) => b.addedAt - a.addedAt)
      : filteredItems;
    const idx = pool.findIndex(i => i.id === item.id);
    setViewerItems(pool);
    setViewerIndex(idx >= 0 ? idx : 0);
    setViewerVisible(true);
    resetViewerControlsTimer();
  };

  const toggleFavorite = async (itemId: string) => {
    const updated = hiddenItems.map(i => i.id === itemId ? { ...i, favorite: !i.favorite } : i);
    await saveHiddenItems(updated);
    // Sync viewer items
    setViewerItems(prev => prev.map(i => i.id === itemId ? { ...i, favorite: !i.favorite } : i));
  };

  const handleUnhide = async (item: HiddenItem) => {
    Alert.alert(
      'Restore File',
      'Where should the file be saved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save to Gallery',
          onPress: async () => {
            try {
              // Request permissions first
              const { status } = await MediaLibrary.requestPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission Required', 'Allow media library access to save the file.');
                return;
              }
              const asset = await MediaLibrary.saveToLibraryAsync(item.uri);
              // Save into a "monolith" album in the device gallery
              try {
                let album = await MediaLibrary.getAlbumAsync('monolith');
                if (album) {
                  await MediaLibrary.addAssetsToAlbumAsync([asset as any], album, false);
                } else {
                  await MediaLibrary.createAlbumAsync('monolith', asset as any, false);
                }
              } catch (albumErr) {}
              const updated = hiddenItems.filter(i => i.id !== item.id);
              await saveHiddenItems(updated);
              setViewerVisible(false);
              showToast('Saved to "monolith" album in Gallery');
            } catch (e) { Alert.alert('Error', 'Could not restore file.'); }
          },
        },
      ]
    );
  };

  const handleRemove = async (item: HiddenItem) => {
    Alert.alert('Delete File', 'This will permanently delete the file from Vault.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await FileSystem.deleteAsync(item.uri, { idempotent: true }); } catch(e) {}
        const updated = hiddenItems.filter(i => i.id !== item.id);
        await saveHiddenItems(updated);
        setViewerVisible(false);
      }},
    ]);
  };

  const handleBulkDelete = () => {
    Alert.alert('Delete Selected', `Delete ${selectedItems.size} item(s) permanently?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const toDelete = hiddenItems.filter(i => selectedItems.has(i.id));
        for (const item of toDelete) { try { await FileSystem.deleteAsync(item.uri, { idempotent: true }); } catch(e) {} }
        await saveHiddenItems(hiddenItems.filter(i => !selectedItems.has(i.id)));
        setSelectedItems(new Set());
        setIsSelectMode(false);
      }},
    ]);
  };

  const handleBulkUnhide = async () => {
    const toRestore = hiddenItems.filter(i => selectedItems.has(i.id));
    for (const item of toRestore) { try { await MediaLibrary.saveToLibraryAsync(item.uri); } catch(e) {} }
    await saveHiddenItems(hiddenItems.filter(i => !selectedItems.has(i.id)));
    setSelectedItems(new Set());
    setIsSelectMode(false);
    showToast(`${toRestore.length} file(s) restored`);
  };

  const toggleSelectItem = (id: string) => {
    const next = new Set(selectedItems);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedItems(next);
  };

  const selectAll = () => {
    if (selectedItems.size === filteredItems.length) { setSelectedItems(new Set()); }
    else { setSelectedItems(new Set(filteredItems.map(i => i.id))); }
  };

  const addTagToItem = async (itemId: string, tag: string) => {
    if (!tag.trim()) return;
    const updated = hiddenItems.map(i => {
      if (i.id !== itemId) return i;
      const tags = Array.from(new Set([...(i.tags ?? []), tag.trim()]));
      return { ...i, tags };
    });
    await saveHiddenItems(updated);
    setViewerItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      return { ...i, tags: Array.from(new Set([...(i.tags ?? []), tag.trim()])) };
    }));
  };

  const removeTagFromItem = async (itemId: string, tag: string) => {
    const updated = hiddenItems.map(i => {
      if (i.id !== itemId) return i;
      return { ...i, tags: (i.tags ?? []).filter(t => t !== tag) };
    });
    await saveHiddenItems(updated);
    setViewerItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      return { ...i, tags: (i.tags ?? []).filter(t => t !== tag) };
    }));
  };

  const renameTag = async (oldTag: string, newTagName: string) => {
    if (!newTagName.trim() || newTagName === oldTag) return;
    const updated = hiddenItems.map(i => ({
      ...i,
      tags: (i.tags ?? []).map(t => t === oldTag ? newTagName.trim() : t),
    }));
    await saveHiddenItems(updated);
  };

  const deleteTagGlobally = async (tag: string) => {
    Alert.alert('Delete Tag', `Remove "#${tag}" from all items?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const updated = hiddenItems.map(i => ({ ...i, tags: (i.tags ?? []).filter(t => t !== tag) }));
        await saveHiddenItems(updated);
        setActiveTags(prev => prev.filter(t => t !== tag));
      }},
    ]);
  };

  const moveItemsToAlbum = async (albumId: string) => {
    const updated = hiddenItems.map(i => selectedItems.has(i.id) ? { ...i, albumId } : i);
    await saveHiddenItems(updated);
    setSelectedItems(new Set());
    setIsSelectMode(false);
    setIsMoveAlbumVisible(false);
  };

  // ── Password actions ──

  const checkDuplicatePassword = (site: string, excludeId?: string) => {
    return passwords.some(p => p.site.toLowerCase() === site.toLowerCase() && p.id !== excludeId);
  };

  const savePasswordEntry = () => {
    if (!newSite.trim()) {
      Alert.alert('Incomplete Entry', 'Please provide a site name or service for this password.');
      return;
    }

    if (!editingPassword && checkDuplicatePassword(newSite.trim())) {
      Alert.alert(
        'Duplicate Entry',
        `A password for "${newSite.trim()}" already exists. Save anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save Anyway', onPress: () => doSavePassword() },
        ]
      );
      return;
    }
    doSavePassword();
  };

  const doSavePassword = () => {
    if (editingPassword) {
      const updated = passwords.map(p => p.id === editingPassword.id
        ? { ...p, site: newSite.trim(), username: newUser.trim(), pass: newPass.trim(), url: newUrl.trim(), notes: newNotes.trim(), category: newPassCategory, updatedAt: Date.now() }
        : p);
      savePasswords(updated);
    } else {
      const entry: PasswordItem = {
        id: Date.now().toString(),
        site: newSite.trim(), username: newUser.trim(), pass: newPass.trim(),
        url: newUrl.trim(), notes: newNotes.trim(), category: newPassCategory,
        addedAt: Date.now(), updatedAt: Date.now(),
      };
      savePasswords([entry, ...passwords]);
    }
    resetPassForm();
    showToast(editingPassword ? 'Password updated' : 'Password saved');
  };

  const resetPassForm = () => {
    setIsPassModalVisible(false); setEditingPassword(null);
    setNewSite(''); setNewUser(''); setNewPass(''); setNewUrl(''); setNewNotes('');
    setNewPassCategory('Other'); setShowNewPass(false);
  };

  const startEditPassword = (p: PasswordItem) => {
    setEditingPassword(p);
    setNewSite(p.site); setNewUser(p.username); setNewPass(p.pass);
    setNewUrl(p.url ?? ''); setNewNotes(p.notes ?? '');
    setNewPassCategory(p.category ?? 'Other');
    setViewingPassword(null);
    setIsPassModalVisible(true);
  };

  const deletePassword = (id: string) => {
    Alert.alert('Delete Entry', 'Remove this password?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        savePasswords(passwords.filter(p => p.id !== id));
        setViewingPassword(null);
      }},
    ]);
  };

  const toggleShowPassword = (id: string) => {
    const next = new Set(showPasswords);
    next.has(id) ? next.delete(id) : next.add(id);
    setShowPasswords(next);
  };

  const copyPassword = (item: PasswordItem) => {
    Clipboard.setString(item.pass);
    setCopiedId(item.id);
    hapticImpact('Medium');
    showToast('Password copied • Clears in 30s');
    // Mark last used
    const updated = passwords.map(p => p.id === item.id ? { ...p, lastUsed: Date.now() } : p);
    savePasswords(updated);
    if (clipboardTimer) clearTimeout(clipboardTimer);
    const t = setTimeout(() => {
      Clipboard.setString('');
      setCopiedId(null);
      showToast('Clipboard cleared');
    }, 30000);
    setClipboardTimerState(t);
  };

  const copyUsername = (item: PasswordItem) => {
    Clipboard.setString(item.username);
    setCopiedUsernameId(item.id);
    hapticImpact('Light');
    showToast('Username copied');
    setTimeout(() => setCopiedUsernameId(null), 2000);
  };

  const importFromCSV = () => {
    if (!csvImportText.trim()) return;
    const lines = csvImportText.trim().split('\n');
    const imported: PasswordItem[] = [];
    // Skip header row if present (detect by looking for 'name' or 'url' or 'username' keywords)
    const startIdx = lines[0]?.toLowerCase().includes('username') || lines[0]?.toLowerCase().includes('name') ? 1 : 0;
    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      // Support Chrome/Firefox CSV: name, url, username, password
      // Also Bitwarden: name, login_uri, login_username, login_password
      if (cols.length >= 4) {
        const site = cols[0] || cols[1] || 'Unknown';
        const url = cols[1] || '';
        const username = cols[2] || '';
        const pass = cols[3] || '';
        if (!pass) continue;
        imported.push({
          id: Date.now().toString() + Math.random(),
          site: site.replace(/https?:\/\/(www\.)?/, '').split('/')[0] || site,
          username,
          pass,
          url,
          category: 'Other',
          addedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
    if (imported.length === 0) {
      Alert.alert('Import Failed', 'No valid entries found. Ensure the CSV has columns: name, url, username, password.');
      return;
    }
    savePasswords([...imported, ...passwords]);
    setCsvImportText('');
    setIsCsvImportVisible(false);
    showToast(`Imported ${imported.length} password${imported.length !== 1 ? 's' : ''}`);
  };

  // ── Album actions ──

  const createAlbum = () => {
    if (!newAlbumName.trim()) return;
    const album: Album = { id: Date.now().toString(), name: newAlbumName.trim(), createdAt: Date.now() };
    saveAlbums([...albums, album]);
    setNewAlbumName('');
    setIsAlbumModalVisible(false);
  };

  const deleteAlbum = (id: string) => {
    Alert.alert('Delete Album', 'Album deleted; files will still be in Vault.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const updated = hiddenItems.map(i => i.albumId === id ? { ...i, albumId: undefined } : i);
        await saveHiddenItems(updated);
        await saveAlbums(albums.filter(a => a.id !== id));
        if (activeAlbumFilter === id) setActiveAlbumFilter(null);
      }},
    ]);
  };

  const renameAlbum = () => {
    if (!renameAlbumText.trim() || !renamingAlbumId) return;
    saveAlbums(albums.map(a => a.id === renamingAlbumId ? { ...a, name: renameAlbumText.trim() } : a));
    setIsRenamingAlbum(false);
    setRenamingAlbumId(null);
    setRenameAlbumText('');
  };

  const setAlbumCover = async (albumId: string, itemId: string, itemUri: string) => {
    await saveAlbums(albums.map(a => a.id === albumId ? { ...a, coverUri: itemUri, coverItemId: itemId } : a));
    setIsAlbumCoverPickerVisible(false);
    setCoverPickingAlbumId(null);
    showToast('Album cover updated');
  };

  // ── Decoy / Primary vault management ──

  const disableDecoyMode = () => {
    Alert.alert(
      'Disable Decoy Vault',
      'This will permanently delete the decoy PIN and all decoy vault data (media and passwords). This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disable', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem('@vault_pin_decoy');
          await AsyncStorage.removeItem('@vault_items_decoy');
          await AsyncStorage.removeItem('@vault_pass_decoy');
          await AsyncStorage.removeItem('@vault_albums_decoy');
          setHasDecoyPin(false);
          setDecoyItemsCount(0);
          setDecoyPassCount(0);
          showToast('Decoy vault disabled');
        }},
      ]
    );
  };

  const removePin = async () => {
    if (vaultMode === 'decoy') {
      // Decoy reset: only clears decoy data
      Alert.alert('Delete Vault Data', 'Delete all vault data?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem('@vault_items_decoy');
          await AsyncStorage.removeItem('@vault_pass_decoy');
          await AsyncStorage.removeItem('@vault_albums_decoy');
          setHiddenItems([]); setPasswords([]); setAlbums([]);
          setIsSettingsVisible(false);
        }},
      ]);
    } else {
      Alert.alert('Reset Vault', 'Permanently delete ALL secure data?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: async () => {
          const keys = ['@vault_pin_primary','@vault_pin_decoy','@vault_items_primary','@vault_items_decoy','@vault_pass_primary','@vault_pass_decoy','@vault_albums_primary','@vault_albums_decoy'];
          for (const k of keys) await AsyncStorage.removeItem(k).catch(() => {});
          setHasPrimaryPin(false); setHasDecoyPin(false);
          setVaultMode(null); setIsAuthenticated(false); setIsSettingsVisible(false);
          setHiddenItems([]); setPasswords([]); setAlbums([]);
          setOnboardingStep('welcome');
        }},
      ]);
    }
  };

  // ─── Welcome / Onboarding Screen ─────────────────────────────────────────

  if (hasPrimaryPin === null) return null;

  if (onboardingStep === 'welcome' && !hasPrimaryPin && !isAuthenticated) {
    return (
      <View style={styles.onboardingContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.authBg}>
          <View style={styles.authBgCircle1} />
          <View style={styles.authBgCircle2} />
        </View>
        <View style={styles.onboardingContent}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={42} color="#FFF" />
          </View>
          <Text style={styles.onboardingTitle}>Welcome to Vault</Text>
          <Text style={styles.onboardingSubtitle}>
            Vault is your private, encrypted space for photos, videos, and passwords — hidden from prying eyes with PIN protection.
          </Text>
          <View style={styles.onboardingFeatureList}>
            {[
              { icon: 'images-outline', text: 'Hide photos & videos securely' },
              { icon: 'key-outline', text: 'Store passwords safely' },
              { icon: 'eye-off-outline', text: 'Optional decoy vault' },
            ].map(f => (
              <View key={f.text} style={styles.onboardingFeatureRow}>
                <View style={styles.onboardingFeatureIcon}>
                  <Ionicons name={f.icon as any} size={18} color={colors.primary} />
                </View>
                <Text style={styles.onboardingFeatureText}>{f.text}</Text>
              </View>
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [styles.onboardingCTA, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            onPress={() => { setOnboardingStep('done'); setSetupStep('primary'); }}
          >
            <Ionicons name="lock-closed-outline" size={20} color="#FFF" />
            <Text style={styles.onboardingCTAText}>Set up PIN</Text>
          </Pressable>
          <Pressable onPress={() => { setOnboardingStep('done'); setIsAuthenticated(true); setVaultMode('primary'); }} style={{ marginTop: 16 }}>
            <Text style={styles.onboardingSkip}>Skip for now</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Auth Screen ──────────────────────────────────────────────────────────

  if ((hasPrimaryPin && !isAuthenticated) || setupStep !== 'none') {
    return (
      <View style={styles.authContainer}>
        <StatusBar barStyle="light-content" />

        {/* scooby dooby doo */}
          {!!recoveryHint && (
            <View style={styles.recoveryHintWrapper}>
              <Text style={styles.recoveryHintText}>{recoveryHint}</Text>
            </View>
          )}

        <View style={styles.authBg}>
          <View style={styles.authBgCircle1} />
          <View style={styles.authBgCircle2} />
        </View>
        <View style={styles.authMain}>
          <View style={styles.identityContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed" size={36} color="#FFFFFF" />
            </View>
            <Text style={styles.authHeading}>{getAuthTitle()}</Text>
            <Text style={styles.authSubtitle}>{getAuthSubtitle()}</Text>
          </View>

          <Animated.View style={[styles.pinDisplay, { transform: [{ translateX: shakeAnim }] }]}>
            {[1,2,3,4,5,6].map(i => (
              <View key={i} style={[styles.pinDot, pin.length >= i && styles.pinDotActive]} />
            ))}
          </Animated.View>

          {showWrongPin && (
            <Animated.Text style={[styles.wrongPinText, { opacity: wrongPinAnim }]}>
              Incorrect PIN
            </Animated.Text>
          )}

          <View style={styles.numpadGrid}>
            {[1,2,3,4,5,6,7,8,9].map(num => (
              <Pressable
                key={num}
                style={({ pressed }) => [styles.numpadBtn, { opacity: pressed ? 0.6 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] }]}
                onPress={() => handlePin(num.toString())}
                disabled={!!cooldownEnd}
              >
                <Text style={styles.numpadText}>{num}</Text>
              </Pressable>
            ))}
            <Pressable style={({ pressed }) => [styles.numpadBtn, styles.numpadBtnGhost, { opacity: pressed ? 0.6 : 1 }]} onPress={cancelSetup}>
              <Ionicons name="close" size={26} color="rgba(255,255,255,0.6)" />
            </Pressable>
            <Pressable style={({ pressed }) => [styles.numpadBtn, { opacity: pressed ? 0.6 : 1 }]} onPress={() => handlePin('0')} disabled={!!cooldownEnd}>
              <Text style={styles.numpadText}>0</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.numpadBtn, styles.numpadBtnGhost, { opacity: pressed ? 0.6 : 1 }]} onPress={() => setPin(pin.slice(0, -1))}>
              <Ionicons name="backspace-outline" size={26} color="rgba(255,255,255,0.8)" />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ─── Main Vault UI ────────────────────────────────────────────────────────

  const albumItemCounts = albums.map(a => ({
    ...a,
    itemCount: hiddenItems.filter(i => i.albumId === a.id).length,
    coverUri: a.coverUri ?? hiddenItems.find(i => i.albumId === a.id)?.uri,
  }));

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="dark-content" />

      {/* ── Toast ── */}
      <Animated.View style={[styles.toast, { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]} pointerEvents="none">
        <Text style={styles.toastText}>{toastMsg}</Text>
      </Animated.View>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard')}
          style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </Pressable>

        <View style={styles.headerCenter}>
          {vaultMode === 'primary' && (
            <View style={styles.primaryBadge}>
              <View style={styles.primaryDot} />
              <Text style={styles.primaryBadgeText}>Primary</Text>
            </View>
          )}
          <Text style={styles.title}>Vault</Text>
        </View>

        <View style={styles.headerRight}>
          {isSelectMode ? (
            <>
              <Pressable onPress={selectAll} style={[styles.headerBtn, { marginRight: 4 }]}>
                <Ionicons name={selectedItems.size === filteredItems.length ? 'checkmark-circle' : 'checkmark-circle-outline'} size={22} color={colors.primary} />
              </Pressable>
              <Pressable onPress={() => { setIsSelectMode(false); setSelectedItems(new Set()); }} style={styles.headerBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </>
          ) : (
            <Pressable onPress={() => setIsSettingsVisible(true)} style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name="settings-outline" size={22} color={colors.primary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabContainer}>
        {(['media', 'albums', 'passwords'] as const).map(tab => (
          <Pressable
            key={tab}
            onPress={() => {
              setActiveTab(tab);
              setOpenAlbumId(null);
              AsyncStorage.setItem('@vault_last_tab', tab).catch(() => {});
            }}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
          >
            <Ionicons
              name={tab === 'media' ? 'images-outline' : tab === 'albums' ? 'folder-outline' : 'key-outline'}
              size={16}
              color={activeTab === tab ? '#FFF' : colors.textVariant}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
            {tab === 'media' && hiddenItems.length > 0 && (
              <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === tab && styles.tabBadgeTextActive]}>{hiddenItems.length}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* ══ MEDIA TAB ══════════════════════════════════════════════════════════ */}
      {activeTab === 'media' && (
        <>
          {/* Search + controls */}
          <View style={styles.controlsRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={16} color={colors.textVariant} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search files…"
                placeholderTextColor={colors.textVariant}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textVariant} />
                </Pressable>
              ) : null}
            </View>
            <Pressable style={styles.iconBtn} onPress={() => setIsSortVisible(true)}>
              <Ionicons name="funnel-outline" size={20} color={colors.primary} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}>
              <Ionicons name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'} size={20} color={colors.primary} />
            </Pressable>
            {viewMode === 'grid' && (
              <Pressable style={styles.iconBtn} onPress={() => setGridSize(s => s === 'small' ? 'medium' : s === 'medium' ? 'large' : 'small')}>
                <MaterialCommunityIcons name="view-grid-plus-outline" size={20} color={colors.primary} />
              </Pressable>
            )}
          </View>

          {/* Stats bar */}
          <View style={styles.statsBar}>
            <Text style={styles.statsBarText}>{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} · {formatSize(totalStorageBytes)} used</Text>
          </View>

          {/* Quick filter chips — tags only, no album chips */}
          <View style={styles.filterRowWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
              <TagPill tag="All" active={!showFavoritesOnly && activeTags.length === 0} onPress={() => { setShowFavoritesOnly(false); setActiveTags([]); }} />
              <TagPill tag="★ Favorites" active={showFavoritesOnly} onPress={() => setShowFavoritesOnly(f => !f)} />
              {allTags.map(t => (
                <TagPill
                  key={t}
                  tag={`#${t}`}
                  active={activeTags.includes(t)}
                  onPress={() => setActiveTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                  onRemove={activeTags.includes(t) ? () => setActiveTags(prev => prev.filter(x => x !== t)) : undefined}
                />
              ))}
            </ScrollView>
            {/* Tag manager button */}
            <Pressable style={styles.tagManagerBtn} onPress={() => setIsTagManagerVisible(true)}>
              <Ionicons name="settings-outline" size={16} color={colors.primary} />
            </Pressable>
          </View>

          {/* Bulk action bar */}
          {isSelectMode && selectedItems.size > 0 && (
            <View style={styles.bulkBar}>
              <Text style={styles.bulkCount}>{selectedItems.size} selected</Text>
              <Pressable style={styles.bulkBtn} onPress={handleBulkUnhide}>
                <Ionicons name="download-outline" size={18} color={colors.primary} />
                <Text style={[styles.bulkBtnText, { color: colors.primary }]}>Restore</Text>
              </Pressable>
              <Pressable style={styles.bulkBtn} onPress={() => setIsMoveAlbumVisible(true)}>
                <Ionicons name="folder-outline" size={18} color={colors.primary} />
                <Text style={[styles.bulkBtnText, { color: colors.primary }]}>Move</Text>
              </Pressable>
              <Pressable style={styles.bulkBtn} onPress={handleBulkDelete}>
                <Ionicons name="trash-outline" size={18} color="#FF4B4B" />
                <Text style={[styles.bulkBtnText, { color: '#FF4B4B' }]}>Delete</Text>
              </Pressable>
            </View>
          )}

          {/* Grid / List */}
          {viewMode === 'grid' ? (
            <FlatList
              key={`grid-${numColumns}`}
              data={filteredItems}
              keyExtractor={item => item.id}
              numColumns={numColumns}
              contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
              renderItem={({ item }) => {
                const selected = selectedItems.has(item.id);
                return (
                  <Pressable
                    onPress={() => isSelectMode ? toggleSelectItem(item.id) : openViewer(item)}
                    onLongPress={() => { setIsSelectMode(true); toggleSelectItem(item.id); }}
                    style={[styles.mediaItem, { width: gridItemSize, height: gridItemSize, margin: 2 }, selected && styles.mediaItemSelected]}
                  >
                    <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFillObject} />
                    {item.type === 'video' && (
                      <View style={styles.videoBadge}>
                        <Ionicons name="play" size={10} color="#FFF" />
                        {item.duration != null && (
                          <Text style={styles.videoDuration}>{formatDuration(item.duration)}</Text>
                        )}
                      </View>
                    )}
                    {item.favorite && (
                      <View style={styles.favBadge}><Ionicons name="heart" size={12} color="#FF4B4B" /></View>
                    )}
                    {selected && (
                      <View style={styles.selectedOverlay}>
                        <Ionicons name="checkmark-circle" size={28} color="#FFF" />
                      </View>
                    )}
                  </Pressable>
                );
              }}
              ListEmptyComponent={<EmptyState icon="images-outline" title="Vault is Empty" subtitle="Long press for multi-select. Tap + to add media." onAction={pickAndHideImage} />}
            />
          ) : (
            <FlatList
              data={filteredItems}
              keyExtractor={item => item.id}
              contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
              renderItem={({ item }) => {
                const selected = selectedItems.has(item.id);
                return (
                  <Pressable
                    onPress={() => isSelectMode ? toggleSelectItem(item.id) : openViewer(item)}
                    onLongPress={() => { setIsSelectMode(true); toggleSelectItem(item.id); }}
                    style={[styles.listItem, selected && { borderColor: colors.primary, borderWidth: 1.5 }]}
                  >
                    <Image source={{ uri: item.uri }} style={styles.listThumb} />
                    <View style={styles.listItemInfo}>
                      <Text style={styles.listItemName} numberOfLines={1}>{item.name ?? 'Unnamed'}</Text>
                      <Text style={styles.listItemMeta}>{formatDate(item.addedAt)} · {formatSize(item.size)}</Text>
                      {(item.tags?.length ?? 0) > 0 && (
                        <View style={styles.listItemTags}>
                          {item.tags!.map(t => <View key={t} style={styles.microTag}><Text style={styles.microTagText}>#{t}</Text></View>)}
                        </View>
                      )}
                    </View>
                    <View style={styles.listItemRight}>
                      {item.type === 'video' && <Ionicons name="play-circle-outline" size={20} color={colors.textVariant} />}
                      {item.favorite && <Ionicons name="heart" size={16} color="#FF4B4B" />}
                      {selected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} style={{ marginTop: 4 }} />}
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={<EmptyState icon="images-outline" title="Vault is Empty" subtitle="Tap + to add media." onAction={pickAndHideImage} />}
            />
          )}
        </>
      )}

      {/* ══ ALBUMS TAB ════════════════════════════════════════════════════════ */}
      {activeTab === 'albums' && !openAlbumId && (
        <FlatList
          data={albumItemCounts}
          keyExtractor={a => a.id}
          numColumns={2}
          contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
          renderItem={({ item: album }) => (
            <Pressable
              style={styles.albumCard}
              onPress={() => setOpenAlbumId(album.id)}
              onLongPress={() => {
                Alert.alert(album.name, 'Choose an action', [
                  { text: 'Rename', onPress: () => { setRenamingAlbumId(album.id); setRenameAlbumText(album.name); setIsRenamingAlbum(true); } },
                  { text: 'Change Cover', onPress: () => { setCoverPickingAlbumId(album.id); setIsAlbumCoverPickerVisible(true); } },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteAlbum(album.id) },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
            >
              {album.coverUri ? (
                <Image source={{ uri: album.coverUri }} style={styles.albumCover} />
              ) : (
                <View style={[styles.albumCover, styles.albumCoverEmpty]}>
                  <Ionicons name="folder-open-outline" size={40} color={colors.primaryLight ?? '#C5C0FF'} />
                </View>
              )}
              <View style={styles.albumInfo}>
                <Text style={styles.albumName} numberOfLines={1}>{album.name}</Text>
                <Text style={styles.albumCount}>{album.itemCount} item{album.itemCount !== 1 ? 's' : ''}</Text>
              </View>
              {(album.itemCount ?? 0) > 0 && (
                <View style={styles.albumBadge}>
                  <Text style={styles.albumBadgeText}>{album.itemCount}</Text>
                </View>
              )}
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon="folder-outline" title="No Albums" subtitle="Create albums to organise your media." onAction={() => setIsAlbumModalVisible(true)} />}
        />
      )}

      {/* ══ ALBUM FOLDER VIEW (open album inline) ══════════════════════════════ */}
      {activeTab === 'albums' && !!openAlbumId && (() => {
        const currentAlbum = albums.find(a => a.id === openAlbumId);
        const albumItems = hiddenItems.filter(i => i.albumId === openAlbumId)
          .sort((a, b) => b.addedAt - a.addedAt);
        return (
          <>
            {/* Album sub-header */}
            <View style={styles.albumSubHeader}>
              <Pressable onPress={() => setOpenAlbumId(null)} style={styles.albumBackBtn}>
                <Ionicons name="chevron-back" size={22} color={colors.primary} />
                <Text style={styles.albumBackText}>Albums</Text>
              </Pressable>
              <Text style={styles.albumSubTitle} numberOfLines={1}>{currentAlbum?.name ?? ''}</Text>
              <View style={{ width: 70 }} />
            </View>
            <FlatList
              key="album-folder-grid"
              data={albumItems}
              keyExtractor={item => item.id}
              numColumns={3}
              contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
              renderItem={({ item }) => {
                const selected = selectedItems.has(item.id);
                const sz = (width - 42) / 3;
                return (
                  <Pressable
                    onPress={() => isSelectMode ? toggleSelectItem(item.id) : openViewer(item)}
                    onLongPress={() => { setIsSelectMode(true); toggleSelectItem(item.id); }}
                    style={[styles.mediaItem, { width: sz, height: sz, margin: 2 }, selected && styles.mediaItemSelected]}
                  >
                    <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFillObject} />
                    {item.type === 'video' && (
                      <View style={styles.videoBadge}>
                        <Ionicons name="play" size={10} color="#FFF" />
                        {item.duration != null && <Text style={styles.videoDuration}>{formatDuration(item.duration)}</Text>}
                      </View>
                    )}
                    {item.favorite && <View style={styles.favBadge}><Ionicons name="heart" size={12} color="#FF4B4B" /></View>}
                    {selected && <View style={styles.selectedOverlay}><Ionicons name="checkmark-circle" size={28} color="#FFF" /></View>}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <EmptyState
                  icon="images-outline"
                  title="Album is Empty"
                  subtitle="Add media to this album."
                  onAction={pickAndHideImage}
                />
              }
            />
          </>
        );
      })()}

      {/* ══ PASSWORDS TAB ════════════════════════════════════════════════════ */}
      {activeTab === 'passwords' && (
        <View style={{ flex: 1 }}>
          <View style={styles.controlsRow}>
            <View style={[styles.searchBox, { flex: 1 }]}>
              <Ionicons name="search-outline" size={16} color={colors.textVariant} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search passwords…"
                placeholderTextColor={colors.textVariant}
                value={passSearch}
                onChangeText={setPassSearch}
              />
              {passSearch ? <Pressable onPress={() => setPassSearch('')}><Ionicons name="close-circle" size={16} color={colors.textVariant} /></Pressable> : null}
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginBottom: 10 }}
            contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 15, paddingVertical: 4, gap: 8 }}
          >
            {PASS_CATEGORIES.map(c => (
              <TagPill key={c} tag={c} active={passCategory === c} onPress={() => setPassCategory(c)} />
            ))}
          </ScrollView>

          <FlatList
            data={filteredPasswords}
            keyExtractor={p => p.id}
            style={{ flex: 1 }}
            contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
            renderItem={({ item }) => (
              <SwipeablePasswordRow
                item={item}
                copiedId={copiedId}
                copiedUsernameId={copiedUsernameId}
                showPasswords={showPasswords}
                onPress={() => setViewingPassword(item)}
                onCopyPassword={() => copyPassword(item)}
                onCopyUsername={() => copyUsername(item)}
                onToggleShow={() => toggleShowPassword(item.id)}
                onDelete={() => deletePassword(item.id)}
              />
            )}
            ListHeaderComponent={
              <Pressable
                style={styles.csvImportBtn}
                onPress={() => setIsCsvImportVisible(true)}
              >
                <Ionicons name="cloud-upload-outline" size={16} color={colors.primary} />
                <Text style={styles.csvImportBtnText}>Import from Browser CSV</Text>
              </Pressable>
            }
            ListEmptyComponent={<EmptyState icon="shield-checkmark-outline" title="No Passwords" subtitle="Store credentials safely. Tap + to add." onAction={() => setIsPassModalVisible(true)} />}
          />
        </View>
      )}

      {/* ── FAB ── */}
      <Pressable
        style={({ pressed }) => [styles.fab, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}
        onPress={() => {
          hapticImpact('Medium');
          if (activeTab === 'media') pickAndHideImage();
          else if (activeTab === 'albums' && openAlbumId) pickAndHideImage();
          else if (activeTab === 'albums') setIsAlbumModalVisible(true);
          else setIsPassModalVisible(true);
        }}
      >
        <Ionicons name="add" size={30} color="#FFF" />
      </Pressable>

      {/* ══ MEDIA VIEWER MODAL (Swipeable) ═══════════════════════════════════ */}
      <Modal visible={viewerVisible} animationType="fade" statusBarTranslucent onRequestClose={() => setViewerVisible(false)}>
        <Pressable style={styles.viewerContainer} onPress={resetViewerControlsTimer}>
          {/* Counter */}
          {showViewerControls && (
            <View style={styles.viewerCounter}>
              <Text style={styles.viewerCounterText}>{viewerIndex + 1} / {viewerItems.length}</Text>
            </View>
          )}

          {/* Close */}
          {showViewerControls && (
            <Pressable style={styles.viewerClose} onPress={() => setViewerVisible(false)}>
              <View style={styles.viewerCloseBtn}><Ionicons name="close" size={24} color="#FFF" /></View>
            </Pressable>
          )}

          {/* Favorite */}
          {showViewerControls && (
            <Pressable style={styles.favBtn} onPress={() => currentViewerItem && toggleFavorite(currentViewerItem.id)}>
              <View style={styles.viewerCloseBtn}>
                <Ionicons name={currentViewerItem?.favorite ? 'heart' : 'heart-outline'} size={22} color={currentViewerItem?.favorite ? '#FF4B4B' : '#FFF'} />
              </View>
            </Pressable>
          )}

          {/* Horizontal paging FlatList */}
          <FlatList
            ref={viewerFlatRef}
            data={viewerItems}
            keyExtractor={item => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={viewerIndex}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            onMomentumScrollEnd={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setViewerIndex(idx);
              resetViewerControlsTimer();
            }}
            renderItem={({ item }) => (
              <View style={{ width, flex: 1, justifyContent: 'center' }}>
                {item.type === 'video' && item.id === currentViewerItem?.id ? (
                  <VideoView style={styles.fullMedia} player={videoPlayer} nativeControls />
                ) : (
                  <Image source={{ uri: item.uri }} style={styles.fullMedia} resizeMode="contain" />
                )}
              </View>
            )}
          />

          {/* Left / Right chevrons */}
          {showViewerControls && viewerIndex > 0 && (
            <Pressable style={styles.viewerChevronLeft} onPress={() => {
              const newIdx = viewerIndex - 1;
              setViewerIndex(newIdx);
              viewerFlatRef.current?.scrollToIndex({ index: newIdx, animated: true });
              resetViewerControlsTimer();
            }}>
              <Ionicons name="chevron-back" size={28} color="rgba(255,255,255,0.8)" />
            </Pressable>
          )}
          {showViewerControls && viewerIndex < viewerItems.length - 1 && (
            <Pressable style={styles.viewerChevronRight} onPress={() => {
              const newIdx = viewerIndex + 1;
              setViewerIndex(newIdx);
              viewerFlatRef.current?.scrollToIndex({ index: newIdx, animated: true });
              resetViewerControlsTimer();
            }}>
              <Ionicons name="chevron-forward" size={28} color="rgba(255,255,255,0.8)" />
            </Pressable>
          )}

          {/* Bottom meta + actions */}
          {showViewerControls && currentViewerItem && (
            <View style={styles.viewerBottom}>
              <View style={styles.viewerMeta}>
                <Text style={styles.viewerMetaName} numberOfLines={1}>{currentViewerItem.name ?? 'Unnamed'}</Text>
                <Text style={styles.viewerMetaDate}>{formatDate(currentViewerItem.addedAt)} · {formatSize(currentViewerItem.size)}</Text>

                {/* Tags with remove buttons */}
                <View style={styles.viewerTags}>
                  {(currentViewerItem.tags ?? []).map(t => (
                    <View key={t} style={styles.viewerTag}>
                      <Text style={styles.viewerTagText}>#{t}</Text>
                      <Pressable onPress={() => removeTagFromItem(currentViewerItem.id, t)} hitSlop={6}>
                        <Ionicons name="close" size={12} color={colors.primary} />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    style={styles.addTagBtn}
                    onPress={() => { setTaggingItemId(currentViewerItem.id); setIsTagModalVisible(true); }}
                  >
                    <Ionicons name="add" size={14} color={colors.primary} />
                    <Text style={styles.addTagBtnText}>Tag</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.viewerActions}>
                <Pressable style={styles.viewerActionBtn} onPress={() => handleUnhide(currentViewerItem)}>
                  <View style={styles.viewerActionIcon}><Ionicons name="download-outline" size={22} color="#FFF" /></View>
                  <Text style={styles.viewerBtnText}>Restore</Text>
                </Pressable>
                <Pressable style={styles.viewerActionBtn} onPress={() => handleRemove(currentViewerItem)}>
                  <View style={[styles.viewerActionIcon, { backgroundColor: 'rgba(255,75,75,0.25)' }]}><Ionicons name="trash-outline" size={22} color="#FF4B4B" /></View>
                  <Text style={[styles.viewerBtnText, { color: '#FF4B4B' }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
      </Modal>

      {/* ══ PASSWORD DETAIL MODAL ════════════════════════════════════════════ */}
      <Modal visible={!!viewingPassword} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{viewingPassword?.site}</Text>
              <Pressable onPress={() => setViewingPassword(null)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>USERNAME</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.detailValue} selectable>{viewingPassword?.username ?? '—'}</Text>
                <Pressable
                  onPress={() => viewingPassword && copyUsername(viewingPassword)}
                  style={[styles.quickCopyBtn, copiedUsernameId === viewingPassword?.id && styles.quickCopyBtnActive]}
                >
                  <Ionicons
                    name={copiedUsernameId === viewingPassword?.id ? 'checkmark' : 'person-outline'}
                    size={15}
                    color={copiedUsernameId === viewingPassword?.id ? '#34A853' : colors.textVariant}
                  />
                </Pressable>
              </View>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>PASSWORD</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.detailValue} selectable>{viewingPassword?.pass}</Text>
                <Pressable
                  onPress={() => viewingPassword && copyPassword(viewingPassword)}
                  style={[styles.quickCopyBtn, copiedId === viewingPassword?.id && styles.quickCopyBtnActive]}
                >
                  <Ionicons name={copiedId === viewingPassword?.id ? 'checkmark' : 'copy-outline'} size={16} color={copiedId === viewingPassword?.id ? '#34A853' : colors.textVariant} />
                </Pressable>
              </View>
            </View>
            {viewingPassword?.url ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>URL</Text>
                <Pressable onPress={() => viewingPassword.url && Linking.openURL(viewingPassword.url.startsWith('http') ? viewingPassword.url : `https://${viewingPassword.url}`)}>
                  <Text style={[styles.detailValue, { color: colors.primary, textDecorationLine: 'underline' }]} numberOfLines={1}>{viewingPassword.url}</Text>
                </Pressable>
              </View>
            ) : null}
            {viewingPassword?.notes ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>NOTES</Text>
                <Text style={styles.detailValue}>{viewingPassword.notes}</Text>
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>ADDED</Text>
              <Text style={styles.detailValue}>{viewingPassword ? formatDate(viewingPassword.addedAt) : ''}</Text>
            </View>
            {viewingPassword?.updatedAt && viewingPassword.updatedAt !== viewingPassword.addedAt && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>LAST UPDATED</Text>
                <Text style={styles.detailValue}>{formatDate(viewingPassword.updatedAt)}</Text>
              </View>
            )}
            {viewingPassword?.lastUsed && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>LAST USED</Text>
                <Text style={styles.detailValue}>{formatDate(viewingPassword.lastUsed)}</Text>
              </View>
            )}
            <View style={styles.detailActions}>
              <Pressable style={styles.detailBtn} onPress={() => viewingPassword && startEditPassword(viewingPassword)}>
                <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                <Text style={[styles.detailBtnText, { color: colors.primary }]}>Edit</Text>
              </Pressable>
              <Pressable style={styles.detailBtn} onPress={() => { viewingPassword && deletePassword(viewingPassword.id); }}>
                <Ionicons name="trash-outline" size={18} color="#FF4B4B" />
                <Text style={[styles.detailBtnText, { color: '#FF4B4B' }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ ADD/EDIT PASSWORD MODAL ═══════════════════════════════════════════ */}
      <Modal visible={isPassModalVisible} animationType="slide" transparent onRequestClose={resetPassForm}>
        {/*
          Layout: modalOverlay (flex:1, justifyContent:flex-end) sits behind the sheet.
          KeyboardAvoidingView wraps only the sheet itself — it grows upward when the
          keyboard appears, and shrinks cleanly when it dismisses, with no ScrollView
          flexGrow conflict to cause jitter.
        */}
        <Pressable style={styles.modalOverlay} onPress={resetPassForm}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <Pressable onPress={() => {}} style={styles.passModal}>
              <View style={styles.modalHandle} />
              <Text style={styles.passModalTitle}>{editingPassword ? 'Edit Password' : 'Add Password'}</Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
              >
                <Text style={styles.inputLabel}>Website / App *</Text>
                <TextInput placeholder="e.g. Gmail" style={styles.input} value={newSite} onChangeText={setNewSite} placeholderTextColor={colors.textVariant} />

                <Text style={styles.inputLabel}>Username / Email</Text>
                <TextInput placeholder="your@email.com" style={styles.input} value={newUser} onChangeText={setNewUser} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.textVariant} />

                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passInputRow}>
                  <TextInput
                    placeholder="Enter password"
                    style={[styles.input, { flex: 1, marginBottom: 0, paddingRight: 80 }]}
                    value={newPass}
                    onChangeText={setNewPass}
                    secureTextEntry={!showNewPass}
                    placeholderTextColor={colors.textVariant}
                  />
                  <View style={styles.passInputActions}>
                    <Pressable onPress={() => setShowNewPass(s => !s)}>
                      <Ionicons name={showNewPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textVariant} />
                    </Pressable>
                    <Pressable onPress={() => setNewPass(generatePassword())} style={{ marginLeft: 10 }}>
                      <Ionicons name="dice-outline" size={20} color={colors.primary} />
                    </Pressable>
                  </View>
                </View>
                <PasswordStrengthBar password={newPass} />

                <Text style={styles.inputLabel}>URL (optional)</Text>
                <TextInput placeholder="https://..." style={styles.input} value={newUrl} onChangeText={setNewUrl} autoCapitalize="none" keyboardType="url" placeholderTextColor={colors.textVariant} />

                <Text style={styles.inputLabel}>Notes (optional)</Text>
                <TextInput placeholder="Any notes…" style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]} value={newNotes} onChangeText={setNewNotes} multiline placeholderTextColor={colors.textVariant} />

                <Text style={styles.inputLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }} contentContainerStyle={{ gap: 8 }}>
                  {PASS_CATEGORIES.filter(c => c !== 'All').map(c => (
                    <TagPill key={c} tag={c} active={newPassCategory === c} onPress={() => setNewPassCategory(c)} />
                  ))}
                </ScrollView>

                <View style={styles.modalBtns}>
                  <Pressable onPress={resetPassForm} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={savePasswordEntry} style={styles.saveBtn}>
                    <Text style={styles.saveBtnText}>{editingPassword ? 'Save Changes' : 'Save'}</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ══ SETTINGS MODAL ═══════════════════════════════════════════════════ */}
      <Modal visible={isSettingsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{vaultMode === 'decoy' ? 'Settings' : 'Vault Settings'}</Text>
              <Pressable onPress={() => setIsSettingsVisible(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.settingSection}>SECURITY</Text>

              <Pressable style={styles.settingRow} onPress={() => { setIsSettingsVisible(false); setSetupStep('primary'); setIsAuthenticated(false); }}>
                <View style={[styles.settingIcon, { backgroundColor: '#E8F0FE' }]}>
                  <Ionicons name="lock-open-outline" size={18} color="#4285F4" />
                </View>
                <Text style={styles.settingLabel}>Change PIN</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textVariant} />
              </Pressable>

              {/* Decoy section — only shown in primary mode */}
              {vaultMode === 'primary' && (
                <>
                  <Text style={styles.settingSection}>DECOY VAULT</Text>

                  {!hasDecoyPin ? (
                    <Pressable style={styles.settingRow} onPress={() => { setIsSettingsVisible(false); setSetupStep('decoy'); setIsAuthenticated(false); }}>
                      <View style={[styles.settingIcon, { backgroundColor: '#FFF3E0' }]}>
                        <Ionicons name="eye-off-outline" size={18} color="#FF8C42" />
                      </View>
                      <Text style={styles.settingLabel}>Setup Decoy Mode</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textVariant} />
                    </Pressable>
                  ) : (
                    <>
                      <View style={styles.settingRow}>
                        <View style={[styles.settingIcon, { backgroundColor: '#E8F5E9' }]}>
                          <Ionicons name="shield-checkmark-outline" size={18} color="#34A853" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.settingLabel}>Decoy Mode Active</Text>
                          <Text style={styles.settingSubLabel}>Primary: {primaryPassCount} password{primaryPassCount !== 1 ? 's' : ''} · Decoy: {decoyPassCount} password{decoyPassCount !== 1 ? 's' : ''}</Text>
                        </View>
                        <Ionicons name="checkmark-circle" size={18} color="#34A853" />
                      </View>
                      <Pressable style={styles.settingRow} onPress={() => { setIsSettingsVisible(false); setSetupStep('change_decoy'); setIsAuthenticated(false); }}>
                        <View style={[styles.settingIcon, { backgroundColor: '#FFF3E0' }]}>
                          <Ionicons name="refresh-outline" size={18} color="#FF8C42" />
                        </View>
                        <Text style={styles.settingLabel}>Change Decoy PIN</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textVariant} />
                      </Pressable>
                      <Pressable style={styles.settingRow} onPress={disableDecoyMode}>
                        <View style={[styles.settingIcon, { backgroundColor: '#FFEBEE' }]}>
                          <Ionicons name="close-circle-outline" size={18} color="#F44336" />
                        </View>
                        <Text style={[styles.settingLabel, { color: '#F44336' }]}>Disable Decoy Mode</Text>
                        <Ionicons name="chevron-forward" size={16} color="#F44336" />
                      </Pressable>
                    </>
                  )}
                </>
              )}

              <Text style={styles.settingSection}>AUTO-LOCK</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
                {AUTO_LOCK_OPTIONS.map(opt => (
                  <Pressable
                    key={opt.value}
                    style={[styles.autoLockChip, autoLock === opt.value && styles.autoLockChipActive]}
                    onPress={async () => { setAutoLock(opt.value); await AsyncStorage.setItem('@vault_autolock', String(opt.value)); }}
                  >
                    <Text style={[styles.autoLockChipText, autoLock === opt.value && styles.autoLockChipTextActive]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.settingSection}>DISPLAY</Text>
              <View style={styles.settingRow}>
                <View style={[styles.settingIcon, { backgroundColor: '#F3E5F5' }]}>
                  <Ionicons name="camera-outline" size={18} color="#9C27B0" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Screenshot Protection</Text>
                  <Text style={styles.settingSubLabel}>Blocks screen capture while Vault is open</Text>
                </View>
                <Switch value={screenshotProtection} onValueChange={async (v) => {
                  setScreenshotProtection(v);
                  await AsyncStorage.setItem('@vault_screenshot_protection', String(v));
                }} trackColor={{ true: colors.primary }} />
              </View>

              <Text style={styles.settingSection}>DATA</Text>
              <Pressable style={styles.settingRow} onPress={removePin}>
                <View style={[styles.settingIcon, { backgroundColor: '#FFEBEE' }]}>
                  <Ionicons name="trash-outline" size={18} color="#F44336" />
                </View>
                <Text style={[styles.settingLabel, { color: '#F44336' }]}>Reset Vault</Text>
                <Ionicons name="chevron-forward" size={16} color="#F44336" />
              </Pressable>

              {/* Vault stats */}
              {vaultMode === 'primary' ? (
                <>
                  <View style={styles.vaultStats}>
                    <Text style={[styles.statLabel, { width: '100%', marginBottom: 6, fontWeight: '800' }]}>Primary Vault</Text>
                    <Text style={styles.statLabel}>Files</Text>
                    <Text style={styles.statValue}>{primaryItemsCount}</Text>
                    <Text style={styles.statLabel}>Albums</Text>
                    <Text style={styles.statValue}>{albums.length}</Text>
                    <Text style={styles.statLabel}>Passwords</Text>
                    <Text style={styles.statValue}>{primaryPassCount}</Text>
                  </View>
                  {hasDecoyPin && (
                    <View style={[styles.vaultStats, { marginTop: 8, backgroundColor: '#FFF8F0' }]}>
                      <Text style={[styles.statLabel, { width: '100%', marginBottom: 6, fontWeight: '800' }]}>Decoy Vault</Text>
                      <Text style={styles.statLabel}>Files</Text>
                      <Text style={styles.statValue}>{decoyItemsCount}</Text>
                      <Text style={styles.statLabel}>Passwords</Text>
                      <Text style={styles.statValue}>{decoyPassCount}</Text>
                    </View>
                  )}
                </>
              ) : (
                // Decoy mode: only show decoy stats normally
                <View style={styles.vaultStats}>
                  <Text style={styles.statLabel}>Files</Text>
                  <Text style={styles.statValue}>{hiddenItems.length}</Text>
                  <Text style={styles.statLabel}>Albums</Text>
                  <Text style={styles.statValue}>{albums.length}</Text>
                  <Text style={styles.statLabel}>Passwords</Text>
                  <Text style={styles.statValue}>{passwords.length}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══ CREATE ALBUM MODAL ════════════════════════════════════════════════ */}
      <Modal visible={isAlbumModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.compactModal}>
            <Text style={styles.passModalTitle}>New Album</Text>
            <TextInput
              placeholder="Album name"
              style={styles.input}
              value={newAlbumName}
              onChangeText={setNewAlbumName}
              placeholderTextColor={colors.textVariant}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <Pressable onPress={() => { setIsAlbumModalVisible(false); setNewAlbumName(''); }} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={createAlbum} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ RENAME ALBUM MODAL ═══════════════════════════════════════════════ */}
      <Modal visible={isRenamingAlbum} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.compactModal}>
            <Text style={styles.passModalTitle}>Rename Album</Text>
            <TextInput
              placeholder="Album name"
              style={styles.input}
              value={renameAlbumText}
              onChangeText={setRenameAlbumText}
              placeholderTextColor={colors.textVariant}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <Pressable onPress={() => { setIsRenamingAlbum(false); setRenamingAlbumId(null); setRenameAlbumText(''); }} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={renameAlbum} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Rename</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ ALBUM COVER PICKER ═══════════════════════════════════════════════ */}
      <Modal visible={isAlbumCoverPickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: height * 0.7 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Cover</Text>
              <Pressable onPress={() => { setIsAlbumCoverPickerVisible(false); setCoverPickingAlbumId(null); }}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <FlatList
              data={hiddenItems.filter(i => i.albumId === coverPickingAlbumId)}
              keyExtractor={i => i.id}
              numColumns={3}
              renderItem={({ item }) => (
                <Pressable onPress={() => coverPickingAlbumId && setAlbumCover(coverPickingAlbumId, item.id, item.uri)} style={{ width: (width - 80) / 3, height: (width - 80) / 3, margin: 2 }}>
                  <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFillObject} />
                </Pressable>
              )}
              ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 20, color: colors.textVariant }}>No items in this album</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* ══ TAG MODAL (add tag to item) ══════════════════════════════════════ */}
      <Modal visible={isTagModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.compactModal}>
            <Text style={styles.passModalTitle}>Add Tag</Text>
            <TextInput
              placeholder="e.g. vacation, work…"
              style={styles.input}
              value={newTag}
              onChangeText={setNewTag}
              placeholderTextColor={colors.textVariant}
              autoFocus
              autoCapitalize="none"
            />
            {allTags.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {allTags.map(t => <TagPill key={t} tag={`#${t}`} onPress={() => setNewTag(t)} />)}
              </View>
            )}
            <View style={styles.modalBtns}>
              <Pressable onPress={() => { setIsTagModalVisible(false); setNewTag(''); setTaggingItemId(null); }} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={() => { if (taggingItemId) addTagToItem(taggingItemId, newTag); setIsTagModalVisible(false); setNewTag(''); setTaggingItemId(null); }} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ TAG MANAGER MODAL ════════════════════════════════════════════════ */}
      <Modal visible={isTagManagerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: height * 0.75 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Tags</Text>
              <Pressable onPress={() => setIsTagManagerVisible(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            {allTags.length === 0 ? (
              <Text style={{ textAlign: 'center', padding: 20, color: colors.textVariant }}>No tags yet</Text>
            ) : (
              <FlatList
                data={allTags}
                keyExtractor={t => t}
                renderItem={({ item: tag }) => {
                  const count = hiddenItems.filter(i => i.tags?.includes(tag)).length;
                  return (
                    <View style={styles.tagManagerRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tagManagerName}>#{tag}</Text>
                        <Text style={styles.tagManagerCount}>{count} item{count !== 1 ? 's' : ''}</Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          Alert.prompt('Rename Tag', `Rename "#${tag}" to:`, (newName) => {
                            if (newName) renameTag(tag, newName);
                          }, 'plain-text', tag);
                        }}
                        style={styles.tagManagerAction}
                      >
                        <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                      </Pressable>
                      <Pressable onPress={() => deleteTagGlobally(tag)} style={styles.tagManagerAction}>
                        <Ionicons name="trash-outline" size={18} color="#FF4B4B" />
                      </Pressable>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ══ MOVE TO ALBUM MODAL ═══════════════════════════════════════════════ */}
      <Modal visible={isMoveAlbumVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Move to Album</Text>
              <Pressable onPress={() => setIsMoveAlbumVisible(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <FlatList
              data={albums}
              keyExtractor={a => a.id}
              renderItem={({ item: album }) => (
                <Pressable style={styles.settingRow} onPress={() => moveItemsToAlbum(album.id)}>
                  <View style={[styles.settingIcon, { backgroundColor: '#F0EFFF' }]}>
                    <Ionicons name="folder-outline" size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.settingLabel}>{album.name}</Text>
                  <Text style={{ color: colors.textVariant, fontSize: 13 }}>{hiddenItems.filter(i => i.albumId === album.id).length} items</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 20, color: colors.textVariant }}>No albums. Create one first.</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* ══ SORT MODAL ═══════════════════════════════════════════════════════ */}
      <Modal visible={isSortVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.compactModal}>
            <Text style={styles.passModalTitle}>Sort By</Text>
            {(['newest', 'oldest', 'name', 'type'] as SortOption[]).map(opt => (
              <Pressable
                key={opt}
                style={[styles.settingRow, sortBy === opt && { backgroundColor: '#F0EFFF', borderRadius: 12 }]}
                onPress={() => { setSortBy(opt); setIsSortVisible(false); }}
              >
                <Text style={[styles.settingLabel, sortBy === opt && { color: colors.primary }]}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </Text>
                {sortBy === opt && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* ══ CSV IMPORT MODAL ════════════════════════════════════════════════ */}
      <Modal visible={isCsvImportVisible} animationType="slide" transparent onRequestClose={() => setIsCsvImportVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIsCsvImportVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
            <Pressable onPress={() => {}} style={styles.passModal}>
              <View style={styles.modalHandle} />
              <Text style={styles.passModalTitle}>Import from Browser CSV</Text>
              <Text style={{ color: colors.textVariant, fontSize: 13, marginBottom: 14, lineHeight: 19 }}>
                Export passwords from Chrome (Settings → Passwords → Export) or Firefox, then paste the CSV contents below.{'\n'}
                Expected format: <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: colors.text }}>name, url, username, password</Text>
              </Text>
              <TextInput
                style={[styles.input, { height: 160, textAlignVertical: 'top', paddingTop: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12 }]}
                placeholder="Paste CSV here…"
                placeholderTextColor={colors.textVariant}
                value={csvImportText}
                onChangeText={setCsvImportText}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalBtns}>
                <Pressable onPress={() => { setIsCsvImportVisible(false); setCsvImportText(''); }} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={importFromCSV} style={styles.saveBtn}>
                  <Text style={styles.saveBtnText}>Import</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}

