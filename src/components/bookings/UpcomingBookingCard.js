import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { SUPPORT_PHONE } from '../../data/contact';
import {
  advancePayment,
  bookingStage,
  CANCELLABLE_STATUSES,
  formatAddress,
  formatRupees,
  formatSlot,
  formatTimeUntil,
  jobName,
  paymentSummary,
} from '../../lib/bookings';
import { colors, fonts, MIN_NEPALI_SIZE, MIN_TAP, radius } from '../../theme';
import ProfessionalRow from './ProfessionalRow';
import ProgressSteps from './ProgressSteps';
import StatusChip from './StatusChip';

// Edit and Reschedule are handled by the team by phone until the booking flow
// can change bookings itself.
function askToCallUs(action) {
  const message = SUPPORT_PHONE
    ? `To ${action} this booking, call our team and we will sort it out.`
    : `To ${action} this booking, please contact our team. The support number is coming soon.`;
  const buttons = SUPPORT_PHONE
    ? [{ text: 'Not now', style: 'cancel' }, { text: 'Call us', onPress: () => Linking.openURL(`tel:${SUPPORT_PHONE}`) }]
    : [{ text: 'OK' }];
  Alert.alert(action === 'edit' ? 'Edit booking' : 'Reschedule', message, buttons);
}

export default function UpcomingBookingCard({ booking, onCancel, onDecidePart }) {
  const { paid, balance } = paymentSummary(booking);
  const stage = bookingStage(booking);
  const advance = advancePayment(booking);
  const pendingParts = booking.extra_parts.filter((part) => part.status === 'pending');
  const decidedParts = booking.extra_parts.filter((part) => part.status !== 'pending');
  const canCancel = CANCELLABLE_STATUSES.includes(booking.status);
  const showCode = booking.status !== 'in_progress' && advance.state !== 'unpaid' && advance.state !== 'checking';
  const startsLater = new Date(booking.slot_start) > new Date();

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.chips}>
            <StatusChip status={stage} />
            {booking.is_urgent ? (
              <View style={styles.asapTag}>
                <Feather name="zap" size={12} color={colors.terracotta} />
                <Text style={styles.asapText}>ASAP</Text>
              </View>
            ) : null}
          </View>
          {startsLater && booking.status !== 'in_progress' && !booking.is_urgent ? (
            <Text style={styles.until}>{formatTimeUntil(booking.slot_start)}</Text>
          ) : null}
        </View>

        <Text style={styles.slot}>
          {booking.is_urgent ? 'As soon as possible' : formatSlot(booking.slot_start, booking.slot_end)}
        </Text>
        <Text style={styles.job}>
          {jobName(booking)}
          {booking.description ? <Text style={styles.jobDetail}>, {booking.description}</Text> : null}
        </Text>
        {(booking.task?.name_ne ?? booking.service?.name_ne) ? (
          <Text style={styles.jobNe}>{booking.task?.name_ne ?? booking.service?.name_ne}</Text>
        ) : null}

        {advance.state === 'unpaid' || advance.state === 'checking' ? null : <ProgressSteps booking={booking} />}

        {advance.state === 'unpaid' ? (
          <View style={styles.payBox}>
            <Text style={styles.payText}>
              Pay the {formatRupees(booking.deposit_amount)} advance to confirm. We start finding your professional
              once it’s paid.
            </Text>
            <Pressable
              style={styles.payButton}
              onPress={() => router.push({ pathname: '/pay/[id]', params: { id: booking.id } })}
              accessibilityRole="button"
            >
              <Text style={styles.payButtonText}>Pay advance</Text>
            </Pressable>
          </View>
        ) : null}
        {advance.state === 'checking' ? (
          <Pressable
            style={styles.payBox}
            onPress={() => router.push({ pathname: '/pay/[id]', params: { id: booking.id } })}
            accessibilityRole="button"
          >
            <Text style={styles.payText}>
              We’re checking your advance (ref. {advance.reference}). Tap to correct it if needed.
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.divider} />

        {booking.professional ? (
          <ProfessionalRow professional={booking.professional} serviceName={booking.service?.name ?? ''} />
        ) : advance.state === 'unpaid' || advance.state === 'checking' ? null : (
          <View style={styles.finding}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.findingText}>We are finding a verified professional near you. You’ll see them here.</Text>
          </View>
        )}

        <View style={styles.divider} />

        <InfoRow icon="map-pin" text={formatAddress(booking.address)} />
        <InfoRow
          icon="credit-card"
          text={
            paid > 0
              ? `${formatRupees(paid)} paid, ${formatRupees(balance)} after the job`
              : `Pay ${formatRupees(balance)} after the job`
          }
        />

        {showCode ? (
          <View style={styles.codeBox}>
            <View style={styles.flex}>
              <Text style={styles.codeLabel}>Start code</Text>
              <Text style={styles.codeHint}>Give this to the professional when they arrive.</Text>
            </View>
            <Text style={styles.code} accessibilityLabel={`Start code ${booking.start_code.split('').join(' ')}`}>
              {booking.start_code}
            </Text>
          </View>
        ) : null}

        {decidedParts.map((part) => (
          <InfoRow
            key={part.id}
            icon={part.status === 'approved' ? 'check' : 'x'}
            text={`${part.description}, ${formatRupees(part.amount)} (${part.status})`}
          />
        ))}

        <View style={styles.actions}>
          <ActionButton label="Edit" onPress={() => askToCallUs('edit')} />
          <ActionButton label="Reschedule" onPress={() => askToCallUs('reschedule')} />
          {canCancel ? <ActionButton label="Cancel" tone="danger" onPress={() => onCancel(booking)} /> : null}
        </View>
      </View>

      {pendingParts.map((part) => (
        <ExtraPartCard key={part.id} part={part} onDecide={(approve) => onDecidePart(booking.id, part.id, approve)} />
      ))}
    </View>
  );
}

function ExtraPartCard({ part, onDecide }) {
  const [busy, setBusy] = useState(null);
  const decide = async (approve) => {
    setBusy(approve ? 'approve' : 'decline');
    await onDecide(approve);
    setBusy(null);
  };
  return (
    <View style={styles.partCard}>
      <View style={styles.partHeader}>
        <Feather name="tool" size={18} color="#8A5A12" />
        <Text style={styles.partTitle}>Extra part needed</Text>
      </View>
      <Text style={styles.partBody}>
        {part.description}, <Text style={styles.partAmount}>{formatRupees(part.amount)}</Text>
      </Text>
      <Text style={styles.partHint}>Nothing extra is charged unless you approve it.</Text>
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionButton, styles.approve, busy && styles.dimmed]}
          onPress={() => decide(true)}
          disabled={Boolean(busy)}
          accessibilityRole="button"
        >
          {busy === 'approve' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.approveText}>Approve</Text>}
        </Pressable>
        <Pressable
          style={[styles.actionButton, busy && styles.dimmed]}
          onPress={() => decide(false)}
          disabled={Boolean(busy)}
          accessibilityRole="button"
        >
          {busy === 'decline' ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.actionText}>Decline</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function InfoRow({ icon, text }) {
  if (!text) return null;
  return (
    <View style={styles.infoRow}>
      <Feather name={icon} size={16} color={colors.textSecondary} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

function ActionButton({ label, onPress, tone }) {
  const danger = tone === 'danger';
  return (
    <Pressable
      style={({ pressed }) => [styles.actionButton, danger && styles.dangerButton, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.actionText, danger && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
    padding: 16,
    gap: 10,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  asapTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: '#F8E6DF',
  },
  asapText: { fontFamily: fonts.bold, fontSize: 11, color: colors.terracotta },
  payBox: {
    gap: 10,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: '#FDF0DC',
    borderWidth: 1,
    borderColor: colors.marigold,
  },
  payText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
  payButton: {
    minHeight: MIN_TAP,
    borderRadius: radius.card,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: { fontFamily: fonts.semibold, fontSize: 15, color: '#FFFFFF' },
  until: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  slot: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: 2 },
  job: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  jobDetail: { fontFamily: fonts.regular, color: colors.textSecondary },
  jobNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE, color: colors.textSecondary, marginTop: -6 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  finding: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  findingText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.sageLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  codeHint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary, marginTop: 2 },
  code: { fontFamily: fonts.bold, fontSize: 26, letterSpacing: 4, color: colors.primary },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionButton: {
    flex: 1,
    minHeight: MIN_TAP,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  dangerButton: { borderColor: colors.terracotta },
  dangerText: { color: colors.terracotta },
  pressed: { opacity: 0.7 },
  dimmed: { opacity: 0.6 },
  partCard: {
    backgroundColor: '#FDF0DC',
    borderWidth: 1,
    borderColor: colors.marigold,
    borderRadius: radius.box,
    padding: 16,
    gap: 6,
  },
  partHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  partTitle: { fontFamily: fonts.bold, fontSize: 15, color: '#8A5A12' },
  partBody: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  partAmount: { fontFamily: fonts.semibold },
  partHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  approve: { backgroundColor: colors.primary, borderColor: colors.primary },
  approveText: { fontFamily: fonts.semibold, fontSize: 14, color: '#FFFFFF' },
});
