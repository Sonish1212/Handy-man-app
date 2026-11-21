import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatRupees } from '../../lib/bookings';
import { callRpc } from '../../lib/work';
import { WorkButton, workStyles } from './ui';

// Confirm or reject a payment the customer reported. "Not received" needs a
// second tap, so a real payment is not rejected by a slip of the finger.
// onReviewed(confirmed) runs after the database saved the answer.
export default function PaymentReview({ payment, onReviewed }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [confirmReject, setConfirmReject] = useState(false);

  const review = async (approve) => {
    setBusy(approve ? 'yes' : 'no');
    setError(null);
    const result = await callRpc('review_payment', { p_payment_id: payment.id, p_approve: approve });
    setBusy(null);
    if (result.error) return setError(result.error);
    return onReviewed(approve);
  };

  return (
    <View style={styles.wrap}>
      {error ? <Text style={workStyles.error}>{error}</Text> : null}
      <View style={workStyles.row}>
        <WorkButton
          label={confirmReject ? 'Tap again: not received' : 'Not received'}
          tone="danger"
          busy={busy === 'no'}
          disabled={Boolean(busy)}
          onPress={() => (confirmReject ? review(false) : setConfirmReject(true))}
        />
        <WorkButton
          label="Confirm"
          icon="check"
          busy={busy === 'yes'}
          disabled={Boolean(busy)}
          onPress={() => review(true)}
        />
      </View>
    </View>
  );
}

// What to tell the team after checking a payment.
export function reviewMessage(payment, confirmed) {
  if (!confirmed) return 'Marked as not received. The customer can send the transaction ID again.';
  return payment.kind === 'deposit'
    ? `${formatRupees(payment.amount)} advance confirmed. The job was sent to the free professionals for it; the booking’s history shows who.`
    : `${formatRupees(payment.amount)} confirmed.`;
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
});
