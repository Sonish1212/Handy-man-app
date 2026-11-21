import { StyleSheet, Text, View } from 'react-native';

import { STATUS_LABELS } from '../../lib/bookings';
import { colors, fonts, radius } from '../../theme';

const TONES = {
  waiting: { background: '#FDF0DC', text: '#8A5A12' },
  good: { background: '#E3EFE3', text: colors.primary },
  done: { background: '#EEF1EC', text: colors.textSecondary },
  cancelled: { background: '#F8E6DF', text: colors.terracotta },
  alert: { background: '#F8E6DF', text: colors.terracotta },
};

// `status` is a booking stage from bookingStage() (or a plain status).
export default function StatusChip({ status }) {
  const { label, tone } = STATUS_LABELS[status] ?? { label: status, tone: 'done' };
  const palette = TONES[tone];
  return (
    <View style={[styles.chip, { backgroundColor: palette.background }]}>
      <View style={[styles.dot, { backgroundColor: palette.text }]} />
      <Text style={[styles.text, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontFamily: fonts.semibold, fontSize: 12 },
});
