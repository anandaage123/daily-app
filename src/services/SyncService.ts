import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY = 'VCXCEuvhGcBDP7XhiJJUDvR1e1D3eiVjgZ9VRiaV';
let ws: WebSocket | null = null;
let syncCode: string | null = null;

// Subscribers
type SyncCallback = (type: string, payload: any) => void;
const subscribers: SyncCallback[] = [];

export const subscribeToSync = (callback: SyncCallback) => {
  subscribers.push(callback);
  return () => {
    const idx = subscribers.indexOf(callback);
    if (idx > -1) subscribers.splice(idx, 1);
  };
};

const notifySubscribers = (type: string, payload: any) => {
  subscribers.forEach(cb => cb(type, payload));
};

export const getSyncCode = async (): Promise<string | null> => {
  if (syncCode) return syncCode;
  const cached = await AsyncStorage.getItem('@monolith_sync_code');
  if (cached) {
    syncCode = cached;
    return cached;
  }
  return null;
};

export const startSyncService = async (providedCode?: string) => {
  if (ws) return; // Already running
  const code = providedCode || await getSyncCode();
  if (!code) return; // No code provided, do not connect
  
  syncCode = code;
  await AsyncStorage.setItem('@monolith_sync_code', code);
  const channelId = `monolith_sync_${code}`;
  
  // Connect to public relay
  ws = new WebSocket('wss://socketsbay.com/wss/v2/1/demo/');
  
  ws.onopen = () => {
    console.log('[SyncService] Connected using code:', code);
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data && data.__monolith && data.channel === code && data.source === 'WEB') {
        notifySubscribers(data.type, data.payload);
      }
    } catch (e) {
      // Ignored
    }
  };
  
  ws.onclose = () => {
    console.log('[SyncService] Disconnected.');
    ws = null;
    // We do not auto-reconnect anymore to save background resources. They must reconnect manually.
  };
};

export const stopSyncService = async () => {
  if (ws) {
    ws.close();
    ws = null;
  }
  syncCode = null;
  await AsyncStorage.removeItem('@monolith_sync_code');
};

export const broadcastSyncUpdate = async (type: string, payload: any) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      __monolith: true,
      channel: syncCode,
      source: 'APP',
      type,
      payload
    }));
  }
};
