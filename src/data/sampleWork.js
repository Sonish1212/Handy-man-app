// Team and professional screens in demo mode (Supabase not connected).
// Same shapes as lib/work loads from Supabase. Actions are switched off.

import { nepalDate, nepalParts } from '../lib/nepalTime';

function dayAt(dayOffset, hour) {
  const today = nepalParts(new Date());
  return nepalDate(today.year, today.month, today.day + dayOffset, hour).toISOString();
}
const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();

export const SAMPLE_PROFESSIONAL = {
  id: 'sample-pro',
  full_name: 'Pemba Sherpa',
  phone: '+9779811111111',
  photo_url: null,
  area: 'Baneshwor',
  is_available: true,
  verification_status: 'verified',
  services: ['Plumber', 'Home cleaning'],
  jobs_done: 22,
  rating: 4.9,
};

const customer = { full_name: 'Asha Shrestha', phone: '+9779800000001', email: null };
const address = { label: 'Home', area: 'Baneshwor', city: 'Kathmandu', landmark: 'near the temple', details: 'Blue gate, 2nd floor' };
const plumber = { slug: 'plumber', name: 'Plumber', name_ne: 'प्लम्बर' };

export function makeSampleTeamBookings() {
  return [
    {
      id: 'team-payment',
      status: 'requested',
      slot_start: dayAt(1, 10),
      slot_end: dayAt(1, 12),
      description: 'Kitchen tap drips all night',
      start_code: '4821',
      price: 480,
      deposit_amount: 200,
      is_urgent: false,
      urgent_fee: 0,
      created_at: minutesAgo(25),
      customer,
      service: plumber,
      task: { name: 'Tap repair', name_ne: 'धारा मर्मत' },
      address,
      professional: null,
      payments: [
        { id: 'pay-1', kind: 'deposit', status: 'pending', method: 'esewa', amount: 200, provider_reference: '0X7K2M9', created_at: minutesAgo(20) },
      ],
      extra_parts: [],
      job_offers: [],
    },
    {
      id: 'team-asap',
      status: 'requested',
      slot_start: minutesAgo(10),
      slot_end: new Date(Date.now() + 110 * 60000).toISOString(),
      description: 'No power in two rooms',
      start_code: '1290',
      price: null,
      deposit_amount: 200,
      is_urgent: true,
      urgent_fee: 100,
      created_at: minutesAgo(10),
      customer: { full_name: 'Bikash Thapa', phone: '+9779800000002', email: null },
      service: { slug: 'electrician', name: 'Electrician', name_ne: 'इलेक्ट्रिसियन' },
      task: { name: 'Wiring fault', name_ne: 'वायरिङ समस्या' },
      address: { ...address, area: 'Koteshwor', landmark: 'opposite the petrol pump' },
      professional: null,
      payments: [{ id: 'pay-2', kind: 'deposit', status: 'paid', method: 'khalti', amount: 200, provider_reference: 'KH55120', created_at: minutesAgo(8) }],
      extra_parts: [],
      job_offers: [
        { id: 'offer-1', response: 'no_reply', channel: 'sms', sent_at: minutesAgo(4), professional: { id: 'pro-hari', full_name: 'Hari Karki', phone: '+9779811111114' } },
      ],
    },
    // Paid, nobody free yet: on hold until someone becomes free.
    {
      id: 'team-hold',
      status: 'requested',
      slot_start: dayAt(1, 14),
      slot_end: dayAt(1, 16),
      description: 'Bathroom tap leaking',
      start_code: '5521',
      price: 480,
      deposit_amount: 200,
      is_urgent: false,
      urgent_fee: 0,
      created_at: minutesAgo(45),
      customer: { full_name: 'Anita Gurung', phone: '+9779800000003', email: null },
      service: { slug: 'plumber', name: 'Plumber', name_ne: 'प्लम्बर' },
      task: { name: 'Tap repair', name_ne: 'धारा मर्मत' },
      address: { ...address, area: 'Chabahil', landmark: 'behind the school' },
      professional: null,
      payments: [{ id: 'pay-4', kind: 'deposit', status: 'paid', method: 'esewa', amount: 200, provider_reference: 'ES77410', created_at: minutesAgo(40) }],
      extra_parts: [],
      job_offers: [],
    },
    {
      id: 'team-active',
      status: 'on_the_way',
      slot_start: dayAt(0, 14),
      slot_end: dayAt(0, 16),
      description: null,
      start_code: '7735',
      price: 1800,
      deposit_amount: 200,
      is_urgent: false,
      urgent_fee: 0,
      created_at: minutesAgo(600),
      assigned_at: minutesAgo(500),
      on_the_way_at: minutesAgo(15),
      customer,
      service: { slug: 'home-cleaning', name: 'Home cleaning', name_ne: 'घर सफाइ' },
      task: { name: '2 BHK deep clean', name_ne: '२ बीएचके सफाइ' },
      address,
      professional: { id: 'sample-pro', full_name: 'Pemba Sherpa', phone: '+9779811111111', photo_url: null, verification_status: 'verified' },
      payments: [{ id: 'pay-3', kind: 'deposit', status: 'paid', method: 'esewa', amount: 200, provider_reference: 'ES88120', created_at: minutesAgo(590) }],
      extra_parts: [],
      job_offers: [],
    },
  ];
}

// Payments waiting for the team, shaped like lib/work's payments query.
export function makeSamplePendingPayments() {
  return makeSampleTeamBookings().flatMap((booking) =>
    booking.payments
      .filter((payment) => payment.status === 'pending')
      .map((payment) => ({ ...payment, booking })),
  );
}

// dispatch_candidates() rows for a booking that needs a professional.
export const SAMPLE_CANDIDATES = [
  {
    professional_id: 'pro-ram', full_name: 'Ram Bahadur', phone: '+9779811111115', photo_url: null, area: 'Koteshwor',
    has_app: true, is_available: true, area_match: true, busy: false, jobs_done: 14, rating: 4.8,
    late_cancellations: 0, offer_response: null,
  },
  {
    professional_id: 'pro-hari', full_name: 'Hari Karki', phone: '+9779811111114', photo_url: null, area: null,
    has_app: false, is_available: true, area_match: true, busy: false, jobs_done: 3, rating: null,
    late_cancellations: 1, offer_response: 'no_reply',
  },
  {
    professional_id: 'sample-pro', full_name: 'Pemba Sherpa', phone: '+9779811111111', photo_url: null, area: 'Baneshwor',
    has_app: true, is_available: true, area_match: false, busy: true, jobs_done: 22, rating: 4.9,
    late_cancellations: 0, offer_response: null,
  },
];

export function makeSampleOffers() {
  return [
    {
      offer_id: 'offer-demo',
      booking_id: 'team-asap',
      sent_at: minutesAgo(3),
      slot_start: minutesAgo(10),
      slot_end: new Date(Date.now() + 110 * 60000).toISOString(),
      is_urgent: true,
      service_name: 'Electrician',
      task_name: 'Wiring fault',
      task_name_ne: 'वायरिङ समस्या',
      description: 'No power in two rooms',
      area: 'Koteshwor',
      price: null,
      urgent_fee: 100,
    },
  ];
}

export function makeSampleJobs() {
  return [
    {
      booking_id: 'team-active',
      status: 'on_the_way',
      slot_start: dayAt(0, 14),
      slot_end: dayAt(0, 16),
      is_urgent: false,
      service_name: 'Home cleaning',
      task_name: '2 BHK deep clean',
      task_name_ne: '२ बीएचके सफाइ',
      description: null,
      area: 'Baneshwor',
      landmark: 'near the temple',
      address_details: 'Blue gate, 2nd floor',
      customer_name: 'Asha Shrestha',
      customer_phone: '+9779800000001',
      price: 1800,
      urgent_fee: 0,
      paid: 200,
      start_locked: false,
      extra_parts: [],
    },
    {
      booking_id: 'job-done',
      status: 'completed',
        completed_at: dayAt(-2, 12),
      slot_start: dayAt(-2, 10),
      slot_end: dayAt(-2, 12),
      is_urgent: false,
      service_name: 'Plumber',
      task_name: 'Tap repair',
      task_name_ne: 'धारा मर्मत',
      description: null,
      area: 'Baneshwor',
      landmark: null,
      address_details: null,
      customer_name: null,
      customer_phone: null,
      price: 480,
      urgent_fee: 0,
      paid: 480,
      start_locked: false,
      extra_parts: [],
    },
  ];
}
