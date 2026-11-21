// The "This season" section on the homepage changes by date. Each season
// covers a range of days (month * 100 + day, so 915 is 15 September) and the
// four ranges together cover the whole year.
//
// Dashain and Tihar follow the lunar calendar and move by a few weeks each
// year, so check the festival dates every year and adjust its range.
// Nepali wording still needs a native speaker's check.

export const seasons = [
  {
    id: 'festival',
    name: 'Dashain and Tihar',
    nameNe: 'दशैं र तिहार',
    from: 915,
    to: 1120,
    items: [
      {
        id: 'festival-cleaning',
        service: 'home-cleaning',
        title: 'Festival home cleaning',
        titleNe: 'चाडपर्व घर सफाइ',
        body: 'A deep clean before guests arrive for Dashain and Tihar.',
        icon: 'home',
      },
      {
        id: 'festival-paint',
        service: 'painter',
        title: 'Festival painting',
        titleNe: 'चाडपर्व रङरोगन',
        body: 'Get the house ready for Dashain and Tihar guests.',
        icon: 'sun',
      },
      {
        id: 'tihar-lights',
        service: 'electrician',
        title: 'Tihar lights and wiring',
        titleNe: 'तिहारको बत्ती जडान',
        body: 'Safe wiring for lights and decorations before Tihar.',
        icon: 'zap',
      },
    ],
  },
  {
    id: 'winter',
    name: 'Winter',
    nameNe: 'जाडो',
    from: 1121,
    to: 229,
    items: [
      {
        id: 'geyser',
        service: 'plumber',
        title: 'Geyser repair',
        titleNe: 'गिजर मर्मत',
        body: 'Hot water again before the cold mornings.',
        icon: 'thermometer',
      },
      {
        id: 'heater',
        service: 'ac-appliance',
        title: 'Room heater repair',
        titleNe: 'हिटर मर्मत',
        body: 'Heaters and appliances checked and fixed.',
        icon: 'wind',
      },
    ],
  },
  {
    id: 'summer',
    name: 'Summer',
    nameNe: 'गर्मी',
    from: 301,
    to: 531,
    items: [
      {
        id: 'ac-before-summer',
        service: 'ac-appliance',
        title: 'AC service before summer',
        titleNe: 'गर्मीअघि एसी सर्भिस',
        body: 'Clean filters and a gas check for cooler rooms.',
        icon: 'wind',
      },
      {
        id: 'purifier-service',
        service: 'water-purifier',
        title: 'Water purifier service',
        titleNe: 'पानी फिल्टर सर्भिस',
        body: 'Fresh filters for safe drinking water.',
        icon: 'filter',
      },
    ],
  },
  {
    id: 'monsoon',
    name: 'Monsoon',
    nameNe: 'वर्षायाम',
    from: 601,
    to: 914,
    items: [
      {
        id: 'leak',
        service: 'plumber',
        title: 'Monsoon leak repair',
        titleNe: 'वर्षायामको चुहावट मर्मत',
        body: 'Roof, wall and pipe leaks fixed before the next rain.',
        icon: 'cloud-rain',
      },
      {
        id: 'wiring-check',
        service: 'electrician',
        title: 'Wiring safety check',
        titleNe: 'वायरिङ सुरक्षा जाँच',
        body: 'Damp walls and old wiring checked before the rains.',
        icon: 'zap',
      },
    ],
  },
];

function inRange(dayOfYear, { from, to }) {
  // A range like winter (1121 to 229) wraps past the new year.
  return from <= to ? dayOfYear >= from && dayOfYear <= to : dayOfYear >= from || dayOfYear <= to;
}

// The season for a date (today by default), using the phone's local date.
export function getSeason(date = new Date()) {
  const dayOfYear = (date.getMonth() + 1) * 100 + date.getDate();
  return seasons.find((season) => inRange(dayOfYear, season)) ?? seasons[0];
}
