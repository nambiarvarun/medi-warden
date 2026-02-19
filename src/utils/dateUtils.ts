import {
  format,
  formatDistanceToNow,
  isToday,
  isTomorrow,
  isYesterday,
  addMinutes,
  addDays,
  startOfDay,
  endOfDay,
  differenceInDays,
  setHours,
  setMinutes,
  isBefore,
  getDay,
} from 'date-fns';

/**
 * Format time based on device locale (12h or 24h)
 * React Native will respect device settings via Intl
 */
export function formatTime(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format date in a human-readable way
 */
export function formatDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;

  if (isToday(d)) {
    return 'Today';
  }
  if (isTomorrow(d)) {
    return 'Tomorrow';
  }
  if (isYesterday(d)) {
    return 'Yesterday';
  }

  return format(d, 'MMM d, yyyy');
}

/**
 * Format date and time together
 */
export function formatDateTime(date: Date | number): string {
  return `${formatDate(date)} at ${formatTime(date)}`;
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 30 minutes")
 */
export function getRelativeTime(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Parse time string "HH:mm" into hours and minutes
 */
export function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Create a Date object from a time string and a base date
 */
export function createDateFromTime(timeStr: string, baseDate: Date = new Date()): Date {
  const { hours, minutes } = parseTimeString(timeStr);
  let date = setHours(baseDate, hours);
  date = setMinutes(date, minutes);
  return date;
}

/**
 * Get the next occurrence of a time based on schedule
 */
export function getNextOccurrence(
  timeStr: string,
  scheduleType: 'daily' | 'weekly' | 'interval',
  options?: {
    daysOfWeek?: number[];
    intervalDays?: number;
    lastOccurrence?: Date;
  }
): Date {
  const now = new Date();
  let nextDate = createDateFromTime(timeStr, now);

  // If the time has passed today, start from tomorrow
  if (isBefore(nextDate, now)) {
    nextDate = addDays(nextDate, 1);
  }

  switch (scheduleType) {
    case 'daily':
      return nextDate;

    case 'weekly':
      if (options?.daysOfWeek && options.daysOfWeek.length > 0) {
        // Find the next matching day of week
        const sortedDays = [...options.daysOfWeek].sort((a, b) => a - b);
        const currentDayOfWeek = getDay(nextDate);

        // Find next day in the schedule
        let nextDay = sortedDays.find(d => d >= currentDayOfWeek);

        if (nextDay === undefined) {
          // Wrap to next week
          nextDay = sortedDays[0];
          const daysToAdd = 7 - currentDayOfWeek + nextDay;
          nextDate = addDays(nextDate, daysToAdd);
        } else if (nextDay > currentDayOfWeek) {
          nextDate = addDays(nextDate, nextDay - currentDayOfWeek);
        }
        // If nextDay === currentDayOfWeek, nextDate is already correct
      }
      return nextDate;

    case 'interval':
      if (options?.intervalDays && options?.lastOccurrence) {
        const daysSinceLastOccurrence = differenceInDays(now, options.lastOccurrence);
        const daysUntilNext = options.intervalDays - (daysSinceLastOccurrence % options.intervalDays);
        if (daysUntilNext === options.intervalDays && isBefore(nextDate, now)) {
          return nextDate; // It's due today but time hasn't passed
        }
        return addDays(createDateFromTime(timeStr, now), daysUntilNext);
      }
      return nextDate;

    default:
      return nextDate;
  }
}

/**
 * Get all scheduled times for a date range
 */
export function getScheduledTimesInRange(
  startDate: Date,
  endDate: Date,
  timesOfDay: string[],
  scheduleType: 'daily' | 'weekly' | 'interval',
  options?: {
    daysOfWeek?: number[];
    intervalDays?: number;
    scheduleStartDate?: Date;
  }
): Date[] {
  const times: Date[] = [];
  let currentDate = startOfDay(startDate);
  const rangeEnd = endOfDay(endDate);

  while (isBefore(currentDate, rangeEnd) || currentDate.getTime() === rangeEnd.getTime()) {
    const dayOfWeek = getDay(currentDate);
    let includeDay = false;

    switch (scheduleType) {
      case 'daily':
        includeDay = true;
        break;
      case 'weekly':
        includeDay = options?.daysOfWeek?.includes(dayOfWeek) ?? false;
        break;
      case 'interval':
        if (options?.intervalDays && options?.scheduleStartDate) {
          const daysSinceStart = differenceInDays(currentDate, options.scheduleStartDate);
          includeDay = daysSinceStart >= 0 && daysSinceStart % options.intervalDays === 0;
        }
        break;
    }

    if (includeDay) {
      for (const timeStr of timesOfDay) {
        const scheduledTime = createDateFromTime(timeStr, currentDate);
        // Use >= for start (include current moment) and <= for end (include end of range)
        if (scheduledTime.getTime() >= startDate.getTime() && scheduledTime.getTime() <= rangeEnd.getTime()) {
          times.push(scheduledTime);
        }
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  return times.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Calculate days worth of stock remaining
 */
export function calculateDaysOfStock(
  stockCount: number,
  dosesPerDay: number
): number {
  if (dosesPerDay <= 0) return Infinity;
  return Math.floor(stockCount / dosesPerDay);
}

/**
 * Add snooze time to current time
 */
export function getSnoozeTime(minutes: number): Date {
  return addMinutes(new Date(), minutes);
}
