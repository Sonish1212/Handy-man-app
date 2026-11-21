import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import JobCard from '../../components/work/JobCard';
import PaymentReview, { reviewMessage } from '../../components/work/PaymentReview';
import { Box, ContactButtons, Notice, WorkHeader, workStyles } from '../../components/work/ui';
import { isDemoMode } from '../../lib/auth';
import { formatRupees, formatSlot, jobName } from '../../lib/bookings';
import {
  bookingPhone,
  formatAgo,
  formatPhone,
  methodLabel,
  PAYMENT_KIND_LABELS,
  teamStage,
  URGENT_HOLD_HOURS,
  useTeamQueue,
  useWorkRole,
} from '../../lib/work';
import { colors, fonts, MIN_TAP, radius } from '../../theme';

// The team's queue: payments to check, bookings that need a professional,
// and jobs in progress. Opening a booking shows everything about it.
export default function TeamScreen() {
  const insets = useSafeAreaInsets();
  const { isTeam } = useWorkRole();
  const { payments, toAssign, urgentHold, onHold, offered, waitingAdvance, active, loading, error, refresh } =
    useTeamQueue();
  const [tab, setTab] = useState('assign');
  const [notice, setNotice] = useState(null);

  if (!isTeam) {
    return (
      <View style={[workStyles.screen, workStyles.content, { paddingTop: insets.top + 16 }]}>
        <WorkHeader title="Team" />
        <Text style={workStyles.empty}>This page is only for the team.</Text>
      </View>
    );
  }

  const tabs = [
    { id: 'payments', label: 'Payments', count: payments.length },
    { id: 'assign', label: 'Assign', count: toAssign.length },
    { id: 'active', label: 'Active', count: active.length },
  ];
  const open = (id) => router.push({ pathname: '/team/[id]', params: { id } });

  return (
    <ScrollView
      style={workStyles.screen}
      contentContainerStyle={[workStyles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <WorkHeader title="Team" subtitle="Bookings and payments" />
      {isDemoMode ? <Text style={workStyles.muted}>Demo mode: sample bookings, buttons switched off.</Text> : null}
      {error ? <Text style={workStyles.error}>{error}</Text> : null}
      <Notice notice={notice} />

      <Pressable
        style={({ pressed }) => [styles.applicants, pressed && styles.pressed]}
        onPress={() => router.push('/team/applicants')}
        accessibilityRole="button"
      >
        <View style={workStyles.flex}>
          <Text style={styles.applicantsTitle}>Professional applications</Text>
          <Text style={workStyles.muted}>Check documents and approve people who applied</Text>
        </View>
        <Text style={styles.applicantsArrow}>›</Text>
      </Pressable>

      <View style={styles.segment} accessibilityRole="tablist">
        {tabs.map((option) => {
          const selected = tab === option.id;
          return (
            <Pressable
              key={option.id}
              style={[styles.segmentButton, selected && styles.segmentButtonActive]}
              onPress={() => setTab(option.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{option.label}</Text>
              {option.count ? (
                <View style={[styles.count, option.id !== 'active' && styles.countUrgent]}>
                  <Text style={styles.countText}>{option.count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {tab === 'payments' ? (
        <>
          <Text style={workStyles.sectionHint}>
            Check each one in the eSewa, Khalti, IME Pay or bank statement before confirming.
          </Text>
          {payments.length === 0 ? <Text style={workStyles.empty}>No payments to check.</Text> : null}
          {payments.map((payment) => (
            <PaymentCard
              key={payment.id}
              payment={payment}
              onOpen={() => payment.booking && open(payment.booking.id)}
              onReviewed={(text) => {
                setNotice({ text });
                refresh();
              }}
            />
          ))}
        </>
      ) : null}

      {tab === 'assign' ? (
        <>
          {toAssign.length === 0 ? <Text style={workStyles.empty}>Every paid booking has a professional.</Text> : null}
          <AssignSection
            title="Urgent: call professionals now"
            hint={`Starts within ${URGENT_HOLD_HOURS} hours (or as soon as possible) and nobody has taken it. Open it to call, offer or assign.`}
            bookings={urgentHold}
            onOpen={open}
            urgent
          />
          <AssignSection
            title="On hold: nobody free yet"
            hint="The app offers these automatically as soon as a professional becomes free. You can still offer or assign by hand."
            bookings={onHold}
            onOpen={open}
          />
          <AssignSection
            title="Offered, waiting for an answer"
            hint="Sent to the free professionals in the app. The first to accept gets the job."
            bookings={offered}
            onOpen={open}
          />
          {waitingAdvance.length ? (
            <>
              <Text style={workStyles.sectionTitle}>Waiting for the advance ({waitingAdvance.length})</Text>
              <Text style={workStyles.sectionHint}>
                Booked but not paid yet. A quick call often helps if it has been a while.
              </Text>
              {waitingAdvance.map((booking) => (
                <BookingCard key={booking.id} booking={booking} onPress={() => open(booking.id)} showCustomer />
              ))}
            </>
          ) : null}
        </>
      ) : null}

      {tab === 'active' ? (
        <>
          {active.length === 0 ? <Text style={workStyles.empty}>No jobs in progress.</Text> : null}
          {active.map((booking) => (
            <BookingCard key={booking.id} booking={booking} onPress={() => open(booking.id)} />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

function AssignSection({ title, hint, bookings, onOpen, urgent = false }) {
  if (!bookings.length) return null;
  return (
    <>
      <Text style={[workStyles.sectionTitle, urgent && styles.urgentTitle]}>
        {title} ({bookings.length})
      </Text>
      <Text style={workStyles.sectionHint}>{hint}</Text>
      {bookings.map((booking) => (
        <BookingCard key={booking.id} booking={booking} onPress={() => onOpen(booking.id)} />
      ))}
    </>
  );
}

function BookingCard({ booking, onPress, showCustomer = false }) {
  const detail = booking.professional
    ? `Professional: ${booking.professional.full_name}`
    : showCustomer
      ? `${booking.customer?.full_name || 'Customer'} · booked ${formatAgo(booking.created_at)}`
      : `Booked ${formatAgo(booking.created_at)}`;
  return (
    <JobCard
      stage={teamStage(booking)}
      isUrgent={booking.is_urgent}
      slotStart={booking.slot_start}
      slotEnd={booking.slot_end}
      title={jobName(booking)}
      titleNe={booking.task?.name_ne ?? booking.service?.name_ne}
      area={booking.address?.area}
      detail={detail}
      onPress={onPress}
    />
  );
}

function PaymentCard({ payment, onOpen, onReviewed }) {
  const booking = payment.booking;

  return (
    <Box>
      <Pressable onPress={onOpen} accessibilityRole="button" style={styles.paymentTop}>
        <View style={workStyles.flex}>
          <Text style={styles.amount}>
            {formatRupees(payment.amount)} · {methodLabel(payment.method)}
          </Text>
          <Text style={workStyles.muted}>
            {PAYMENT_KIND_LABELS[payment.kind] ?? payment.kind} · sent {formatAgo(payment.created_at)}
          </Text>
        </View>
        {booking?.is_urgent ? <Text style={styles.asap}>ASAP</Text> : null}
      </Pressable>
      <View style={styles.reference}>
        <Text style={styles.referenceLabel}>Transaction ID</Text>
        <Text style={styles.referenceValue} selectable>
          {payment.provider_reference || '–'}
        </Text>
      </View>
      {booking ? (
        <View style={styles.paymentCustomer}>
          <View style={workStyles.flex}>
            <Text style={workStyles.body}>
              {booking.customer?.full_name || 'Customer'}
              {bookingPhone(booking) ? ` · ${formatPhone(bookingPhone(booking))}` : ''}
            </Text>
            <Text style={workStyles.muted}>
              {booking.task?.name ?? booking.service?.name} ·{' '}
              {booking.is_urgent ? 'As soon as possible' : formatSlot(booking.slot_start, booking.slot_end)}
            </Text>
          </View>
          <ContactButtons phone={bookingPhone(booking)} name={booking.customer?.full_name} />
        </View>
      ) : null}
      <PaymentReview
        payment={payment}
        onReviewed={(confirmed) => onReviewed(reviewMessage(payment, confirmed))}
      />
    </Box>
  );
}

const styles = StyleSheet.create({
  applicants: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.box,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
  },
  applicantsTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primary },
  applicantsArrow: { fontFamily: fonts.regular, fontSize: 26, color: colors.textSecondary },
  pressed: { opacity: 0.7 },
  urgentTitle: { color: colors.terracotta },
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
    flexDirection: 'row',
    gap: 6,
    minHeight: MIN_TAP - 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
  },
  segmentButtonActive: { backgroundColor: colors.box, borderWidth: 1, borderColor: colors.border },
  segmentText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  segmentTextActive: { fontFamily: fonts.semibold, color: colors.primary },
  count: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countUrgent: { backgroundColor: colors.terracotta },
  countText: { fontFamily: fonts.bold, fontSize: 11, color: '#FFFFFF' },
  paymentTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  amount: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  asap: { fontFamily: fonts.bold, fontSize: 12, color: colors.terracotta },
  reference: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: radius.card,
    backgroundColor: colors.sageLight,
  },
  referenceLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  referenceValue: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: 1, color: colors.text },
  paymentCustomer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
