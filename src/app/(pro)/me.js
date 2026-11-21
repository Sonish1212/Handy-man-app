import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box, workStyles } from '../../components/work/ui';
import { SUPPORT_PHONE } from '../../data/contact';
import LanguageSwitch from '../../components/pro/LanguageSwitch';
import { useAuth } from '../../lib/auth';
import { useT } from '../../lib/i18n';
import { formatPhone, useWorkRole } from '../../lib/work';
import { colors, fonts, MIN_NEPALI_SIZE, MIN_TAP, radius } from '../../theme';

// The professional's profile. Name, services and area are set by the team
// when they verify someone, so changes go through the team.
export default function ProProfileScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { professional } = useWorkRole();
  const [failedPhoto, setFailedPhoto] = useState(null);
  const { t } = useT();

  if (!professional) return null;
  const verified = professional.verification_status === 'verified';

  const callTeam = () => {
    if (SUPPORT_PHONE) Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => Alert.alert('Could not open your phone app', `Please dial ${SUPPORT_PHONE}.`));
    else Alert.alert('Call the team', 'The team’s number is coming soon.');
  };

  return (
    <ScrollView style={workStyles.screen} contentContainerStyle={[workStyles.content, { paddingTop: insets.top + 24 }]}>
      <View>
        <Text style={styles.title}>{t('me.title')}</Text>
      </View>

      <Box>
        <View style={styles.headRow}>
          {professional.photo_url && failedPhoto !== professional.photo_url ? (
            <Image source={{ uri: professional.photo_url }} style={styles.avatar} onError={() => setFailedPhoto(professional.photo_url)} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.initial}>{professional.full_name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={workStyles.flex}>
            <Text style={styles.name}>{professional.full_name}</Text>
            <View style={styles.badgeRow}>
              <Feather
                name={verified ? 'check-circle' : 'clock'}
                size={14}
                color={verified ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.badge, verified && styles.badgeOn]}>
                {verified ? t('me.verified') : t('status.review.title')}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.stats}>
          <Stat value={professional.rating ? `★ ${professional.rating}` : '–'} label={t('me.rating')} />
          <Stat value={String(professional.jobs_done ?? 0)} label={t('me.jobsDone')} />
        </View>
      </Box>

      <Box title={t('me.details')}>
        <Line icon="phone" label={t('me.phone')} value={formatPhone(professional.phone)} />
        <Line icon="map-pin" label={t('me.area')} value={professional.area ?? t('apply.anywhere')} />
        <Text style={styles.label}>{t('me.services')}</Text>
        <View style={styles.chips}>
          {(professional.services ?? []).map((service) => (
            <View key={service} style={styles.chip}>
              <Text style={styles.chipText}>{service}</Text>
            </View>
          ))}
          {(professional.services ?? []).length === 0 ? <Text style={workStyles.muted}>None yet</Text> : null}
        </View>
        <Text style={workStyles.muted}>{t('me.change')}</Text>
      </Box>

      <Box title={t('me.language')}>
        <LanguageSwitch />
      </Box>

      <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={callTeam} accessibilityRole="button">
        <Feather name="headphones" size={20} color={colors.primary} />
        <Text style={styles.rowLabel}>{t('me.callTeam')}</Text>
        <Feather name="chevron-right" size={20} color={colors.textSecondary} />
      </Pressable>

      <Pressable style={styles.signOut} onPress={signOut} accessibilityRole="button">
        <Feather name="log-out" size={18} color={colors.terracotta} />
        <Text style={styles.signOutText}>{t('me.signOut')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={workStyles.muted}>{label}</Text>
    </View>
  );
}

function Line({ icon, label, value }) {
  return (
    <View style={styles.line}>
      <Feather name={icon} size={16} color={colors.textSecondary} />
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  titleNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE + 2, color: colors.textSecondary },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: { backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.bold, fontSize: 22, color: colors.primary },
  name: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  badge: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  badgeOn: { color: colors.primary },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 12, borderRadius: radius.card, backgroundColor: colors.sageLight, gap: 2 },
  statValue: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, width: 52 },
  lineValue: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.sage },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: MIN_TAP + 12,
    paddingHorizontal: 16,
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
  },
  rowLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  pressed: { opacity: 0.7 },
  signOut: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TAP + 4,
    borderRadius: radius.box,
    borderWidth: 1,
    borderColor: colors.terracotta,
    marginTop: 8,
  },
  signOutText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.terracotta },
});
