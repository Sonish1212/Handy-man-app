import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, MIN_NEPALI_SIZE, radius, spacing } from '../theme';

// A white boxed homepage section with an English title and Nepali subtitle.
export default function Section({ title, titleNe, children, bleed = false }) {
  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.titleNe}>{titleNe}</Text>
      </View>
      <View style={bleed ? null : styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
    marginHorizontal: spacing.gutter,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  header: { paddingHorizontal: 16, marginBottom: 12 },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  titleNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE + 1, color: colors.textSecondary },
  body: { paddingHorizontal: 16 },
});
