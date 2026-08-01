import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../context/ThemeContext';
import AnimatedTabBar from '../components/AnimatedTabBar';

import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TransferScreen from '../screens/TransferScreen';
import BillsScreen from '../screens/BillsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TransactionDetailScreen from '../screens/TransactionDetailScreen';
import SupportScreen from '../screens/SupportScreen';
import InvoiceScreen from '../screens/InvoiceScreen';

// Elite Modules
import AnalyticsScreen from '../screens/AnalyticsScreen';
import CardScreen from '../screens/CardScreen';
import RewardsScreen from '../screens/RewardsScreen';

// Elite Modules (v2)
import SavingsScreen from '../screens/SavingsScreen';
import LoanScreen from '../screens/LoanScreen';
import BeneficiariesScreen from '../screens/BeneficiariesScreen';
import QRPayScreen from '../screens/QRPayScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AirtimeScreen from '../screens/AirtimeScreen';

// Elite Modules (v3) — profile management & preferences
import ProfileInfoScreen from '../screens/ProfileInfoScreen';
import ProfileInfoFormScreen from '../screens/ProfileInfoFormScreen';
import SettingsScreen from '../screens/SettingsScreen';

// Elite Modules (v4) — advanced fintech engagement
import SecurityScreen from '../screens/SecurityScreen';
import StatementScreen from '../screens/StatementScreen';
import BudgetScreen from '../screens/BudgetScreen';
import KYCScreen from '../screens/KYCScreen';
import ReferralScreen from '../screens/ReferralScreen';
import DisputesScreen from '../screens/DisputesScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  // The tab bar itself is a custom renderer (animated pill + icon lift);
  // routes, names and titles are unchanged.
  return (
    <Tab.Navigator
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'shift' }}
    >
      <Tab.Screen name="DashboardTab" component={DashboardScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Savings" component={SavingsScreen} options={{ title: 'Wealth' }} />
      <Tab.Screen name="Loans" component={LoanScreen} options={{ title: 'Finance' }} />
      <Tab.Screen name="Rewards" component={RewardsScreen} options={{ title: 'Rewards' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Me' }} />
    </Tab.Navigator>
  );
}

function MainStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 280,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <Stack.Screen name="Main" component={MainTabs} options={{ animation: 'fade' }} />

      {/* Money movement */}
      <Stack.Screen name="Transfer" component={TransferScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Bills" component={BillsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Airtime" component={AirtimeScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="Invoice" component={InvoiceScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Beneficiaries" component={BeneficiariesScreen} options={{ presentation: 'modal', animation: 'slide_from_right' }} />
      <Stack.Screen name="QRPay" component={QRPayScreen} options={{ presentation: 'modal', animation: 'fade_from_bottom' }} />

      {/* Records & insight */}
      <Stack.Screen name="History" component={HistoryScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="Insights" component={AnalyticsScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} options={{ presentation: 'transparentModal', animation: 'fade_from_bottom' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />

      {/* Account & profile */}
      <Stack.Screen name="Cards" component={CardScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="ProfileInfo" component={ProfileInfoScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="ProfileInfoForm" component={ProfileInfoFormScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="Security" component={SecurityScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="Statement" component={StatementScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="Budget" component={BudgetScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="KYC" component={KYCScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="Referral" component={ReferralScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="Disputes" component={DisputesScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />

      {/* Support & dev */}
      <Stack.Screen
        name="Support"
        component={SupportScreen}
        options={{ presentation: 'card', headerShown: true, title: 'Help & Support', headerTintColor: theme.text, headerStyle: { backgroundColor: theme.background } }}
      />
    </Stack.Navigator>
  );
}

function AuthStack() {
  const { user } = useWallet();
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 280 }}
      initialRouteName={user ? 'Login' : 'Signup'}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { loading, onboarded, isAuthenticated } = useWallet();
  const { scheme } = useTheme();

  if (loading) return <SplashScreen />;
  if (!onboarded) return <OnboardingScreen />;

  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <NavigationContainer theme={navTheme}>
      {isAuthenticated ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
