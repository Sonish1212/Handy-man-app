// Booking times are always Nepal time (UTC+5:45, no daylight saving),
// whatever time zone the phone is set to, so a slot shows as "10 am" for the
// customer, the team and the professional alike.

const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Calendar parts of an instant as seen in Nepal.
export function nepalParts(input) {
  const shifted = new Date(new Date(input).getTime() + NEPAL_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

// The instant for a Nepal calendar date and hour.
export function nepalDate(year, month, day, hour = 0) {
  return new Date(Date.UTC(year, month, day, hour) - NEPAL_OFFSET_MS);
}

// Whole days between two instants' Nepal calendar dates (b - a).
function nepalDayDiff(a, b) {
  const pa = nepalParts(a);
  const pb = nepalParts(b);
  return Math.round((Date.UTC(pb.year, pb.month, pb.day) - Date.UTC(pa.year, pa.month, pa.day)) / 86400000);
}

export function dayLabel(input, now = new Date()) {
  const diff = nepalDayDiff(now, input);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const p = nepalParts(input);
  return `${DAYS[p.weekday]} ${p.day} ${MONTHS[p.month]}`;
}

export function shortDayParts(input, now = new Date()) {
  const p = nepalParts(input);
  const diff = nepalDayDiff(now, input);
  return {
    top: diff === 0 ? 'Today' : diff === 1 ? 'Tmrw' : DAYS[p.weekday],
    bottom: `${p.day} ${MONTHS[p.month]}`,
  };
}

function hourLabel(input, withPeriod = true) {
  const { hour, minute } = nepalParts(input);
  const h12 = hour % 12 || 12;
  const time = minute ? `${h12}:${String(minute).padStart(2, '0')}` : `${h12}`;
  return withPeriod ? `${time} ${hour < 12 ? 'am' : 'pm'}` : time;
}

// "10 am–12 pm" or "8–10 am"
export function formatRange(startIso, endIso) {
  const samePeriod = nepalParts(startIso).hour < 12 === nepalParts(endIso).hour < 12;
  return samePeriod
    ? `${hourLabel(startIso, false)}–${hourLabel(endIso)}`
    : `${hourLabel(startIso)}–${hourLabel(endIso)}`;
}

// "Today, 2:15 pm": when something happened, for booking histories.
export function formatMoment(iso) {
  return `${dayLabel(iso)}, ${hourLabel(iso)}`;
}

// "Tomorrow, 10 am–12 pm"
export function formatSlot(startIso, endIso) {
  return `${dayLabel(startIso)}, ${formatRange(startIso, endIso)}`;
}

// The days a customer can book, each with its time slots, following the
// rules in booking_settings. Slots under the minimum notice are marked
// unavailable, and full slots (from slot_counts) too.
export function buildSlotDays(settings, bookedCounts = {}, now = new Date()) {
  const today = nepalParts(now);
  const earliest = now.getTime() + settings.min_notice_hours * 3600 * 1000;
  const days = [];
  for (let offset = 0; offset <= settings.days_ahead; offset++) {
    const slots = [];
    for (let hour = settings.day_start_hour; hour + settings.slot_hours <= settings.day_end_hour; hour += settings.slot_hours) {
      const start = nepalDate(today.year, today.month, today.day + offset, hour);
      const end = new Date(start.getTime() + settings.slot_hours * 3600 * 1000);
      if (start.getTime() > now.getTime() + settings.days_ahead * 86400000) continue;
      const full = (bookedCounts[start.toISOString()] ?? 0) >= settings.slot_capacity;
      slots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        available: start.getTime() >= earliest && !full,
        full,
      });
    }
    if (slots.length) days.push({ date: nepalDate(today.year, today.month, today.day + offset, 12).toISOString(), slots });
  }
  // Drop leading days with nothing left to book (for example late in the day).
  while (days.length && !days[0].slots.some((slot) => slot.available)) days.shift();
  return days;
}

// Whether "as soon as possible" can be offered right now (working hours,
// with time left for the promised arrival window).
export function asapOpenNow(settings, now = new Date()) {
  const { hour } = nepalParts(now);
  return hour >= settings.day_start_hour && hour < settings.day_end_hour - settings.asap_promise_hours;
}
