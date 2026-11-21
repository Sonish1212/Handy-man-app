import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../lib/i18n';
import { colors, fonts, MIN_TAP, radius } from '../../theme';

const OPTIONS = [
  { id: 'ne', label: 'नेपाली' },
  { id: 'en', label: 'English' },
];

// Nepali or English, changed with one tap and remembered on the phone.
export default function LanguageSwitch() {
  const { lang, setLang } = useT();
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {OPTIONS.map((option) => {
        const active = option.id === lang;
        return (
          <Pressable
            key={option.id}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => setLang(option.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
          >
            <Text style={[styles.text, active && styles.textActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 3,
    gap: 3,
    borderRadius: radius.box,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.sageLight,
  },
  option: { minHeight: MIN_TAP - 6, paddingHorizontal: 16, borderRadius: radius.card, justifyContent: 'center' },
  optionActive: { backgroundColor: colors.box, borderWidth: 1, borderColor: colors.border },
  text: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  textActive: { fontFamily: fonts.semibold, color: colors.primary },
});
