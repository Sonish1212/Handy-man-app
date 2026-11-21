import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import {
  makeSampleJobs,
  makeSampleOffers,
  makeSamplePendingPayments,
  makeSampleTeamBookings,
  SAMPLE_CANDIDATES,
  SAMPLE_PROFESSIONAL,
} from '../data/sampleWork';
import { isDemoMode, useAuth } from './auth';
import { advancePayment } from './bookings';
import { supabase } from './supabase';

// Data and actions for the people who run the jobs: the team
// (profiles.role = 'admin') and professionals with the app. Every action is
// a database function that checks who is calling and whether the step is
// allowed (migration 20261030000000_dispatch.sql), so these screens can
// never do more than the database permits.

const DEMO_MESSAGE = 'Demo mode: connect Supabase to use this.';

// Calls a database function. The database writes its rule errors for people
// (error code P0001), so those are shown as they are.
export async function callRpc(name, args) {
  if (isDemoMode) return { data: null, error: DEMO_MESSAGE };
  try {
    const { data, error } = await supabase.rpc(name, args);
    if (!error) return { data, error: null };
    if (error.code === 'P0001') return { data: null, error: error.message };
    if (__DEV__) console.warn(`[rpc ${name}]`, error.code, error.message);
    // PGRST202: the server does not have this function yet (a database
    // update has not been run). The person's internet is fine, so say so.
    if (error.code === 'PGRST202') {
      return { data: null, error: 'This part is being updated. Please try again later or call us.' };
    }
    return { data: null, error: 'Something went wrong. Check your internet and try again.' };
  } catch {
    return { data: null, error: 'Could not connect. Check your internet and try again.' };
  }
}

// Is the signed-in person on the team, or a professional? Professionals get
// their own side of the app (src/app/(pro)); the profile loads their
// professional record at sign-in. Demo mode shows a sample professional so
// those screens can be previewed.
export function useWorkRole() {
  const { profile } = useAuth();
  return {
    isTeam: isDemoMode || profile?.role === 'admin',
    professional: isDemoMode ? SAMPLE_PROFESSIONAL : (profile?.professional ?? null),
  };
}

// Keep cached job/customer details private when the signed-in account changes.
function useAccountState(initial, empty = []) {
  const { session } = useAuth();
  const owner = session?.user?.id ?? null;
  const [cached, setCached] = useState(() => ({ owner, value: typeof initial === 'function' ? initial() : initial }));
  const value = isDemoMode || cached.owner === owner ? cached.value : empty;
  const update = useCallback((next) => setCached({ owner, value: next }), [owner]);
  return [value, update];
}

// Loads on every visit to the screen and on pull-to-refresh.
function useLoader(load) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const failed = await load();
      setError(failed ? 'Could not load. Pull down to try again.' : null);
    } catch {
      setError('Could not load. Check your internet, then pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { loading, error, refresh };
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

const TEAM_COLUMNS = `
  id, status, slot_start, slot_end, description, start_code, price, deposit_amount, is_urgent, urgent_fee, contact_phone,
  assigned_at, on_the_way_at, started_at, completed_at, cancelled_at, cancel_reason, created_at,
  customer:profiles (full_name, phone, email),
  service:services (slug, name, name_ne),
  task:service_tasks (name, name_ne),
  address:addresses (label, area, city, landmark, details),
  professional:professionals (id, full_name, phone, photo_url, verification_status),
  payments (id, kind, status, method, amount, provider_reference, created_at),
  extra_parts (id, description, amount, status),
  job_offers (id, response, channel, sent_at, professional:professionals (id, full_name, phone))
`;

const PAYMENT_COLUMNS = `
  id, kind, method, amount, provider_reference, created_at,
  booking:bookings (id, status, slot_start, slot_end, is_urgent, contact_phone,
    customer:profiles (full_name, phone, email),
    service:services (name), task:service_tasks (name))
`;

// The number to call about a booking: the one given for the job, else the
// customer's account number (older bookings).
export const bookingPhone = (booking) => booking?.contact_phone ?? booking?.customer?.phone ?? null;

export const ACTIVE_STATUSES = ['requested', 'assigned', 'on_the_way', 'in_progress'];

// Is the advance paid (or not needed)? Only then can a job be offered.
export function advanceSettled(booking) {
  const { state } = advancePayment(booking);
  return state === 'none' || state === 'paid';
}

// A paid booking nobody has taken is "on hold": the database offers it
// automatically when someone becomes free. Within this many hours of its
// time (or for "as soon as possible") the team should step in by phone.
export const URGENT_HOLD_HOURS = 2;

// What the team is waiting on for a booking, for its status chip.
export function teamStage(booking, now = Date.now()) {
  if (booking.status !== 'requested') return booking.status;
  if (!advanceSettled(booking)) return advancePayment(booking).state === 'checking' ? 'payment_checking' : 'awaiting_payment';
  if (booking.job_offers?.some((offer) => offer.response === 'no_reply')) return 'offered';
  const hoursLeft = (new Date(booking.slot_start) - now) / 3600000;
  return booking.is_urgent || hoursLeft <= URGENT_HOLD_HOURS ? 'urgent_hold' : 'on_hold';
}

const bySlot = (a, b) => Number(b.is_urgent) - Number(a.is_urgent) || new Date(a.slot_start) - new Date(b.slot_start);

export function useTeamQueue() {
  const [bookings, setBookings] = useAccountState(() => (isDemoMode ? makeSampleTeamBookings() : []));
  const [payments, setPayments] = useAccountState(() => (isDemoMode ? makeSamplePendingPayments() : []));

  const load = useCallback(async () => {
    if (isDemoMode) return false;
    const [bookingResult, paymentResult] = await Promise.all([
      supabase.from('bookings').select(TEAM_COLUMNS).in('status', ACTIVE_STATUSES).order('slot_start'),
      supabase.from('payments').select(PAYMENT_COLUMNS).eq('status', 'pending').order('created_at'),
    ]);
    if (bookingResult.error || paymentResult.error) return true;
    setBookings(bookingResult.data);
    setPayments(paymentResult.data);
    return false;
  }, [setBookings, setPayments]);

  const { loading, error, refresh } = useLoader(load);

  const groups = useMemo(() => {
    const requested = bookings.filter((booking) => booking.status === 'requested');
    const paid = requested.filter(advanceSettled).sort(bySlot);
    return {
      toAssign: paid,
      urgentHold: paid.filter((booking) => teamStage(booking) === 'urgent_hold'),
      onHold: paid.filter((booking) => teamStage(booking) === 'on_hold'),
      offered: paid.filter((booking) => teamStage(booking) === 'offered'),
      waitingAdvance: requested.filter((booking) => !advanceSettled(booking)).sort(bySlot),
      active: bookings.filter((booking) => booking.status !== 'requested').sort(bySlot),
    };
  }, [bookings]);

  return { ...groups, payments, loading, error, refresh };
}

export function useTeamBooking(id) {
  const [booking, setBooking] = useAccountState(() =>
    isDemoMode ? (makeSampleTeamBookings().find((item) => item.id === id) ?? null) : null,
    null,
  );
  const [events, setEvents] = useAccountState([]);
  const [candidates, setCandidates] = useAccountState(() =>
    isDemoMode && booking?.status === 'requested' ? SAMPLE_CANDIDATES : [],
  );

  const load = useCallback(async () => {
    if (isDemoMode) return false;
    const [bookingResult, eventResult] = await Promise.all([
      supabase.from('bookings').select(TEAM_COLUMNS).eq('id', id).maybeSingle(),
      supabase
        .from('booking_events')
        .select('id, status, note, created_at')
        .eq('booking_id', id)
        .order('created_at', { ascending: false }),
    ]);
    if (bookingResult.error || eventResult.error) return true;
    setBooking(bookingResult.data);
    setEvents(eventResult.data);
    if (bookingResult.data && ['requested', 'assigned'].includes(bookingResult.data.status)) {
      const { data } = await supabase.rpc('dispatch_candidates', { p_booking_id: id });
      setCandidates(data ?? []);
    } else {
      setCandidates([]);
    }
    return false;
  }, [id, setBooking, setEvents, setCandidates]);

  const { loading, error, refresh } = useLoader(load);
  return { booking, events, candidates, loading, error, refresh };
}

// ---------------------------------------------------------------------------
// Professionals
// ---------------------------------------------------------------------------

export function useMyWork() {
  const [offers, setOffers] = useAccountState(() => (isDemoMode ? makeSampleOffers() : []));
  const [jobs, setJobs] = useAccountState(() => (isDemoMode ? makeSampleJobs() : []));

  const load = useCallback(async () => {
    if (isDemoMode) return false;
    const [offerResult, jobResult] = await Promise.all([supabase.rpc('my_job_offers'), supabase.rpc('my_jobs')]);
    if (offerResult.error || jobResult.error) return true;
    setOffers(offerResult.data);
    setJobs(jobResult.data);
    return false;
  }, [setOffers, setJobs]);

  const { loading, error, refresh } = useLoader(load);
  const active = jobs.filter((job) => job.status !== 'completed');
  const done = jobs.filter((job) => job.status === 'completed');
  return { offers, active, done, loading, error, refresh };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'esewa', label: 'eSewa' },
  { id: 'khalti', label: 'Khalti' },
  { id: 'ime_pay', label: 'IME Pay' },
  { id: 'bank', label: 'Bank' },
];

export const methodLabel = (id) => PAYMENT_METHODS.find((method) => method.id === id)?.label ?? id;

export const PAYMENT_KIND_LABELS = {
  deposit: 'Advance',
  balance: 'Rest of the bill',
  extra_parts: 'Extra parts',
  travel_fee: 'Travel fee',
  refund: 'Refund',
};

// "+977 98XXX XXXXX" for showing; tel: links use the number as stored.
export function formatPhone(phone) {
  if (!phone) return null;
  const local = phone.replace(/^\+?977/, '');
  return local.length === 10 ? `+977 ${local.slice(0, 5)} ${local.slice(5)}` : phone;
}

// "5 min ago", "3 h ago", "2 days ago"
export function formatAgo(iso) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
