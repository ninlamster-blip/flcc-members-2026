// Kuwait's midday outdoor work ban.
//
// Every year the Public Authority for Manpower bars work in direct sunlight in
// open areas between 11:00 and 16:00, from 1 June to 31 August. It is the one
// piece of Kuwait weather that is also a law, and for anyone working outdoors
// it is the most useful thing a weather app can tell them.
//
// The dates and hours below are the standing annual rule. PAM re-issues it
// each year and could in principle move it, so the app shows this as what the
// rule says and points at PAM to confirm — it never states it as a reading of
// today's decree. Nothing here is legal advice.

export const BAN = {
  startMonth: 6, startDay: 1,   // 1 June
  endMonth: 8,   endDay: 31,    // 31 August
  fromHour: 11,                 // 11:00
  toHour: 16,                   // 16:00
  authority: 'Public Authority for Manpower (PAM)',
};

export const TIME_ZONE = 'Asia/Kuwait';

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

/**
 * A Date, read in Kuwait's own clock. Kuwait is UTC+3 all year and keeps no
 * daylight saving, but this goes through Intl rather than assuming that.
 */
export function kuwaitParts(date = new Date()) {
  const out = {};
  for (const { type, value } of PARTS.formatToParts(date)) {
    if (type !== 'literal') out[type] = Number(value);
  }
  // Midnight comes back as hour 24 from some ICU builds.
  if (out.hour === 24) out.hour = 0;
  return out;
}

function withinSeason({ month, day }) {
  if (month > BAN.startMonth && month < BAN.endMonth) return true;
  if (month === BAN.startMonth) return day >= BAN.startDay;
  if (month === BAN.endMonth) return day <= BAN.endDay;
  return false;
}

/**
 * @returns {{inSeason: boolean, active: boolean, fromHour: number, toHour: number,
 *            minutesUntilStart: number|null, minutesUntilEnd: number|null,
 *            summary: string}}
 */
export function banStatus(date = new Date()) {
  const parts = kuwaitParts(date);
  const inSeason = withinSeason(parts);
  const minutesNow = parts.hour * 60 + parts.minute;
  const start = BAN.fromHour * 60;
  const end = BAN.toHour * 60;
  const active = inSeason && minutesNow >= start && minutesNow < end;

  let minutesUntilStart = null;
  let minutesUntilEnd = null;
  if (inSeason) {
    if (active) minutesUntilEnd = end - minutesNow;
    else if (minutesNow < start) minutesUntilStart = start - minutesNow;
  }

  const summary = !inSeason
    ? 'Outside the 1 June – 31 August ban period.'
    : active
      ? 'Work in direct sun in open areas is prohibited right now.'
      : minutesUntilStart != null
        ? `Work in direct sun stops at ${BAN.fromHour}:00 today.`
        : `Today's ${BAN.fromHour}:00 – ${BAN.toHour}:00 ban has ended.`;

  return { inSeason, active, fromHour: BAN.fromHour, toHour: BAN.toHour, minutesUntilStart, minutesUntilEnd, summary };
}

/** Is this specific hour inside the ban? Used to shade the hourly strip. */
export function bannedHour(date) {
  const { month, day, hour } = kuwaitParts(date);
  return withinSeason({ month, day }) && hour >= BAN.fromHour && hour < BAN.toHour;
}
