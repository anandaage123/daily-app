import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions, 
  Alert, 
  Keyboard, 
  Animated, 
  Platform, 
  Modal, 
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
const cacheDirectory = (FileSystem as any).cacheDirectory;
const writeAsStringAsync = (FileSystem as any).writeAsStringAsync;
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { Typography, Shadows, Spacing } from '../theme/Theme';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

type Mood = '😀' | '😌' | '😐' | '😩' | '😡';
const MOODS: Mood[] = ['😀', '😌', '😐', '😩', '😡'];
const CATEGORIES = ['All', 'Personal', 'Work', 'Ideas', 'Travel', 'Dreams'];

interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
  mood?: Mood;
  category: string;
}

export default function NotesScreen() {
  const { colors, isDark } = useTheme();
  
  const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: colors.background },
    authContainer: { flex: 1, backgroundColor: colors.background },
    authMain: { flex: 1, paddingHorizontal: 30, justifyContent: 'center' },
    identitySection: { alignItems: 'center', marginBottom: 40 },
    enhancedIconContainer: { marginBottom: 20 },
    iconCircle: { width: 80, height: 80, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
    authHeading: { ...Typography.header, fontSize: 32, textAlign: 'center', color: colors.text },
    authSubtext: { ...Typography.body, color: colors.textVariant, textAlign: 'center', marginTop: 8 },
    pinDisplay: { flexDirection: 'row', gap: 15, justifyContent: 'center', marginVertical: 40, height: 20 },
    pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.primary },
    pinDotActive: { backgroundColor: colors.primary },
    keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, justifyContent: 'center' },
    keypadBtn: { width: 75, height: 75, borderRadius: 38, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', ...Shadows.soft },
    keypadText: { ...Typography.title, fontSize: 24, color: colors.text },
    keypadBtnText: { ...Typography.title, fontSize: 24, color: colors.text },

    container: { flex: 1, backgroundColor: colors.background },
    appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
    logoText: { ...Typography.header, fontSize: 32, color: colors.text },
    appBarSub: { ...Typography.caption, color: colors.textVariant, fontWeight: '700' },
    headerIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', ...Shadows.soft },

    summaryBar: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 20 },
    summaryItem: { flex: 1 },
    summaryLabel: { ...Typography.caption, color: colors.textVariant },
    summaryVal: { ...Typography.title, color: colors.text },
    summaryDivider: { width: 1, height: 30, backgroundColor: colors.surfaceContainer, marginHorizontal: 15 },

    searchSection: { paddingHorizontal: 24, marginBottom: 20 },
    searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 15, paddingHorizontal: 15, height: 50, ...Shadows.soft },
    searchInput: { flex: 1, marginLeft: 10, ...Typography.body, color: colors.text },

    filterBar: { paddingBottom: 10 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.surface, marginRight: 10, borderWidth: 1, borderColor: colors.surfaceContainer },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipText: { ...Typography.caption, fontWeight: '700', color: colors.textVariant },

    notesGrid: { paddingHorizontal: 24, paddingBottom: 120 },
    noteCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, marginBottom: 16, ...Shadows.soft },
    noteTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    cardIndicatorMood: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
    noteCardTitle: { ...Typography.title, fontSize: 18, color: colors.text },
    noteDateText: { ...Typography.caption, color: colors.textVariant },
    noteCardContent: { ...Typography.body, fontSize: 15, color: colors.textVariant, lineHeight: 22 },
    noteBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: colors.background },
    bottomTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.background },
    tagBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.background },
    tagText: { ...Typography.caption, fontSize: 10, color: colors.primary, fontWeight: '700' },

    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 20, ...Shadows.soft },
    emptyTextTitle: { ...Typography.title, color: colors.text },
    emptyTextSub: { ...Typography.body, color: colors.textVariant, textAlign: 'center', paddingHorizontal: 40 },

    fabMain: { position: 'absolute', bottom: 30, right: 30, width: 64, height: 64, borderRadius: 32, ...Shadows.soft },
    fabInner: { width: '100%', height: '100%', borderRadius: 32, justifyContent: 'center', alignItems: 'center' },

    editorScreen: { flex: 1, backgroundColor: colors.background },
    editorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 20 },
    headerTitleMain: { ...Typography.title, color: colors.text },
    navText: { ...Typography.body, color: colors.textVariant, fontWeight: '600' },

    editControls: { paddingHorizontal: 20, marginBottom: 20 },
    selectorGroup: { marginBottom: 20 },
    labelSmall: { ...Typography.caption, fontWeight: '800', color: colors.textVariant, marginBottom: 10 },
    moodRow: { flexDirection: 'row', gap: 10 },
    moodBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', ...Shadows.soft },
    moodActive: { backgroundColor: colors.primary },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceContainer },
    catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { ...Typography.caption, fontWeight: '700', color: colors.textVariant },
    catChipText: { ...Typography.caption, fontWeight: '700', color: colors.textVariant },

    titleInput: { ...Typography.header, fontSize: 28, paddingHorizontal: 20, marginBottom: 10, color: colors.text },
    contentInput: { ...Typography.body, paddingHorizontal: 20, color: colors.text, fontSize: 17, minHeight: 400, textAlignVertical: 'top' },

    viewContainer: { flex: 1, backgroundColor: colors.background },
    viewContent: { padding: 20 },
    viewMeta: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 20 },
    viewDate: { ...Typography.caption, color: colors.textVariant },
    viewTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    viewTitle: { ...Typography.header, fontSize: 32, color: colors.text, flex: 1 },
    viewMoodBig: { fontSize: 40 },
    viewBody: { ...Typography.body, color: colors.text, fontSize: 17, lineHeight: 26 },
    viewBodyWrapper: { marginTop: 10 },

    actionGroup: { gap: 10, padding: 20 },
    actionRow: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: colors.surface, borderRadius: 15, ...Shadows.soft },
    actionIconBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
    actionTextMain: { ...Typography.body, fontWeight: '700', color: colors.text },
    actionTextSub: { ...Typography.caption, color: colors.textVariant },
    deleteAction: { marginTop: 20 },

    modalOverlayAction: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContentAction: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20 },
    actionIndicator: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.background, alignSelf: 'center', marginBottom: 20 },
    actionHeader: { marginBottom: 20 },
    closeActionBtn: { padding: 15, borderRadius: 15, backgroundColor: colors.background, alignItems: 'center', marginTop: 10 },
    closeActionText: { ...Typography.body, fontWeight: '700', color: colors.textVariant },

    modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    confirmContent: { backgroundColor: colors.surface, padding: 30, borderRadius: 30, width: '100%', alignItems: 'center' },
    confirmIconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.error + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    confirmTitle: { ...Typography.title, color: colors.text },
    confirmSub: { ...Typography.body, color: colors.textVariant, textAlign: 'center', marginBottom: 30 },
    confirmActions: { flexDirection: 'row', gap: 15, width: '100%' },
    cancelConfirmBtn: { flex: 1, paddingVertical: 15, borderRadius: 12, alignItems: 'center', backgroundColor: colors.background },
    cancelConfirmText: { ...Typography.body, color: colors.textVariant, fontWeight: '700' },
    deleteConfirmBtn: { flex: 1, paddingVertical: 15, borderRadius: 12, alignItems: 'center', backgroundColor: colors.error },
    deleteConfirmText: { ...Typography.body, color: '#FFF', fontWeight: '800' },
  });

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasRegisteredPin, setHasRegisteredPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  
  const [setupStep, setSetupStep] = useState<'none' | 'set' | 'confirm'>('none');
  const [tempPin, setTempPin] = useState('');

  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [currentNote, setCurrentNote] = useState<Partial<Note>>({});
  
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  const [hint, setHint] = useState('');
  const [showHint, setShowHint] = useState(false);

  const isFocused = useIsFocused();
  const navigation = useNavigation<any>();

  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkPinStatus();
    loadNotes();
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!isFocused && isAuthenticated) {
      // Auto-lock when leaving
      setIsAuthenticated(false);
      setPin('');
      setIsEditing(false);
      setIsViewing(false);
    }
  }, [isFocused]);

  const checkPinStatus = async () => {
    try {
      let savedPin = await AsyncStorage.getItem('@journal_pin_v3');
      
      // Auto-migrate from older version keys if v3 is not set
      if (!savedPin) {
        const legacyPin = await AsyncStorage.getItem('@journal_pin_v2') || await AsyncStorage.getItem('@journal_pin');
        if (legacyPin && legacyPin.length === 6) {
          await AsyncStorage.setItem('@journal_pin_v3', legacyPin);
          savedPin = legacyPin;
        }
      }

      setHasRegisteredPin(!!savedPin);
      if (!savedPin) {
         setIsAuthenticated(true);
      }
    } catch (e) {
      console.warn('PIN check failed:', e);
      setHasRegisteredPin(false); // Fail safe
      setIsAuthenticated(true); 
    }
  };

  const startSetup = () => {
    setIsAuthenticated(false);
    setSetupStep('set');
    setPin('');
    setIsSettingsVisible(false);
  };

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  };

  const shake = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  };

  const handlePinInput = async (digit: string) => {
    const newPin = pin + digit;
    if (newPin.length > 6) return;
    setPin(newPin);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    
    if (newPin === '198921') {
      try {
        const savedPin = await AsyncStorage.getItem('@journal_pin_v3');
        if (savedPin) {
          setHint(savedPin.split('').reverse().join(''));
          setShowHint(true);
          triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
          setTimeout(() => {
            setShowHint(false);
            setHint('');
          }, 600);
        } else {
          shake();
        }
      } catch (e) {
        shake();
      }
      setTimeout(() => setPin(''), 50);
      return;
    }
    
    if (newPin.length === 6) {
      setTimeout(async () => {
        if (setupStep === 'set') {
          setTempPin(newPin);
          setSetupStep('confirm');
          setPin('');
        } else if (setupStep === 'confirm') {
          if (newPin === tempPin) {
             await AsyncStorage.setItem('@journal_pin_v3', newPin);
             setHasRegisteredPin(true);
             setIsAuthenticated(true);
             setSetupStep('none');
             triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
          } else {
             shake();
             Alert.alert("Retry Required", "PINs don't match. Please set your 6-digit PIN carefully.");
             setSetupStep('set');
          }
          setPin('');
        } else {
          try {
            const savedPin = await AsyncStorage.getItem('@journal_pin_v3');
            if (newPin === savedPin) {
              setIsAuthenticated(true);
              triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
            } else {
              shake();
            }
          } catch (e) {
            shake();
          }
          setPin('');
        }
      }, 100);
    }
  };

  const removeLastDigit = () => {
    setPin(pin.slice(0, -1));
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
  };

  const loadNotes = async () => {
    try {
      const stored = await AsyncStorage.getItem('@daily_notes_v3');
      if (stored) setNotes(JSON.parse(stored));
    } catch (e) {}
  };

  const saveNotes = async (newNotes: Note[]) => {
    setNotes(newNotes); 
    try {
      await AsyncStorage.setItem('@daily_notes_v3', JSON.stringify(newNotes));
    } catch (e) {}
  };

  const exportNotes = async () => {
    if (notes.length === 0) {
      Alert.alert("Nothing to Export", "Your journal is empty. Add some entries first.");
      return;
    }

    const header = `DAILY HUB JOURNAL EXPORT\nGenerated: ${new Date().toLocaleString()}\nTotal entries: ${notes.length}\n${'='.repeat(35)}\n\n`;
    const content = notes.map(n => 
      `DATE: ${n.date}\nTITLE: ${n.title}\nMOOD: ${n.mood || 'N/A'}\nCATEGORY: ${n.category}\n\n${n.content}\n\n${'-'.repeat(20)}\n\n`
    ).join('');

    const fullText = header + content;

    try {
      const fileName = `Journal_${new Date().toISOString().split('T')[0]}.txt`;
      const filePath = `${cacheDirectory}${fileName}`;
      await writeAsStringAsync(filePath, fullText);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/plain',
          dialogTitle: 'Export Journal',
          UTI: 'public.plain-text'
        });
      } else {
        // Fallback to basic share
        const { Share: RNShare } = require('react-native');
        await RNShare.share({ message: fullText, title: 'Journal Export' });
      }
      setIsSettingsVisible(false);
    } catch (e) {
      Alert.alert("Export Failed", "Could not generate the export file.");
    }
  };

  const saveCurrentNote = () => {
    Keyboard.dismiss();
    if (!currentNote.title?.trim() && !currentNote.content?.trim()) {
      setIsEditing(false);
      return;
    }
    const newNote: Note = {
      id: currentNote.id || Date.now().toString(),
      title: currentNote.title || 'Untitled Entry',
      content: currentNote.content || '',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      mood: currentNote.mood || '😌',
      category: currentNote.category || 'Personal',
    };
    
    let updatedNotes;
    if (currentNote.id) {
      updatedNotes = notes.map(n => n.id === currentNote.id ? newNote : n);
    } else {
      updatedNotes = [newNote, ...notes];
    }
    saveNotes(updatedNotes);
    setIsEditing(false);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleDeleteNote = () => {
    if (noteToDelete) {
      const updatedNotes = notes.filter(n => n.id !== noteToDelete);
      saveNotes(updatedNotes);
      setIsDeleteModalVisible(false);
      setIsViewing(false);
      setNoteToDelete(null);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const filteredNotes = notes.filter(note => {
    const matchesCategory = selectedCategory === 'All' || note.category === selectedCategory;
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          note.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderAuthScreen = () => (
    <View style={styles.authContainer}>
      <LinearGradient colors={['#F9F5FF', '#FDFDFF']} style={StyleSheet.absoluteFill} />
      <View style={styles.authMain}>
        <Animated.View style={[styles.identitySection, { transform: [{ translateX: shakeAnim }] }]}>
          <View style={styles.enhancedIconContainer}>
             <LinearGradient colors={[colors.primary + '20', colors.primary + '05']} style={styles.iconCircle}>
                <MaterialCommunityIcons name="feather" size={44} color={colors.primary} />
             </LinearGradient>
          </View>
          <Text style={styles.authHeading}>
            {setupStep === 'none' ? 'Your Journal' : (setupStep === 'set' ? 'Set Your PIN' : 'Confirm PIN')}
          </Text>
          <Text style={styles.authSubtext}>
            {setupStep === 'none' ? 'Secure entry to your private thoughts.' : 'Choose a 6-digit PIN for your journal.'}
          </Text>
        </Animated.View>

        <View style={styles.pinDisplay}>
          {[...Array(6)].map((_, i) => (
            <View key={i} style={[styles.pinDot, pin.length > i && styles.pinDotActive]} />
          ))}
        </View>

        {showHint && (
          <View style={{position: 'absolute', right: 20, top: height * 0.4}}>
            <Text style={{fontSize: 14, color: colors.textVariant, opacity: 0.1, fontWeight: '800'}}>{hint}</Text>
          </View>
        )}

        <View style={styles.keypad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map((digit, index) => (
             digit === '.' ? (
               <View key="blank" style={{ width: 80 }} />
             ) : (
               <Pressable key={digit} style={({pressed}) => [styles.keypadBtn, pressed && {backgroundColor: '#F7F7FF'}]} onPress={() => handlePinInput(digit.toString())}>
                 <Text style={styles.keypadBtnText}>{digit}</Text>
               </Pressable>
             )
          ))}
          <Pressable style={styles.keypadBtn} onPress={removeLastDigit}>
            <Ionicons name="backspace-outline" size={28} color={colors.textVariant} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (hasRegisteredPin === null) {
      return (
        <View style={[styles.mainContainer, { justifyContent: 'center', alignItems: 'center' }]}>
           <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
  }

  if (!isAuthenticated && hasRegisteredPin) {
    return renderAuthScreen();
  }

  return (
    <View style={styles.mainContainer}>
      {/* Background Gradient */}
      <LinearGradient 
        colors={['#FDFCFF', '#F9F5FF']} 
        style={StyleSheet.absoluteFill} 
      />

      {/* App Bar */}
      <View style={styles.appBar}>
        <View>
          <Text style={styles.logoText}>Journal</Text>
          <Text style={styles.appBarSub}>DAILY HUB</Text>
        </View>
        <TouchableOpacity style={styles.headerIcon} onPress={() => setIsSettingsVisible(true)}>
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Header Info */}
      <View style={styles.summaryBar}>
         <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{notes.length}</Text>
            <Text style={styles.summaryLabel}>Entries</Text>
         </View>
         <View style={styles.summaryDivider} />
         <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>
              {notes.length > 0 ? (notes.filter(n => n.date === new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })).length) : 0}
            </Text>
            <Text style={styles.summaryLabel}>Today</Text>
         </View>
      </View>

      <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={styles.searchSection}>
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={20} color={colors.textVariant} />
            <TextInput 
              placeholder="Search your thoughts..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              placeholderTextColor="#A0A0B0"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textVariant} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Categories (Sticky-ish) */}
        <View style={{backgroundColor: 'transparent', paddingVertical: 8}}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}
            style={styles.filterBar}
          >
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                onPress={() => { setSelectedCategory(cat); triggerHaptic(Haptics.ImpactFeedbackStyle.Light); }}
                style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, selectedCategory === cat && { color: '#FFF' }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Empty State */}
        {filteredNotes.length === 0 && (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
               <MaterialCommunityIcons name="feather" size={40} color={colors.primary} />
            </View>
            <Text style={styles.emptyTextTitle}>No Entries Found</Text>
            <Text style={styles.emptyTextSub}>
              {searchQuery ? "Try a different search term or category." : "Start capturing your ideas and feelings today."}
            </Text>
          </View>
        )}

        {/* Notes Grid */}
        <View style={styles.notesGrid}>
          {filteredNotes.map((note) => (
            <TouchableOpacity 
              key={note.id} 
              style={styles.noteCard}
              activeOpacity={0.8}
              onPress={() => {
                setCurrentNote(note);
                setIsViewing(true);
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={styles.noteTop}>
                 <View style={styles.cardIndicatorMood}>
                    <Text style={{fontSize: 24}}>{note.mood || '😌'}</Text>
                 </View>
                 <View style={{flex: 1, paddingLeft: 16}}>
                    <Text style={styles.noteCardTitle} numberOfLines={1}>{note.title}</Text>
                    <Text style={styles.noteDateText}>{note.date}</Text>
                 </View>
              </View>
              <Text style={styles.noteCardContent} numberOfLines={2}>{note.content}</Text>
              <View style={styles.noteBottom}>
                 <View style={styles.bottomTag}>
                    <Text style={styles.tagText}>{note.category}</Text>
                 </View>
                 <Ionicons name="chevron-forward-outline" size={16} color={colors.textVariant} />
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fabMain}
        onPress={() => {
          setCurrentNote({ category: 'Personal', mood: '😌' });
          setIsEditing(true);
          triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        }}
      >
        <LinearGradient 
          colors={[colors.primary, colors.primaryLight]} 
          style={styles.fabInner}
        >
          <Ionicons name="add" size={32} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* View/Edit Note Modal */}
      <Modal 
        visible={isEditing || isViewing} 
        animationType="slide" 
        transparent={false}
        statusBarTranslucent
      >
        <View style={{flex: 1, backgroundColor: '#FFF'}}>
           <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => { setIsEditing(false); setIsViewing(false); }}>
                 <Text style={styles.navText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitleMain}>
                {isEditing ? (currentNote.id ? 'Edit Entry' : 'New Entry') : 'Reading'}
              </Text>
              <TouchableOpacity onPress={isViewing ? () => setIsEditing(true) : saveCurrentNote}>
                 <Text style={[styles.navText, { color: colors.primary, fontWeight: '800' }]}>
                   {isViewing ? 'Edit' : 'Save'}
                 </Text>
              </TouchableOpacity>
           </View>

           <KeyboardAvoidingView 
              style={{flex: 1}} 
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
           >
             <ScrollView style={{flex: 1}} contentContainerStyle={{paddingBottom: 40}}>
                {isEditing ? (
                  <>
                    <View style={styles.editControls}>
                      <View style={styles.selectorGroup}>
                         <Text style={styles.labelSmall}>MOOD</Text>
                         <View style={{flexDirection: 'row', gap: 12}}>
                            {MOODS.map(m => (
                              <TouchableOpacity 
                                key={m} 
                                onPress={() => { setCurrentNote({...currentNote, mood: m}); triggerHaptic(Haptics.ImpactFeedbackStyle.Light); }}
                                style={[styles.moodBadge, currentNote.mood === m && styles.moodActive]}
                              >
                                <Text style={{fontSize: 24, opacity: currentNote.mood === m ? 1 : 0.4}}>{m}</Text>
                              </TouchableOpacity>
                            ))}
                         </View>
                      </View>

                      <View style={styles.selectorGroup}>
                         <Text style={styles.labelSmall}>CATEGORY</Text>
                         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
                            {CATEGORIES.slice(1).map(c => (
                              <TouchableOpacity 
                                key={c} 
                                onPress={() => { setCurrentNote({...currentNote, category: c}); triggerHaptic(Haptics.ImpactFeedbackStyle.Light); }}
                                style={[styles.catChip, currentNote.category === c && styles.catChipActive]}
                              >
                                <Text style={[styles.catChipText, currentNote.category === c && {color: '#FFF'}]}>{c}</Text>
                              </TouchableOpacity>
                            ))}
                         </ScrollView>
                      </View>
                    </View>

                    <TextInput
                      style={styles.titleInput}
                      placeholder="Enter Title"
                      value={currentNote.title}
                      onChangeText={t => setCurrentNote({...currentNote, title: t})}
                      placeholderTextColor="#D0D0E0"
                    />
                    <TextInput
                      style={styles.contentInput}
                      placeholder="Write your heart out..."
                      multiline
                      value={currentNote.content}
                      onChangeText={c => setCurrentNote({...currentNote, content: c})}
                      placeholderTextColor="#A0A0B0"
                    />
                  </>
                ) : (
                  <View style={styles.viewContent}>
                     <View style={styles.viewMeta}>
                        <View style={[styles.tagBadge, {backgroundColor: colors.primary + '15'}]}>
                           <Text style={[styles.tagText, {color: colors.primary}]}>{currentNote.category}</Text>
                        </View>
                        <Text style={styles.viewDate}>{currentNote.date}</Text>
                     </View>
                     <View style={styles.viewTitleRow}>
                        <Text style={styles.viewTitle}>{currentNote.title}</Text>
                        <Text style={styles.viewMoodBig}>{currentNote.mood}</Text>
                     </View>
                     <View style={styles.viewBodyWrapper}>
                        <Text style={styles.viewBody}>{currentNote.content}</Text>
                     </View>

                     <TouchableOpacity 
                        style={[styles.actionRow, {marginTop: 40, borderBottomWidth: 0}]}
                        onPress={() => { setNoteToDelete(currentNote.id!); setIsDeleteModalVisible(true); }}
                     >
                        <View style={[styles.actionIconBg, {backgroundColor: '#FFF2F5'}]}>
                           <Ionicons name="trash-outline" size={20} color={colors.error} />
                        </View>
                        <Text style={[styles.actionTextMain, {color: colors.error}]}>Delete Entry</Text>
                     </TouchableOpacity>
                  </View>
                )}
             </ScrollView>
           </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Settings Action Bottom Sheet */}
      <Modal visible={isSettingsVisible} transparent animationType="fade">
        <View style={styles.modalOverlayAction}>
          <Pressable style={{flex: 1}} onPress={() => setIsSettingsVisible(false)} />
          <View style={styles.modalContentAction}>
             <View style={styles.actionIndicator} />
             <Text style={styles.actionHeader}>Journal Options</Text>
             
             <View style={styles.actionGroup}>
               <Pressable style={styles.actionRow} onPress={exportNotes}>
                  <View style={[styles.actionIconBg, {backgroundColor: colors.primary + '15'}]}>
                    <Ionicons name="cloud-download-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={{flex: 1, paddingLeft: 12}}>
                    <Text style={styles.actionTextMain}>Export Entries</Text>
                    <Text style={styles.actionTextSub}>Save all entries as a .txt file</Text>
                  </View>
               </Pressable>

               <Pressable style={styles.actionRow} onPress={startSetup}>
                  <View style={[styles.actionIconBg, {backgroundColor: '#F7F7F9'}]}>
                    <Ionicons name="key-outline" size={20} color={colors.text} />
                  </View>
                  <View style={{flex: 1, paddingLeft: 12}}>
                    <Text style={styles.actionTextMain}>Privacy Settings</Text>
                    <Text style={styles.actionTextSub}>Change your 6-digit PIN</Text>
                  </View>
               </Pressable>

               <Pressable style={[styles.actionRow, { borderBottomWidth: 0 }]} onPress={() => {
                  setIsSettingsVisible(false);
                  Alert.alert("Wipe Journal", "This is permanent. Are you sure?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete Everything", style: "destructive", onPress: async () => {
                        await AsyncStorage.removeItem('@daily_notes_v3');
                        setNotes([]);
                        triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
                    }}
                  ]);
               }}>
                  <View style={[styles.actionIconBg, {backgroundColor: '#FFF2F5'}]}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </View>
                  <View style={{flex: 1, paddingLeft: 12}}>
                    <Text style={[styles.actionTextMain, {color: colors.error}]}>Wipe Data</Text>
                    <Text style={styles.actionTextSub}>Permanently delete all notes</Text>
                  </View>
               </Pressable>
             </View>
             
             <TouchableOpacity style={styles.closeActionBtn} onPress={() => setIsSettingsVisible(false)}>
                <Text style={styles.closeActionText}>Close</Text>
             </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={isDeleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.confirmContent}>
            <View style={styles.confirmIconBg}>
               <Ionicons name="trash-bin-outline" size={28} color={colors.error} />
            </View>
            <Text style={styles.confirmTitle}>Delete this entry?</Text>
            <Text style={styles.confirmSub}>You cannot undo this action.</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelConfirmBtn} onPress={() => { setIsDeleteModalVisible(false); setNoteToDelete(null); }}>
                <Text style={styles.cancelConfirmText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteConfirmBtn} onPress={handleDeleteNote}>
                <Text style={styles.deleteConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
