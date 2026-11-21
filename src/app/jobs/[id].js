import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import StatusChip from '../../components/bookings/StatusChip';
import JobActions from '../../components/work/JobActions';
import { AsapTag, Box, ContactButtons, InfoLine, Notice, WorkButton, WorkHeader, workStyles } from '../../components/work/ui';
import { billFor, formatRupees, formatSlot } from '../../lib/bookings';
import { useT } from '../../lib/i18n';
import { formatPhone, useMyWork, useWorkRole } from '../../lib/work';
import { colors, fonts, MIN_NEPALI_SIZE } from '../../theme';

// One job for its professional: where to go, who to call, what to collect,
// and the next step.
export default function MyJobScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { professional } = useWorkRole();
  const { t } = useT();
  const { active, done, loading, error, refresh } = useMyWork();
  const [notice, setNotice] = useState(null);
  const job = [...active, ...done].find((item) => item.booking_id === id);

  if (!professional || !job) {
    return (
      <View style={[workStyles.screen, workStyles.content, { paddingTop: insets.top + 16 }]}>
        <WorkHeader title="Job" fallback="/work" />
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={workStyles.empty}>{error ?? t('job.gone')}</Text>
        )}
      </View>
    );
  }

  const parts = job.extra_parts ?? [];
  const { total, due } = billFor({ price: job.price, urgentFee: job.urgent_fee, parts, paid: Number(job.paid) });

  return (
    <ScrollView
      style={workStyles.screen}
      contentContainerStyle={[workStyles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      <WorkHeader title={t('job.title')} fallback="/work" />
      <Notice notice={notice} />

      <Box>
        <View style={styles.chips}>
          <StatusChip status={job.status} />
          {job.is_urgent ? <AsapTag /> : null}
        </View>
        <Text style={styles.slot}>{job.is_urgent ? 'As soon as possible' : formatSlot(job.slot_start, job.slot_end)}</Text>
        <Text style={styles.job}>{job.task_name ?? job.service_name}</Text>
        {job.task_name_ne ? <Text style={styles.jobNe}>{job.task_name_ne}</Text> : null}
        <InfoLine icon="message-circle">{job.description ? `“${job.description}”` : null}</InfoLine>
      </Box>

      {job.status !== 'completed' ? (
        <Box title={t('job.customer')}>
          <View style={styles.personRow}>
            <View style={workStyles.flex}>
              <Text style={styles.person}>{job.customer_name || 'Customer'}</Text>
              <Text style={workStyles.muted}>{formatPhone(job.customer_phone) ?? t('job.askTeam')}</Text>
            </View>
            <ContactButtons phone={job.customer_phone} name={job.customer_name} />
          </View>
          <InfoLine icon="map-pin" strong>
            {[job.area, job.landmark].filter(Boolean).join(', ')}
          </InfoLine>
          <InfoLine icon="home">{job.address_details}</InfoLine>
          {job.latitude != null && job.longitude != null ? (
            <WorkButton label={t('job.maps')} icon="navigation" tone="secondary" onPress={() => openMaps(job)} />
          ) : null}
        </Box>
      ) : null}

      <Box title={t('job.money')}>
        <Line label={t('job.price')} value={job.price == null ? t('job.agreeFirst') : formatRupees(job.price)} />
        {Number(job.urgent_fee) > 0 ? <Line label="As soon as possible" value={formatRupees(job.urgent_fee)} /> : null}
        {parts.map((part) => (
          <Line key={part.id} label={`${part.description} (${part.status})`} value={formatRupees(part.amount)} />
        ))}
        <View style={workStyles.divider} />
        <Line label={t('job.paidOnline')} value={formatRupees(job.paid)} />
        <Line label={t('job.collect')} value={due == null ? t('job.collectLater') : formatRupees(due)} bold />
        {total != null && job.status !== 'completed' ? (
          <Text style={workStyles.muted}>{t('job.collectHint')}</Text>
        ) : null}
      </Box>

      {job.status !== 'completed' ? (
        <Box title={t('job.next')}>
          <JobActions
            job={{
              id: job.booking_id,
              status: job.status,
              price: job.price,
              urgentFee: job.urgent_fee,
              parts,
              paid: Number(job.paid),
              startLocked: job.start_locked,
            }}
            role="pro"
            onChanged={(text) => {
              setNotice({ text });
              refresh();
            }}
          />
        </Box>
      ) : null}
    </ScrollView>
  );
}

// Opens the phone's maps app with directions to the customer's pin.
function openMaps(job) {
  const point = `${job.latitude},${job.longitude}`;
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${point}`
      : `https://www.google.com/maps/dir/?api=1&destination=${point}`;
  Linking.openURL(url).catch(() => Alert.alert('Could not open Maps', `The pin is at ${point}.`));
}

function Line({ label, value, bold = false }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.lineValue, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slot: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  job: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  jobNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE, color: colors.textSecondary, marginTop: -8 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  person: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  lineLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  lineValue: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, textAlign: 'right', flexShrink: 1 },
  bold: { fontFamily: fonts.semibold },
});
