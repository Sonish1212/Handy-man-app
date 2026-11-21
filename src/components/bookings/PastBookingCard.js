import Feather from '@expo/vector-icons/Feather';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatAddress, formatRupees, formatSlot, jobName, paymentSummary } from '../../lib/bookings';
import { colors, fonts, MIN_TAP, radius } from '../../theme';
import ProfessionalRow from './ProfessionalRow';
import StatusChip from './StatusChip';

export default function PastBookingCard({ booking, onRate }) {
  const completed = booking.status === 'completed';
  const { total } = paymentSummary(booking);
  const myRating = booking.ratings.find((rating) => rating.rated_by === 'customer');
  const approvedParts = booking.extra_parts.filter((part) => part.status === 'approved');

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <StatusChip status={booking.status} />
      </View>
      <Text style={styles.job}>
        {jobName(booking)}
        {booking.description ? <Text style={styles.jobDetail}>, {booking.description}</Text> : null}
      </Text>
      <Text style={styles.meta}>
        {formatSlot(booking.slot_start, booking.slot_end)} · {formatAddress(booking.address)}
      </Text>

      {completed ? (
        <>
          {booking.professional ? (
            <ProfessionalRow
              professional={booking.professional}
              serviceName={booking.service?.name ?? ''}
              showCall={false}
            />
          ) : null}

          <View style={styles.receipt}>
            <ReceiptLine label={jobName(booking)} amount={booking.price} />
            {Number(booking.urgent_fee) > 0 ? <ReceiptLine label="As soon as possible" amount={booking.urgent_fee} /> : null}
            {approvedParts.map((part) => (
              <ReceiptLine key={part.id} label={part.description} amount={part.amount} />
            ))}
            <View style={styles.receiptDivider} />
            <ReceiptLine label="Total" amount={total} bold />
          </View>

          {myRating ? (
            <View style={styles.ratedRow}>
              <Stars value={myRating.stars} />
              <Text style={styles.ratedText}>Thanks for rating</Text>
            </View>
          ) : (
            <View style={styles.rateBox}>
              <Text style={styles.rateTitle}>How was the job?</Text>
              <Stars value={0} onPick={(stars) => onRate(booking.id, stars)} />
            </View>
          )}
        </>
      ) : (
        <Text style={styles.cancelNote}>
          Cancelled{booking.cancel_reason ? `: ${booking.cancel_reason}` : ''}. The team will confirm and arrange any refund to your original payment method.
        </Text>
      )}

      <Pressable
        style={({ pressed }) => [styles.again, pressed && styles.pressed]}
        onPress={() => router.navigate('/')}
        accessibilityRole="button"
      >
        <Feather name="rotate-cw" size={16} color={colors.primary} />
        <Text style={styles.againText}>Book again</Text>
      </Pressable>
    </View>
  );
}

function ReceiptLine({ label, amount, bold = false }) {
  return (
    <View style={styles.receiptLine}>
      <Text style={[styles.receiptLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.receiptAmount, bold && styles.bold]}>{formatRupees(amount)}</Text>
    </View>
  );
}

function Stars({ value, onPick }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const star = (
          <FontAwesome
            name={filled ? 'star' : 'star-o'}
            size={onPick ? 28 : 16}
            color={filled ? colors.marigold : colors.textSecondary}
          />
        );
        return onPick ? (
          <Pressable
            key={n}
            onPress={() => onPick(n)}
            style={styles.starButton}
            accessibilityRole="button"
            accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
          >
            {star}
          </Pressable>
        ) : (
          <View key={n}>{star}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
    padding: 16,
    gap: 10,
  },
  topRow: { flexDirection: 'row' },
  job: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  jobDetail: { fontFamily: fonts.regular, color: colors.textSecondary },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: -6 },
  receipt: {
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.sageLight,
    gap: 6,
  },
  receiptLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  receiptLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  receiptAmount: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  receiptDivider: { height: 1, backgroundColor: colors.border },
  bold: { fontFamily: fonts.semibold },
  rateBox: { alignItems: 'center', gap: 4, paddingVertical: 4 },
  rateTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  stars: { flexDirection: 'row', gap: 2 },
  starButton: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  ratedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratedText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  cancelNote: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  again: {
    flexDirection: 'row',
    gap: 8,
    minHeight: MIN_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
  },
  againText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  pressed: { opacity: 0.7 },
});
