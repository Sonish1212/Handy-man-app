import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, MIN_TAP, radius } from '../../theme';

const LABELS = ['Home', 'Work', 'Other'];

// Step 3: a saved address, or a new one. The area comes from the location
// picker, with the house pinned on its map; a landmark is required because
// many Nepali addresses rely on one.
export default function AddressStep({ savedAddresses, signedIn, area, hasPin, value, onChange }) {
  const usingSaved = Boolean(value.addressId);
  const draft = value.newAddress;

  const setDraft = (change) => onChange({ addressId: null, newAddress: { ...draft, ...change } });

  return (
    <View style={styles.wrap}>
      {savedAddresses.length > 0 ? (
        <View style={styles.box}>
          {savedAddresses.map((address, index) => {
            const active = value.addressId === address.id;
            return (
              <Pressable
                key={address.id}
                style={[styles.row, index < savedAddresses.length - 1 && styles.rowBorder]}
                onPress={() => onChange({ addressId: address.id, newAddress: draft })}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{address.label}</Text>
                  <Text style={styles.rowBody}>
                    {[address.area, address.landmark, address.details].filter(Boolean).join(', ')}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable
            style={[styles.row, styles.rowTopBorder]}
            onPress={() => onChange({ addressId: null, newAddress: draft })}
            accessibilityRole="radio"
            accessibilityState={{ checked: !usingSaved }}
          >
            <View style={[styles.radio, !usingSaved && styles.radioActive]}>
              {!usingSaved ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={styles.rowTitle}>Add a new address</Text>
          </Pressable>
        </View>
      ) : null}

      {!usingSaved ? (
        <View style={styles.box}>
          <View style={styles.form}>
            <Text style={styles.label}>Save as</Text>
            <View style={styles.chips}>
              {LABELS.map((label) => {
                const active = draft.label === label;
                return (
                  <Pressable
                    key={label}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setDraft({ label })}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Location on the map</Text>
            <Pressable
              style={[styles.areaRow, !hasPin && styles.areaRowTodo]}
              onPress={() => router.push('/location')}
              accessibilityRole="button"
            >
              <Feather name={hasPin ? 'map-pin' : 'map'} size={16} color={hasPin ? colors.primary : colors.terracotta} />
              <View style={styles.flex}>
                <Text style={styles.areaText}>
                  {area.name}, {area.city}
                </Text>
                <Text style={[styles.pinState, !hasPin && styles.pinTodo]}>
                  {hasPin ? 'House pinned on the map' : 'Pin your house so the professional finds it'}
                </Text>
              </View>
              <Text style={styles.change}>{hasPin ? 'Change' : 'Set pin'}</Text>
            </Pressable>

            <Text style={styles.label}>Landmark *</Text>
            <TextInput
              value={draft.landmark}
              onChangeText={(landmark) => setDraft({ landmark })}
              placeholder="e.g. near Shiva temple, opposite the school"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              maxLength={120}
              accessibilityLabel="Landmark"
            />

            <Text style={styles.label}>House, floor or gate (optional)</Text>
            <TextInput
              value={draft.details}
              onChangeText={(details) => setDraft({ details })}
              placeholder="e.g. 2nd floor, green gate"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              maxLength={120}
              accessibilityLabel="House, floor or gate"
            />
          </View>
        </View>
      ) : null}

      {!signedIn ? (
        <Text style={styles.hint}>You’ll sign in at the last step, and we’ll save this address to your account.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  flex: { flex: 1 },
  box: {
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
    paddingHorizontal: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTopBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  rowBody: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  form: { paddingVertical: 14, gap: 8 },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.text, marginTop: 4 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.sage },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  chipTextActive: { color: colors.primary },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: MIN_TAP + 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.sageLight,
  },
  areaRowTodo: { borderColor: colors.terracotta, backgroundColor: colors.box },
  areaText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  pinState: { fontFamily: fonts.regular, fontSize: 12, color: colors.primary },
  pinTodo: { color: colors.terracotta },
  change: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.page,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
  },
  hint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
});
