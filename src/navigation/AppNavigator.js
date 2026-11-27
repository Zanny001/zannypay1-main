import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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
import SupportChatScreen from '../screens/SupportChatScreen';
import InvoiceScreen from '../screens/InvoiceScreen';
import BusinessScreen from '../screens/BusinessScreen';
import InvoicesListScreen from '../screens/InvoicesListScreen';
import InvoiceDetailScreen from '../screens/InvoiceDetailScreen';
import RecurringTransfersScreen from '../screens/RecurringTransfersScreen';
import CreateRecurringTransferScreen from '../screens/CreateRecurringTransferScreen';

// Elite Modules
import AnalyticsScreen from '../screens/AnalyticsScreen';
import CardScreen from '../screens/CardScreen';

// Elite Modules (v2)
import BeneficiariesScreen from '../screens/BeneficiariesScreen';
import QRPayScreen from '../screens/QRPayScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AirtimeScreen from '../screens/AirtimeScreen';

// Elite Modules (v3) — profile management & preferences
import ProfileInfoScreen from '../screens/ProfileInfoScreen';
import ProfileInfoFormScreen from '../screens/ProfileInfoFormScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ServiceStatusScreen from '../screens/ServiceStatusScreen';

// Elite Modules (v4) — advanced fintech engagement
import SecurityScreen from '../screens/SecurityScreen';
import StatementScreen from '../screens/StatementScreen';
import BudgetScreen from '../screens/BudgetScreen';
import KYCScreen from '../screens/KYCScreen';
import ReferralScreen from '../screens/ReferralScreen';
import DisputesScreen from '../screens/DisputesScreen';


const navigationRef = createNavigationContainerRef();
let pendingPushData = null;
let lastHandledPushId = null;

function navigateFromPush(data) {
  if (!data || typeof data.type !== 'string') return;
  const destinations = {
    chat_reply: 'SupportChat',
    kyc_approved: 'KYC',
    kyc_rejected: 'KYC',
    dispute_resolved: 'Disputes',
    card_frozen: 'Cards',
    card_funded: 'Cards',
    recurring_transfer_sent: 'RecurringTransfers',
    recurring_transfer_failed: 'RecurringTransfers',
    recurring_transfer_paused: 'RecurringTransfers',
    transfer_sent: 'History',
    transfer_received: 'History',
    bill_paid: 'History',
    airtime_purchased: 'History',
    transaction_reversed: 'History',
    account_frozen: 'Security',
    account_unfrozen: 'Security',
    fraud_alert: 'Security',
  };
  const destination = destinations[data.type];
  if (!destination) return;
  if (navigationRef.isReady()) navigationRef.navigate(destination);
  else pendingPushData = data;
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AnimatedTabBar {...props} />}
    >
      <Tab.Screen name="DashboardTab" component={DashboardScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Cards" component={CardScreen} options={{ title: 'Cards' }} />
      <Tab.Screen name="QRPay" component={QRPayScreen} options={{ title: 'Scan & Pay' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

function MainStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />

      {/* Money movement */}
      <Stack.Screen name="Transfer" component={TransferScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Bills" component={BillsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Airtime" component={AirtimeScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="Invoice" component={InvoiceScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Business" component={BusinessScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="InvoicesList" component={InvoicesListScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="RecurringTransfers" component={RecurringTransfersScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="CreateRecurringTransfer" component={CreateRecurringTransferScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
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
      <Stack.Screen name="ServiceStatus" component={ServiceStatusScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
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
      <Stack.Screen name="SupportChat" component={SupportChatScreen} options={{ presentation: 'card', animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  const { user } = useWallet();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={user ? 'Login' : 'Signup'}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { loading, onboarded, isAuthenticated } = useWallet();
  const { scheme } = useTheme();

  useEffect(() => {
    const handleResponse = (response) => {
      if (!response) return;
      const requestId = response.notification?.request?.identifier;
      if (requestId && requestId === lastHandledPushId) return;
      lastHandledPushId = requestId || lastHandledPushId;
      const data = response.notification?.request?.content?.data;
      if (!isAuthenticated) {
        pendingPushData = data || null;
        return;
      }
      navigateFromPush(data);
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    Notifications.getLastNotificationResponseAsync()
      .then(handleResponse)
      .catch(() => {});
    return () => subscription.remove();
  }, [isAuthenticated]);

  if (loading) return <SplashScreen />;
  if (!onboarded) return <OnboardingScreen />;

  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={() => {
        if (isAuthenticated && pendingPushData) {
          const data = pendingPushData;
          pendingPushData = null;
          navigateFromPush(data);
        }
      }}
    >
      {isAuthenticated ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
