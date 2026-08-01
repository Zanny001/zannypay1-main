import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';
import { duration, easing, haptic, spring, useReduceMotion } from '../theme/motion';

// A custom bottom tab bar with real micro-interactions:
//  - the active pill glides between tabs on a spring
//  - the selected icon lifts, scales and swaps to its filled variant
//  - the label fades/slides in only for the active tab (keeps it calm)
//  - selection haptic on every switch
//
// Navigation state and routes are untouched — this is a pure `tabBar`
// renderer handed to React Navigation.
const ICONS = {
  DashboardTab: ['home-outline', 'home'],
  Savings: ['trending-up-outline', 'trending-up'],
  Loans: ['cash-outline', 'cash'],
  Rewards: ['gift-outline', 'gift'],
  Profile: ['person-outline', 'person'],
};

export default function AnimatedTabBar({ state, descriptors, navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const [barWidth, setBarWidth] = React.useState(0);
  const indicator = useRef(new Animated.Value(state.index)).current;
  const tabCount = state.routes.length;

  useEffect(() => {
    if (reduceMotion) {
      indicator.setValue(state.index);
      return;
    }
    Animated.spring(indicator, { ...spring.bouncy, toValue: state.index }).start();
  }, [state.index, indicator, reduceMotion]);

  const tabWidth = barWidth / tabCount || 0;
  const pillWidth = Math.max(tabWidth - 22, 44);
  const translateX = indicator.interpolate({
    inputRange: state.routes.map((_, i) => i),
    outputRange: state.routes.map((_, i) => i * tabWidth + (tabWidth - pillWidth) / 2),
  });

  return (
    <View
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      style={[
        styles.bar,
        {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {barWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            {
              width: pillWidth,
              backgroundColor: `${theme.primary}1F`,
              transform: [{ translateX }],
            },
          ]}
        />
      )}

      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const [outline, filled] = ICONS[route.name] || ['ellipse-outline', 'ellipse'];

        const onPress = () => {
          haptic.select();
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TabItem
            key={route.key}
            focused={focused}
            label={label}
            icon={focused ? filled : outline}
            color={focused ? theme.primary : theme.textMuted}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            reduceMotion={reduceMotion}
          />
        );
      })}
    </View>
  );
}

function TabItem({ focused, label, icon, color, onPress, onLongPress, reduceMotion }) {
  const active = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      active.setValue(focused ? 1 : 0);
      return;
    }
    Animated.spring(active, { ...spring.bouncy, toValue: focused ? 1 : 0 }).start();
  }, [focused, active, reduceMotion]);

  const iconScale = active.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const lift = active.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const labelOpacity = active.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() =>
        Animated.spring(pressScale, { ...spring.press, toValue: reduceMotion ? 1 : 0.9 }).start()
      }
      onPressOut={() => Animated.spring(pressScale, { ...spring.press, toValue: 1 }).start()}
      style={styles.item}
    >
      <Animated.View
        style={{ alignItems: 'center', transform: [{ scale: Animated.multiply(iconScale, pressScale) }, { translateY: lift }] }}
      >
        <Ionicons name={icon} size={23} color={color} />
        <Animated.Text
          numberOfLines={1}
          style={[styles.label, { color, opacity: labelOpacity, fontFamily: focused ? fonts.bold : fonts.medium }]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  pill: { position: 'absolute', top: 4, height: 44, borderRadius: 22 },
  label: { fontSize: 10.5, marginTop: 4, fontWeight: '700' },
});
