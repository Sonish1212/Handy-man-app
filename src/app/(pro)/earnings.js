import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box, workStyles } from '../../components/work/ui';
import { formatRupees } from '../../lib/bookings';
import { useT } from '../../lib/i18n';
import { formatMoment } from '../../lib/nepalTime';
import { useEarnings } from '../../lib/pro';
import { methodLabel } from '../../lib/work';
import { colors, fonts, radius } from '../../theme';

// What the professional earned and where the money is: per job, what the
// customer paid, the company's share and what they keep; and on top, who
// owes whom after the cash they collected themselves.
export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useT();
  const { earnings, loading, error, refresh } = useEarnings();

  const balance = Number(earnings?.balance ?? 0);
  const jobs = earnings?.jobs ?? [];
  const settlements = earnings?.settlements ?? [];
  const balanceTitle = balance > 0 ? t('earn.owedToYou') : balance < 0 ? t('earn.youOwe') : t('earn.settled');

  return (
    <ScrollView
      style={workStyles.screen}
      contentContainerStyle={[workStyles.content, { paddingTop: insets.top + 24 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>{t('earn.title')}</Text>
      {error ? <Text style={workStyles.error}>{error}</Text> : null}

      <View style={[styles.balance, balance < 0 && styles.balanceOwe]}>
        <Text style={styles.balanceLabel}>{balanceTitle}</Text>
        <Text style={[styles.balanceAmount, balance < 0 && styles.balanceAmountOwe]}>{formatRupees(Math.abs(balance))}</Text>
        <Text style={styles.balanceHint}>{t('earn.balanceHint')}</Text>
      </View>
      {earnings ? (
        <Text style={workStyles.muted}>{t('earn.share', { percent: Number(earnings.commission_percent) })}</Text>
      ) : null}

      <Text style={workStyles.sectionTitle}>{t('earn.jobs')}</Text>
      {jobs.length === 0 ? <Text style={workStyles.empty}>{t('earn.none')}</Text> : null}
      {jobs.map((job) => (
        <Box key={job.booking_id}>
          <View>
            <Text style={styles.jobTitle}>{lang === 'ne' && job.title_ne ? job.title_ne : job.title}</Text>
            <Text style={workStyles.muted}>{formatMoment(job.completed_at)}</Text>
          </View>
          <Row label={t('earn.billed')} value={formatRupees(job.billed)} />
          <Row label={t('earn.commission')} value={`− ${formatRupees(job.commission)}`} />
          <View style={workStyles.divider} />
          <Row label={t('earn.net')} value={formatRupees(job.net)} bold />
          <Row label={t('earn.cash')} value={formatRupees(job.cash_collected)} muted />
        </Box>
      ))}

      {settlements.length ? (
        <>
          <Text style={workStyles.sectionTitle}>{t('earn.settlements')}</Text>
          <Box>
            {settlements.map((item) => (
              <Row
                key={item.id}
                label={`${Number(item.amount) > 0 ? t('earn.paidToYou') : t('earn.paidByYou')} · ${methodLabel(item.method)} · ${formatMoment(item.created_at)}`}
                value={formatRupees(Math.abs(Number(item.amount)))}
              />
            ))}
          </Box>
        </>
      ) : null}
    </ScrollView>
  );
}

function Row({ label, value, bold = false, muted = false }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold, muted && styles.mutedText]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold, muted && styles.mutedText]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 34, color: colors.text },
  balance: {
    gap: 4,
    padding: 18,
    borderRadius: radius.box,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.sage,
  },
  balanceOwe: { borderColor: colors.marigold, backgroundColor: '#FDF0DC' },
  balanceLabel: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 23, color: colors.text },
  balanceAmount: { fontFamily: fonts.bold, fontSize: 32, color: colors.primary },
  balanceAmountOwe: { color: '#8A5A12' },
  balanceHint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  jobTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 23, color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.text },
  rowValue: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  bold: { fontFamily: fonts.semibold },
  mutedText: { color: colors.textSecondary },
});
