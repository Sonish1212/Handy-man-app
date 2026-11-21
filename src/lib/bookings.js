import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { makeSampleBookings } from '../data/sampleBookings';
import { isDemoMode, useAuth } from './auth';
import { supabase } from './supabase';

// Everything the Bookings page shows comes from one query; row level security
// makes sure customers only ever get their own bookings back.
const BOOKING_COLUMNS = `
  id, status, slot_start, slot_end, description, start_code, price, deposit_amount,
  is_urgent, urgent_fee, assigned_at, on_the_way_at, started_at, completed_at, cancelled_at, cancel_reason,
  cancelled_by, created_at,
  service:services (slug, name, name_ne, icon),
  task:service_tasks (name, name_ne),
  payments (id, kind, status, method, amount, provider_reference),
  address:addresses (label, area, city, landmark),
  professional:professionals (full_name, photo_url, phone, verification_status),
  extra_parts (id, description, amount, status),
  ratings (rated_by, stars)
`;

export const UPCOMING_STATUSES = ['requested', 'assigned', 'on_the_way', 'in_progress'];

// Cancelling is allowed until the work starts (matches cancel_booking()).
export const CANCELLABLE_STATUSES = ['requested', 'assigned', 'on_the_way'];

export function useBookings() {
  const { isSignedIn, session } = useAuth();
  const userId = session?.user.id;
  const [bookings, setBookings] = useState(() => (isDemoMode ? makeSampleBookings() : []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (isDemoMode || !isSignedIn) return;
    setLoading(true);
    try {
      const { data, error: loadError } = await supabase
        .from('bookings')
        .select(BOOKING_COLUMNS)
        .eq('customer_id', userId)
        .order('slot_start', { ascending: false });
      if (loadError) {
        setError('Could not load your bookings. Pull down to try again.');
        return;
      }
      setError(null);
      setBookings((data ?? []).map((booking) => ({ ...booking, _viewerId: userId })));
    } catch {
      setError('Could not load your bookings. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, userId]);

  // Reload every time the tab is opened, so status changes made by the team
  // (a professional assigned, on the way, finished) show up.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const updateLocal = (id, change) =>
    setBookings((list) => list.map((booking) => (booking.id === id ? { ...booking, ...change(booking) } : booking)));

  const cancelBooking = useCallback(
    async (id, reason) => {
      if (isDemoMode) {
        updateLocal(id, () => ({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: reason }));
        return { error: null };
      }
      let rpcError;
      try {
        ({ error: rpcError } = await supabase.rpc('cancel_booking', { p_booking_id: id, p_reason: reason }));
      } catch {
        return { error: 'Could not connect. Please try cancelling again.' };
      }
      if (rpcError) return { error: 'This booking can no longer be cancelled in the app. Please call us.' };
      await refresh();
      return { error: null };
    },
    [refresh],
  );

  const decideExtraPart = useCallback(
    async (bookingId, partId, approve) => {
      const status = approve ? 'approved' : 'declined';
      if (isDemoMode) {
        updateLocal(bookingId, (booking) => ({
          extra_parts: booking.extra_parts.map((part) => (part.id === partId ? { ...part, status } : part)),
        }));
        return { error: null };
      }
      let rpcError;
      try {
        ({ error: rpcError } = await supabase.rpc('decide_extra_part', { p_part_id: partId, p_approve: approve }));
      } catch {
        return { error: 'Could not connect. Please try again.' };
      }
      if (rpcError) return { error: 'Could not save your answer. Please try again.' };
      await refresh();
      return { error: null };
    },
    [refresh],
  );

  const rateBooking = useCallback(async (id, stars) => {
    updateLocal(id, (booking) => ({ ratings: [...booking.ratings, { rated_by: 'customer', stars }] }));
    if (isDemoMode) return { error: null };
    let insertError;
    try {
      ({ error: insertError } = await supabase.from('ratings').insert({ booking_id: id, rated_by: 'customer', stars }));
    } catch (error) {
      insertError = error;
    }
    if (insertError) {
      updateLocal(id, (booking) => ({ ratings: booking.ratings.filter((rating) => rating.rated_by !== 'customer') }));
      return { error: 'Could not save your rating. Please try again.' };
    }
    return { error: null };
  }, []);

  const { upcoming, past } = useMemo(() => {
    const visibleBookings = isDemoMode ? bookings : bookings.filter((booking) => isSignedIn && booking._viewerId === userId);
    const upcomingList = visibleBookings
      .filter((booking) => UPCOMING_STATUSES.includes(booking.status))
      .sort((a, b) => new Date(a.slot_start) - new Date(b.slot_start));
    const pastList = visibleBookings.filter((booking) => !UPCOMING_STATUSES.includes(booking.status));
    return { upcoming: upcomingList, past: pastList };
  }, [bookings, isSignedIn, userId]);

  return { upcoming, past, loading, error, refresh, cancelBooking, decideExtraPart, rateBooking };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export const STATUS_LABELS = {
  awaiting_payment: { label: 'Waiting for advance', tone: 'waiting' },
  payment_checking: { label: 'Checking your payment', tone: 'waiting' },
  requested: { label: 'Finding a professional', tone: 'waiting' },
  assigned: { label: 'Professional assigned', tone: 'good' },
  on_the_way: { label: 'On the way', tone: 'good' },
  in_progress: { label: 'Work in progress', tone: 'good' },
  completed: { label: 'Completed', tone: 'done' },
  // Team and professional screens
  on_hold: { label: 'On hold: nobody free yet', tone: 'waiting' },
  urgent_hold: { label: 'Urgent: nobody has taken it', tone: 'alert' },
  offered: { label: 'Offered, waiting for a reply', tone: 'waiting' },
  cancelled: { label: 'Cancelled', tone: 'cancelled' },
};

export { formatSlot } from './nepalTime';

// "in 18 hours", "in 3 days", "in 25 min", "now"
export function formatTimeUntil(iso) {
  const minutes = Math.round((new Date(iso) - Date.now()) / 60000);
  if (minutes <= 0) return 'now';
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  return `in ${Math.round(hours / 24)} days`;
}

export function formatRupees(amount) {
  return amount == null ? 'Price pending' : `Rs ${Number(amount).toLocaleString('en-IN')}`;
}

// The advance for a booking: 'none' (not needed), 'unpaid', 'checking'
// (transaction ID sent, the team is verifying it) or 'paid'.
export function advancePayment(booking) {
  if (!(Number(booking.deposit_amount) > 0)) return { state: 'none' };
  const payment = (booking.payments ?? [])
    .filter((item) => item.kind === 'deposit' && item.status !== 'failed' && item.status !== 'refunded')
    .sort((a, b) => (a.status === 'paid' ? -1 : b.status === 'paid' ? 1 : 0))[0];
  if (!payment) return { state: 'unpaid' };
  return { state: payment.status === 'paid' ? 'paid' : 'checking', reference: payment.provider_reference };
}

// What the card should say: a booking only counts as "finding a
// professional" once its advance is paid.
export function bookingStage(booking) {
  if (booking.status !== 'requested') return booking.status;
  const { state } = advancePayment(booking);
  if (state === 'unpaid') return 'awaiting_payment';
  if (state === 'checking') return 'payment_checking';
  return 'requested';
}

export function jobName(booking) {
  return booking.task?.name ?? booking.service?.name ?? 'Booking';
}

// Money paid so far: confirmed payments only (advance, rest of the bill,
// parts). Payments still being checked do not count yet.
export function paidSoFar(payments) {
  return (payments ?? [])
    .filter((item) => item.status === 'paid' && ['deposit', 'balance', 'extra_parts'].includes(item.kind))
    .reduce((sum, item) => sum + Number(item.amount), 0);
}

// The bill: job price, ASAP charge and approved extra parts, minus what is
// paid. total and due are null while the price is not set yet.
export function billFor({ price, urgentFee, parts, paid }) {
  const approved = (parts ?? []).filter((part) => part.status === 'approved');
  const partsTotal = approved.some((part) => part.amount == null)
    ? null
    : approved.reduce((sum, part) => sum + Number(part.amount), 0);
  const total = price == null || partsTotal == null ? null : Number(price) + Number(urgentFee ?? 0) + partsTotal;
  return { total, paid, due: total == null ? null : Math.max(total - paid, 0) };
}

// What the customer has paid and still owes for one booking row.
export function paymentSummary(booking) {
  const { total, paid, due } = billFor({
    price: booking.price,
    urgentFee: booking.urgent_fee,
    parts: booking.extra_parts,
    paid: paidSoFar(booking.payments),
  });
  return { total, paid, balance: due };
}

export function formatAddress(address) {
  if (!address) return '';
  return [address.area, address.landmark].filter(Boolean).join(', ');
}
