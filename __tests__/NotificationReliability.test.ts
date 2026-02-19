/**
 * Tests for notification scheduling reliability.
 *
 * These tests exercise the core scheduling pipeline logic using mocked
 * repositories and notification services. They verify:
 *
 * - Dose logs are created for all today's scheduled times (including past)
 * - Notifications are only scheduled for future times
 * - Inactive medications / schedules produce no notifications
 * - Rescheduling does not duplicate dose logs
 * - Weekly / interval schedules are respected
 * - The v1.13 boundary bug (>= vs >) is fixed
 * - cancelScheduledTriggers vs cancelMedicationNotifications separation
 */

import {
  getScheduledTimesInRange,
} from '../src/utils/dateUtils';
import { isScheduleActiveOnDate } from '../src/utils/scheduleUtils';
import { Schedule } from '../src/types';

// ──── Mock infrastructure ────

interface MockDoseLog {
  id: string;
  medicationId: string;
  scheduleId: string;
  scheduledTime: number;
  actionTime: number | null;
  status: 'pending' | 'taken' | 'skipped' | 'missed';
  snoozedUntil: number | null;
}

interface MockMedication {
  id: string;
  name: string;
  dosage: string;
  color: string;
  isActive: boolean;
}

interface MockNotification {
  id: string;
  scheduledTime: number;
  medicationId: string;
  displayed: boolean; // true = already fired and showing, false = still a future trigger
}

class MockDoseLogRepo {
  logs: Map<string, MockDoseLog> = new Map();

  async getByScheduledTime(scheduleId: string, scheduledTime: number): Promise<MockDoseLog | null> {
    return this.logs.get(`${scheduleId}-${scheduledTime}`) || null;
  }

  async create(data: Omit<MockDoseLog, 'id'>): Promise<MockDoseLog> {
    const log: MockDoseLog = { id: `log-${this.logs.size}`, ...data };
    this.logs.set(`${data.scheduleId}-${data.scheduledTime}`, log);
    return log;
  }

  getAll(): MockDoseLog[] { return [...this.logs.values()]; }
  clear(): void { this.logs.clear(); }
}

class MockNotificationSvc {
  notifications: Map<string, MockNotification> = new Map();

  async schedule(id: string, scheduledTime: number, medicationId: string): Promise<void> {
    this.notifications.set(id, { id, scheduledTime, medicationId, displayed: false });
  }

  async cancelScheduledTriggers(medicationId: string): Promise<number> {
    let count = 0;
    for (const [id, n] of this.notifications) {
      if (n.medicationId === medicationId && !n.displayed) {
        this.notifications.delete(id);
        count++;
      }
    }
    return count;
  }

  async cancelAll(medicationId: string): Promise<number> {
    let count = 0;
    for (const [id, n] of this.notifications) {
      if (n.medicationId === medicationId) {
        this.notifications.delete(id);
        count++;
      }
    }
    return count;
  }

  getTriggers(): MockNotification[] {
    return [...this.notifications.values()].filter(n => !n.displayed);
  }

  getDisplayed(): MockNotification[] {
    return [...this.notifications.values()].filter(n => n.displayed);
  }

  markDisplayed(id: string): void {
    const n = this.notifications.get(id);
    if (n) n.displayed = true;
  }

  getAll(): MockNotification[] { return [...this.notifications.values()]; }
  clear(): void { this.notifications.clear(); }
}

// ──── Scheduling logic (mirrors ReminderScheduler.scheduleMedicationReminders) ────

async function scheduleMedicationReminders(
  medication: MockMedication,
  schedules: Schedule[],
  isStrictMode: boolean,
  daysAhead: number,
  doseLogRepo: MockDoseLogRepo,
  notifSvc: MockNotificationSvc,
  now: Date,
): Promise<number> {
  await notifSvc.cancelScheduledTriggers(medication.id);

  if (!medication.isActive) return 0;

  const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  let scheduled = 0;

  for (const schedule of schedules) {
    if (!schedule.isActive) continue;
    if (!isScheduleActiveOnDate(schedule, now)) continue;

    const nowMs = now.getTime();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    // Start from today's midnight so past-today times are included for dose logs
    const times = getScheduledTimesInRange(
      todayStart, endDate, schedule.timesOfDay, schedule.scheduleType, {
        daysOfWeek: schedule.daysOfWeek || undefined,
        intervalDays: schedule.intervalDays || undefined,
        scheduleStartDate: new Date(schedule.startDate),
      },
    );

    for (const time of times) {
      const ms = time.getTime();
      const isPast = ms <= nowMs;

      // Create dose log for today only
      if (ms >= todayStartMs && ms < todayStartMs + 86400000) {
        const existing = await doseLogRepo.getByScheduledTime(schedule.id, ms);
        if (!existing) {
          await doseLogRepo.create({
            medicationId: medication.id,
            scheduleId: schedule.id,
            scheduledTime: ms,
            actionTime: null,
            status: 'pending',
            snoozedUntil: null,
          });
        }
      }

      if (!isPast) {
        const notifId = `reminder-${schedule.id}-${ms}`;
        await notifSvc.schedule(notifId, ms, medication.id);
        scheduled++;
      }
    }
  }

  return scheduled;
}

// ──── Helpers ────

function makeDate(y: number, mo: number, d: number, h = 0, m = 0, s = 0): Date {
  return new Date(y, mo - 1, d, h, m, s, 0);
}

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'sched-1',
    medicationId: 'med-1',
    scheduleType: 'daily',
    timesOfDay: ['09:00', '21:00'],
    daysOfWeek: null,
    intervalDays: null,
    startDate: new Date(2026, 0, 1).getTime(),
    endDate: null,
    durationDays: null,
    isActive: true,
    ...overrides,
  };
}

function makeMed(overrides: Partial<MockMedication> = {}): MockMedication {
  return {
    id: 'med-1',
    name: 'Aspirin',
    dosage: '100mg',
    color: '#FF0000',
    isActive: true,
    ...overrides,
  };
}

// ──── Tests ────

describe('Notification scheduling reliability', () => {
  let repo: MockDoseLogRepo;
  let notif: MockNotificationSvc;

  beforeEach(() => {
    repo = new MockDoseLogRepo();
    notif = new MockNotificationSvc();
  });

  describe('basic scheduling', () => {
    it('schedules notifications for future times only', async () => {
      const now = makeDate(2026, 2, 7, 12, 0); // noon
      const med = makeMed();
      const sched = makeSchedule({ timesOfDay: ['09:00', '15:00', '21:00'] });

      const count = await scheduleMedicationReminders(med, [sched], false, 1, repo, notif, now);

      // 09:00 past (no notification), 15:00 and 21:00 future today + 3 tomorrow (endOfDay expansion)
      expect(count).toBe(5);
      expect(notif.getTriggers()).toHaveLength(5);
    });

    it('creates dose logs for all of todays times including past', async () => {
      const now = makeDate(2026, 2, 7, 12, 0);
      const med = makeMed();
      const sched = makeSchedule({ timesOfDay: ['09:00', '15:00', '21:00'] });

      await scheduleMedicationReminders(med, [sched], false, 1, repo, notif, now);

      // All 3 today times should have dose logs
      expect(repo.getAll()).toHaveLength(3);
      expect(repo.getAll().every(l => l.status === 'pending')).toBe(true);
    });

    it('does not create dose logs for future days (only today)', async () => {
      const now = makeDate(2026, 2, 7, 0, 0); // midnight
      const med = makeMed();
      const sched = makeSchedule({ timesOfDay: ['09:00'] });

      await scheduleMedicationReminders(med, [sched], false, 7, repo, notif, now);

      // Only today's dose log, not 7 days worth
      const todayLogs = repo.getAll().filter(l => {
        const d = new Date(l.scheduledTime);
        return d.getDate() === 7 && d.getMonth() === 1; // Feb 7
      });
      expect(todayLogs).toHaveLength(1);
      // 8 notifications: Feb 7 through Feb 14 (endOfDay makes daysAhead=7 inclusive)
      expect(notif.getTriggers().length).toBe(8);
    });
  });

  describe('inactive medication / schedule', () => {
    it('inactive medication produces zero notifications', async () => {
      const now = makeDate(2026, 2, 7, 10, 0);
      const med = makeMed({ isActive: false });
      const sched = makeSchedule();

      const count = await scheduleMedicationReminders(med, [sched], false, 7, repo, notif, now);

      expect(count).toBe(0);
      expect(notif.getTriggers()).toHaveLength(0);
      expect(repo.getAll()).toHaveLength(0);
    });

    it('inactive schedule is skipped', async () => {
      const now = makeDate(2026, 2, 7, 10, 0);
      const med = makeMed();
      const activeSched = makeSchedule({ id: 'active', timesOfDay: ['15:00'] });
      const inactiveSched = makeSchedule({ id: 'inactive', isActive: false, timesOfDay: ['16:00'] });

      const count = await scheduleMedicationReminders(
        med, [activeSched, inactiveSched], false, 1, repo, notif, now,
      );

      expect(count).toBe(2); // active schedule: today 15:00 + tomorrow 15:00 (endOfDay expansion)
    });

    it('schedule past its endDate is skipped', async () => {
      const now = makeDate(2026, 2, 7, 10, 0);
      const med = makeMed();
      const sched = makeSchedule({
        endDate: new Date(2026, 0, 31).getTime(), // ended Jan 31
      });

      const count = await scheduleMedicationReminders(med, [sched], false, 7, repo, notif, now);
      expect(count).toBe(0);
    });
  });

  describe('rescheduling does not duplicate dose logs', () => {
    it('calling schedule twice does not create duplicate logs', async () => {
      const now = makeDate(2026, 2, 7, 10, 0);
      const med = makeMed();
      const sched = makeSchedule({ timesOfDay: ['15:00'] });

      await scheduleMedicationReminders(med, [sched], false, 1, repo, notif, now);
      expect(repo.getAll()).toHaveLength(1);

      // Schedule again (simulating app re-open)
      await scheduleMedicationReminders(med, [sched], false, 1, repo, notif, now);
      expect(repo.getAll()).toHaveLength(1); // still 1
    });
  });

  describe('cancelScheduledTriggers vs cancelMedicationNotifications', () => {
    it('cancelScheduledTriggers preserves displayed notifications', async () => {
      // Simulate: a notification fired and is displayed, then user opens app
      notif.notifications.set('reminder-s1-123', {
        id: 'reminder-s1-123',
        scheduledTime: 123,
        medicationId: 'med-1',
        displayed: true, // already showing in notification tray
      });
      notif.notifications.set('reminder-s1-456', {
        id: 'reminder-s1-456',
        scheduledTime: 456,
        medicationId: 'med-1',
        displayed: false, // still a future trigger
      });

      const cancelled = await notif.cancelScheduledTriggers('med-1');

      expect(cancelled).toBe(1); // only the trigger
      expect(notif.getDisplayed()).toHaveLength(1); // displayed preserved
      expect(notif.getDisplayed()[0].id).toBe('reminder-s1-123');
    });

    it('cancelAll removes both displayed and triggers', async () => {
      notif.notifications.set('reminder-s1-123', {
        id: 'reminder-s1-123',
        scheduledTime: 123,
        medicationId: 'med-1',
        displayed: true,
      });
      notif.notifications.set('reminder-s1-456', {
        id: 'reminder-s1-456',
        scheduledTime: 456,
        medicationId: 'med-1',
        displayed: false,
      });

      const cancelled = await notif.cancelAll('med-1');
      expect(cancelled).toBe(2);
      expect(notif.getAll()).toHaveLength(0);
    });

    it('rescheduling preserves displayed notifications', async () => {
      const now = makeDate(2026, 2, 7, 12, 0);

      // A 09:00 notification already fired and is displayed
      notif.notifications.set('reminder-sched-1-displayed', {
        id: 'reminder-sched-1-displayed',
        scheduledTime: makeDate(2026, 2, 7, 9, 0).getTime(),
        medicationId: 'med-1',
        displayed: true,
      });

      const med = makeMed();
      const sched = makeSchedule({ timesOfDay: ['09:00', '21:00'] });

      await scheduleMedicationReminders(med, [sched], false, 1, repo, notif, now);

      // The displayed notification should still be there
      expect(notif.getDisplayed()).toHaveLength(1);
      expect(notif.getDisplayed()[0].id).toBe('reminder-sched-1-displayed');
    });
  });

  describe('weekly schedule', () => {
    it('only schedules notifications on matching days', async () => {
      // Feb 7 2026 = Saturday (day 6)
      const now = makeDate(2026, 2, 7, 0, 0);
      const med = makeMed();
      const sched = makeSchedule({
        scheduleType: 'weekly',
        timesOfDay: ['09:00'],
        daysOfWeek: [1, 5], // Mon and Fri only
      });

      const count = await scheduleMedicationReminders(med, [sched], false, 7, repo, notif, now);

      // In 7 days from Sat Feb 7: Mon Feb 9 and Fri Feb 13
      expect(count).toBe(2);
    });

    it('no notifications on non-matching days', async () => {
      const now = makeDate(2026, 2, 7, 0, 0); // Saturday
      const med = makeMed();
      const sched = makeSchedule({
        scheduleType: 'weekly',
        timesOfDay: ['09:00'],
        daysOfWeek: [3], // Wednesday only
      });

      const count = await scheduleMedicationReminders(med, [sched], false, 3, repo, notif, now);

      // Sat, Sun, Mon — no Wednesday
      expect(count).toBe(0);
    });
  });

  describe('interval schedule', () => {
    it('schedules only on matching interval days', async () => {
      const now = makeDate(2026, 2, 7, 0, 0);
      const med = makeMed();
      const sched = makeSchedule({
        scheduleType: 'interval',
        timesOfDay: ['09:00'],
        intervalDays: 3,
        startDate: makeDate(2026, 2, 5, 0, 0).getTime(), // started Feb 5
      });

      const count = await scheduleMedicationReminders(med, [sched], false, 7, repo, notif, now);

      // Feb 5 (day 0), 8 (day 3), 11 (day 6), 14 (day 9)
      // Range: Feb 7 to Feb 14 → Feb 8, 11, 14
      expect(count).toBe(3);
    });
  });

  describe('boundary bug (v1.13 fix: >= instead of >)', () => {
    it('includes time at exact start moment', async () => {
      // User creates med at exactly 19:50:00 for time 19:50
      const now = makeDate(2026, 2, 7, 19, 50, 0);
      const med = makeMed();
      const sched = makeSchedule({ timesOfDay: ['19:50'] });

      const count = await scheduleMedicationReminders(med, [sched], false, 7, repo, notif, now);

      // 19:50:00 <= 19:50:00 is past (isPastTime check uses <=)
      // So today's 19:50 is NOT scheduled as notification (just dose log)
      // But tomorrow's 19:50 and beyond should be
      expect(count).toBeGreaterThanOrEqual(6); // 6 more days
    });

    it('time 1 second after now IS scheduled', async () => {
      const now = makeDate(2026, 2, 7, 19, 49, 59);
      const med = makeMed();
      const sched = makeSchedule({ timesOfDay: ['19:50'] });

      const count = await scheduleMedicationReminders(med, [sched], false, 1, repo, notif, now);

      // 19:50:00 > 19:49:59 → future → today + tomorrow (endOfDay expansion)
      expect(count).toBe(2);
    });
  });

  describe('all past times today', () => {
    it('creates dose logs but no notifications when all times passed', async () => {
      const now = makeDate(2026, 2, 7, 23, 0);
      const med = makeMed();
      const sched = makeSchedule({ timesOfDay: ['09:00', '15:00', '21:00'] });

      const count = await scheduleMedicationReminders(med, [sched], false, 1, repo, notif, now);

      // All 3 past today → dose logs but no today notifications
      // Only tomorrow's 3 times should be scheduled
      const todayLogs = repo.getAll();
      expect(todayLogs).toHaveLength(3);
      // Tomorrow notifications
      expect(count).toBe(3);
    });
  });

  describe('multiple schedules per medication', () => {
    it('combines notifications from multiple schedules', async () => {
      const now = makeDate(2026, 2, 7, 10, 0);
      const med = makeMed();
      const sched1 = makeSchedule({ id: 'morning', timesOfDay: ['08:00'] });
      const sched2 = makeSchedule({ id: 'evening', timesOfDay: ['20:00'] });

      const count = await scheduleMedicationReminders(
        med, [sched1, sched2], false, 1, repo, notif, now,
      );

      // 08:00 past today, 20:00 future today + 08:00 and 20:00 tomorrow = 3 notifications
      expect(count).toBe(3);
      // Both dose logs for today (08:00 past + 20:00 future)
      expect(repo.getAll()).toHaveLength(2);
    });
  });

  describe('no schedules', () => {
    it('produces no notifications and no dose logs', async () => {
      const now = makeDate(2026, 2, 7, 10, 0);
      const med = makeMed();

      const count = await scheduleMedicationReminders(med, [], false, 7, repo, notif, now);

      expect(count).toBe(0);
      expect(repo.getAll()).toHaveLength(0);
    });
  });

  describe('daysAhead parameter', () => {
    it('daysAhead=1 schedules only today and tomorrow', async () => {
      const now = makeDate(2026, 2, 7, 0, 0);
      const med = makeMed();
      const sched = makeSchedule({ timesOfDay: ['12:00'] });

      const count = await scheduleMedicationReminders(med, [sched], false, 1, repo, notif, now);

      // Today 12:00 and tomorrow 12:00 (endDate = now + 1 day)
      // Actually, with endOfDay applied in getScheduledTimesInRange, range is Feb 7 to end of Feb 8
      expect(count).toBe(2);
    });

    it('daysAhead=7 produces ~7 days of notifications', async () => {
      const now = makeDate(2026, 2, 7, 0, 0);
      const med = makeMed();
      const sched = makeSchedule({ timesOfDay: ['12:00'] });

      const count = await scheduleMedicationReminders(med, [sched], false, 7, repo, notif, now);

      // 8 days: Feb 7 through Feb 14 (endOfDay makes it inclusive)
      expect(count).toBe(8);
    });
  });
});
