// Built-in copy of the catalogue and booking rules, used when Supabase isn't
// connected (demo mode) or can't be reached. The real values live in the
// database (migration 20261027000000_booking_flow.sql); keep the two in step.

export const DEFAULT_SETTINGS = {
  advance_amount: 200,
  asap_fee: 100,
  travel_fee: 150,
  visit_charge: 200,
  free_cancel_hours: 3,
  min_notice_hours: 2,
  slot_hours: 2,
  day_start_hour: 8,
  day_end_hour: 18,
  days_ahead: 7,
  slot_capacity: 2,
  asap_promise_hours: 2,
  esewa_id: null,
  khalti_id: null,
};

// What a visit includes when a service has no list of its own.
export const DEFAULT_INCLUDES = [
  'A verified professional visits at your chosen time',
  'The job done with their own tools',
  'Clean-up after the work',
];
export const DEFAULT_EXCLUDES = ['Parts and materials (you approve each one in the app first)'];

const t = (slug, name, name_ne, duration_minutes) => ({ id: slug, slug, name, name_ne, duration_minutes, price: null });
const somethingElse = t('something-else', 'Something else', 'अन्य काम', 60);

export const LOCAL_SERVICES = {
  plumber: { name: 'Plumber', name_ne: 'प्लम्बर', icon: 'droplet', pricing_type: 'fixed_price' },
  electrician: { name: 'Electrician', name_ne: 'इलेक्ट्रिसियन', icon: 'zap', pricing_type: 'fixed_price' },
  painter: { name: 'Painter', name_ne: 'पेन्टर', icon: 'edit-3', pricing_type: 'fixed_price' },
  'tile-marble': { name: 'Tile and marble', name_ne: 'टायल र मार्बल', icon: 'grid', pricing_type: 'quote_first' },
  'ac-appliance': { name: 'AC and appliances', name_ne: 'एसी र उपकरण', icon: 'wind', pricing_type: 'fixed_price' },
  'water-purifier': { name: 'Water purifier', name_ne: 'पानी फिल्टर', icon: 'filter', pricing_type: 'fixed_price' },
  'labour-mistri': { name: 'Labour and mistri', name_ne: 'ज्यामी र मिस्त्री', icon: 'tool', pricing_type: 'day_rate' },
  'home-cleaning': {
    name: 'Home cleaning',
    name_ne: 'घर सफाइ',
    icon: 'home',
    pricing_type: 'fixed_price',
    includes: ['Deep clean of rooms, kitchen and bathrooms', 'Cleaning materials and equipment', 'Dusting fans, windows and shelves'],
    excludes: ['Moving heavy furniture', 'Outside walls and roof'],
  },
  'general-cleaning': {
    name: 'General cleaning',
    name_ne: 'सामान्य सफाइ',
    icon: 'check-square',
    pricing_type: 'fixed_price',
    includes: ['Sweeping, mopping and dusting', 'Kitchen and bathroom wipe-down', 'Cleaning materials'],
    excludes: ['Deep stain removal', 'Moving heavy furniture'],
  },
  other: {
    name: 'Other services',
    name_ne: 'अन्य सेवाहरू',
    icon: 'grid',
    pricing_type: 'quote_first',
    includes: ['A professional visits and checks the job', 'A clear price before any work starts'],
    excludes: ['Work you have not approved'],
  },
};

export const LOCAL_TASKS = {
  plumber: [
    t('tap-repair', 'Tap repair', 'धारा मर्मत', 60),
    t('pipe-leak', 'Pipe leak repair', 'पाइप चुहावट मर्मत', 90),
    t('tap-fitting', 'New tap fitting', 'नयाँ धारा जडान', 60),
    t('toilet', 'Toilet repair', 'शौचालय मर्मत', 90),
    t('geyser', 'Geyser repair', 'गिजर मर्मत', 90),
    somethingElse,
  ],
  electrician: [
    t('switch-socket', 'Switch or socket repair', 'स्विच वा सकेट मर्मत', 45),
    t('fan', 'Fan installation', 'पंखा जडान', 60),
    t('light', 'Light fitting', 'बत्ती जडान', 45),
    t('wiring', 'Wiring fault', 'वायरिङ समस्या', 90),
    somethingElse,
  ],
  painter: [
    t('one-room', 'One room painting', 'एक कोठा रङ', 480),
    t('touch-up', 'Wall touch-up', 'भित्ता मर्मत रङ', 180),
    t('outside', 'Outside walls', 'बाहिरी भित्ता', 480),
    somethingElse,
  ],
  'tile-marble': [
    t('inspection', 'Visit and quote', 'निरीक्षण र मूल्य', 60),
    t('broken-tile', 'Broken tile replacement', 'टुटेको टायल फेर्ने', 120),
    somethingElse,
  ],
  'ac-appliance': [
    t('ac-service', 'AC service', 'एसी सर्भिस', 60),
    t('ac-repair', 'AC repair', 'एसी मर्मत', 90),
    t('fridge', 'Fridge repair', 'फ्रिज मर्मत', 90),
    t('washing-machine', 'Washing machine repair', 'वासिङ मेसिन मर्मत', 90),
    t('heater', 'Room heater repair', 'हिटर मर्मत', 60),
    somethingElse,
  ],
  'water-purifier': [
    t('service', 'Filter change and service', 'फिल्टर सर्भिस', 45),
    t('install', 'New purifier installation', 'नयाँ फिल्टर जडान', 60),
    t('repair', 'Purifier repair', 'फिल्टर मर्मत', 60),
    somethingElse,
  ],
  'labour-mistri': [
    t('helper-half', 'Helper, half day', 'ज्यामी, आधा दिन', 240),
    t('helper-full', 'Helper, full day', 'ज्यामी, पूरा दिन', 480),
    t('mistri-full', 'Mistri, full day', 'मिस्त्री, पूरा दिन', 480),
  ],
  'home-cleaning': [
    t('1bhk', '1 BHK deep clean', '१ बीएचके सफाइ', 180),
    t('2bhk', '2 BHK deep clean', '२ बीएचके सफाइ', 240),
    t('3bhk', '3 BHK deep clean', '३ बीएचके सफाइ', 300),
    t('full-house', 'Full house deep clean', 'पूरा घर सफाइ', 480),
  ],
  'general-cleaning': [
    t('2-hours', '2 hours', '२ घण्टा', 120),
    t('4-hours', '4 hours', '४ घण्टा', 240),
    t('full-day', 'Full day', 'पूरा दिन', 480),
  ],
  other: [t('describe', 'Tell us what you need', 'के चाहिन्छ भन्नुहोस्', 60)],
};

export function formatDuration(minutes) {
  if (!minutes) return null;
  if (minutes >= 480) return 'a full day';
  if (minutes >= 240 && minutes % 60 === 0) return `${minutes / 60} hours`;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} hour${hours === 1 ? '' : 's'}`;
}
