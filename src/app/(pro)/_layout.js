import Feather from '@expo/vector-icons/Feather';
import { Redirect, Tabs } from 'expo-router';

import { isDemoMode, useAuth } from '../../lib/auth';
import { useT } from '../../lib/i18n';
import { isProApp } from '../../lib/variant';
import { colors, fonts } from '../../theme';

// The professional app's main screens. Only an approved professional gets
// here: someone signed out goes to the welcome page, and someone who has
// not been approved yet goes to their application.
const TABS = [
  { name: 'work', title: 'tab.jobs', icon: 'briefcase' },
  { name: 'earnings', title: 'tab.earnings', icon: 'bar-chart-2' },
  { name: 'me', title: 'tab.profile', icon: 'user' },
];

export default function ProTabLayout() {
  const { isSignedIn, profile, loading } = useAuth();
  const { t } = useT();

  if (!isDemoMode) {
    // The customer app has no professional screens.
    if (!isProApp) return <Redirect href="/" />;
    if (loading) return null;
    if (!isSignedIn) return <Redirect href="/pro-welcome" />;
    if (!profile?.professional) return <Redirect href="/apply" />;
  }

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
            title: t(tab.title),
            tabBarIcon: ({ color, size }) => <Feather name={tab.icon} size={size - 2} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
