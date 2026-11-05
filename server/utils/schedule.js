// server/utils/schedule.js

/**
 * Pure function: generate a list of date strings (YYYY-MM-DD) for bulk topic creation.
 *
 * BR-13: Starting on startDate, take the next `count` dates whose weekday is in
 * meetingDays, in order (the start date counts if it matches). Returns an array
 * of ISO date strings.
 *
 * @param {number} count - number of dates to generate (1-40)
 * @param {string} startDate - "YYYY-MM-DD"
 * @param {number[]} meetingDays - weekday numbers (0=Sun..6=Sat)
 * @param {string} [timezone='Asia/Manila'] - IANA timezone for weekday calculation
 * @returns {string[]} array of "YYYY-MM-DD" date strings
 */
export function generateSchedule(count, startDate, meetingDays, timezone = 'Asia/Manila') {
  if (count < 1) return [];
  if (!startDate) return [];

  const daySet = new Set(meetingDays);
  const result = [];

  // Parse startDate
  const [y, m, d] = startDate.split('-').map(Number);
  const current = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)); // noon UTC to avoid DST

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const maxIterations = count * 7 + 7; // safety bound
  let iterations = 0;

  while (result.length < count && iterations < maxIterations) {
    iterations++;
    const parts = formatter.formatToParts(current);
    const weekdayName = parts.find((p) => p.type === 'weekday').value;
    const weekdayNum = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName);

    if (daySet.has(weekdayNum)) {
      const year = parts.find((p) => p.type === 'year').value;
      const month = parts.find((p) => p.type === 'month').value;
      const day = parts.find((p) => p.type === 'day').value;
      result.push(`${year}-${month}-${day}`);
    }

    // Advance by one day
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}