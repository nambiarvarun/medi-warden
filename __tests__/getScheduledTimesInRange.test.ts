/**
 * Tests for getScheduledTimesInRange — the core function that determines
 * which notification times are generated for a given date range.
 *
 * This is the single most critical function in the app: if it drops a time,
 * the user misses a medication reminder.
 */

import {
  getScheduledTimesInRange,
  createDateFromTime,
} from '../src/utils/dateUtils';

// Helper: build a Date at a specific date+time for deterministic tests
function makeDate(year: number, month: number, day: number, h = 0, m = 0, s = 0): Date {
  return new Date(year, month - 1, day, h, m, s, 0);
}

describe('getScheduledTimesInRange', () => {
  // ───── Daily schedules ─────

  describe('daily schedule', () => {
    it('returns times for each day in range', () => {
      const start = makeDate(2026, 2, 7, 0, 0);
      const end = makeDate(2026, 2, 9, 23, 59);
      const times = getScheduledTimesInRange(start, end, ['09:00', '21:00'], 'daily');
      // 3 days × 2 times = 6
      expect(times).toHaveLength(6);
    });

    it('includes a time at the exact start boundary (>= fix)', () => {
      // User creates medication at exactly 19:50 — the 19:50 slot must be included
      const start = makeDate(2026, 2, 7, 19, 50, 0);
      const end = makeDate(2026, 2, 14, 19, 50, 0);
      const times = getScheduledTimesInRange(start, end, ['19:50'], 'daily');
      // The first result should be today at 19:50 (>= boundary)
      expect(times.length).toBeGreaterThanOrEqual(1);
      expect(times[0].getHours()).toBe(19);
      expect(times[0].getMinutes()).toBe(50);
      expect(times[0].getDate()).toBe(7);
    });

    it('includes a time at the exact end boundary (<= fix)', () => {
      const start = makeDate(2026, 2, 7, 0, 0);
      const end = makeDate(2026, 2, 7, 21, 0, 0);
      // endOfDay(end) = 2026-02-07T23:59:59.999 so 21:00 should be included
      const times = getScheduledTimesInRange(start, end, ['21:00'], 'daily');
      expect(times).toHaveLength(1);
      expect(times[0].getHours()).toBe(21);
    });

    it('excludes times before the start boundary', () => {
      // Start at 15:00, only 21:00 should be included for today
      const start = makeDate(2026, 2, 7, 15, 0);
      const end = makeDate(2026, 2, 7, 23, 59);
      const times = getScheduledTimesInRange(start, end, ['09:00', '21:00'], 'daily');
      // 09:00 is before 15:00 start, should be excluded
      expect(times).toHaveLength(1);
      expect(times[0].getHours()).toBe(21);
    });

    it('returns empty array when no times fall in range', () => {
      // Start after last time of day
      const start = makeDate(2026, 2, 7, 22, 0);
      const end = makeDate(2026, 2, 7, 23, 59);
      const times = getScheduledTimesInRange(start, end, ['09:00', '15:00'], 'daily');
      expect(times).toHaveLength(0);
    });

    it('handles single-day range correctly', () => {
      const start = makeDate(2026, 2, 7, 0, 0);
      const end = makeDate(2026, 2, 7, 23, 59);
      const times = getScheduledTimesInRange(start, end, ['08:00', '14:00', '20:00'], 'daily');
      expect(times).toHaveLength(3);
    });

    it('returns results sorted by time', () => {
      const start = makeDate(2026, 2, 7, 0, 0);
      const end = makeDate(2026, 2, 9, 23, 59);
      const times = getScheduledTimesInRange(start, end, ['21:00', '09:00'], 'daily');
      for (let i = 1; i < times.length; i++) {
        expect(times[i].getTime()).toBeGreaterThanOrEqual(times[i - 1].getTime());
      }
    });

    it('handles empty timesOfDay gracefully', () => {
      const start = makeDate(2026, 2, 7, 0, 0);
      const end = makeDate(2026, 2, 14, 23, 59);
      const times = getScheduledTimesInRange(start, end, [], 'daily');
      expect(times).toHaveLength(0);
    });
  });

  // ───── Weekly schedules ─────

  describe('weekly schedule', () => {
    it('only includes specified days of week', () => {
      // Feb 7 2026 is a Saturday (day 6)
      // Feb 8 is Sunday (0), Feb 9 Mon (1), Feb 10 Tue (2)...
      const start = makeDate(2026, 2, 7, 0, 0);
      const end = makeDate(2026, 2, 13, 23, 59);  // 7 days
      // Only Monday (1) and Friday (5)
      const times = getScheduledTimesInRange(start, end, ['09:00'], 'weekly', {
        daysOfWeek: [1, 5],
      });
      // Mon Feb 9 and Fri Feb 13
      expect(times).toHaveLength(2);
      expect(times[0].getDay()).toBe(1); // Monday
      expect(times[1].getDay()).toBe(5); // Friday
    });

    it('returns empty when no matching day in range', () => {
      // Feb 7 is Saturday, only check for Wednesday (3)
      const start = makeDate(2026, 2, 7, 0, 0);
      const end = makeDate(2026, 2, 8, 23, 59);
      const times = getScheduledTimesInRange(start, end, ['09:00'], 'weekly', {
        daysOfWeek: [3], // Wednesday
      });
      expect(times).toHaveLength(0);
    });

    it('includes all times on matching days', () => {
      // Feb 9 2026 is Monday
      const start = makeDate(2026, 2, 9, 0, 0);
      const end = makeDate(2026, 2, 9, 23, 59);
      const times = getScheduledTimesInRange(start, end, ['08:00', '14:00', '20:00'], 'weekly', {
        daysOfWeek: [1], // Monday
      });
      expect(times).toHaveLength(3);
    });

    it('returns empty when daysOfWeek is not provided', () => {
      const start = makeDate(2026, 2, 7, 0, 0);
      const end = makeDate(2026, 2, 14, 23, 59);
      const times = getScheduledTimesInRange(start, end, ['09:00'], 'weekly', {});
      expect(times).toHaveLength(0);
    });
  });

  // ───── Interval schedules ─────

  describe('interval schedule', () => {
    it('includes only days matching the interval from start date', () => {
      // Schedule started Feb 5, interval = 3 days → Feb 5, 8, 11, 14...
      const scheduleStartDate = makeDate(2026, 2, 5, 0, 0);
      const start = makeDate(2026, 2, 7, 0, 0);
      const end = makeDate(2026, 2, 14, 23, 59);
      const times = getScheduledTimesInRange(start, end, ['09:00'], 'interval', {
        intervalDays: 3,
        scheduleStartDate,
      });
      // Feb 8 (day 3) and Feb 11 (day 6) and Feb 14 (day 9)
      expect(times).toHaveLength(3);
      expect(times[0].getDate()).toBe(8);
      expect(times[1].getDate()).toBe(11);
      expect(times[2].getDate()).toBe(14);
    });

    it('returns empty when interval is not provided', () => {
      const start = makeDate(2026, 2, 7, 0, 0);
      const end = makeDate(2026, 2, 14, 23, 59);
      const times = getScheduledTimesInRange(start, end, ['09:00'], 'interval', {});
      expect(times).toHaveLength(0);
    });

    it('handles interval of 1 (same as daily)', () => {
      const scheduleStartDate = makeDate(2026, 2, 1, 0, 0);
      const start = makeDate(2026, 2, 7, 0, 0);
      const end = makeDate(2026, 2, 9, 23, 59);
      const times = getScheduledTimesInRange(start, end, ['09:00'], 'interval', {
        intervalDays: 1,
        scheduleStartDate,
      });
      expect(times).toHaveLength(3); // 3 days
    });

    it('excludes days before scheduleStartDate', () => {
      const scheduleStartDate = makeDate(2026, 2, 10, 0, 0);
      const start = makeDate(2026, 2, 7, 0, 0);
      const end = makeDate(2026, 2, 12, 23, 59);
      const times = getScheduledTimesInRange(start, end, ['09:00'], 'interval', {
        intervalDays: 1,
        scheduleStartDate,
      });
      // Only Feb 10, 11, 12
      expect(times).toHaveLength(3);
      expect(times[0].getDate()).toBe(10);
    });
  });

  // ───── Edge cases ─────

  describe('edge cases', () => {
    it('exact same-second start creates notification (the v1.13 bug fix)', () => {
      // Simulate: user creates med at 19:50:30, schedule time is 19:50
      // createDateFromTime sets seconds/ms to 0 for the time, while start has :30
      // The scheduled time (19:50:00) must be >= start (19:50:30)?
      // Actually start is passed as `new Date()` in the scheduler which is 19:50:30
      // and createDateFromTime("19:50", startOfDay) gives 19:50:00
      // Since startOfDay(start) = 00:00 of that day, 19:50:00 >= 19:50:30 is false
      // But the scheduler passes `now` (19:50:30) as start, not startOfDay
      // So 19:50:00 < 19:50:30 → excluded. This is correct! The time already passed.
      // However, if the user creates at exactly 19:50:00...
      const start = makeDate(2026, 2, 7, 19, 50, 0); // exactly 19:50:00
      const end = makeDate(2026, 2, 14, 19, 50, 0);
      const times = getScheduledTimesInRange(start, end, ['19:50'], 'daily');
      // 19:50:00 >= 19:50:00 → should be included (the >= fix)
      expect(times[0].getTime()).toBe(start.getTime());
    });

    it('midnight times work correctly', () => {
      const start = makeDate(2026, 2, 7, 0, 0);
      const end = makeDate(2026, 2, 8, 23, 59);
      const times = getScheduledTimesInRange(start, end, ['00:00', '23:59'], 'daily');
      // Day 7: 00:00 (>= 00:00) and 23:59; Day 8: 00:00 and 23:59
      expect(times).toHaveLength(4);
    });

    it('handles multi-week range', () => {
      const start = makeDate(2026, 2, 1, 0, 0);
      const end = makeDate(2026, 2, 28, 23, 59);
      const times = getScheduledTimesInRange(start, end, ['12:00'], 'daily');
      expect(times).toHaveLength(28);
    });

    it('start and end on same day, time within range', () => {
      const start = makeDate(2026, 2, 7, 8, 0);
      const end = makeDate(2026, 2, 7, 10, 0);
      const times = getScheduledTimesInRange(start, end, ['09:00'], 'daily');
      expect(times).toHaveLength(1);
    });

    it('start and end on same day, time outside range', () => {
      const start = makeDate(2026, 2, 7, 8, 0);
      const end = makeDate(2026, 2, 7, 8, 30);
      // endOfDay(end) = 23:59:59 of Feb 7 → 09:00 is actually in range
      // because endOfDay expands the end. This is how the function works.
      const times = getScheduledTimesInRange(start, end, ['09:00'], 'daily');
      expect(times).toHaveLength(1); // endOfDay makes it 23:59:59
    });
  });
});
