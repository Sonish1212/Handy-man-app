// Homepage content. Everything here is placeholder copy from the design pack:
// prices stay as "Rs [price]" and the Nepali wording still needs a native
// speaker's check before anything goes public (design pack, section 9).
//
// Photos are matched to items in ./photos. The customer's area lives in
// ./areas and lib/location.

export const promos = [
  {
    id: 'tap',
    service: 'plumber',
    tag: 'Book for tomorrow',
    title: 'Leaking tap? A plumber at your door tomorrow',
    titleNe: 'धारा चुहियो? भोलि नै प्लम्बर घरमा',
    cta: 'Book a plumber',
    icon: 'droplet',
  },
  {
    id: 'paint',
    service: 'painter',
    tag: 'Festival season',
    title: 'Fresh walls before Dashain and Tihar',
    titleNe: 'दशैं र तिहारअघि नयाँ रङ',
    cta: 'Book a painter',
    icon: 'edit-3',
  },
  {
    id: 'ac',
    service: 'ac-appliance',
    tag: 'Fixed prices',
    title: 'AC and appliance repair, price shown upfront',
    titleNe: 'एसी र उपकरण मर्मत, मूल्य पहिल्यै थाहा',
    cta: 'See prices',
    icon: 'wind',
  },
];

export const services = [
  { id: 'plumber', name: 'Plumber', nameNe: 'प्लम्बर', icon: 'droplet' },
  { id: 'electrician', name: 'Electrician', nameNe: 'इलेक्ट्रिसियन', icon: 'zap' },
  { id: 'painter', name: 'Painter', nameNe: 'पेन्टर', icon: 'edit-3' },
  { id: 'tile-marble', name: 'Tile and marble', nameNe: 'टायल र मार्बल', icon: 'grid' },
  { id: 'ac-appliance', name: 'AC and appliances', nameNe: 'एसी र उपकरण', icon: 'wind' },
  { id: 'water-purifier', name: 'Water purifier', nameNe: 'पानी फिल्टर', icon: 'filter' },
  { id: 'labour-mistri', name: 'Labour and mistri', nameNe: 'ज्यामी र मिस्त्री', icon: 'tool' },
  { id: 'home-cleaning', name: 'Home cleaning', nameNe: 'घर सफाइ', icon: 'home' },
  { id: 'general-cleaning', name: 'General cleaning', nameNe: 'सामान्य सफाइ', icon: 'check-square' },
  { id: 'other', name: 'Other services', nameNe: 'अन्य सेवाहरू', icon: 'grid', isOther: true },
];

export const highlights = [
  {
    id: 'verified',
    title: 'Verified professionals',
    titleNe: 'प्रमाणित कामदार',
    body: 'ID and skills checked before the first job.',
    icon: 'shield',
  },
  {
    id: 'fixed',
    title: 'Clear pricing',
    titleNe: 'स्पष्ट मूल्य',
    body: 'See the job price, or agree a quote before work starts.',
    icon: 'tag',
  },
  {
    id: 'pay-after',
    title: 'Advance, then balance',
    titleNe: 'अग्रिम र बाँकी भुक्तानी',
    body: 'An online advance confirms your booking. Pay the rest after the job.',
    icon: 'credit-card',
  },
];
