import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

// Base reference: standard iPhone 12 width (390px)
const BASE_WIDTH = 390;
const MIN_SCALE = 0.85; // Don't shrink below 85% on small devices
const MAX_SCALE = 1.15; // Don't grow above 115% on large devices

/**
 * Scales a size value proportionally to the device width
 * @param baseSize - The base size (typically for 390px width)
 * @returns Scaled size appropriate for current device
 */
export const scaleSize = (baseSize: number): number => {
  const scale = width / BASE_WIDTH;
  const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
  return Math.round(baseSize * clampedScale);
};

/**
 * Scales font size, with slightly different scaling than other sizes
 * This prevents text from becoming too small or too large
 * @param baseFontSize - The base font size
 * @returns Scaled font size
 */
export const scaleFontSize = (baseFontSize: number): number => {
  const scale = width / BASE_WIDTH;
  const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
  return Math.round(baseFontSize * clampedScale);
};

/**
 * Responsive dimension scaler (similar to FocusScreen's ds function)
 * @param baseSize - Size based on 414px standard
 * @returns Scaled size for current device
 */
export const ds = (baseSize: number): number => {
  return (baseSize * width) / 414;
};

/**
 * Get screen breakpoint for responsive design
 */
export const getBreakpoint = (): 'small' | 'medium' | 'large' => {
  if (width < 375) return 'small';
  if (width > 430) return 'large';
  return 'medium';
};

export const ResponsiveSize = {
  scaleSize,
  scaleFontSize,
  ds,
  getBreakpoint,
  width,
  height,
  baseWidth: BASE_WIDTH,
};
