import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, radius } from '../theme';

// Six boxes for the SMS code, backed by one invisible input so paste and
// SMS autofill (iOS and Android) fill every box at once.
export default function CodeInput({ value, onChange, length = 6, hasError = false, autoFocus = true }) {
  const inputRef = useRef(null);
  const digits = value.split('');

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel={length === 4 ? 'Start code' : 'Verification code'}>
      <View style={styles.row}>
        {Array.from({ length }, (_, index) => {
          const isCurrent = index === Math.min(value.length, length - 1);
          return (
            <View
              key={index}
              style={[styles.box, isCurrent && styles.boxActive, hasError && styles.boxError]}
            >
              <Text style={styles.digit}>{digits[index] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        accessibilityLabel={length === 4 ? 'Start code' : 'Verification code'}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: {
    flex: 1,
    maxWidth: 52,
    height: 56,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.primary, borderWidth: 2 },
  boxError: { borderColor: colors.terracotta },
  digit: { fontFamily: fonts.semibold, fontSize: 22, color: colors.text },
  hiddenInput: { ...StyleSheet.absoluteFillObject, opacity: 0.01, color: 'transparent' },
});
