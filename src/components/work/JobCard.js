import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatSlot } from '../../lib/bookings';
import { colors, fonts, MIN_NEPALI_SIZE, radius } from '../../theme';
import StatusChip from '../bookings/StatusChip';
import { AsapTag } from './ui';

// One job in a list: status, time, job, area, and one extra line.
export default function JobCard({ stage, isUrgent, slotStart, slotEnd, title, titleNe, area, detail, onPress, children }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={styles.topRow}>
        <View style={styles.chips}>
          {stage ? <StatusChip status={stage} /> : null}
          {isUrgent ? <AsapTag /> : null}
        </View>
        {onPress ? <Feather name="chevron-right" size={20} color={colors.textSecondary} /> : null}
      </View>
      <Text style={styles.slot}>{isUrgent ? 'As soon as possible' : formatSlot(slotStart, slotEnd)}</Text>
      <Text style={styles.title}>{title}</Text>
      {titleNe ? <Text style={styles.titleNe}>{titleNe}</Text> : null}
      <View style={styles.metaRow}>
        <Feather name="map-pin" size={14} color={colors.textSecondary} />
        <Text style={styles.meta}>{area}</Text>
      </View>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
    padding: 14,
    gap: 6,
  },
  pressed: { opacity: 0.8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, flexWrap: 'wrap' },
  slot: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginTop: 2 },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  titleNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE, color: colors.textSecondary, marginTop: -4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
  detail: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
});
