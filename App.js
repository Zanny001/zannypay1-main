import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { WalletProvider } from './src/context/WalletContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AlertProvider } from './src/context/AlertContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';

// Note: the offline-retry queue (SyncEngine.processQueue) is driven from
// inside WalletContext now — it needs `syncWallet()` to refresh state right
// after a queued request succeeds, so it doesn't belong up here anymore.

SplashScreen.preventAutoHideAsync().catch(() => {});

// Inter is loaded here and applied explicitly via `fonts.js` (fontFamily
// constants) on the highest-visibility surfaces — GradientButton, the new
// CustomAlert, and screen headers — rather than a global Text monkey-patch,
// which is a common source of hard-to-diagnose crashes across RN versions.

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AlertProvider>
            <WalletProvider>
              <ThemedStatusBar />
              <AppNavigator />
            </WalletProvider>
          </AlertProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
