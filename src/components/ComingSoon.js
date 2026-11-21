import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, MIN_NEPALI_SIZE } from '../theme';

// Placeholder for tabs that are not designed yet.
export default function ComingSoon({ title, titleNe, icon }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.titleNe}>{titleNe}</Text>
      <View style={styles.box}>
        <Feather name={icon} size={28} color={colors.primary} />
        <Text style={styles.body}>This page is still being designed.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.page, paddingHorizontal: 16 },
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  titleNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE + 2, color: colors.textSecondary },
  box: {
    marginTop: 24,
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  body: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary },
});
