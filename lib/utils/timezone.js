// Timezone handling for the DATE/DATEONLY data types and the Postgres session
// timezone, backed by `Intl` rather than a date library.
//
// The `timezone` connection option accepts two shapes -- a UTC offset ('+05:30')
// and an IANA zone name ('America/Los_Angeles') -- which are handled differently
// almost everywhere, so telling them apart is the primitive the rest of this
// module is built on.

const OFFSET_RE = /^[+-]\d{2}(?::?\d{2})?$/;

/**
 * Whether `timezone` names an IANA zone, as opposed to a UTC offset.
 *
 * `Intl.DateTimeFormat` accepts offsets ('+07:00') as timeZone identifiers, so a
 * bare try/catch would report them as zones. Callers depend on the distinction:
 * Postgres reads a bare offset under the POSIX convention, so routing one to the
 * named-zone branch of `SET TIME ZONE` silently inverts its sign.
 *
 * @param {string} timezone - a zone name or UTC offset
 * @returns {boolean} true only for IANA zone names
 * @private
 */
export function isIanaZone(timezone) {
  if (typeof timezone !== 'string' || OFFSET_RE.test(timezone)) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });

    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a UTC offset into minutes east of UTC.
 *
 * Accepts '+HH', '+HH:MM' and '+HHMM'. The optional trailing ':SS' only ever
 * appears in `Intl`'s longOffset output for pre-1900 local mean times, and is
 * truncated to whole minutes.
 *
 * @param {string} timezone - a UTC offset
 * @returns {number|null} minutes east of UTC, or null if unparseable
 * @private
 */
export function parseOffsetMinutes(timezone) {
  const match = /^([+-])(\d{2}):?(\d{2})?(?::\d{2})?$/.exec(timezone);

  if (!match) {
    return null;
  }

  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] || 0));
}

// Formatter construction dominates the cost of an offset lookup, and _stringify
// runs once per date per query.
const zoneFormatters = new Map();

/**
 * The UTC offset an IANA zone was on at a given instant, in minutes east of UTC.
 *
 * @param {Date} date - the instant to resolve the offset at, so DST is honoured
 * @param {string} timezone - an IANA zone name
 * @returns {number} minutes east of UTC
 * @private
 */
export function zoneOffsetMinutes(date, timezone) {
  let formatter = zoneFormatters.get(timezone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' });
    zoneFormatters.set(timezone, formatter);
  }

  const name = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName').value;

  // Zones sitting at UTC render as a bare 'GMT' rather than 'GMT+00:00'
  return name === 'GMT' ? 0 : parseOffsetMinutes(name.slice(3));
}

function pad(value, width = 2) {
  return String(Math.abs(value)).padStart(width, '0');
}

/**
 * Render minutes east of UTC as '+HH:mm'.
 *
 * @param {number} minutes - minutes east of UTC
 * @returns {string} the formatted offset
 * @private
 */
export function formatOffset(minutes) {
  return `${minutes < 0 ? '-' : '+'}${pad((minutes / 60) | 0)}:${pad(minutes % 60)}`;
}

/**
 * Render an instant as 'YYYY-MM-DD HH:mm:ss.SSS +HH:mm' at the given offset.
 *
 * @param {Date} date - the instant to render
 * @param {number} offsetMinutes - minutes east of UTC
 * @returns {string} the formatted timestamp
 * @private
 */
export function formatWithOffset(date, offsetMinutes) {
  // Shift the instant by the offset so the UTC getters read out local wall clock
  const shifted = new Date(date.getTime() + offsetMinutes * 60000);

  return (
    `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ` +
    `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}.` +
    `${pad(shifted.getUTCMilliseconds(), 3)} ${formatOffset(offsetMinutes)}`
  );
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Coerce a value to a Date, reading a bare 'YYYY-MM-DD' as local midnight.
 *
 * `new Date` reads a date-only string as UTC midnight, which lands on a different
 * instant than the local midnight every other date-only path here uses -- a where
 * clause on a DATE column would silently shift by the host's offset.
 *
 * @param {Date|string|number} value - the value to coerce
 * @returns {Date} the parsed instant
 * @private
 */
export function toDate(value) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' && DATE_ONLY_RE.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(0);

    // Via setFullYear so years 0-99 are not remapped into the 1900s
    date.setFullYear(year, month - 1, day);
    date.setHours(0, 0, 0, 0);

    return date;
  }

  return new Date(value);
}

/**
 * Reduce a value to its 'YYYY-MM-DD' calendar day in local time.
 *
 * A bare 'YYYY-MM-DD' string is passed through untouched: `new Date` reads it as
 * UTC midnight, which renders as the previous day anywhere west of UTC.
 *
 * @param {Date|string|number} value - the value to reduce
 * @returns {string} the calendar day
 * @private
 */
export function formatDateOnly(value) {
  if (typeof value === 'string' && DATE_ONLY_RE.test(value)) {
    return value;
  }

  const date = toDate(value);

  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
