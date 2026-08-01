export const colors = {
  primary: '#5B21B6',
  primaryLight: '#7C3AED',
  accent: '#F5B700',
  bgLight: '#F7F6FB',
  card: '#FFFFFF',
  textDark: '#1A1523',
  textMuted: '#847F94',
  success: '#16A34A',
  danger: '#DC2626',
  border: '#ECE9F3',
  info: '#0EA5E9',
  warning: '#F59E0B',
  savingsGreen: '#0E9F6E',
  
  // Dark Mode Palette
  dark: {
    background: '#121212',
    surface: '#1E1E24',
    surfaceAlt: '#2A1F45',
    primary: '#6236FF',
    text: '#FFFFFF',
    textMuted: '#A0A0A0',
    accent: '#D4AF37',
    border: '#3A2E5D',
    success: '#00E676',
    danger: '#FF4D4D',
    info: '#00D2FF',
  },

  // Light Mode Palette — same shape as `dark` above, built from the
  // existing flat light tokens so it stays visually consistent with the
  // screens (Bills, Invoice, Support, etc.) that already use those directly.
  light: {
    background: '#F7F6FB',
    surface: '#FFFFFF',
    surfaceAlt: '#F0EBFC',
    primary: '#5B21B6',
    text: '#1A1523',
    textMuted: '#847F94',
    accent: '#B8860B',
    border: '#ECE9F3',
    success: '#16A34A',
    danger: '#DC2626',
    info: '#0EA5E9',
  },
};

// Consumed by ThemeContext — `themes.dark` / `themes.light` give every
// screen the same shape of palette regardless of the active mode.
export const themes = {
  dark: colors.dark,
  light: colors.light,
};

export const gradients = {
  primary: ['#5B21B6', '#7C3AED'],
  gold: ['#F5B700', '#FFD84D'],
  dark: ['#1A1523', '#3B2A63'],
  savings: ['#0E9F6E', '#34D399'],
  loan: ['#F5A623', '#F5B700'],
  info: ['#0EA5E9', '#38BDF8'],
  darkSurface: ['#1E1E24', '#121212']
};
