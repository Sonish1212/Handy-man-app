import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { billFor, formatRupees } from '../../lib/bookings';
import { useT } from '../../lib/i18n';
import { callRpc, methodLabel, PAYMENT_METHODS } from '../../lib/work';
import { colors, fonts, radius } from '../../theme';
import CodeInput from '../CodeInput';
import { Chips, Field, WorkButton, workStyles } from './ui';

// The next steps for a job, for its professional or for the team acting
// for them: on the way, start with the customer's code, extra parts, done,
// or hand the job back. The database checks every step again.
//
// job: { id, status, price, urgentFee, parts, paid, startLocked }
// onChanged(message): called after a step worked, to reload and show it.
export default function JobActions({ job, role, onChanged }) {
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const team = role === 'team';
  const { t } = useT();

  const run = async (name, args, message) => {
    setBusy(true);
    setError(null);
    const result = await callRpc(name, args);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return null;
    }
    setMode(null);
    if (message) onChanged(message);
    return result.data;
  };

  if (!['assigned', 'on_the_way', 'in_progress'].includes(job.status)) return null;

  const pendingParts = (job.parts ?? []).filter((part) => part.status === 'pending');
  const close = () => {
    setMode(null);
    setError(null);
  };

  let body;
  if (mode === 'start') {
    body = <StartJobForm job={job} team={team} onCancel={close} onStarted={() => onChanged('Job started.')} />;
  } else if (mode === 'part') {
    body = (
      <ExtraPartForm
        busy={busy}
        onCancel={close}
        onSubmit={(description, amount) =>
          run(
            'request_extra_part',
            { p_booking_id: job.id, p_description: description, p_amount: amount },
            'Sent to the customer. Fit the part only after they approve it in their app.',
          )
        }
      />
    );
  } else if (mode === 'complete') {
    body = (
      <CompleteJobForm
        job={job}
        team={team}
        busy={busy}
        onCancel={close}
        onSubmit={(price, method, reference) =>
          run(
            'complete_job',
            { p_booking_id: job.id, p_price: price, p_balance_method: method, p_balance_reference: reference },
            'Job marked done. Thank you!',
          )
        }
      />
    );
  } else if (mode === 'release') {
    body = (
      <ReasonForm
        label={team ? 'Why is the professional taken off this job?' : 'Why can’t you do this job?'}
        placeholder={team ? 'For example: not answering calls' : 'For example: I am sick today'}
        hint={
          team
            ? 'The booking goes back to “Needs a professional”.'
            : 'The team will find someone else. Handing back a job close to its time counts as a late cancellation.'
        }
        buttonLabel={team ? 'Remove professional' : 'Hand back job'}
        busy={busy}
        onCancel={close}
        onSubmit={(reason) =>
          run('release_job', { p_booking_id: job.id, p_reason: reason }, team ? 'Professional removed.' : 'Job handed back.')
        }
      />
    );
  } else {
    body = (
      <View style={styles.buttons}>
        {job.status === 'assigned' ? (
          <WorkButton
            icon="navigation"
            label={team ? 'Mark on the way' : t('act.onway')}
            busy={busy}
            onPress={() => run('mark_on_the_way', { p_booking_id: job.id }, 'The customer can see you are on the way.')}
          />
        ) : null}
        {job.status !== 'in_progress' ? (
          <WorkButton
            icon="key"
            label={team ? 'Start job' : t('act.start')}
            tone={job.status === 'assigned' ? 'secondary' : 'primary'}
            onPress={() => setMode('start')}
          />
        ) : (
          <>
            {pendingParts.length ? (
              <Text style={workStyles.muted}>
                Waiting for the customer to answer about{' '}
                {pendingParts.map((part) => `${part.description} (${formatRupees(part.amount)})`).join(', ')}.
              </Text>
            ) : null}
            <WorkButton icon="check-circle" label={team ? 'Mark job done' : t('act.done')} onPress={() => setMode('complete')} />
            <WorkButton icon="tool" label={team ? 'Add extra part' : t('act.part')} tone="secondary" onPress={() => setMode('part')} />
          </>
        )}
        {job.status !== 'in_progress' ? (
          <WorkButton
            label={team ? 'Remove professional' : t('act.cant')}
            tone="danger"
            onPress={() => setMode('release')}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {body}
      {error ? <Text style={workStyles.error}>{error}</Text> : null}
    </View>
  );
}

function StartJobForm({ job, team, onCancel, onStarted }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [locked, setLocked] = useState(Boolean(job.startLocked) && !team);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const result = await callRpc('start_job', { p_booking_id: job.id, p_code: code });
    setBusy(false);
    if (result.error) return setMessage(result.error);
    if (result.data === 'started') return onStarted();
    setCode('');
    if (result.data === 'locked') return setLocked(true);
    return setMessage('That code is not right. Ask the customer to check the start code in their Bookings tab.');
  };

  if (locked) {
    return (
      <View style={styles.form}>
        <Text style={styles.formTitle}>Start code locked</Text>
        <Text style={workStyles.body}>
          The code was wrong too many times. Please call the team: they will check with the customer and start the job.
        </Text>
        <WorkButton label="Close" tone="secondary" onPress={onCancel} />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Start the job</Text>
      <Text style={workStyles.body}>
        {team
          ? 'Enter the 4-digit code the professional reads to you from the customer.'
          : 'Ask the customer for their 4-digit start code. It shows in their app under Bookings.'}
      </Text>
      <CodeInput value={code} onChange={setCode} length={4} hasError={Boolean(message)} />
      {message ? <Text style={workStyles.error}>{message}</Text> : null}
      <View style={workStyles.row}>
        <WorkButton label="Back" tone="secondary" onPress={onCancel} />
        <WorkButton label="Start" onPress={submit} busy={busy} disabled={code.length !== 4} />
      </View>
    </View>
  );
}

function ExtraPartForm({ busy, onCancel, onSubmit }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const value = Number(amount);
  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Extra part</Text>
      <Field
        label="What part?"
        value={description}
        onChangeText={setDescription}
        placeholder="For example: new tap washer"
        maxLength={120}
      />
      <Field
        label="Price (Rs)"
        value={amount}
        onChangeText={(text) => setAmount(text.replace(/[^\d]/g, ''))}
        keyboardType="number-pad"
        placeholder="0"
        hint="The customer sees this and approves or declines it in their app."
      />
      <View style={workStyles.row}>
        <WorkButton label="Back" tone="secondary" onPress={onCancel} />
        <WorkButton
          label="Send to customer"
          busy={busy}
          disabled={description.trim().length < 2 || !(value > 0)}
          onPress={() => onSubmit(description.trim(), value)}
        />
      </View>
    </View>
  );
}

function CompleteJobForm({ job, team, busy, onCancel, onSubmit }) {
  const needsPrice = job.price == null;
  const [priceText, setPriceText] = useState(needsPrice ? '' : String(Number(job.price)));
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');

  const canEditPrice = needsPrice || team;
  const price = priceText === '' ? null : Number(priceText);
  const { total, due } = billFor({ price, urgentFee: job.urgentFee, parts: job.parts, paid: job.paid });
  const collecting = due != null && due > 0;
  const ready = price != null && (!collecting || method === 'cash' || reference.trim().length >= 4);
  const priceChanged = !needsPrice && price !== Number(job.price);

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Mark job done</Text>
      {canEditPrice ? (
        <Field
          label={needsPrice ? 'Agreed price for the job (Rs)' : 'Job price (Rs)'}
          value={priceText}
          onChangeText={(text) => setPriceText(text.replace(/[^\d]/g, ''))}
          keyboardType="number-pad"
          placeholder="0"
          hint={needsPrice ? 'The price you agreed with the customer before starting.' : 'Change only for an agreed discount.'}
        />
      ) : null}

      <View style={styles.bill}>
        <BillLine label="Job" amount={price} />
        {Number(job.urgentFee) > 0 ? <BillLine label="As soon as possible" amount={job.urgentFee} /> : null}
        {(job.parts ?? [])
          .filter((part) => part.status === 'approved')
          .map((part) => (
            <BillLine key={part.id} label={part.description} amount={part.amount} />
          ))}
        <BillLine label="Total" amount={total} bold />
        {job.paid > 0 ? <BillLine label="Already paid" amount={-job.paid} /> : null}
        <BillLine label="To collect now" amount={due} bold />
      </View>

      {collecting ? (
        <>
          <Text style={styles.label}>How did the customer pay the rest?</Text>
          <Chips options={PAYMENT_METHODS} value={method} onChange={setMethod} />
          {method !== 'cash' ? (
            <Field
              label={`${methodLabel(method)} transaction ID`}
              value={reference}
              onChangeText={setReference}
              autoCapitalize="characters"
              placeholder="From the customer's payment screen"
              hint="The team checks it before it counts as paid."
              maxLength={64}
            />
          ) : null}
        </>
      ) : null}

      <View style={workStyles.row}>
        <WorkButton label="Back" tone="secondary" onPress={onCancel} />
        <WorkButton
          label={collecting && method === 'cash' ? `Done, ${formatRupees(due)} received` : 'Job done'}
          busy={busy}
          disabled={!ready}
          onPress={() => onSubmit(needsPrice || priceChanged ? price : null, collecting ? method : null, reference.trim() || null)}
        />
      </View>
    </View>
  );
}

function BillLine({ label, amount, bold = false }) {
  const text = amount == null ? '–' : amount < 0 ? `− ${formatRupees(-amount)}` : formatRupees(amount);
  return (
    <View style={styles.billLine}>
      <Text style={[styles.billLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.billAmount, bold && styles.bold]}>{text}</Text>
    </View>
  );
}

export function ReasonForm({ label, placeholder, hint, buttonLabel, tone = 'danger', busy, onCancel, onSubmit }) {
  const [reason, setReason] = useState('');
  return (
    <View style={styles.form}>
      <Field
        label={label}
        value={reason}
        onChangeText={setReason}
        placeholder={placeholder}
        hint={hint}
        maxLength={300}
        multiline
      />
      <View style={workStyles.row}>
        {onCancel ? <WorkButton label="Back" tone="secondary" onPress={onCancel} /> : null}
        <WorkButton
          label={buttonLabel}
          tone={tone}
          busy={busy}
          disabled={reason.trim().length < 3}
          onPress={() => onSubmit(reason.trim())}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  buttons: { gap: 8 },
  form: {
    gap: 12,
    padding: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.sageLight,
  },
  formTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  bill: { gap: 6, padding: 12, borderRadius: radius.card, backgroundColor: colors.box, borderWidth: 1, borderColor: colors.border },
  billLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  billLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  billAmount: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  bold: { fontFamily: fonts.semibold },
});
