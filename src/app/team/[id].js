import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProfessionalRow from '../../components/bookings/ProfessionalRow';
import StatusChip from '../../components/bookings/StatusChip';
import JobActions, { ReasonForm } from '../../components/work/JobActions';
import PaymentReview, { reviewMessage } from '../../components/work/PaymentReview';
import { AsapTag, Box, ContactButtons, InfoLine, Notice, WorkButton, WorkHeader, workStyles } from '../../components/work/ui';
import { formatRupees, formatSlot, jobName, paidSoFar, paymentSummary, STATUS_LABELS } from '../../lib/bookings';
import { formatMoment } from '../../lib/nepalTime';
import {
  advanceSettled,
  bookingPhone,
  callRpc,
  formatAgo,
  formatPhone,
  methodLabel,
  PAYMENT_KIND_LABELS,
  teamStage,
  useTeamBooking,
  useWorkRole,
} from '../../lib/work';
import { colors, fonts, MIN_NEPALI_SIZE, radius } from '../../theme';

const HISTORY_LABELS = {
  requested: 'Waiting for a professional',
  assigned: 'Professional assigned',
  on_the_way: 'Professional on the way',
  in_progress: 'Job started (start code checked)',
  completed: 'Job done',
  cancelled: 'Cancelled',
};

const OFFER_LABELS = {
  no_reply: 'No reply yet',
  accepted: 'Accepted',
  declined: 'Said no',
  withdrawn: 'Closed',
};

// Everything about one booking for the team: customer, money, who is doing
// it, and the buttons for the next step.
export default function TeamBookingScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { isTeam } = useWorkRole();
  const { booking, events, candidates, loading, error, refresh } = useTeamBooking(id);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [mode, setMode] = useState(null);

  const done = (text) => {
    setNotice({ text });
    setMode(null);
    refresh();
  };

  // Runs one database action; `key` marks which button shows the spinner.
  const act = async (key, name, args, message) => {
    setBusy(key);
    const result = await callRpc(name, args);
    setBusy(null);
    if (result.error) {
      setNotice({ tone: 'error', text: result.error });
      return null;
    }
    done(typeof message === 'function' ? message(result.data) : message);
    return result.data;
  };

  if (!isTeam || !booking) {
    return (
      <View style={[workStyles.screen, workStyles.content, { paddingTop: insets.top + 16 }]}>
        <WorkHeader title="Booking" fallback="/team" />
        {!isTeam ? (
          <Text style={workStyles.empty}>This page is only for the team.</Text>
        ) : loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={workStyles.empty}>{error ?? 'Booking not found.'}</Text>
        )}
      </View>
    );
  }

  const settled = advanceSettled(booking);
  const { total, paid, balance } = paymentSummary(booking);
  const openOffers = (booking.job_offers ?? []).filter((offer) => offer.response === 'no_reply');
  // "Offer to all" skips anyone busy, already asked, or who already said no.
  const freeCandidates = candidates.filter(
    (candidate) => !candidate.busy && !['no_reply', 'declined'].includes(candidate.offer_response),
  );
  const when = booking.is_urgent ? 'as soon as possible' : formatSlot(booking.slot_start, booking.slot_end);
  const place = [booking.address?.area, booking.address?.landmark].filter(Boolean).join(', ');
  const canCancel = ['requested', 'assigned', 'on_the_way'].includes(booking.status);
  const choosing = (booking.status === 'requested' && settled) || booking.status === 'assigned';

  // Texts the team sends from their own phone (no SMS service yet).
  const offerText = `New job: ${jobName(booking)} in ${booking.address?.area}, ${when}. Reply YES if you can take it.`;
  const jobText = [
    `Job confirmed: ${jobName(booking)}, ${when}.`,
    `Address: ${[place, booking.address?.details].filter(Boolean).join(', ')}.`,
    `Customer: ${booking.customer?.full_name || 'Customer'} ${bookingPhone(booking) ?? ''}.`.trim(),
    booking.description ? `Problem: ${booking.description}.` : null,
    'Ask the customer for the start code when you arrive.',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <ScrollView
      style={workStyles.screen}
      contentContainerStyle={[workStyles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      <WorkHeader title="Booking" subtitle={`Ref. ${booking.id.slice(0, 8).toUpperCase()} · booked ${formatAgo(booking.created_at)}`} fallback="/team" />
      <Notice notice={notice} />

      <Box>
        <View style={styles.chips}>
          <StatusChip status={teamStage(booking)} />
          {booking.is_urgent ? <AsapTag /> : null}
        </View>
        <Text style={styles.slot}>{booking.is_urgent ? 'As soon as possible' : formatSlot(booking.slot_start, booking.slot_end)}</Text>
        <Text style={styles.job}>{jobName(booking)}</Text>
        {booking.task?.name_ne ?? booking.service?.name_ne ? (
          <Text style={styles.jobNe}>{booking.task?.name_ne ?? booking.service?.name_ne}</Text>
        ) : null}
        <InfoLine icon="message-circle">{booking.description ? `“${booking.description}”` : null}</InfoLine>
        {booking.status === 'cancelled' ? (
          <InfoLine icon="x-circle">{`Cancelled${booking.cancel_reason ? `: ${booking.cancel_reason}` : ''}`}</InfoLine>
        ) : null}
      </Box>

      <Box title="Customer">
        <View style={styles.personRow}>
          <View style={workStyles.flex}>
            <Text style={styles.person}>{booking.customer?.full_name || 'No name given'}</Text>
            <Text style={workStyles.muted}>
              {formatPhone(bookingPhone(booking)) ?? booking.customer?.email ?? 'No contact saved'}
            </Text>
          </View>
          <ContactButtons phone={bookingPhone(booking)} name={booking.customer?.full_name} />
        </View>
        <InfoLine icon="map-pin">{place}</InfoLine>
        <InfoLine icon="home">{booking.address?.details}</InfoLine>
      </Box>

      <Box title="Money">
        <MoneyLine label={jobName(booking)} amount={booking.price} empty="Price agreed at the visit" />
        {Number(booking.urgent_fee) > 0 ? <MoneyLine label="As soon as possible" amount={booking.urgent_fee} /> : null}
        {booking.extra_parts.map((part) => (
          <MoneyLine key={part.id} label={`${part.description} (${part.status})`} amount={part.amount} muted={part.status !== 'approved'} />
        ))}
        <View style={workStyles.divider} />
        <MoneyLine label="Total" amount={total} bold empty="Not known yet" />
        <MoneyLine label="Paid" amount={paid} />
        <MoneyLine label="Still to pay" amount={balance} bold empty="–" />

        {booking.payments.length ? <Text style={styles.subTitle}>Payments</Text> : null}
        {booking.payments.map((payment) => (
          <View key={payment.id} style={styles.payment}>
            <View style={styles.paymentTop}>
              <Text style={workStyles.body}>
                {PAYMENT_KIND_LABELS[payment.kind] ?? payment.kind}: {formatRupees(payment.amount)} by {methodLabel(payment.method)}
              </Text>
              <Text style={[styles.paymentStatus, payment.status === 'paid' && styles.paymentPaid]}>{payment.status}</Text>
            </View>
            {payment.provider_reference ? (
              <Text style={workStyles.muted} selectable>
                Ref. {payment.provider_reference}
              </Text>
            ) : null}
            {payment.status === 'pending' ? (
              <PaymentReview payment={payment} onReviewed={(confirmed) => done(reviewMessage(payment, confirmed))} />
            ) : null}
          </View>
        ))}
      </Box>

      <Box title="Professional">
        {booking.professional ? (
          <View style={styles.personRow}>
            <View style={workStyles.flex}>
              <ProfessionalRow professional={booking.professional} serviceName={booking.service?.name ?? ''} showCall={false} />
            </View>
            <ContactButtons phone={booking.professional.phone} name={booking.professional.full_name} smsBody={jobText} />
          </View>
        ) : null}

        {booking.status === 'requested' && !settled ? (
          <Text style={workStyles.body}>
            Waiting for the customer’s advance. Confirm it under Money first, then choose a professional.
          </Text>
        ) : null}

        <JobActions
          job={{
            id: booking.id,
            status: booking.status,
            price: booking.price,
            urgentFee: booking.urgent_fee,
            parts: booking.extra_parts,
            paid: paidSoFar(booking.payments),
          }}
          role="team"
          onChanged={done}
        />

        {booking.status === 'requested' && openOffers.length ? (
          <>
            <Text style={styles.subTitle}>Offers sent</Text>
            <Text style={workStyles.muted}>
              Professionals with the app answer there. For the others, call or text them and tap their answer.
            </Text>
            {booking.job_offers.map((offer) => (
              <View key={offer.id} style={styles.offer}>
                <View style={styles.personRow}>
                  <View style={workStyles.flex}>
                    <Text style={styles.person}>{offer.professional?.full_name}</Text>
                    <Text style={workStyles.muted}>
                      {OFFER_LABELS[offer.response]} · {offer.channel === 'app' ? 'in the app' : 'by phone or SMS'} ·{' '}
                      {formatAgo(offer.sent_at)}
                    </Text>
                  </View>
                  {offer.response === 'no_reply' && offer.channel !== 'app' ? (
                    <ContactButtons phone={offer.professional?.phone} name={offer.professional?.full_name} smsBody={offerText} />
                  ) : null}
                </View>
                {offer.response === 'no_reply' ? (
                  <View style={workStyles.row}>
                    <WorkButton
                      label="Said no"
                      tone="secondary"
                      busy={busy === `no-${offer.id}`}
                      disabled={Boolean(busy)}
                      onPress={() => act(`no-${offer.id}`, 'respond_to_offer', { p_offer_id: offer.id, p_accept: false }, 'Answer saved.')}
                    />
                    <WorkButton
                      label="Said yes"
                      busy={busy === `yes-${offer.id}`}
                      disabled={Boolean(busy)}
                      onPress={() =>
                        act(`yes-${offer.id}`, 'respond_to_offer', { p_offer_id: offer.id, p_accept: true }, (result) =>
                          result === 'assigned'
                            ? `${offer.professional?.full_name} is assigned. Text them the job details.`
                            : 'Too late: the job was already taken or cancelled.',
                        )
                      }
                    />
                  </View>
                ) : null}
              </View>
            ))}
            <WorkButton
              label="Close all open offers"
              tone="secondary"
              busy={busy === 'withdraw'}
              disabled={Boolean(busy)}
              onPress={() => act('withdraw', 'withdraw_job_offers', { p_booking_id: booking.id }, 'Open offers closed.')}
            />
          </>
        ) : null}

        {choosing ? (
          <>
            <Text style={styles.subTitle}>{booking.status === 'assigned' ? 'Swap professional' : 'Choose a professional'}</Text>
            <Text style={workStyles.muted}>
              {booking.status === 'assigned'
                ? 'Only before they set off. The customer will see the new name.'
                : booking.is_urgent
                  ? 'ASAP: offer it to every free professional. The first to accept gets it.'
                  : 'Agree it with them by phone, then assign. Or send offers and let them accept.'}
            </Text>
            {booking.status === 'requested' && freeCandidates.length ? (
              <WorkButton
                icon="send"
                label={`Offer to all ${freeCandidates.length} free professional${freeCandidates.length === 1 ? '' : 's'}`}
                tone={booking.is_urgent ? 'primary' : 'secondary'}
                busy={busy === 'offer-all'}
                disabled={Boolean(busy)}
                onPress={() =>
                  act(
                    'offer-all',
                    'send_job_offers',
                    { p_booking_id: booking.id, p_professional_ids: freeCandidates.map((c) => c.professional_id) },
                    (count) => `Offer sent to ${count}. Call or text those without the app.`,
                  )
                }
              />
            ) : null}
            {candidates.length === 0 ? (
              <Text style={workStyles.body}>
                No verified professional does this service yet. Add one in Supabase (professionals and
                professional_services), then pull down to refresh.
              </Text>
            ) : null}
            {candidates
              .filter((candidate) => candidate.professional_id !== booking.professional?.id)
              .map((candidate) => (
                <CandidateRow
                  key={candidate.professional_id}
                  candidate={candidate}
                  canOffer={booking.status === 'requested'}
                  busy={busy}
                  offerText={offerText}
                  onAssign={() =>
                    act(
                      `assign-${candidate.professional_id}`,
                      'assign_professional',
                      { p_booking_id: booking.id, p_professional_id: candidate.professional_id },
                      `${candidate.full_name} is assigned. Text them the job details.`,
                    )
                  }
                  onOffer={() =>
                    act(
                      `offer-${candidate.professional_id}`,
                      'send_job_offers',
                      { p_booking_id: booking.id, p_professional_ids: [candidate.professional_id] },
                      (count) => (count ? `Offer sent to ${candidate.full_name}.` : 'Already offered, or busy at this time.'),
                    )
                  }
                />
              ))}
          </>
        ) : null}
      </Box>

      <Box title="Notes and history">
        {mode === 'note' ? (
          <ReasonForm
            label="Note for the team"
            placeholder="For example: customer asked for a call 10 minutes before"
            hint="Only the team sees notes."
            buttonLabel="Save note"
            tone="primary"
            busy={busy === 'note'}
            onCancel={() => setMode(null)}
            onSubmit={(note) => act('note', 'add_team_note', { p_booking_id: booking.id, p_note: note }, 'Note saved.')}
          />
        ) : (
          <WorkButton icon="edit-3" label="Add a note" tone="secondary" onPress={() => setMode('note')} />
        )}
        {events.map((event) => (
          <View key={event.id} style={styles.event}>
            <Feather
              name={event.status ? 'circle' : 'file-text'}
              size={14}
              color={event.status ? colors.primary : colors.textSecondary}
              style={styles.eventIcon}
            />
            <View style={workStyles.flex}>
              <Text style={workStyles.body}>
                {event.status ? (HISTORY_LABELS[event.status] ?? STATUS_LABELS[event.status]?.label) : event.note}
              </Text>
              <Text style={workStyles.muted}>{formatMoment(event.created_at)}</Text>
            </View>
          </View>
        ))}
      </Box>

      {canCancel ? (
        mode === 'cancel' ? (
          <ReasonForm
            label="Why is this booking cancelled?"
            placeholder="For example: customer asked by phone"
            hint="The customer sees this reason. Settle any refund of the advance from the payments table."
            buttonLabel="Cancel booking"
            busy={busy === 'cancel'}
            onCancel={() => setMode(null)}
            onSubmit={(reason) =>
              act('cancel', 'team_cancel_booking', { p_booking_id: booking.id, p_reason: reason }, 'Booking cancelled.')
            }
          />
        ) : (
          <WorkButton label="Cancel this booking" tone="danger" onPress={() => setMode('cancel')} />
        )
      ) : null}
    </ScrollView>
  );
}

function CandidateRow({ candidate, canOffer, busy, offerText, onAssign, onOffer }) {
  const tags = [
    candidate.area_match ? (candidate.area ? `Works in ${candidate.area}` : 'Works anywhere') : `Area: ${candidate.area}`,
    candidate.rating ? `★ ${candidate.rating}` : 'No ratings yet',
    `${candidate.jobs_done} job${candidate.jobs_done === 1 ? '' : 's'} done`,
    candidate.late_cancellations ? `${candidate.late_cancellations} late cancel` : null,
    candidate.has_app ? 'Has the app' : 'SMS only',
  ].filter(Boolean);
  const offered = candidate.offer_response === 'no_reply';

  return (
    <View style={[styles.candidate, candidate.busy && styles.candidateBusy]}>
      <View style={styles.personRow}>
        <View style={workStyles.flex}>
          <Text style={styles.person}>{candidate.full_name}</Text>
          <Text style={workStyles.muted}>{tags.join(' · ')}</Text>
          {candidate.busy ? <Text style={styles.warning}>Has another job at this time</Text> : null}
          {!candidate.busy && !candidate.is_available ? <Text style={styles.warning}>Marked as not taking jobs</Text> : null}
          {!candidate.area_match ? <Text style={styles.warning}>Different area from the customer</Text> : null}
        </View>
        <ContactButtons phone={candidate.phone} name={candidate.full_name} smsBody={canOffer ? offerText : undefined} />
      </View>
      {!candidate.busy ? (
        <View style={workStyles.row}>
          {canOffer ? (
            <WorkButton
              label={offered ? 'Offered' : 'Offer'}
              tone="secondary"
              busy={busy === `offer-${candidate.professional_id}`}
              disabled={Boolean(busy) || offered}
              onPress={onOffer}
            />
          ) : null}
          <WorkButton
            label="Assign"
            busy={busy === `assign-${candidate.professional_id}`}
            disabled={Boolean(busy)}
            onPress={onAssign}
          />
        </View>
      ) : null}
    </View>
  );
}

function MoneyLine({ label, amount, bold = false, muted = false, empty = 'Rs [price]' }) {
  return (
    <View style={styles.moneyLine}>
      <Text style={[styles.moneyLabel, bold && styles.bold, muted && styles.mutedText]}>{label}</Text>
      <Text style={[styles.moneyAmount, bold && styles.bold, muted && styles.mutedText]}>
        {amount == null ? empty : formatRupees(amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  slot: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  job: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  jobNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE, color: colors.textSecondary, marginTop: -8 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  person: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  subTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, marginTop: 6 },
  moneyLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  moneyLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  moneyAmount: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  bold: { fontFamily: fonts.semibold },
  mutedText: { color: colors.textSecondary },
  payment: { gap: 6, padding: 10, borderRadius: radius.card, backgroundColor: colors.sageLight },
  paymentTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  paymentStatus: { fontFamily: fonts.semibold, fontSize: 13, color: '#8A5A12', textTransform: 'capitalize' },
  paymentPaid: { color: colors.primary },
  offer: { gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  candidate: { gap: 8, padding: 12, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
  candidateBusy: { backgroundColor: colors.sageLight, opacity: 0.75 },
  warning: { fontFamily: fonts.medium, fontSize: 12, color: colors.terracotta, marginTop: 2 },
  event: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  eventIcon: { marginTop: 3 },
});
