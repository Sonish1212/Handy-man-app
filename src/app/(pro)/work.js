import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import JobCard from '../../components/work/JobCard';
import { Box, Notice, WorkButton, workStyles } from '../../components/work/ui';
import { isDemoMode, useAuth } from '../../lib/auth';
import { formatRupees } from '../../lib/bookings';
import { useT } from '../../lib/i18n';
import { callRpc, formatAgo, useMyWork, useWorkRole } from '../../lib/work';
import { colors, fonts } from '../../theme';

// The professional's home: new job offers to accept, and their jobs.
export default function WorkScreen() {
  const insets = useSafeAreaInsets();
  const { refreshProfile } = useAuth();
  const { professional } = useWorkRole();
  const { offers, active, loading, error, refresh } = useMyWork();
  const [notice, setNotice] = useState(null);
  const [available, setAvailable] = useState(null);
  const [busy, setBusy] = useState(null);
  const { t } = useT();

  // No push notifications yet, so look for new offers every 30 seconds
  // while this page is open.
  useEffect(() => {
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  if (!professional) return null;

  const isAvailable = available ?? professional.is_available;
  const firstName = professional.full_name.split(' ')[0];
  const open = (id) => router.push({ pathname: '/jobs/[id]', params: { id } });

  const toggle = async (value) => {
    setAvailable(value);
    const result = await callRpc('set_my_availability', { p_available: value });
    if (result.error) {
      setAvailable(!value);
      setNotice({ tone: 'error', text: result.error });
      return;
    }
    refreshProfile();
  };

  const answer = async (offer, accept) => {
    setBusy(`${accept ? 'yes' : 'no'}-${offer.offer_id}`);
    const result = await callRpc('respond_to_offer', { p_offer_id: offer.offer_id, p_accept: accept });
    setBusy(null);
    if (result.error) return setNotice({ tone: 'error', text: result.error });
    await refresh();
    if (result.data === 'assigned') {
      setNotice({ text: t('work.accepted') });
      return open(offer.booking_id);
    }
    return setNotice(
      result.data === 'taken'
        ? { tone: 'error', text: t('work.taken') }
        : { text: t('work.thanks') },
    );
  };

  return (
    <ScrollView
      style={workStyles.screen}
      contentContainerStyle={[workStyles.content, { paddingTop: insets.top + 24 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <View>
        <Text style={styles.title}>{t('work.hello', { name: firstName })}</Text>
      </View>
      {isDemoMode ? <Text style={workStyles.muted}>{t('work.demo')}</Text> : null}
      {error ? <Text style={workStyles.error}>{error}</Text> : null}
      <Notice notice={notice} />

      <Box style={isAvailable ? styles.onBox : null}>
        <View style={styles.availability}>
          <View style={workStyles.flex}>
            <Text style={styles.availabilityTitle}>{isAvailable ? t('work.taking') : t('work.notTaking')}</Text>
            <Text style={workStyles.muted}>
              {isAvailable ? t('work.takingHint') : t('work.notTakingHint')}
            </Text>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={toggle}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel={t('work.taking')}
          />
        </View>
      </Box>

      <Text style={workStyles.sectionTitle}>
        {t('work.offers')}{offers.length ? ` (${offers.length})` : ''}
      </Text>
      {offers.length === 0 ? (
        <Text style={workStyles.empty}>{t('work.noOffers')}</Text>
      ) : (
        <Text style={workStyles.sectionHint}>{t('work.firstWins')}</Text>
      )}
      {offers.map((offer) => (
        <JobCard
          key={offer.offer_id}
          isUrgent={offer.is_urgent}
          slotStart={offer.slot_start}
          slotEnd={offer.slot_end}
          title={offer.task_name ?? offer.service_name}
          titleNe={offer.task_name_ne}
          area={offer.area}
          detail={[
            offer.description ? `“${offer.description}”` : null,
            offer.price != null
              ? t('work.price', { amount: formatRupees(Number(offer.price) + Number(offer.urgent_fee)) })
              : t('work.priceLater'),
            formatAgo(offer.sent_at),
          ]
            .filter(Boolean)
            .join(' · ')}
        >
          <Text style={workStyles.muted}>{t('work.addressAfter')}</Text>
          <View style={workStyles.row}>
            <WorkButton
              label={t('work.decline')}
              tone="secondary"
              busy={busy === `no-${offer.offer_id}`}
              disabled={Boolean(busy)}
              onPress={() => answer(offer, false)}
            />
            <WorkButton
              label={t('work.accept')}
              icon="check"
              busy={busy === `yes-${offer.offer_id}`}
              disabled={Boolean(busy)}
              onPress={() => answer(offer, true)}
            />
          </View>
        </JobCard>
      ))}

      <Text style={workStyles.sectionTitle}>{t('work.myJobs')}</Text>
      {active.length === 0 ? <Text style={workStyles.empty}>{t('work.noJobs')}</Text> : null}
      {active.map((job) => (
        <JobCard
          key={job.booking_id}
          stage={job.status}
          isUrgent={job.is_urgent}
          slotStart={job.slot_start}
          slotEnd={job.slot_end}
          title={job.task_name ?? job.service_name}
          titleNe={job.task_name_ne}
          area={[job.area, job.landmark].filter(Boolean).join(', ')}
          detail={job.customer_name ? t('work.customer', { name: job.customer_name }) : null}
          onPress={() => open(job.booking_id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 34, color: colors.text },
  onBox: { borderColor: colors.primary, backgroundColor: colors.sageLight },
  availability: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  availabilityTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
});
