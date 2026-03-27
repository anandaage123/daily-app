import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Alert, Modal, AppState, Dimensions, Platform, Animated, StatusBar, Linking, TextInput, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Colors, Typography } from '../theme/Theme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';

const { width, height } = Dimensions.get('window');

interface HiddenItem {
  id: string;
  uri: string;
  type: 'image' | 'video';
}

interface PasswordItem {
  id: string;
  site: string;
  username: string;
  pass: string;
}

const MM_Colors = {
  primary: '#4052B6',
  primaryLight: '#8899FF',
  background: '#F9F5FF',
  surface: '#FFFFFF',
  surfaceContainer: '#E9E5FF',
  surfaceContainerHigh: '#E3DFFF',
  text: '#2C2A51',
  textVariant: '#5A5781',
  outlineVariant: '#ACA8D7',
  onBackground: '#2C2A51',
  onSurfaceVariant: '#5A5781',
  primaryDim: '#3346A9',
  secondary: '#765600',
  error: '#B41340',
  white: '#FFFFFF',
};

export default function VaultScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [vaultMode, setVaultMode] = useState<'primary' | 'decoy' | null>(null);
  const [hasPrimaryPin, setHasPrimaryPin] = useState<boolean | null>(null);
  const [hasDecoyPin, setHasDecoyPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  
  const [setupStep, setSetupStep] = useState<'none' | 'primary' | 'primary_confirm' | 'decoy' | 'decoy_confirm'>('none');
  const [tempPin, setTempPin] = useState('');

  const [activeTab, setActiveTab] = useState<'media' | 'passwords'>('media');
  const [hiddenItems, setHiddenItems] = useState<HiddenItem[]>([]);
  const [passwords, setPasswords] = useState<PasswordItem[]>([]);

  const [isPassModalVisible, setIsPassModalVisible] = useState(false);
  const [newSite, setNewSite] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');

  const navigation = useNavigation();
  const [selectedItem, setSelectedItem] = useState<HiddenItem | null>(null);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<HiddenItem | null>(null);

  const appState = useRef(AppState.currentState);
  const skipLock = useRef(false);

  // Video Player Setup
  const videoPlayer = useVideoPlayer(viewingMedia?.type === 'video' ? viewingMedia.uri : null, (player) => {
    player.loop = true;
    player.play();
  });

  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkPinStatus();
    
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/active/) && nextAppState !== 'active') {
        if (!skipLock.current) {
          setIsAuthenticated(false);
          setVaultMode(null);
          setPin('');
          setHiddenItems([]);
          setPasswords([]);
          setIsSettingsVisible(false);
          setSelectedItem(null);
          setViewingMedia(null);
          setSetupStep('none');
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (vaultMode && isAuthenticated) {
      loadHiddenItems(vaultMode);
      loadPasswords(vaultMode);
    }
  }, [vaultMode, isAuthenticated]);

  const checkPinStatus = async () => {
    try {
      const pPin = await AsyncStorage.getItem('@vault_pin_primary');
      const dPin = await AsyncStorage.getItem('@vault_pin_decoy');
      setHasPrimaryPin(!!pPin);
      setHasDecoyPin(!!dPin);
      
      if (!pPin) {
        setIsAuthenticated(true); 
        setVaultMode('primary');
      }
    } catch (e) {}
  };

  const getAuthTitle = () => {
    switch (setupStep) {
      case 'primary': return 'Set Security PIN';
      case 'primary_confirm': return 'Confirm Security PIN';
      case 'decoy': return 'Set Security PIN';
      case 'decoy_confirm': return 'Confirm Security PIN';
      default: return 'Enter PIN';
    }
  };

  const startSetup = () => {
    setIsAuthenticated(false);
    setSetupStep('primary');
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

  const removePin = async () => {
    Alert.alert("Reset All Data", "This will permanently delete all stored media and passwords and clear your PIN. Proceed?", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset Everything", style: "destructive", onPress: async () => {
          await AsyncStorage.removeItem('@vault_pin_primary');
          await AsyncStorage.removeItem('@vault_pin_decoy');
          await AsyncStorage.removeItem('@vault_items_primary');
          await AsyncStorage.removeItem('@vault_items_decoy');
          await AsyncStorage.removeItem('@vault_pass_primary');
          await AsyncStorage.removeItem('@vault_pass_decoy');
          setHasPrimaryPin(false);
          setHasDecoyPin(false);
          setVaultMode('primary');
          setIsAuthenticated(true);
          setIsSettingsVisible(false);
          Alert.alert("Success", "Security and storage have been fully reset.");
      }}
    ]);
  };

  const loadHiddenItems = async (mode: 'primary' | 'decoy') => {
    try {
      const items = await AsyncStorage.getItem(`@vault_items_${mode}`);
      if (items) setHiddenItems(JSON.parse(items));
      else setHiddenItems([]);
    } catch (e) {}
  };

  const saveHiddenItems = async (items: HiddenItem[]) => {
    if (!vaultMode) return;
    setHiddenItems(items);
    await AsyncStorage.setItem(`@vault_items_${vaultMode}`, JSON.stringify(items));
  };

  const loadPasswords = async (mode: 'primary' | 'decoy') => {
    try {
      const stored = await AsyncStorage.getItem(`@vault_pass_${mode}`);
      if (stored) setPasswords(JSON.parse(stored));
      else setPasswords([]);
    } catch (e) {}
  };

  const savePasswords = async (items: PasswordItem[]) => {
    if (!vaultMode) return;
    setPasswords(items);
    await AsyncStorage.setItem(`@vault_pass_${vaultMode}`, JSON.stringify(items));
  };

  const handlePin = async (p: string) => {
    const newPin = pin + p;
    if (newPin.length > 6) return;
    setPin(newPin);
    
    if (newPin.length === 6) {
      setTimeout(async () => {
        if (setupStep === 'primary') {
          setTempPin(newPin);
          setSetupStep('primary_confirm');
        } else if (setupStep === 'primary_confirm') {
          if (newPin === tempPin) {
             await AsyncStorage.setItem('@vault_pin_primary', newPin);
             setHasPrimaryPin(true);
             setSetupStep('none');
             setVaultMode('primary');
             setIsAuthenticated(true);
          } else {
             shake();
             Alert.alert("Error", "PINs don't match.");
             setSetupStep('primary');
          }
        } else if (setupStep === 'decoy') {
          setTempPin(newPin);
          setSetupStep('decoy_confirm');
        } else if (setupStep === 'decoy_confirm') {
          if (newPin === tempPin) {
             await AsyncStorage.setItem('@vault_pin_decoy', newPin);
             setHasDecoyPin(true);
             setSetupStep('none');
             setIsAuthenticated(true);
             setVaultMode('primary');
          } else {
             shake();
             Alert.alert("Error", "PINs don't match.");
             setSetupStep('decoy');
          }
        } else {
          const savedPrimary = await AsyncStorage.getItem('@vault_pin_primary');
          const savedDecoy = await AsyncStorage.getItem('@vault_pin_decoy');
          
          if (newPin === savedPrimary) {
             setVaultMode('primary'); 
             setIsAuthenticated(true);
          } else if (newPin === savedDecoy) {
             setVaultMode('decoy');
             setIsAuthenticated(true);
          } else {
             shake();
             setPin('');
          }
        }
        setPin('');
      }, 100);
    }
  };

  const pickAndHideImage = async () => {
    if (!vaultMode) return;
    
    skipLock.current = true;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') {
         Alert.alert("Permission Error", "Allow storage access to hide files.");
         skipLock.current = false;
         return;
      }
    } catch (e) {}

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 1,
    });
    skipLock.current = false;

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      try {
         const fileExt = asset.uri.split('.').pop() || 'jpg';
         const newUri = `${FileSystem.documentDirectory}hidden_${vaultMode}_${Date.now()}.${fileExt}`;
         await FileSystem.copyAsync({ from: asset.uri, to: newUri });

         const newItem: HiddenItem = {
            id: Date.now().toString(),
            uri: newUri,
            type: asset.type === 'video' ? 'video' : 'image',
         };
         await saveHiddenItems([newItem, ...hiddenItems]);

         if (asset.assetId) {
            try { 
                await MediaLibrary.deleteAssetsAsync([asset.assetId]);
            } catch(e) {}
         }
      } catch (err) {}
    }
  };

  const handleUnhide = async (item: HiddenItem) => {
    try {
      await MediaLibrary.saveToLibraryAsync(item.uri);
      const updated = hiddenItems.filter(i => i.id !== item.id);
      setHiddenItems(updated);
      await AsyncStorage.setItem(`@vault_items_${vaultMode}`, JSON.stringify(updated));
      setSelectedItem(null);
      setViewingMedia(null);
      Alert.alert("Success", "File has been restored to your gallery.");
    } catch(e) {
      Alert.alert("Error", "Could not restore file.");
    }
  };

  const handleRemove = async (item: HiddenItem) => {
    const updated = hiddenItems.filter(i => i.id !== item.id);
    setHiddenItems(updated);
    await AsyncStorage.setItem(`@vault_items_${vaultMode}`, JSON.stringify(updated));
    setSelectedItem(null);
    setViewingMedia(null);
  };

  const addPassword = () => {
    if (newSite.trim()) {
      const newItem: PasswordItem = {
        id: Date.now().toString(),
        site: newSite.trim(),
        username: newUser.trim(),
        pass: newPass.trim()
      };
      savePasswords([newItem, ...passwords]);
      setIsPassModalVisible(false);
      setNewSite(''); setNewUser(''); setNewPass('');
    }
  };

  const deletePassword = (id: string) => {
    Alert.alert("Remove Password", "Are you sure you want to delete this entry?", [
      { text: "Cancel" },
      { text: "Delete", style: 'destructive', onPress: () => savePasswords(passwords.filter(p => p.id !== id)) }
    ]);
  };

  if (hasPrimaryPin === null) return null;

  if ((hasPrimaryPin && !isAuthenticated) || setupStep !== 'none') {
    return (
      <View style={styles.authContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.bgDecoration1} />
        <View style={styles.bgDecoration2} />

        <View style={styles.authHeader}>
          <TouchableOpacity onPress={cancelSetup} style={styles.backButton}>
             <Ionicons name="lock-closed" size={24} color={MM_Colors.primary} />
             <Text style={styles.headerTitle}>Secure Storage</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.authMain}>
           <View style={styles.identityContainer}>
              <View style={styles.iconCircle}>
                 <Ionicons name="shield-checkmark" size={40} color={MM_Colors.primary} />
              </View>
              <Text style={styles.authHeading}>{getAuthTitle()}</Text>
              <Text style={styles.authSubtitle}>Secure verification required</Text>
           </View>

           <Animated.View style={[styles.pinDisplay, { transform: [{ translateX: shakeAnim }] }]}>
             {[1,2,3,4,5,6].map((i) => (
               <View key={i} style={[styles.pinDot, pin.length >= i && styles.pinDotActive]} />
             ))}
           </Animated.View>

           <View style={styles.numpadGrid}>
              {[1,2,3,4,5,6,7,8,9].map(num => (
                <TouchableOpacity key={num} style={styles.numpadBtn} onPress={() => handlePin(num.toString())} activeOpacity={0.6}>
                  <Text style={styles.numpadText}>{num}</Text>
                </TouchableOpacity>
              ))}
              <View style={styles.numpadBtn} />
              <TouchableOpacity style={styles.numpadBtn} onPress={() => handlePin('0')} activeOpacity={0.6}>
                <Text style={styles.numpadText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.numpadBtn} onPress={() => setPin(pin.slice(0, -1))} activeOpacity={0.6}>
                <Ionicons name="backspace-outline" size={32} color={MM_Colors.textVariant} />
              </TouchableOpacity>
           </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={MM_Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Secure Storage</Text>
        <TouchableOpacity onPress={() => setIsSettingsVisible(true)}>
          <Ionicons name="settings-outline" size={28} color={MM_Colors.textVariant} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'media' && styles.activeTab]}
          onPress={() => setActiveTab('media')}
        >
          <Text style={[styles.tabText, activeTab === 'media' && styles.activeTabText]}>Media</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'passwords' && styles.activeTab]}
          onPress={() => setActiveTab('passwords')}
        >
          <Text style={[styles.tabText, activeTab === 'passwords' && styles.activeTabText]}>Passwords</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'media' ? (
        <FlatList
          key="media-grid"
          data={hiddenItems}
          numColumns={3}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.mediaCard}
              onPress={() => setViewingMedia(item)}
              onLongPress={() => setSelectedItem(item)}
            >
              <Image source={{ uri: item.uri }} style={styles.hiddenImage} />
              {item.type === 'video' && (
                <View style={styles.videoIndicator}>
                  <Ionicons name="play" size={16} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={64} color={MM_Colors.surfaceContainer} />
              <Text style={styles.emptyText}>No hidden media found.</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          key="password-list"
          data={passwords}
          numColumns={1}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={styles.passCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.passSite}>{item.site}</Text>
                <Text style={styles.passUser}>{item.username}</Text>
              </View>
              <TouchableOpacity onPress={() => {
                Alert.alert("Entry Details", `Site: ${item.site}\nUser: ${item.username}\nPass: ${item.pass}`, [{ text: "Copy Pass", onPress: () => {} }, { text: "Close" }]);
              }}>
                <Ionicons name="eye-outline" size={24} color={MM_Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deletePassword(item.id)} style={{ marginLeft: 15 }}>
                <Ionicons name="trash-outline" size={24} color={MM_Colors.error} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="key-outline" size={64} color={MM_Colors.surfaceContainer} />
              <Text style={styles.emptyText}>No stored passwords found.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => activeTab === 'media' ? pickAndHideImage() : setIsPassModalVisible(true)}
      >
        <LinearGradient colors={[MM_Colors.primary, MM_Colors.primaryLight]} style={styles.fabInner}>
           <Ionicons name="add" size={32} color={MM_Colors.white} />
        </LinearGradient>
      </TouchableOpacity>

      {/* Media Fullscreen Viewer */}
      <Modal visible={!!viewingMedia} transparent animationType="fade">
        <View style={styles.fullscreenOverlay}>
          <TouchableOpacity style={styles.closeFullscreen} onPress={() => setViewingMedia(null)}>
            <Ionicons name="close" size={32} color="#FFF" />
          </TouchableOpacity>
          {viewingMedia && (
            viewingMedia.type === 'video' ? (
              <VideoView
                style={styles.fullscreenVideo}
                player={videoPlayer}
                allowsFullscreen
                allowsPictureInPicture
              />
            ) : (
              <Image source={{ uri: viewingMedia.uri }} style={styles.fullscreenImage} resizeMode="contain" />
            )
          )}
          <View style={styles.fullscreenFooter}>
            <TouchableOpacity style={styles.fullscreenBtn} onPress={() => handleUnhide(viewingMedia!)}>
              <Ionicons name="eye-outline" size={24} color="#FFF" />
              <Text style={styles.fullscreenBtnText}>Unhide</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fullscreenBtn} onPress={() => handleRemove(viewingMedia!)}>
              <Ionicons name="trash-outline" size={24} color={MM_Colors.error} />
              <Text style={[styles.fullscreenBtnText, { color: MM_Colors.error }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Options Modal */}
      <Modal visible={!!selectedItem} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
             <Ionicons name="image" size={40} color={MM_Colors.primary} style={{marginBottom: 10}} />
             <Text style={styles.modalTitle}>File Options</Text>
             <TouchableOpacity style={styles.actionBtn} onPress={() => handleUnhide(selectedItem!)}>
                <Ionicons name="eye-outline" size={24} color={MM_Colors.text} style={{marginRight: 10}} />
                <Text style={styles.actionText}>Restore to Gallery</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.actionBtn, {backgroundColor: MM_Colors.error + '20'}]} onPress={() => handleRemove(selectedItem!)}>
                <Ionicons name="trash-outline" size={24} color={MM_Colors.error} style={{marginRight: 10}} />
                <Text style={[styles.actionText, {color: MM_Colors.error}]}>Remove Permanently</Text>
             </TouchableOpacity>
             <TouchableOpacity style={{marginTop: 15}} onPress={() => setSelectedItem(null)}>
                <Text style={{color: MM_Colors.textVariant, fontWeight: 'bold'}}>CANCEL</Text>
             </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Password Modal */}
      <Modal visible={isPassModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Entry</Text>
            <TextInput style={styles.input} placeholder="Website/App" placeholderTextColor={MM_Colors.textVariant} value={newSite} onChangeText={setNewSite} />
            <TextInput style={styles.input} placeholder="Username/Email" placeholderTextColor={MM_Colors.textVariant} value={newUser} onChangeText={setNewUser} />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor={MM_Colors.textVariant} secureTextEntry value={newPass} onChangeText={setNewPass} />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setIsPassModalVisible(false)} style={styles.cancelBtn}><Text style={{fontWeight:'700'}}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={addPassword} style={styles.saveBtn}><Text style={{color: '#FFF', fontWeight:'700'}}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={isSettingsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
             <Text style={styles.modalTitle}>Security Configuration</Text>
             {vaultMode === 'primary' ? (
               <>
                 <TouchableOpacity style={styles.actionBtn} onPress={() => {setIsSettingsVisible(false); setSetupStep('primary');}}>
                    <Ionicons name="key-outline" size={24} color={MM_Colors.text} style={{marginRight: 10}} />
                    <Text style={styles.actionText}>Change Primary PIN</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.actionBtn} onPress={() => {setIsSettingsVisible(false); setSetupStep('decoy');}}>
                    <Ionicons name="shield-outline" size={24} color={MM_Colors.text} style={{marginRight: 10}} />
                    <Text style={styles.actionText}>{hasDecoyPin ? 'Change Decoy PIN' : 'Initialize Decoy PIN'}</Text>
                 </TouchableOpacity>
               </>
             ) : (
               <TouchableOpacity style={styles.actionBtn} onPress={() => {setIsSettingsVisible(false); setSetupStep('decoy');}}>
                  <Ionicons name="key-outline" size={24} color={MM_Colors.text} style={{marginRight: 10}} />
                  <Text style={styles.actionText}>Change Password</Text>
               </TouchableOpacity>
             )}
             <TouchableOpacity style={[styles.actionBtn, {backgroundColor: MM_Colors.error + '20'}]} onPress={removePin}>
                <Ionicons name="lock-open-outline" size={24} color={MM_Colors.error} style={{marginRight: 10}} />
                <Text style={[styles.actionText, {color: MM_Colors.error}]}>Factory Reset (Clear All)</Text>
             </TouchableOpacity>
             <TouchableOpacity style={{marginTop: 15}} onPress={() => setIsSettingsVisible(false)}>
                <Text style={{color: MM_Colors.textVariant, fontWeight: '700'}}>CLOSE</Text>
             </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  authContainer: { flex: 1, backgroundColor: MM_Colors.background },
  bgDecoration1: { position: 'absolute', top: -height * 0.1, left: -width * 0.1, width: width * 0.4, height: width * 0.4, borderRadius: width * 0.2, backgroundColor: 'rgba(64, 82, 182, 0.05)' },
  bgDecoration2: { position: 'absolute', bottom: -height * 0.1, right: -width * 0.1, width: width * 0.5, height: width * 0.5, borderRadius: width * 0.25, backgroundColor: 'rgba(118, 86, 0, 0.05)' },
  authHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, marginTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 10 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontWeight: '800', fontSize: 20, color: MM_Colors.primary, letterSpacing: -0.5 },
  authMain: { flex: 1, width: '100%', paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center' },
  identityContainer: { alignItems: 'center', marginBottom: 48 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: MM_Colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  authHeading: { fontWeight: '800', fontSize: 32, color: MM_Colors.onBackground, letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  authSubtitle: { color: MM_Colors.onSurfaceVariant, fontWeight: '500', fontSize: 14, textAlign: 'center' },
  pinDisplay: { flexDirection: 'row', gap: 24, paddingVertical: 16, marginBottom: 48 },
  pinDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: MM_Colors.outlineVariant },
  pinDotActive: { backgroundColor: MM_Colors.primary, transform: [{ scale: 1.2 }], shadowColor: MM_Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 12 },
  numpadGrid: { width: '100%', maxWidth: 320, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 24 },
  numpadBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  numpadText: { fontWeight: '700', fontSize: 26, color: MM_Colors.text },

  container: { flex: 1, backgroundColor: MM_Colors.background, padding: 24, paddingTop: Platform.OS === 'ios' ? 80 : (StatusBar.currentHeight || 0) + 30 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '900', color: MM_Colors.primary, letterSpacing: -1 },
  tabContainer: { flexDirection: 'row', backgroundColor: MM_Colors.surfaceContainer, borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: MM_Colors.white, elevation: 2 },
  tabText: { fontWeight: '700', color: MM_Colors.textVariant },
  activeTabText: { color: MM_Colors.primary },
  mediaCard: { flex: 1/3, aspectRatio: 1, margin: 4, borderRadius: 12, overflow: 'hidden', backgroundColor: MM_Colors.surface },
  hiddenImage: { width: '100%', height: '100%' },
  videoIndicator: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 2 },
  passCard: { backgroundColor: MM_Colors.white, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, elevation: 1 },
  passSite: { fontSize: 18, fontWeight: '800', color: MM_Colors.text },
  passUser: { fontSize: 14, color: MM_Colors.textVariant },
  emptyState: { alignItems: 'center', marginTop: 100, opacity: 0.5 },
  emptyText: { marginTop: 16, color: MM_Colors.textVariant, fontWeight: '600' },
  fab: { position: 'absolute', bottom: 30, right: 30, elevation: 8, shadowColor: MM_Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15 },
  fabInner: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(44, 42, 81, 0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: MM_Colors.surface, padding: 32, borderRadius: 32, width: '100%', alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: MM_Colors.text, marginBottom: 24 },
  input: { backgroundColor: MM_Colors.background, width: '100%', padding: 15, borderRadius: 12, marginBottom: 12, color: MM_Colors.text, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { padding: 15, borderRadius: 12, backgroundColor: MM_Colors.background, flex: 1, alignItems: 'center' },
  saveBtn: { padding: 15, borderRadius: 12, backgroundColor: MM_Colors.primary, flex: 1, alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: MM_Colors.background, width: '100%', padding: 20, borderRadius: 20, marginBottom: 12 },
  actionText: { fontSize: 16, fontWeight: '700', color: MM_Colors.text },

  fullscreenOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  fullscreenImage: { width: width, height: height * 0.8 },
  fullscreenVideo: { width: width, height: height * 0.8 },
  closeFullscreen: { position: 'absolute', top: 60, right: 24, zIndex: 10 },
  fullscreenFooter: { position: 'absolute', bottom: 40, width: '100%', flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 40 },
  fullscreenBtn: { alignItems: 'center', gap: 8 },
  fullscreenBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 }
});
