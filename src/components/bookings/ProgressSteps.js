import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';

import { formatMoment } from '../../lib/nepalTime';
import { colors, fonts } from '../../theme';

const STEPS = [
  { status: 'requested', label: 'Booked' },
  { status: 'assigned', label: 'Assigned', at: 'assigned_at', note: 'Professional assigned' },
  { status: 'on_the_way', label: 'On the way', at: 'on_the_way_at', note: 'Set off' },
  { status: 'in_progress', label: 'Started', at: 'started_at', note: 'Work started' },
  { status: 'completed', label: 'Done' },
];

// Where the job is now, as five steps the customer can read at a glance.
export default function ProgressSteps({ booking }) {
  const current = STEPS.findIndex((step) => step.status === booking.status);
  if (current < 0) return null;
  const step = STEPS[current];
  const since = step.at && booking[step.at] ? `${step.note}: ${formatMoment(booking[step.at])}` : null;

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={`Progress: step ${current + 1} of ${STEPS.length}, ${step.label}`}
    >
      <View style={styles.row}>
        {STEPS.map((item, index) => {
          const reached = index <= current;
          return (
            <View key={item.status} style={styles.step}>
              <View style={styles.track}>
                <View style={[styles.line, index === 0 && styles.hidden, reached && styles.lineOn]} />
                <View style={[styles.dot, reached && styles.dotOn, index === current && styles.dotCurrent]}>
                  {index < current ? <Feather name="check" size={10} color="#FFFFFF" /> : null}
                </View>
                <View
                  style={[styles.line, index === STEPS.length - 1 && styles.hidden, index < current && styles.lineOn]}
                />
              </View>
              <Text style={[styles.label, reached && styles.labelOn]} numberOfLines={2}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
      {since ? <Text style={styles.since}>{since}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  track: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  line: { flex: 1, height: 2, backgroundColor: colors.border },
  lineOn: { backgroundColor: colors.primary },
  hidden: { opacity: 0 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.box,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  dotCurrent: { width: 18, height: 18, borderRadius: 9, borderWidth: 4, backgroundColor: colors.box },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 15, textAlign: 'center', color: colors.textSecondary },
  labelOn: { color: colors.text },
  since: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
});
