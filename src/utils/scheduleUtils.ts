import { Schedule } from '../types';
import { DAYS_OF_WEEK } from './constants';

/**
 * Generate a human-readable description of a schedule
 */
export function getScheduleDescription(schedule: Schedule): string {
  const times = formatTimesOfDay(schedule.timesOfDay);

  switch (schedule.scheduleType) {
    case 'daily':
      return `Daily at ${times}`;

    case 'weekly':
      const days = formatDaysOfWeek(schedule.daysOfWeek || []);
      return `${days} at ${times}`;

    case 'interval':
      const interval = schedule.intervalDays || 1;
      if (interval === 1) {
        return `Every day at ${times}`;
      }
      return `Every ${interval} days at ${times}`;

    default:
      return `At ${times}`;
  }
}

/**
 * Format an array of time strings into a readable string
 */
export function formatTimesOfDay(times: string[]): string {
  if (times.length === 0) return '';
  if (times.length === 1) return times[0];
  if (times.length === 2) return `${times[0]} and ${times[1]}`;

  const lastTime = times[times.length - 1];
  const otherTimes = times.slice(0, -1).join(', ');
  return `${otherTimes}, and ${lastTime}`;
}

/**
 * Format days of week array into readable string
 */
export function formatDaysOfWeek(days: number[]): string {
  if (days.length === 0) return '';
  if (days.length === 7) return 'Every day';

  const sortedDays = [...days].sort((a, b) => a - b);

  // Check for common patterns
  const weekdays = [1, 2, 3, 4, 5];
  const weekends = [0, 6];

  if (arraysEqual(sortedDays, weekdays)) {
    return 'Weekdays';
  }
  if (arraysEqual(sortedDays, weekends)) {
    return 'Weekends';
  }

  // Format individual days
  const dayLabels = sortedDays.map(d => {
    const day = DAYS_OF_WEEK.find(dw => dw.value === d);
    return day?.label || '';
  });

  if (dayLabels.length === 1) return dayLabels[0];
  if (dayLabels.length === 2) return `${dayLabels[0]} and ${dayLabels[1]}`;

  const lastDay = dayLabels[dayLabels.length - 1];
  const otherDays = dayLabels.slice(0, -1).join(', ');
  return `${otherDays}, and ${lastDay}`;
}

/**
 * Calculate the number of doses per day for a schedule
 */
export function getDosesPerDay(schedule: Schedule): number {
  const timesPerDay = schedule.timesOfDay.length;

  switch (schedule.scheduleType) {
    case 'daily':
      return timesPerDay;

    case 'weekly':
      const daysPerWeek = schedule.daysOfWeek?.length || 0;
      return (timesPerDay * daysPerWeek) / 7;

    case 'interval':
      const intervalDays = schedule.intervalDays || 1;
      return timesPerDay / intervalDays;

    default:
      return timesPerDay;
  }
}

/**
 * Check if a schedule is active on a given date
 */
export function isScheduleActiveOnDate(schedule: Schedule, date: Date): boolean {
  const timestamp = date.getTime();

  // Check start date
  if (timestamp < schedule.startDate) {
    return false;
  }

  // Check end date
  if (schedule.endDate && timestamp > schedule.endDate) {
    return false;
  }

  // Check duration days
  if (schedule.durationDays) {
    const daysElapsed = Math.floor(
      (timestamp - schedule.startDate) / (24 * 60 * 60 * 1000)
    );
    if (daysElapsed >= schedule.durationDays) {
      return false;
    }
  }

  return schedule.isActive;
}

/**
 * Get the end date for a schedule (calculated from duration if needed)
 */
export function getScheduleEndDate(schedule: Schedule): Date | null {
  if (schedule.endDate) {
    return new Date(schedule.endDate);
  }

  if (schedule.durationDays) {
    const endTimestamp =
      schedule.startDate + schedule.durationDays * 24 * 60 * 60 * 1000;
    return new Date(endTimestamp);
  }

  return null; // Indefinite
}

/**
 * Validate a schedule configuration
 */
export function validateSchedule(schedule: Partial<Schedule>): string[] {
  const errors: string[] = [];

  if (!schedule.timesOfDay || schedule.timesOfDay.length === 0) {
    errors.push('At least one time of day is required');
  }

  if (!schedule.scheduleType) {
    errors.push('Schedule type is required');
  }

  if (schedule.scheduleType === 'weekly') {
    if (!schedule.daysOfWeek || schedule.daysOfWeek.length === 0) {
      errors.push('At least one day of week is required for weekly schedules');
    }
  }

  if (schedule.scheduleType === 'interval') {
    if (!schedule.intervalDays || schedule.intervalDays < 1) {
      errors.push('Interval days must be at least 1');
    }
  }

  if (!schedule.startDate) {
    errors.push('Start date is required');
  }

  // Validate time formats
  schedule.timesOfDay?.forEach((time, index) => {
    if (!/^\d{2}:\d{2}$/.test(time)) {
      errors.push(`Invalid time format at position ${index + 1}: ${time}`);
    }
  });

  return errors;
}

/**
 * Helper to check if two arrays are equal
 */
function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, idx) => val === b[idx]);
}

/**
 * Generate default times based on number of doses per day
 */
export function generateDefaultTimes(dosesPerDay: number): string[] {
  switch (dosesPerDay) {
    case 1:
      return ['09:00'];
    case 2:
      return ['09:00', '21:00'];
    case 3:
      return ['08:00', '14:00', '20:00'];
    case 4:
      return ['08:00', '12:00', '18:00', '22:00'];
    default:
      return ['09:00'];
  }
}
