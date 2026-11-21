// Bookings shown in demo mode (Supabase not connected), so the Bookings page
// can be designed and tested without real data. Same shape as the rows that
// lib/bookings loads from Supabase.

import { nepalDate, nepalParts } from '../lib/nepalTime';

const hoursFromNow = (hours) => new Date(Date.now() + hours * 3600 * 1000).toISOString();

// Tomorrow at the given hour, Nepal time.
function tomorrowAt(hour) {
  const today = nepalParts(new Date());
  return nepalDate(today.year, today.month, today.day + 1, hour).toISOString();
}

export function makeSampleBookings() {
  return [
    {
      id: 'sample-upcoming',
      status: 'assigned',
      slot_start: tomorrowAt(10),
      slot_end: tomorrowAt(12),
      description: 'Leaking kitchen tap',
      start_code: '5530',
      price: null,
      deposit_amount: 0,
      service: { slug: 'tap-repair', name: 'Tap repair', name_ne: 'धारा मर्मत', icon: 'droplet' },
      address: { label: 'Home', area: 'Baneshwor', city: 'Kathmandu', landmark: 'near the temple' },
      professional: { full_name: 'Ram', photo_url: null, phone: '+9779800000000', verification_status: 'verified' },
      extra_parts: [{ id: 'sample-part', description: 'New washer', amount: null, status: 'pending' }],
      payments: [],
      is_urgent: false,
      urgent_fee: 0,
      task: null,
      ratings: [],
    },
    {
      id: 'sample-past',
      status: 'completed',
      slot_start: hoursFromNow(-24 * 6),
      slot_end: hoursFromNow(-24 * 6 + 2),
      completed_at: hoursFromNow(-24 * 6 + 1),
      description: 'Ceiling fan in the bedroom',
      start_code: '1842',
      price: null,
      deposit_amount: 0,
      service: { slug: 'fan-install', name: 'Fan installation', name_ne: 'पंखा जडान', icon: 'wind' },
      address: { label: 'Home', area: 'Baneshwor', city: 'Kathmandu', landmark: 'near the temple' },
      professional: { full_name: 'Sita', photo_url: null, phone: '+9779800000001', verification_status: 'verified' },
      extra_parts: [],
      ratings: [],
      payments: [],
      is_urgent: false,
      urgent_fee: 0,
      task: null,
    },
    {
      id: 'sample-cancelled',
      status: 'cancelled',
      slot_start: hoursFromNow(-24 * 12),
      slot_end: hoursFromNow(-24 * 12 + 2),
      cancelled_at: hoursFromNow(-24 * 13),
      cancel_reason: 'Wrong time',
      description: 'Paint one bedroom',
      start_code: '7710',
      price: null,
      deposit_amount: 0,
      service: { slug: 'room-paint', name: 'One room painting', name_ne: 'एक कोठा रङ', icon: 'edit-3' },
      address: { label: 'Home', area: 'Baneshwor', city: 'Kathmandu', landmark: null },
      professional: null,
      extra_parts: [],
      ratings: [],
      payments: [],
      is_urgent: false,
      urgent_fee: 0,
      task: null,
    },
  ];
}
