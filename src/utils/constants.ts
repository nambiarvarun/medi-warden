// App constants
export const APP_NAME = 'Medi-Warden';
export const APP_VERSION = '1.0.0';

// Database
export const DATABASE_NAME = 'mediwarden.db';
export const DATABASE_VERSION = 2;

// Default settings
export const DEFAULT_SNOOZE_DURATION = 15; // minutes
export const DEFAULT_STOCK_REMINDER_THRESHOLD = 7; // days worth
export const AUTO_MISS_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours in ms

// Snooze options (in minutes)
export const SNOOZE_OPTIONS = [5, 10, 15, 30] as const;

// Schedule types
export const SCHEDULE_TYPES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  INTERVAL: 'interval',
} as const;

// Days of week (0 = Sunday)
export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun', fullLabel: 'Sunday' },
  { value: 1, label: 'Mon', fullLabel: 'Monday' },
  { value: 2, label: 'Tue', fullLabel: 'Tuesday' },
  { value: 3, label: 'Wed', fullLabel: 'Wednesday' },
  { value: 4, label: 'Thu', fullLabel: 'Thursday' },
  { value: 5, label: 'Fri', fullLabel: 'Friday' },
  { value: 6, label: 'Sat', fullLabel: 'Saturday' },
] as const;

// Notification channels
export const NOTIFICATION_CHANNEL = {
  REMINDER: 'medication-reminders',
  REFILL: 'refill-alerts',
  ALARM: 'medication-alarms',
} as const;

// Dose statuses
export const DOSE_STATUS = {
  TAKEN: 'taken',
  SKIPPED: 'skipped',
  MISSED: 'missed',
  PENDING: 'pending',
} as const;

// Reminder modes
export const REMINDER_MODE = {
  STRICT: 'strict',
  RELAXED: 'relaxed',
} as const;
