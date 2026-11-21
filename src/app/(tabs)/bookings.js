import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PhotoSlot from '../../components/PhotoSlot';
import CancelSheet from '../../components/bookings/CancelSheet';
import PastBookingCard from '../../components/bookings/PastBookingCard';
import UpcomingBookingCard from '../../components/bookings/UpcomingBookingCard';
import { servicePhotos } from '../../data/photos';
import { isDemoMode, useAuth } from '../../lib/auth';
import { useBookings } from '../../lib/bookings';
import { colors, fonts, MIN_NEPALI_SIZE, MIN_TAP, radius, spacing } from '../../theme';

const POPULAR = [
  { id: 'plumber', name: 'Plumber', nameNe: 'प्लम्बर', icon: 'droplet' },
  { id: 'electrician', name: 'Electrician', nameNe: 'इलेक्ट्रिसियन', icon: 'zap' },
];

// Design pack, section 7: Upcoming and Past tabs, the booking card with the
// start code and extra-part approval, a cancel sheet, and an empty state.
export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { upcoming, past, loading, error, refresh, cancelBooking, decideExtraPart, rateBooking } = useBookings();
  const [tab, setTab] = useState('upcoming');
  const [cancelling, setCancelling] = useState(null);
  const [notice, setNotice] = useState(null);

  const showNotice = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleDecide = async (bookingId, partId, approve) => {
    const result = await decideExtraPart(bookingId, partId, approve);
    if (result.error) showNotice(result.error);
  };

  const handleRate = async (bookingId, stars) => {
    const result = await rateBooking(bookingId, stars);
    if (result.error) showNotice(result.error);
  };

  const list = tab === 'upcoming' ? upcoming : past;
  const signedOut = !isSignedIn && !isDemoMode;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
        refreshControl={
          signedOut ? undefined : <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.titleNe}>बुकिङ</Text>

        {signedOut ? (
          <SignedOut />
        ) : (
          <>
            <View style={styles.segment} accessibilityRole="tablist">
              {[
                { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
                { id: 'past', label: 'Past', count: past.length },
              ].map((option) => {
                const active = tab === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.segmentButton, active && styles.segmentButtonActive]}
                    onPress={() => setTab(option.id)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {option.label}
                      {option.count ? ` (${option.count})` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {isDemoMode ? (
              <Text style={styles.demo}>Demo mode: these are sample bookings.</Text>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.error}>{notice}</Text> : null}

            {list.length === 0 ? (
              <EmptyState tab={tab} />
            ) : (
              <View style={styles.list}>
                {list.map((booking) =>
                  tab === 'upcoming' ? (
                    <UpcomingBookingCard
                      key={booking.id}
                      booking={booking}
                      onCancel={setCancelling}
                      onDecidePart={handleDecide}
                    />
                  ) : (
                    <PastBookingCard key={booking.id} booking={booking} onRate={handleRate} />
                  ),
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <CancelSheet key={cancelling?.id ?? 'closed'} booking={cancelling} onClose={() => setCancelling(null)} onConfirm={cancelBooking} />
    </View>
  );
}

function SignedOut() {
  return (
    <View style={[styles.box, styles.center]}>
      <View style={styles.badge}>
        <Feather name="calendar" size={26} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>See your bookings here</Text>
      <Text style={styles.emptyBody}>Sign in to track upcoming jobs, approve parts and see your receipts.</Text>
      <Pressable style={styles.primary} onPress={() => router.push('/login')} accessibilityRole="button">
        <Text style={styles.primaryText}>Sign in or sign up</Text>
      </Pressable>
    </View>
  );
}

function EmptyState({ tab }) {
  return (
    <View style={styles.box}>
      <View style={styles.center}>
        <View style={styles.emptyArt}>
          <Feather name="home" size={40} color={colors.primary} />
          <Feather name="feather" size={22} color={colors.primary} style={styles.emptyLeaf} />
        </View>
        <Text style={styles.emptyTitle}>{tab === 'upcoming' ? 'No bookings yet' : 'No past bookings'}</Text>
        <Text style={styles.emptyTitleNe}>अहिलेसम्म कुनै बुकिङ छैन</Text>
        <Pressable style={styles.primary} onPress={() => router.navigate('/')} accessibilityRole="button">
          <Text style={styles.primaryText}>Book a service</Text>
        </Pressable>
      </View>

      <Text style={styles.popularTitle}>Popular right now</Text>
      <View style={styles.popularRow}>
        {POPULAR.map((service) => (
          <Pressable
            key={service.id}
            style={styles.popularCard}
            onPress={() => router.navigate('/')}
            accessibilityRole="button"
          >
            <PhotoSlot image={servicePhotos[service.id]} icon={service.icon} style={styles.popularPhoto} />
            <View style={styles.popularLabel}>
              <Text style={styles.popularName}>{service.name}</Text>
              <Text style={styles.popularNameNe}>{service.nameNe}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: spacing.gutter, paddingBottom: 32, gap: spacing.boxGap },
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  titleNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE + 2, color: colors.textSecondary, marginTop: -10 },

  segment: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    backgroundColor: colors.sageLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
  },
  segmentButton: {
    flex: 1,
    minHeight: MIN_TAP - 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
  },
  segmentButtonActive: { backgroundColor: colors.box, borderWidth: 1, borderColor: colors.border },
  segmentText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
  segmentTextActive: { fontFamily: fonts.semibold, color: colors.primary },

  demo: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  error: { fontFamily: fonts.regular, fontSize: 14, color: colors.terracotta },
  list: { gap: 16 },

  box: {
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
    padding: 20,
  },
  center: { alignItems: 'center' },
  badge: {
    width: 52,
    height: 52,
    borderRadius: radius.box,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyArt: {
    width: '100%',
    height: 120,
    borderRadius: radius.box,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyLeaf: { position: 'absolute', right: 24, top: 18, opacity: 0.5 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, textAlign: 'center' },
  emptyTitleNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE + 1, color: colors.textSecondary, marginTop: 2 },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  primary: {
    alignSelf: 'stretch',
    minHeight: 52,
    marginTop: 18,
    borderRadius: radius.box,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: fonts.semibold, fontSize: 16, color: '#FFFFFF' },

  popularTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, marginTop: 22, marginBottom: 10 },
  popularRow: { flexDirection: 'row', gap: 12 },
  popularCard: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.box,
  },
  popularPhoto: { height: 90 },
  popularLabel: { padding: 10 },
  popularName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  popularNameNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE, color: colors.textSecondary },
});
