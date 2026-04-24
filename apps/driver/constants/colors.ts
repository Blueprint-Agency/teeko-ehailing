import { useTheme } from '../components/ThemeProvider';

export const DarkColors = {
  bg: '#0A0A0E',
  surface: '#13131A',
  surfaceHigh: '#1C1C26',
  surfaceTop: '#242430',
  accent: '#CCFF00',
  accentDim: '#99BF00',
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
};

export const LightColors = {
  bg: '#F5F5F8',
  surface: '#FFFFFF',
  surfaceHigh: '#EBEBF0',
  surfaceTop: '#E0E0E8',
  accent: '#7AB000',
  accentDim: '#5C8500',
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
};

// Default export for backwards-compat (dark theme)
export const Colors = DarkColors;

export function useColors() {
  const { activeTheme } = useTheme();
  return activeTheme === 'dark' ? DarkColors : LightColors;
}
