import { Platform } from 'react-native';
import { scaleFontSize } from '../utils/ResponsiveSize';

export const MM_Colors = {
  primary: '#4052B6', // Royal Muse Blue
  primaryLight: '#8899FF',
  background: '#F9F5FF', // Soft UI background
  surface: '#FFFFFF',
  surfaceContainer: '#F0EFFF', 
  surfaceContainerHigh: '#E0DEFF',
  surfaceContainerLow: '#FFFFFF',
  surfaceContainerLowest: '#FFFFFF',
  text: '#2C2A51', // Deep Slate
  textVariant: '#5D5A88', 
  outlineVariant: '#C6C6C8',
  onBackground: '#2C2A51',
  onSurface: '#2C2A51',
  onSurfaceVariant: '#5D5A88',
  primaryDim: '#303F9F',
  secondary: '#765600', // Gold
  secondaryContainer: '#FFF1CC', 
  onSecondaryContainer: '#765600',
  tertiary: '#006947', // Green
  tertiaryContainer: '#E5F9E7',
  onTertiaryContainer: '#1E7D32',
  error: '#B41340', // Ruby
  white: '#FFFFFF',
  primaryContainer: '#4052B6',
};

export const Dark_Colors = {
  primary: '#8899FF', // Lighter for legibility on dark
  primaryLight: '#AABBFF',
  background: '#0F0E17',
  surface: '#1A1826',
  surfaceContainer: '#242233',
  surfaceContainerHigh: '#2F2C45',
  surfaceContainerLow: '#1A1826',
  surfaceContainerLowest: '#0F0E17',
  text: '#F2F2F2',
  textVariant: '#B0ADC9',
  outlineVariant: '#3C3A5A',
  onBackground: '#F2F2F2',
  onSurface: '#F2F2F2',
  onSurfaceVariant: '#B0ADC9',
  primaryDim: '#4052B6',
  secondary: '#FFCC00', // Gold pop
  secondaryContainer: '#332900',
  onSecondaryContainer: '#FFCC00',
  tertiary: '#4ADE80',
  tertiaryContainer: '#002C1E',
  onTertiaryContainer: '#4ADE80',
  error: '#FF4D6D',
  white: '#FFFFFF',
  primaryContainer: '#4052B6',
};

export const Colors = MM_Colors;

const getFontFamily = (weight: string) => {
  if (Platform.OS === 'ios') return 'System';
  return 'Inter'; // Fallback for Android to match iOS look
};

export const Typography = {
  header: {
    fontFamily: getFontFamily('700'),
    fontSize: scaleFontSize(34), // iOS Large Title - responsive
    fontWeight: '700' as const,
    color: MM_Colors.text,
    letterSpacing: 0.37,
  },
  title: {
    fontFamily: getFontFamily('600'),
    fontSize: scaleFontSize(20), // iOS Title 3 - responsive
    fontWeight: '600' as const,
    color: MM_Colors.text,
    letterSpacing: -0.45,
  },
  body: {
    fontFamily: getFontFamily('400'),
    fontSize: scaleFontSize(17), // iOS Body - responsive
    fontWeight: '400' as const,
    color: MM_Colors.text,
    letterSpacing: -0.41,
    lineHeight: 22,
  },
  caption: {
    fontFamily: getFontFamily('400'),
    fontSize: scaleFontSize(12), // iOS Caption 2 - responsive
    fontWeight: '400' as const,
    color: MM_Colors.textVariant,
    letterSpacing: 0,
  },
};

export const Shadows = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  dark: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  }
};

export const Spacing = {
  padding: 16,
  borderRadius: 12,
};
