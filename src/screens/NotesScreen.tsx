import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, KeyboardAvoidingView, Platform, Keyboard, Modal, Animated, Dimensions, StatusBar, Linking, ScrollView, Image, Share, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography } from '../theme/Theme';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

type Mood = '😀' | '😌' | '😐' | '😩' | '😡';
const MOODS: Mood[] = ['😀', '😌', '😐', '😩', '😡'];

interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
  mood?: Mood;
  category: string;
}

const MM_Colors = {
  primary: '#4052b6',
  primaryLight: '#8899FF',
  primaryDim: '#3346a9',
  surface: '#f9f5ff',
  surfaceContainer: '#e9e5ff',
  surfaceContainerHigh: '#e3dfff',
  onSurface: '#2c2a51',
  onSurfaceVariant: '#5a5781',
  onBackground: '#2c2a51',
  outlineVariant: '#aca8d7',
  background: '#f9f5ff',
  white: '#ffffff',
  slate500: '#64748b',
  slate400: '#94a3b8',
  error: '#B41340',
};

const CATEGORIES = ['All', 'Personal', 'Work', 'Ideas'];

export default function NotesScreen() {
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

  const isFocused = useIsFocused();
  const navigation = useNavigation<any>();

  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkPinStatus();
    loadNotes();
  }, []);

  useEffect(() => {
    if (!isFocused && isAuthenticated) {
      setIsAuthenticated(false);
      setPin('');
      setIsEditing(false);
      setIsViewing(false);
    }
  }, [isFocused]);

  const checkPinStatus = async () => {
    try {
      const savedPin = await AsyncStorage.getItem('@journal_pin_v2');
      setHasRegisteredPin(!!savedPin);
      if (!savedPin) {
         setIsAuthenticated(true);
      }
    } catch (e) {}
  };

  const startSetup = () => {
    setIsAuthenticated(false);
    setSetupStep('set');
    setPin('');
  };

  const cancelSetup = () => {
     if (setupStep !== 'none') {
         setSetupStep('none');
         setPin('');
     } else {
         navigation.goBack();
     }
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  };

  const handleForgotPin = async () => {
    const url = 'mailto:anand.aage.spam@gmail.com?subject=Security PIN Reset Request&body=I have forgotten my journal PIN. Please provide instructions to reset my access.';
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        "Reset Access",
        "Please email anand.aage.spam@gmail.com from your registered address to reset your PIN.",
        [{ text: "OK" }]
      );
    }
  };

  const handlePin = async (p: string) => {
    const newPin = pin + p;
    if (newPin.length > 6) return;
    setPin(newPin);
    
    if (newPin.length === 6) {
      setTimeout(async () => {
        if (setupStep === 'set') {
          setTempPin(newPin);
          setSetupStep('confirm');
        } else if (setupStep === 'confirm') {
          if (newPin === tempPin) {
             await AsyncStorage.setItem('@journal_pin_v2', newPin);
             setHasRegisteredPin(true);
             setIsAuthenticated(true);
             setSetupStep('none');
          } else {
             shake();
             Alert.alert("Error", "PINs don't match.");
             setSetupStep('set');
          }
        } else {
          const savedPin = await AsyncStorage.getItem('@journal_pin_v2');
          if (newPin === savedPin) {
            setIsAuthenticated(true);
          } else {
            shake();
            Alert.alert("Error", "Incorrect PIN");
          }
        }
        setPin('');
      }, 100);
    }
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
      Alert.alert("Empty", "No notes to export.");
      return;
    }

    const content = notes.map(n => `TITLE: ${n.title}\nDATE: ${n.date}\nMOOD: ${n.mood || 'N/A'}\nCATEGORY: ${n.category}\n\n${n.content}\n\n-------------------\n\n`).join('');

    try {
        if (Platform.OS === 'ios') {
            const fileName = `MethodicMuse_Journal_Export_${new Date().getTime()}.txt`;
            const filePath = `${FileSystem.documentDirectory}${fileName}`;
            await FileSystem.writeAsStringAsync(filePath, content);
            await Share.share({
                url: filePath,
                title: 'Export Journal'
            });
        } else {
            await Share.share({
                message: content,
                title: 'Export Journal'
            });
        }
    } catch (e) {
      Alert.alert("Error", "Could not export notes.");
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
      title: currentNote.title || 'Untitled',
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
    setIsViewing(true);
    setCurrentNote(newNote);
  };

  const confirmDeleteNote = (id: string) => {
    setNoteToDelete(id);
    setIsDeleteModalVisible(true);
  };

  const handleDeleteNote = () => {
    if (noteToDelete) {
      const updatedNotes = notes.filter(n => n.id !== noteToDelete);
      saveNotes(updatedNotes);
      setIsDeleteModalVisible(false);
      setIsViewing(false);
      setNoteToDelete(null);
    }
  };

  const filteredNotes = notes.filter(n => {
    const matchesCategory = selectedCategory === 'All' || n.category === selectedCategory;
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getAuthTitle = () => {
    if (setupStep === 'set') return "Set Journal PIN";
    if (setupStep === 'confirm') return "Confirm Journal PIN";
    return "Enter Journal PIN";
  };

  const screenPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 40 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 60) {
          navigation.navigate('Budget');
        }
      }
    })
  ).current;

  if (hasRegisteredPin === null) return null;

  if ((hasRegisteredPin && !isAuthenticated) || setupStep !== 'none') {
    return (
      <View style={styles.authContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.bgDecoration1} />
        <View style={styles.bgDecoration2} />

        <View style={styles.authHeader}>
          <TouchableOpacity onPress={cancelSetup} style={styles.headerLeft}>
            <MaterialIcons name="lock" size={24} color={MM_Colors.primary} />
            <Text style={styles.headerTitle}>Secure Journal</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsSettingsVisible(true)}>
            <MaterialIcons name="settings" size={24} color={MM_Colors.slate500} />
          </TouchableOpacity>
        </View>

        <View style={styles.authMain}>
          <View style={styles.identitySection}>
            <View style={styles.enhancedIconContainer}>
              <MaterialIcons name="book" size={40} color={MM_Colors.primary} />
            </View>
            <Text style={styles.authHeading}>{getAuthTitle()}</Text>
            <Text style={styles.authSubtext}>Authentication required to access journal</Text>
          </View>

          <Animated.View style={[styles.pinDisplay, { transform: [{ translateX: shakeAnim }] }]}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <View
                key={i}
                style={[
                  styles.pinDot,
                  pin.length >= i && styles.pinDotActive
                ]}
              />
            ))}
          </Animated.View>

          <View style={styles.keypad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <TouchableOpacity
                key={num}
                style={styles.keypadBtn}
                onPress={() => handlePin(num.toString())}
              >
                <Text style={styles.keypadBtnText}>{num}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.keypadBtn} />
            <TouchableOpacity
              style={styles.keypadBtn}
              onPress={() => handlePin('0')}
            >
              <Text style={styles.keypadBtnText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.keypadBtn}
              onPress={() => setPin(pin.slice(0, -1))}
            >
              <MaterialIcons name="backspace" size={32} color={MM_Colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotLink} onPress={handleForgotPin}>
            <Text style={styles.forgotLinkText}>FORGOT PIN?</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isViewing) {
    return (
      <View style={styles.mainContainer}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setIsViewing(false)}>
            <Ionicons name="chevron-back" size={28} color={MM_Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitleMain}>View Musing</Text>
          <View style={{ flexDirection: 'row', gap: 15 }}>
            <TouchableOpacity onPress={() => { setIsViewing(false); setIsEditing(true); }}>
              <Ionicons name="create-outline" size={28} color={MM_Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => confirmDeleteNote(currentNote.id!)}>
              <Ionicons name="trash-outline" size={28} color={MM_Colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.viewContent}>
          <View style={styles.viewMeta}>
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>{currentNote.category?.toUpperCase()}</Text>
            </View>
            <Text style={styles.viewDate}>{currentNote.date}</Text>
            <Text style={{ fontSize: 24 }}>{currentNote.mood}</Text>
          </View>
          <Text style={styles.viewTitle}>{currentNote.title}</Text>
          <Text style={styles.viewBody}>{currentNote.content}</Text>
        </ScrollView>

        <Modal visible={isDeleteModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.confirmContent}>
              <View style={styles.confirmIcon}>
                <Ionicons name="trash" size={32} color={MM_Colors.error} />
              </View>
              <Text style={styles.confirmTitle}>Delete Musing?</Text>
              <Text style={styles.confirmSub}>This will permanently delete this spark of inspiration. This action cannot be undone.</Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity style={styles.cancelConfirmBtn} onPress={() => setIsDeleteModalVisible(false)}>
                  <Text style={styles.cancelConfirmText}>KEEP IT</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteConfirmBtn} onPress={handleDeleteNote}>
                  <Text style={styles.deleteConfirmText}>DELETE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  if (isEditing) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.mainContainer}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => { setIsEditing(false); if (currentNote.id) setIsViewing(true); }}>
            <Ionicons name="close" size={28} color={MM_Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitleMain}>{currentNote.id ? 'Editing Musing' : 'New Musing'}</Text>
          <TouchableOpacity onPress={saveCurrentNote} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.editControls}>
          <View style={styles.moodSelector}>
             <Text style={styles.labelSmall}>Mood:</Text>
             <ScrollView horizontal showsHorizontalScrollIndicator={false}>
               {MOODS.map(m => (
                 <TouchableOpacity key={m} onPress={() => setCurrentNote({...currentNote, mood: m})} style={[styles.moodBadge, currentNote.mood === m && styles.moodActive]}>
                    <Text style={{fontSize: 22}}>{m}</Text>
                 </TouchableOpacity>
               ))}
             </ScrollView>
          </View>

          <View style={styles.catSelector}>
             <Text style={styles.labelSmall}>Category:</Text>
             <ScrollView horizontal showsHorizontalScrollIndicator={false}>
               {CATEGORIES.filter(c => c !== 'All').map(c => (
                 <TouchableOpacity key={c} onPress={() => setCurrentNote({...currentNote, category: c})} style={[styles.catChip, currentNote.category === c && styles.catChipActive]}>
                    <Text style={[styles.catChipText, currentNote.category === c && {color: '#FFF'}]}>{c}</Text>
                 </TouchableOpacity>
               ))}
             </ScrollView>
          </View>
        </View>

        <TextInput
          style={styles.titleInput}
          placeholder="Title"
          placeholderTextColor={MM_Colors.onSurfaceVariant}
          value={currentNote.title}
          onChangeText={(text) => setCurrentNote({ ...currentNote, title: text })}
        />
        <TextInput
          style={styles.contentInput}
          placeholder="Start writing..."
          placeholderTextColor={MM_Colors.onSurfaceVariant}
          multiline
          textAlignVertical="top"
          value={currentNote.content}
          onChangeText={(text) => setCurrentNote({ ...currentNote, content: text })}
        />
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.mainContainer} {...screenPanResponder.panHandlers}>
      <StatusBar barStyle="dark-content" />

      {/* App Bar */}
      <View style={styles.appBar}>
        <View style={styles.headerLeftAppBar}>
           <Text style={styles.logoText}>Daily Journal</Text>
        </View>
        <TouchableOpacity style={styles.searchBtnTop} onPress={() => setIsSettingsVisible(true)}>
           <Ionicons name="settings-outline" size={24} color={MM_Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.editorialHeader}>
           <Text style={styles.heroTitle}>Journal</Text>
           <Text style={styles.heroSub}>Capture your sparks of inspiration and refined thoughts in a curated space.</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
           <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={20} color={MM_Colors.onSurfaceVariant} style={{marginRight: 10}} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search your musings..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
           </View>
        </View>

        {/* Filter Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
           {CATEGORIES.map(cat => (
             <TouchableOpacity key={cat} style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]} onPress={() => setSelectedCategory(cat)}>
                <Text style={[styles.filterChipText, selectedCategory === cat && {color: '#FFF'}]}>{cat}</Text>
             </TouchableOpacity>
           ))}
        </ScrollView>

        {/* Notes Grid */}
        <View style={styles.notesGrid}>
           {filteredNotes.length > 0 ? (
             filteredNotes.map((item, idx) => (
               <TouchableOpacity
                 key={item.id}
                 style={[styles.noteCardLarge, idx % 3 === 0 && { width: '100%' }]}
                 onPress={() => { setCurrentNote(item); setIsViewing(true); }}
                 onLongPress={() => confirmDeleteNote(item.id)}
               >
                 <View style={styles.noteTop}>
                    <View style={styles.tagBadge}>
                       <Text style={styles.tagText}>{item.category.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.noteDateText}>{item.date}</Text>
                 </View>
                 <Text style={styles.noteCardTitle}>{item.title}</Text>
                 <Text style={styles.noteCardContent} numberOfLines={idx % 3 === 0 ? 3 : 2}>{item.content}</Text>
                 <View style={styles.noteBottom}>
                    <Text style={{fontSize: 18}}>{item.mood}</Text>
                    <TouchableOpacity onPress={() => confirmDeleteNote(item.id)}>
                       <Ionicons name="trash-outline" size={20} color={MM_Colors.onSurfaceVariant} />
                    </TouchableOpacity>
                 </View>
               </TouchableOpacity>
             ))
           ) : (
             <Text style={styles.emptyText}>No musings found.</Text>
           )}
        </View>
        <View style={{height: 40}} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fabMain}
        onPress={() => { setCurrentNote({mood: '😌', category: 'Personal'}); setIsEditing(true); }}
      >
        <LinearGradient colors={[MM_Colors.primary, MM_Colors.primaryLight]} style={styles.fabInner}>
           <Ionicons name="add" size={32} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Settings Modal */}
      <Modal visible={isSettingsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
             <Text style={styles.modalTitle}>Journal Settings</Text>
             <TouchableOpacity style={styles.actionBtn} onPress={exportNotes}>
                <Ionicons name="download-outline" size={24} color={MM_Colors.primary} style={{marginRight: 10}} />
                <Text style={styles.actionText}>Export all notes</Text>
             </TouchableOpacity>
             <TouchableOpacity style={styles.actionBtn} onPress={startSetup}>
                <Ionicons name="key-outline" size={24} color={MM_Colors.primary} style={{marginRight: 10}} />
                <Text style={styles.actionText}>Reset PIN</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#ffefef'}]} onPress={() => {
                Alert.alert("Wipe Journal", "This will delete all notes permanently. Continue?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Wipe All", style: "destructive", onPress: async () => {
                      await AsyncStorage.removeItem('@daily_notes_v3');
                      setNotes([]);
                      setIsSettingsVisible(false);
                  }}
                ]);
             }}>
                <Ionicons name="trash-outline" size={24} color={MM_Colors.error} style={{marginRight: 10}} />
                <Text style={[styles.actionText, {color: MM_Colors.error}]}>Delete All Musings</Text>
             </TouchableOpacity>
             <TouchableOpacity onPress={() => setIsSettingsVisible(false)} style={{marginTop: 20}}>
                <Text style={{color: MM_Colors.onSurfaceVariant, fontWeight: '700'}}>CLOSE</Text>
             </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Main Delete Confirmation Modal */}
      <Modal visible={isDeleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmContent}>
            <View style={styles.confirmIcon}>
              <Ionicons name="trash" size={32} color={MM_Colors.error} />
            </View>
            <Text style={styles.confirmTitle}>Discard Musing?</Text>
            <Text style={styles.confirmSub}>This spark of inspiration will be permanently removed from your curated space.</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelConfirmBtn} onPress={() => { setIsDeleteModalVisible(false); setNoteToDelete(null); }}>
                <Text style={styles.cancelConfirmText}>KEEP IT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteConfirmBtn} onPress={handleDeleteNote}>
                <Text style={styles.deleteConfirmText}>DISCARD</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: MM_Colors.background },
  authContainer: { flex: 1, backgroundColor: MM_Colors.surface, alignItems: 'center' },
  bgDecoration1: { position: 'absolute', top: -height * 0.1, left: -width * 0.1, width: width * 0.4, height: width * 0.4, borderRadius: width * 0.2, backgroundColor: 'rgba(64, 82, 182, 0.05)' },
  bgDecoration2: { position: 'absolute', bottom: -height * 0.1, right: -width * 0.1, width: width * 0.5, height: width * 0.5, borderRadius: width * 0.25, backgroundColor: 'rgba(118, 86, 0, 0.05)' },

  authHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, marginTop: Platform.OS === 'ios' ? 80 : (StatusBar.currentHeight || 0) + 30, backgroundColor: 'rgba(248, 250, 252, 0.5)' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: Platform.OS === 'ios' ? 'Manrope' : 'sans-serif-medium', fontWeight: '700', fontSize: 20, color: MM_Colors.primary, tracking: -0.5 },

  authMain: { flex: 1, width: '100%', maxWidth: 448, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center' },
  identitySection: { alignItems: 'center', marginBottom: 48 },
  enhancedIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: MM_Colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  authHeading: { fontFamily: Platform.OS === 'ios' ? 'Manrope' : 'sans-serif-medium', fontWeight: '800', fontSize: 30, color: MM_Colors.onBackground, tracking: -0.5, marginBottom: 4, textAlign: 'center' },
  authSubtext: { color: MM_Colors.onSurfaceVariant, fontWeight: '500', fontSize: 14, textAlign: 'center' },

  pinDisplay: { flexDirection: 'row', gap: 24, paddingVertical: 16, marginBottom: 48 },
  pinDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: MM_Colors.outlineVariant },
  pinDotActive: { backgroundColor: MM_Colors.primary, transform: [{ scale: 1.2 }], shadowColor: MM_Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 12 },

  keypad: { width: '100%', maxWidth: 320, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 32 },
  keypadBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  keypadBtnText: { fontFamily: Platform.OS === 'ios' ? 'Manrope' : 'sans-serif-medium', fontWeight: '700', fontSize: 24, color: MM_Colors.onSurface },

  forgotLink: { marginTop: 16, paddingVertical: 16 },
  forgotLinkText: { color: MM_Colors.primary, fontWeight: '600', fontSize: 14, letterSpacing: 1 },

  appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 80 : (StatusBar.currentHeight || 0) + 30, paddingBottom: 15, backgroundColor: MM_Colors.background },
  headerLeftAppBar: { flexDirection: 'row', alignItems: 'center' },
  profileCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: MM_Colors.surfaceContainer, overflow: 'hidden' },
  profileImg: { width: '100%', height: '100%' },
  logoText: { fontSize: 24, fontWeight: '900', color: MM_Colors.primary, letterSpacing: -1 },
  searchBtnTop: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 2 },

  editorialHeader: { padding: 24, paddingTop: 10 },
  heroTitle: { fontSize: 48, fontWeight: '900', color: MM_Colors.onSurface, letterSpacing: -2 },
  heroSub: { fontSize: 16, color: MM_Colors.onSurfaceVariant, marginTop: 12, lineHeight: 24, maxWidth: '90%' },

  searchSection: { paddingHorizontal: 24, marginBottom: 20 },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 20, height: 60, borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '600', color: MM_Colors.onSurface },

  filterBar: { paddingHorizontal: 24, marginBottom: 30, flexGrow: 0 },
  filterChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 15, backgroundColor: '#FFF', marginRight: 10, elevation: 2 },
  filterChipActive: { backgroundColor: MM_Colors.primary },
  filterChipText: { fontSize: 14, fontWeight: '700', color: MM_Colors.onSurfaceVariant },

  notesGrid: { paddingHorizontal: 24, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  noteCardLarge: { width: '48%', backgroundColor: '#FFF', padding: 20, borderRadius: 28, marginBottom: 15, elevation: 2, shadowColor: '#2C2A51', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12 },
  noteTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: MM_Colors.surfaceContainerHigh },
  tagText: { fontSize: 10, fontWeight: '800', color: MM_Colors.primary },
  noteDateText: { fontSize: 11, color: MM_Colors.onSurfaceVariant, fontWeight: '600' },
  noteCardTitle: { fontSize: 18, fontWeight: '800', color: MM_Colors.onSurface, marginBottom: 8 },
  noteCardContent: { fontSize: 14, color: MM_Colors.onSurfaceVariant, lineHeight: 20, marginBottom: 15 },
  noteBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  fabMain: { position: 'absolute', bottom: 40, right: 24, width: 72, height: 72, borderRadius: 28, elevation: 8, shadowColor: MM_Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15 },
  fabInner: { width: '100%', height: '100%', borderRadius: 28, justifyContent: 'center', alignItems: 'center' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 80 : (StatusBar.currentHeight || 0) + 30, paddingBottom: 20 },
  headerTitleMain: { fontSize: 20, fontWeight: '800', color: MM_Colors.onSurface },
  saveBtn: { backgroundColor: MM_Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  saveBtnText: { color: '#FFF', fontWeight: '800' },

  editControls: { paddingHorizontal: 24, marginBottom: 20 },
  labelSmall: { fontSize: 12, fontWeight: '800', color: MM_Colors.primary, marginBottom: 10, letterSpacing: 1 },
  moodSelector: { marginBottom: 20 },
  moodBadge: { padding: 10, borderRadius: 12, backgroundColor: MM_Colors.surfaceContainer, marginRight: 10 },
  moodActive: { backgroundColor: MM_Colors.surfaceContainerHigh, borderWidth: 1, borderColor: MM_Colors.primary },
  catSelector: { marginBottom: 10 },
  catChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, backgroundColor: MM_Colors.surfaceContainer, marginRight: 10 },
  catChipActive: { backgroundColor: MM_Colors.primary },
  catChipText: { fontWeight: '700', color: MM_Colors.onSurfaceVariant },

  titleInput: { fontSize: 32, fontWeight: '900', color: MM_Colors.onSurface, paddingHorizontal: 24, marginBottom: 10 },
  contentInput: { flex: 1, fontSize: 18, color: MM_Colors.onSurfaceVariant, paddingHorizontal: 24, lineHeight: 28 },

  viewContent: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 100 },
  viewMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  viewDate: { fontSize: 14, fontWeight: '700', color: MM_Colors.onSurfaceVariant },
  viewTitle: { fontSize: 36, fontWeight: '900', color: MM_Colors.onSurface, marginBottom: 20, letterSpacing: -1 },
  viewBody: { fontSize: 18, color: MM_Colors.onSurfaceVariant, lineHeight: 28 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(44, 42, 81, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 32, padding: 32, width: '100%', alignItems: 'center' },
  modalTitle: { fontSize: 24, fontWeight: '800', color: MM_Colors.onSurface, marginBottom: 25 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: MM_Colors.background, width: '100%', padding: 18, borderRadius: 20, marginBottom: 12 },
  actionText: { fontSize: 16, fontWeight: '700', color: MM_Colors.onSurface },
  emptyText: { textAlign: 'center', marginTop: 100, color: MM_Colors.onSurfaceVariant, fontSize: 16 },

  confirmContent: { backgroundColor: '#FFF', borderRadius: 32, padding: 32, width: '100%', alignItems: 'center' },
  confirmIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF1F1', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  confirmTitle: { fontSize: 22, fontWeight: '800', color: MM_Colors.onSurface, marginBottom: 12 },
  confirmSub: { fontSize: 16, color: MM_Colors.onSurfaceVariant, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelConfirmBtn: { flex: 1, height: 56, borderRadius: 20, backgroundColor: MM_Colors.background, justifyContent: 'center', alignItems: 'center' },
  cancelConfirmText: { color: MM_Colors.onSurfaceVariant, fontWeight: '800', letterSpacing: 1 },
  deleteConfirmBtn: { flex: 1, height: 56, borderRadius: 20, backgroundColor: MM_Colors.error, justifyContent: 'center', alignItems: 'center' },
  deleteConfirmText: { color: '#FFF', fontWeight: '800', letterSpacing: 1 },

  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 90, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: Platform.OS === 'ios' ? 24 : 12, backgroundColor: 'rgba(255, 255, 255, 0.8)', borderTopLeftRadius: 32, borderTopRightRadius: 32, elevation: 20, shadowColor: '#2c2a51', shadowOpacity: 0.06, shadowRadius: 24 },
  navItem: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  navItemActive: { transform: [{ scale: 1.05 }] },
  navItemActiveBg: { position: 'absolute', width: '100%', height: '100%', backgroundColor: '#f0f2ff', borderRadius: 16 },
  navLabel: { fontSize: 10, fontWeight: '600', marginTop: 4, color: MM_Colors.slate400, letterSpacing: 1 },
});
