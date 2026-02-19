/**
 * Tests for isScheduleActiveOnDate — determines whether a schedule
 * should produce notifications on a given date.
 */

import { isScheduleActiveOnDate } from '../src/utils/scheduleUtils';
import { Schedule } from '../src/types';

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'sched-1',
    medicationId: 'med-1',
    scheduleType: 'daily',
    timesOfDay: ['09:00'],
    daysOfWeek: null,
    intervalDays: null,
    startDate: new Date(2026, 0, 1).getTime(), // Jan 1 2026
    endDate: null,
    durationDays: null,
    isActive: true,
    ...overrides,
  };
}

describe('isScheduleActiveOnDate', () => {
  it('returns true for a date after startDate with no end constraint', () => {
    const schedule = makeSchedule();
    const date = new Date(2026, 1, 7); // Feb 7
    expect(isScheduleActiveOnDate(schedule, date)).toBe(true);
  });

  it('returns false for a date before startDate', () => {
    const schedule = makeSchedule({
      startDate: new Date(2026, 5, 1).getTime(), // June 1
    });
    const date = new Date(2026, 1, 7); // Feb 7
    expect(isScheduleActiveOnDate(schedule, date)).toBe(false);
  });

  it('returns false for a date after endDate', () => {
    const schedule = makeSchedule({
      endDate: new Date(2026, 0, 31).getTime(), // Jan 31
    });
    const date = new Date(2026, 1, 7); // Feb 7
    expect(isScheduleActiveOnDate(schedule, date)).toBe(false);
  });

  it('returns true for a date between startDate and endDate', () => {
    const schedule = makeSchedule({
      startDate: new Date(2026, 0, 1).getTime(),
      endDate: new Date(2026, 2, 1).getTime(), // March 1
    });
    const date = new Date(2026, 1, 7); // Feb 7
    expect(isScheduleActiveOnDate(schedule, date)).toBe(true);
  });

  it('returns false when durationDays have elapsed', () => {
    const schedule = makeSchedule({
      startDate: new Date(2026, 0, 1).getTime(), // Jan 1
      durationDays: 30, // 30 days → ends Jan 31
    });
    const date = new Date(2026, 1, 7); // Feb 7 (day 37)
    expect(isScheduleActiveOnDate(schedule, date)).toBe(false);
  });

  it('returns true when within durationDays', () => {
    const schedule = makeSchedule({
      startDate: new Date(2026, 0, 1).getTime(), // Jan 1
      durationDays: 60, // 60 days
    });
    const date = new Date(2026, 1, 7); // Feb 7 (day 37)
    expect(isScheduleActiveOnDate(schedule, date)).toBe(true);
  });

  it('returns false when isActive is false', () => {
    const schedule = makeSchedule({ isActive: false });
    const date = new Date(2026, 1, 7);
    expect(isScheduleActiveOnDate(schedule, date)).toBe(false);
  });

  it('returns true on exact startDate', () => {
    const startDate = new Date(2026, 1, 7).getTime();
    const schedule = makeSchedule({ startDate });
    const date = new Date(2026, 1, 7);
    // Same day, timestamp >= startDate (midnight >= midnight)
    expect(isScheduleActiveOnDate(schedule, date)).toBe(true);
  });

  it('returns false on exact endDate boundary (> comparison)', () => {
    const endDate = new Date(2026, 1, 7, 0, 0, 0).getTime();
    const schedule = makeSchedule({ endDate });
    // A date with timestamp > endDate
    const date = new Date(2026, 1, 7, 12, 0, 0); // noon same day
    expect(isScheduleActiveOnDate(schedule, date)).toBe(false);
  });

  it('handles durationDays = 1 (only active on start day)', () => {
    const schedule = makeSchedule({
      startDate: new Date(2026, 1, 7, 0, 0, 0).getTime(),
      durationDays: 1,
    });
    // Same day at noon: daysElapsed = 0 < 1 → active
    expect(isScheduleActiveOnDate(schedule, new Date(2026, 1, 7, 12, 0))).toBe(true);
    // Next day: daysElapsed = 1 >= 1 → inactive
    expect(isScheduleActiveOnDate(schedule, new Date(2026, 1, 8, 12, 0))).toBe(false);
  });
});
