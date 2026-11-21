import Feather from '@expo/vector-icons/Feather';
import { Redirect, Tabs } from 'expo-router';

import { useAuth } from '../../lib/auth';
import { isProApp } from '../../lib/variant';
import { colors, fonts } from '../../theme';

const TABS = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'bookings', title: 'Bookings', icon: 'calendar' },
  { name: 'offers', title: 'Offers', icon: 'tag' },
  { name: 'account', title: 'Account', icon: 'user' },
];

export default function TabLayout() {
  const { loading } = useAuth();

  // These are the customer screens. The professional app (same code,
  // started with APP_VARIANT=pro) has its own, in src/app/(pro). In the
  // customer app a professional is a customer like anyone else.
  if (isProApp) return <Redirect href="/work" />;
  if (loading) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.box,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        sceneStyle: { backgroundColor: colors.page },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              <Feather name={tab.icon} size={size - 2} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
