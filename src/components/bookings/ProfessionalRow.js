import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, MIN_TAP, radius } from '../../theme';

// Who is coming: photo (or initial), name, verified label and a call button.
export default function ProfessionalRow({ professional, serviceName, showCall = true }) {
  const [failedPhoto, setFailedPhoto] = useState(null);
  const verified = professional.verification_status === 'verified';
  return (
    <View style={styles.row}>
      {professional.photo_url && failedPhoto !== professional.photo_url ? (
        <Image source={{ uri: professional.photo_url }} style={styles.avatar} onError={() => setFailedPhoto(professional.photo_url)} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.initial}>{professional.full_name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.flex}>
        <Text style={styles.name}>{professional.full_name}</Text>
        <View style={styles.metaRow}>
          {verified ? <Feather name="check-circle" size={13} color={colors.primary} /> : null}
          <Text style={styles.meta}>
            {verified ? 'Verified' : 'Professional'} · {serviceName}
          </Text>
        </View>
      </View>
      {showCall && professional.phone ? (
        <Pressable
          style={styles.call}
          onPress={() => Linking.openURL(`tel:${professional.phone}`).catch(() => Alert.alert('Could not open your phone app', 'Please dial the professional’s number from your phone.'))}
          accessibilityRole="button"
          accessibilityLabel={`Call ${professional.full_name}`}
        >
          <Feather name="phone" size={18} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.bold, fontSize: 18, color: colors.primary },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  call: {
    width: MIN_TAP,
    height: MIN_TAP,
    borderRadius: radius.box,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
