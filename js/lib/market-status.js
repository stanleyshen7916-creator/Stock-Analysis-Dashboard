const TAIPEI_TIME_ZONE = 'Asia/Taipei';
const SESSION_OPEN_MINUTES = 9 * 60;
const SESSION_CLOSE_MINUTES = 13 * 60 + 30;

function taipeiParts(now) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TAIPEI_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  return {
    weekday: parts.weekday,
    minutesOfDay: (Number(parts.hour) * 60) + Number(parts.minute)
  };
}

/**
 * Approximate TWSE/TPEx session status from local wall-clock time.
 * This is a simplification: it does not consult the trading_calendar
 * table, so market holidays are not accounted for.
 */
export function getMarketStatus(now = new Date()) {
  const { weekday, minutesOfDay } = taipeiParts(now);
  const isWeekday = !['Sat', 'Sun'].includes(weekday);
  const isSessionHours = minutesOfDay >= SESSION_OPEN_MINUTES && minutesOfDay < SESSION_CLOSE_MINUTES;
  return isWeekday && isSessionHours ? 'OPEN' : 'CLOSED';
}

/**
 * Compares the latest available trading date against "today" in Taipei
 * time to flag potentially stale dashboard data.
 */
export function getDataFreshness({ latestTradingDate, now = new Date(), staleAfterDays = 5 }) {
  if (!latestTradingDate) return 'UNKNOWN';
  const todayLabel = new Intl.DateTimeFormat('en-CA', { timeZone: TAIPEI_TIME_ZONE }).format(now);
  const latest = Date.parse(`${latestTradingDate}T00:00:00Z`);
  const today = Date.parse(`${todayLabel}T00:00:00Z`);
  if (Number.isNaN(latest) || Number.isNaN(today)) return 'UNKNOWN';
  const ageInDays = Math.round((today - latest) / (24 * 60 * 60 * 1000));
  if (ageInDays < 0) return 'UNKNOWN';
  return ageInDays > staleAfterDays ? 'STALE' : 'FRESH';
}
