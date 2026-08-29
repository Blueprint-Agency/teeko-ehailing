import { useTheme } from '../components/ThemeProvider';

export const DarkColors = {
  bg: '#0A0A0E',
  surface: '#13131A',
  surfaceHigh: '#1C1C26',
  surfaceTop: '#242430',
  accent: '#E11D2E',
  accentDim: '#A80025',
  text: '#FFFFFF',
  textSec: '#9090A4',
  textMut: '#505060',
  border: '#252530',
  borderHigh: '#343444',
  success: '#00D47E',
  danger: '#FF3B5C',
  warning: '#FFAB00',
  info: '#4DA6FF',
  online: '#00D47E',
  offline: '#505060',
  surge: '#FF6B2B',

  // Soft fills for icon chips and trend pills. Kept as literals rather than
  // computed alphas so the palette stays a plain object the style factories read.
  accentTint: 'rgba(225, 29, 46, 0.16)',
  successTint: 'rgba(0, 212, 126, 0.16)',
  dangerTint: 'rgba(255, 59, 92, 0.16)',
  infoTint: 'rgba(77, 166, 255, 0.16)',
  warningTint: 'rgba(255, 171, 0, 0.16)',

  // A hairline that reads as separation rather than as an outline.
  borderSoft: '#1E1E28',

  // Dark surfaces get their depth from the border — a black shadow on a near
  // black background is invisible, so elevation is switched off here.
  shadowColor: '#000000',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowElevation: 0,
};

export const LightColors = {
  bg: '#F5F5F8',
  surface: '#FFFFFF',
  surfaceHigh: '#EBEBF0',
  surfaceTop: '#E0E0E8',
  accent: '#FF6B6B',
  accentDim: '#E04444',
  text: '#0A0A0E',
  textSec: '#505060',
  textMut: '#9090A4',
  border: '#DDDDE8',
  borderHigh: '#C8C8D8',
  success: '#00A860',
  danger: '#E0002E',
  warning: '#CC8800',
  info: '#2080D0',
  online: '#00A860',
  offline: '#9090A4',
  surge: '#D44A00',

  accentTint: 'rgba(255, 107, 107, 0.14)',
  successTint: 'rgba(0, 168, 96, 0.12)',
  dangerTint: 'rgba(224, 0, 46, 0.10)',
  infoTint: 'rgba(32, 128, 208, 0.12)',
  warningTint: 'rgba(204, 136, 0, 0.14)',

  borderSoft: '#EFEFF5',

  // Light cards float on a shadow instead of being ringed by a border.
  shadowColor: '#1A1A2E',
  shadowOpacity: 0.07,
  shadowRadius: 14,
  shadowElevation: 3,
};

// Default export for backwards-compat (dark theme)
export const Colors = DarkColors;

export function useColors() {
  const { activeTheme } = useTheme();
  return activeTheme === 'dark' ? DarkColors : LightColors;
}
