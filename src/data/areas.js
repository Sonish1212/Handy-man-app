// Areas customers can pick on the homepage. Coordinates are approximate
// centres, used only to find the nearest area from the phone's GPS.
// Nepali names still need a native speaker's check.

export const areas = [
  // Kathmandu
  { id: 'baneshwor', name: 'Baneshwor', nameNe: 'बानेश्वर', city: 'Kathmandu', lat: 27.6915, lng: 85.342 },
  { id: 'koteshwor', name: 'Koteshwor', nameNe: 'कोटेश्वर', city: 'Kathmandu', lat: 27.6789, lng: 85.3492 },
  { id: 'tinkune', name: 'Tinkune', nameNe: 'तीनकुने', city: 'Kathmandu', lat: 27.6857, lng: 85.3463 },
  { id: 'sinamangal', name: 'Sinamangal', nameNe: 'सिनामंगल', city: 'Kathmandu', lat: 27.699, lng: 85.355 },
  { id: 'gaushala', name: 'Gaushala', nameNe: 'गौशाला', city: 'Kathmandu', lat: 27.7066, lng: 85.3434 },
  { id: 'chabahil', name: 'Chabahil', nameNe: 'चाबहिल', city: 'Kathmandu', lat: 27.7172, lng: 85.3463 },
  { id: 'boudha', name: 'Boudha', nameNe: 'बौद्ध', city: 'Kathmandu', lat: 27.7215, lng: 85.362 },
  { id: 'maitighar', name: 'Maitighar', nameNe: 'माइतीघर', city: 'Kathmandu', lat: 27.6946, lng: 85.3207 },
  { id: 'thapathali', name: 'Thapathali', nameNe: 'थापाथली', city: 'Kathmandu', lat: 27.69, lng: 85.319 },
  { id: 'new-road', name: 'New Road', nameNe: 'न्युरोड', city: 'Kathmandu', lat: 27.7041, lng: 85.3083 },
  { id: 'thamel', name: 'Thamel', nameNe: 'ठमेल', city: 'Kathmandu', lat: 27.7154, lng: 85.3123 },
  { id: 'lazimpat', name: 'Lazimpat', nameNe: 'लाजिम्पाट', city: 'Kathmandu', lat: 27.7213, lng: 85.322 },
  { id: 'maharajgunj', name: 'Maharajgunj', nameNe: 'महाराजगञ्ज', city: 'Kathmandu', lat: 27.7369, lng: 85.33 },
  { id: 'balaju', name: 'Balaju', nameNe: 'बालाजु', city: 'Kathmandu', lat: 27.734, lng: 85.3009 },
  { id: 'kalimati', name: 'Kalimati', nameNe: 'कालीमाटी', city: 'Kathmandu', lat: 27.6985, lng: 85.2986 },
  { id: 'kalanki', name: 'Kalanki', nameNe: 'कलंकी', city: 'Kathmandu', lat: 27.6935, lng: 85.2817 },
  // Lalitpur
  { id: 'kupondole', name: 'Kupondole', nameNe: 'कुपन्डोल', city: 'Lalitpur', lat: 27.6855, lng: 85.317 },
  { id: 'pulchowk', name: 'Pulchowk', nameNe: 'पुल्चोक', city: 'Lalitpur', lat: 27.6782, lng: 85.3168 },
  { id: 'sanepa', name: 'Sanepa', nameNe: 'सानेपा', city: 'Lalitpur', lat: 27.685, lng: 85.306 },
  { id: 'jawalakhel', name: 'Jawalakhel', nameNe: 'जावलाखेल', city: 'Lalitpur', lat: 27.6727, lng: 85.3141 },
  { id: 'satdobato', name: 'Satdobato', nameNe: 'सातदोबाटो', city: 'Lalitpur', lat: 27.6585, lng: 85.3247 },
  // Bhaktapur
  { id: 'thimi', name: 'Thimi', nameNe: 'ठिमी', city: 'Bhaktapur', lat: 27.6815, lng: 85.387 },
  { id: 'suryabinayak', name: 'Suryabinayak', nameNe: 'सूर्यविनायक', city: 'Bhaktapur', lat: 27.664, lng: 85.429 },
];

export const cities = ['Kathmandu', 'Lalitpur', 'Bhaktapur'];

export const DEFAULT_AREA_ID = 'baneshwor';

// Further than this from every area centre counts as outside our service area.
const MAX_DISTANCE_KM = 3;

function distanceKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// The closest area to a GPS point, or null when none is within maxKm.
export function nearestArea(point, maxKm = MAX_DISTANCE_KM) {
  let best = null;
  let bestKm = Infinity;
  for (const area of areas) {
    const km = distanceKm(point, area);
    if (km < bestKm) {
      best = area;
      bestKm = km;
    }
  }
  return bestKm <= maxKm ? best : null;
}
