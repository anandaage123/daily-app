import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppSettingsContextType {
  periodTrackerEnabled: boolean;
  setPeriodTrackerEnabled: (enabled: boolean) => Promise<void>;
  isLoading: boolean;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [periodTrackerEnabled, setEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem('@settings_period_tracker');
      if (stored !== null) {
        setEnabled(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setPeriodTrackerEnabled = async (enabled: boolean) => {
    try {
      setEnabled(enabled);
      await AsyncStorage.setItem('@settings_period_tracker', JSON.stringify(enabled));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  return (
    <AppSettingsContext.Provider value={{ periodTrackerEnabled, setPeriodTrackerEnabled, isLoading }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return context;
};
