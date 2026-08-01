import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Appearance } from 'react-native';
import { themes } from '../theme/colors';
import { saveJSON, loadJSON } from '../utils/storage';

const ThemeContext = createContext(null);
const THEME_MODE_KEY = 'zannypay:themeMode';

export function ThemeProvider({ children }) {
  // 'dark' | 'light' | 'system' — defaults to 'system' so first launch
  // respects the device's own appearance setting rather than forcing dark.
  const [mode, setModeState] = useState('system');
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme() || 'dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await loadJSON(THEME_MODE_KEY, 'system');
      setModeState(saved || 'system');
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'dark');
    });
    return () => sub.remove();
  }, []);

  const setMode = useCallback(async (nextMode) => {
    setModeState(nextMode);
    await saveJSON(THEME_MODE_KEY, nextMode);
  }, []);

  const resolvedScheme = mode === 'system' ? systemScheme : mode;
  const theme = useMemo(() => themes[resolvedScheme] || themes.dark, [resolvedScheme]);

  const value = {
    mode, // what the user picked: 'dark' | 'light' | 'system'
    scheme: resolvedScheme, // the actual palette in effect right now
    theme,
    setMode,
    ready,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
