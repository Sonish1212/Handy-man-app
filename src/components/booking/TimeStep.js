import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatRupees } from '../../lib/bookings';
import { asapOpenNow, buildSlotDays, formatRange, shortDayParts } from '../../lib/nepalTime';
import { colors, fonts, MIN_TAP, radius } from '../../theme';

// Step 2: "As soon as possible" (+ fee) or a 2-hour slot in the next week.
// All times are Nepal time.
export default function TimeStep({ settings, bookedCounts, asapAvailable, areaName, value, onChange }) {
  const days = useMemo(() => buildSlotDays(settings, bookedCounts), [settings, bookedCounts]);
  const initialDay = value.mode === 'slot' && value.slotStart
    ? Math.max(0, days.findIndex((day) => day.slots.some((slot) => slot.start === value.slotStart)))
    : 0;
  const [dayIndex, setDayIndex] = useState(initialDay);
  const day = days[Math.min(dayIndex, days.length - 1)];

  const asapOpen = asapOpenNow(settings);
  const asapEnabled = asapOpen && asapAvailable;
  const asapReason = !asapOpen
    ? `Available ${hourText(settings.day_start_hour)}–${hourText(settings.day_end_hour - settings.asap_promise_hours)}, Nepal time`
    : !asapAvailable
      ? `No professional is free right now in ${areaName}`
      : null;
  const asapActive = value.mode === 'asap';

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.asap, asapActive && styles.asapActive, !asapEnabled && styles.disabled]}
        disabled={!asapEnabled}
        onPress={() => onChange({ mode: 'asap', slotStart: null, slotEnd: null })}
        accessibilityRole="radio"
        accessibilityState={{ checked: asapActive, disabled: !asapEnabled }}
      >
        <View style={[styles.asapIcon, asapActive && styles.asapIconActive]}>
          <Feather name="zap" size={20} color={asapActive ? '#FFFFFF' : colors.terracotta} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.asapTitle}>
            As soon as possible <Text style={styles.asapFee}>+{formatRupees(settings.asap_fee)}</Text>
          </Text>
          <Text style={styles.asapBody}>
            {asapReason ??
              `We offer the job to available professionals nearby after your advance is confirmed. We aim to arrange help within ${settings.asap_promise_hours} hours. Contact the team if nobody is assigned.`}
          </Text>
        </View>
        {asapActive ? <Feather name="check-circle" size={22} color={colors.terracotta} /> : null}
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or pick a time</Text>
        <View style={styles.dividerLine} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {days.map((item, index) => {
          const active = index === dayIndex;
          const parts = shortDayParts(item.date);
          const anyFree = item.slots.some((slot) => slot.available);
          return (
            <Pressable
              key={item.date}
              style={[styles.day, active && styles.dayActive, !anyFree && styles.disabled]}
              onPress={() => setDayIndex(index)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.dayTop, active && styles.dayTextActive]}>{parts.top}</Text>
              <Text style={[styles.dayBottom, active && styles.dayTextActive]}>{parts.bottom}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.slots}>
        {day?.slots.map((slot) => {
          const active = value.mode === 'slot' && value.slotStart === slot.start;
          return (
            <Pressable
              key={slot.start}
              style={[styles.slot, active && styles.slotActive, !slot.available && styles.slotDisabled]}
              disabled={!slot.available}
              onPress={() => onChange({ mode: 'slot', slotStart: slot.start, slotEnd: slot.end })}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, disabled: !slot.available }}
            >
              <Text style={[styles.slotText, active && styles.slotTextActive, !slot.available && styles.slotTextDisabled]}>
                {formatRange(slot.start, slot.end)}
              </Text>
              {slot.full ? <Text style={styles.slotNote}>Full</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        Times are the arrival window in Nepal time. Book at least {settings.min_notice_hours} hours ahead, or choose As soon
        as possible.
      </Text>
    </View>
  );
}

function hourText(hour) {
  const h12 = hour % 12 || 12;
  return `${h12} ${hour < 12 ? 'am' : 'pm'}`;
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  flex: { flex: 1 },
  disabled: { opacity: 0.5 },
  asap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.box,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
  },
  asapActive: { borderColor: colors.terracotta, borderWidth: 2, backgroundColor: '#FBF1EC' },
  asapIcon: {
    width: MIN_TAP,
    height: MIN_TAP,
    borderRadius: radius.box,
    backgroundColor: '#F8E6DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  asapIconActive: { backgroundColor: colors.terracotta },
  asapTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  asapFee: { fontFamily: fonts.semibold, color: colors.terracotta },
  asapBody: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 2 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  days: { gap: 8 },
  day: {
    width: 64,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
  },
  dayActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayTop: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  dayBottom: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  dayTextActive: { color: '#FFFFFF' },
  slots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  slot: {
    width: '48.5%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
  },
  slotActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.sage },
  slotDisabled: { backgroundColor: colors.page },
  slotText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  slotTextActive: { color: colors.primary },
  slotTextDisabled: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  slotNote: { fontFamily: fonts.regular, fontSize: 11, color: colors.terracotta },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
});
