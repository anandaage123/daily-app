import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Alert, Modal, AppState, Dimensions, Platform, Animated, StatusBar, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Colors, Typography } from '../theme/Theme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface HiddenItem {
  id: string;
  uri: string;
  type: 'image' | 'video' | 'mixed';
  originalUri?: string;
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

  const [hiddenItems, setHiddenItems] = useState<HiddenItem[]>([]);
  const navigation = useNavigation();
  const [selectedItem, setSelectedItem] = useState<HiddenItem | null>(null);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  
  const appState = useRef(AppState.currentState);
  const skipLock = useRef(false);

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
          setIsSettingsVisible(false);
          setSelectedItem(null);
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
      case 'primary': return 'Set Primary PIN';
      case 'primary_confirm': return 'Confirm Primary PIN';
      case 'decoy': return 'Set Decoy PIN';
      case 'decoy_confirm': return 'Confirm Decoy PIN';
      default: return 'Enter Vault PIN';
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

  const handleForgotPin = async () => {
    Alert.alert(
      "Reset Vault PIN",
      "Generate new random Primary PIN and send to anand.aage.spam@gmail.com?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: async () => {
            const newPin = Math.floor(100000 + Math.random() * 900000).toString();
            try {
              await AsyncStorage.setItem('@vault_pin_primary', newPin);
              const url = `mailto:anand.aage.spam@gmail.com?subject=Vault PIN Reset&body=Your new Secure Vault PIN has been reset to: ${newPin}`;
              const supported = await Linking.canOpenURL(url);
              if (supported) {
                await Linking.openURL(url);
              } else {
                Alert.alert("New PIN", `New PIN is ${newPin}`);
              }
            } catch (e) {}
        }}
      ]
    );
  };

  const removePin = async () => {
    Alert.alert("Remove Security", "This will remove the PIN lock and clear all vault items for security. Proceed?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove & Wipe", style: "destructive", onPress: async () => {
          await AsyncStorage.removeItem('@vault_pin_primary');
          await AsyncStorage.removeItem('@vault_pin_decoy');
          await AsyncStorage.removeItem('@vault_items_primary');
          await AsyncStorage.removeItem('@vault_items_decoy');
          setHasPrimaryPin(false);
          setHasDecoyPin(false);
          setVaultMode('primary');
          setIsAuthenticated(true);
          setIsSettingsVisible(false);
          Alert.alert("Vault Reset", "Security and items have been cleared.");
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

  const handlePin = async (p: string) => {
    const newPin = pin + p;
    if (newPin.length > 6) return;
    setPin(newPin);
    
    if (newPin.length === 6) {
      setTimeout(async () => {
        // Setup flows
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
             Alert.alert("Vault Secured", "Primary PIN Set.");
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
             Alert.alert("Decoy Set", "Decoy PIN applied.");
          } else {
             shake();
             Alert.alert("Error", "PINs don't match.");
             setSetupStep('decoy');
          }
        } else {
          // Login flow
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
             Alert.alert("Error", "Incorrect Vault PIN!");
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
         // @ts-ignore
         const newUri = `${FileSystem.documentDirectory}hidden_${vaultMode}_${Date.now()}.${fileExt}`;
         await FileSystem.copyAsync({ from: asset.uri, to: newUri });

         const newItem: HiddenItem = {
            id: Date.now().toString(),
            uri: newUri,
            type: asset.type === 'video' ? 'video' : 'image',
            originalUri: asset.assetId ? asset.uri : undefined, 
         };
         await saveHiddenItems([newItem, ...hiddenItems]);

         if (asset.assetId) {
            try { 
                await MediaLibrary.deleteAssetsAsync([asset.assetId]);
            } catch(e) {}
         }
         
         try {
             await FileSystem.deleteAsync(asset.uri, { idempotent: true });
         } catch(e) {}

      } catch (err) {}
    }
  };

  const unhideItem = async () => {
    if (!selectedItem) return;
    try {
      await MediaLibrary.saveToLibraryAsync(selectedItem.uri);
      // @ts-ignore
      await FileSystem.deleteAsync(selectedItem.uri, { idempotent: true });
      await saveHiddenItems(hiddenItems.filter(i => i.id !== selectedItem.id));
      setSelectedItem(null);
      Alert.alert("Unhidden", "Item successfully restored.");
    } catch(e) { Alert.alert("Error", "Could not restore file."); }
  };

  const permanentlyDelete = async () => {
    if (!selectedItem) return;
    try {
      // @ts-ignore
      await FileSystem.deleteAsync(selectedItem.uri, { idempotent: true });
      await saveHiddenItems(hiddenItems.filter(i => i.id !== selectedItem.id));
      setSelectedItem(null);
    } catch(e) {}
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
             <Text style={styles.headerTitle}>Secure Vault</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.authMain}>
           <View style={styles.identityContainer}>
              <View style={styles.iconCircle}>
                 <Ionicons name="shield-checkmark" size={40} color={MM_Colors.primary} />
              </View>
              <Text style={styles.authHeading}>{getAuthTitle()}</Text>
              <Text style={styles.authSubtitle}>Authentication required to access assets</Text>
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

           <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPin}>
              <Text style={styles.forgotText}>FORGOT PIN?</Text>
           </TouchableOpacity>
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
        <Text style={styles.title}>Secure Vault {vaultMode === 'decoy' ? '(Decoy)' : ''}</Text>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
           {!!vaultMode && (
             <>
               <TouchableOpacity onPress={() => setIsSettingsVisible(true)} style={{marginRight: 20}}>
                 <Ionicons name="settings" size={30} color={MM_Colors.textVariant} />
               </TouchableOpacity>
               <TouchableOpacity onPress={pickAndHideImage}>
                 <Ionicons name="add-circle" size={32} color={MM_Colors.secondary} />
               </TouchableOpacity>
             </>
           )}
        </View>
      </View>

      {!hasPrimaryPin && setupStep === 'none' && (
         <TouchableOpacity onPress={startSetup} style={styles.warningBox}>
            <Ionicons name="warning" size={24} color="#FFD700" />
            <Text style={{fontSize: 14, color: "#FFD700", marginLeft: 10, flex: 1, fontWeight: '500'}}>Set up a PIN to lock and secure this Vault.</Text>
         </TouchableOpacity>
      )}

      {!!vaultMode && (
         <Text style={styles.subtitle}>Hidden Files ({hiddenItems.length})</Text>
      )}

      {!!vaultMode && (
        <FlatList
          data={hiddenItems}
          numColumns={2}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.appCard} onPress={() => setSelectedItem(item)}>
              <Image source={{ uri: item.uri }} style={styles.hiddenImage} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={{color: MM_Colors.textVariant, textAlign: 'center', marginTop: 50}}>Tap '+' to authentically hide photos/videos here.</Text>}
        />
      )}

      <Modal visible={!!selectedItem} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
             <Ionicons name="image" size={40} color={MM_Colors.primary} style={{marginBottom: 10}} />
             <Text style={styles.modalTitle}>Vault File Action</Text>
             
             <TouchableOpacity style={styles.actionBtn} onPress={unhideItem}>
                <Ionicons name="eye-outline" size={24} color={MM_Colors.text} style={{marginRight: 10}} />
                <Text style={styles.actionText}>Unhide (Restore)</Text>
             </TouchableOpacity>

             <TouchableOpacity style={[styles.actionBtn, {backgroundColor: MM_Colors.error + '20'}]} onPress={permanentlyDelete}>
                <Ionicons name="trash-outline" size={24} color={MM_Colors.error} style={{marginRight: 10}} />
                <Text style={[styles.actionText, {color: MM_Colors.error}]}>Permanently Delete</Text>
             </TouchableOpacity>

             <TouchableOpacity style={{marginTop: 15}} onPress={() => setSelectedItem(null)}>
                <Text style={{color: MM_Colors.textVariant, fontWeight: 'bold'}}>Cancel</Text>
             </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isSettingsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
             <Text style={styles.modalTitle}>Vault Settings</Text>

             <TouchableOpacity style={styles.actionBtn} onPress={() => {setIsSettingsVisible(false); setSetupStep('primary');}}>
                <Ionicons name="key-outline" size={24} color={MM_Colors.text} style={{marginRight: 10}} />
                <Text style={styles.actionText}>Change Primary PIN</Text>
             </TouchableOpacity>

             <TouchableOpacity style={styles.actionBtn} onPress={() => {setIsSettingsVisible(false); setSetupStep('decoy');}}>
                <Ionicons name="shield-outline" size={24} color={MM_Colors.text} style={{marginRight: 10}} />
                <Text style={styles.actionText}>{hasDecoyPin ? 'Change Decoy PIN' : 'Set Decoy PIN'}</Text>
             </TouchableOpacity>

             <TouchableOpacity style={[styles.actionBtn, {backgroundColor: MM_Colors.error + '20'}]} onPress={removePin}>
                <Ionicons name="lock-open-outline" size={24} color={MM_Colors.error} style={{marginRight: 10}} />
                <Text style={[styles.actionText, {color: MM_Colors.error}]}>Remove PIN & Reset</Text>
             </TouchableOpacity>

             <TouchableOpacity style={{marginTop: 15}} onPress={() => setIsSettingsVisible(false)}>
                <Text style={{color: MM_Colors.textVariant, fontWeight: 'bold'}}>Close</Text>
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

  authHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, marginTop: Platform.OS === 'ios' ? 44 : 10 },
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

  forgotBtn: { marginTop: 32, paddingVertical: 16 },
  forgotText: { color: MM_Colors.primary, fontWeight: '700', fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase' },

  container: { flex: 1, backgroundColor: MM_Colors.background, padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', color: MM_Colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, fontWeight: '600', color: MM_Colors.textVariant, marginBottom: 20 },
  warningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#332b00', padding: 16, borderRadius: 16, marginBottom: 24 },
  appCard: { flex: 1, margin: 8, borderRadius: 20, overflow: 'hidden', backgroundColor: MM_Colors.surface, aspectRatio: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
  hiddenImage: { width: '100%', height: '100%' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(44, 42, 81, 0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: MM_Colors.surface, padding: 32, borderRadius: 32, width: '100%', alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: MM_Colors.text, marginBottom: 24 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: MM_Colors.background, width: '100%', padding: 20, borderRadius: 20, marginBottom: 12 },
  actionText: { fontSize: 16, fontWeight: '700', color: MM_Colors.text }
});
