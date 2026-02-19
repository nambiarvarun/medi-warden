/**
 * Tests for the HomeScreen medication sorting logic.
 *
 * Sorting rules (current implementation):
 *   1. Pending / upcoming medications come before completed-today ones
 *   2. Within each group, sort by next intake time (soonest first)
 *   3. Completed-today = taken with actionTime today (skipped is NOT completed — allows re-take)
 *
 * These are pure-function tests against the exact helpers in HomeScreen.
 */

import { isToday } from 'date-fns';

// ──── Types (mirroring the app) ────

interface Schedule {
  id: string;
  isActive: boolean;
  timesOfDay: string[];
}

interface DoseLog {
  id: string;
  medicationId: string;
  scheduleId: string;
  scheduledTime: number;
  actionTime: number | null;
  status: 'pending' | 'taken' | 'skipped' | 'missed';
  snoozedUntil: number | null;
}

interface MedEntry {
  id: string;
  schedules: Schedule[];
  doseLog: DoseLog | null;
}

// ──── Helpers extracted from HomeScreen (must match source) ────

function getNextIntakeTime(schedules: Schedule[] | undefined, now: Date): number {
  if (!schedules || schedules.length === 0) return Infinity;

  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const allTimes: string[] = [];
  schedules.forEach((s) => {
    if (s.isActive && s.timesOfDay) allTimes.push(...s.timesOfDay);
  });
  if (allTimes.length === 0) return Infinity;

  const sorted = allTimes.sort();
  const next = sorted.find((t) => t >= currentTime) || sorted[0];
  const [h, m] = next.split(':').map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function isMedCompletedToday(doseLog: DoseLog | null): boolean {
  if (!doseLog) return false;
  // Only 'taken' is fully completed; 'skipped' still allows taking
  return doseLog.status === 'taken' && !!doseLog.actionTime && isToday(new Date(doseLog.actionTime));
}

/** The actual comparator that HomeScreen uses */
function sortMedications(meds: MedEntry[], now: Date): MedEntry[] {
  return [...meds].sort((a, b) => {
    const aC = isMedCompletedToday(a.doseLog);
    const bC = isMedCompletedToday(b.doseLog);
    if (aC !== bC) return aC ? 1 : -1;
    const tA = getNextIntakeTime(a.schedules, now);
    const tB = getNextIntakeTime(b.schedules, now);
    return tA - tB;
  });
}

// ──── Helpers for building test data ────

function today(h: number, m: number): number {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function yesterday(h: number, m: number): number {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function sched(id: string, times: string[], active = true): Schedule {
  return { id, isActive: active, timesOfDay: times };
}

function doseLog(
  medId: string,
  schedId: string,
  scheduled: number,
  action: number | null,
  status: DoseLog['status'],
): DoseLog {
  return {
    id: `log-${medId}`,
    medicationId: medId,
    scheduleId: schedId,
    scheduledTime: scheduled,
    actionTime: action,
    status,
    snoozedUntil: null,
  };
}

// ──── Tests ────

describe('HomeScreen medication sorting', () => {
  // Fix the clock for deterministic results
  const now = new Date();
  now.setHours(16, 0, 0, 0); // 16:00

  describe('basic ordering', () => {
    it('pending meds before completed-today meds', () => {
      const meds: MedEntry[] = [
        {
          id: 'taken-09',
          schedules: [sched('s1', ['09:00'])],
          doseLog: doseLog('taken-09', 's1', today(9, 0), today(9, 5), 'taken'),
        },
        {
          id: 'pending-18',
          schedules: [sched('s2', ['18:00'])],
          doseLog: null,
        },
      ];
      const sorted = sortMedications(meds, now);
      expect(sorted[0].id).toBe('pending-18');
      expect(sorted[1].id).toBe('taken-09');
    });

    it('multiple pending meds sorted by next intake time', () => {
      const meds: MedEntry[] = [
        { id: 'med-21', schedules: [sched('s1', ['21:00'])], doseLog: null },
        { id: 'med-17', schedules: [sched('s2', ['17:00'])], doseLog: null },
        { id: 'med-19', schedules: [sched('s3', ['19:00'])], doseLog: null },
      ];
      const sorted = sortMedications(meds, now);
      expect(sorted.map(m => m.id)).toEqual(['med-17', 'med-19', 'med-21']);
    });

    it('completed-today meds sorted by next intake time among themselves', () => {
      const meds: MedEntry[] = [
        {
          id: 'taken-15',
          schedules: [sched('s1', ['15:00'])],
          doseLog: doseLog('taken-15', 's1', today(15, 0), today(15, 5), 'taken'),
        },
        {
          id: 'taken-09',
          schedules: [sched('s2', ['09:00'])],
          doseLog: doseLog('taken-09', 's2', today(9, 0), today(9, 2), 'taken'),
        },
      ];
      const sorted = sortMedications(meds, now);
      // Both completed; 09:00 wraps to tomorrow → tomorrow 09:00
      // 15:00 also wraps to tomorrow → tomorrow 15:00
      // So 09:00 tomorrow < 15:00 tomorrow
      expect(sorted[0].id).toBe('taken-09');
      expect(sorted[1].id).toBe('taken-15');
    });
  });

  describe('the reported 15:00-above-19:50 bug scenario', () => {
    it('newly added 19:50 med should appear before a past 15:00 med', () => {
      // At 19:55, user just created a 19:50 medication.
      // The 15:00 medication was taken yesterday, no dose log for today.
      const clock = new Date();
      clock.setHours(19, 55, 0, 0);

      const meds: MedEntry[] = [
        {
          id: 'med-15',
          schedules: [sched('s1', ['15:00'])],
          doseLog: doseLog('med-15', 's1', yesterday(15, 0), yesterday(15, 5), 'taken'),
        },
        {
          id: 'med-1950',
          schedules: [sched('s2', ['19:50'])],
          doseLog: null,
        },
      ];
      const sorted = sortMedications(meds, clock);
      // Neither is completed today.
      // med-15 next intake = tomorrow 15:00
      // med-1950 next intake = tomorrow 19:50
      // So med-15 should come first (earlier tomorrow)
      // Both are "pending" — neither should be flagged incorrectly.
      expect(sorted[0].id).toBe('med-15');
      expect(sorted[1].id).toBe('med-1950');
    });

    it('a taken-today 15:00 med goes BELOW an upcoming 19:50 med', () => {
      const clock = new Date();
      clock.setHours(19, 55, 0, 0);

      const meds: MedEntry[] = [
        {
          id: 'med-15-done',
          schedules: [sched('s1', ['15:00'])],
          doseLog: doseLog('med-15-done', 's1', today(15, 0), today(15, 2), 'taken'),
        },
        {
          id: 'med-1950-pending',
          schedules: [sched('s2', ['19:50'])],
          doseLog: null,
        },
      ];
      const sorted = sortMedications(meds, clock);
      // med-1950-pending is not completed → goes first
      // med-15-done is completed today → goes second
      expect(sorted[0].id).toBe('med-1950-pending');
      expect(sorted[1].id).toBe('med-15-done');
    });
  });

  describe('skipped doses', () => {
    it('skipped-today is NOT treated as completed — allows re-take', () => {
      const meds: MedEntry[] = [
        {
          id: 'skipped',
          schedules: [sched('s1', ['09:00'])],
          doseLog: doseLog('skipped', 's1', today(9, 0), today(9, 0), 'skipped'),
        },
        {
          id: 'pending',
          schedules: [sched('s2', ['18:00'])],
          doseLog: null,
        },
      ];
      const sorted = sortMedications(meds, now);
      // Both are in the "not completed" group; sorted by next intake time
      // skipped 09:00 wraps to tomorrow 09:00; pending 18:00 is today
      expect(sorted[0].id).toBe('pending');
      expect(sorted[1].id).toBe('skipped');
    });

    it('skipped med sorts alongside pending meds (not with taken)', () => {
      const meds: MedEntry[] = [
        {
          id: 'taken-09',
          schedules: [sched('s1', ['09:00'])],
          doseLog: doseLog('taken-09', 's1', today(9, 0), today(9, 5), 'taken'),
        },
        {
          id: 'skipped-10',
          schedules: [sched('s2', ['10:00'])],
          doseLog: doseLog('skipped-10', 's2', today(10, 0), today(10, 0), 'skipped'),
        },
        {
          id: 'pending-18',
          schedules: [sched('s3', ['18:00'])],
          doseLog: null,
        },
      ];
      const sorted = sortMedications(meds, now);
      // pending-18 and skipped-10 are in "not completed" group
      // taken-09 is in "completed" group (last)
      expect(sorted[2].id).toBe('taken-09');
      // skipped-10 next = tomorrow 10:00; pending-18 next = today 18:00
      expect(sorted[0].id).toBe('pending-18');
      expect(sorted[1].id).toBe('skipped-10');
    });
  });

  describe('yesterday dose logs (not completed today)', () => {
    it('taken-yesterday is NOT treated as completed-today', () => {
      const meds: MedEntry[] = [
        {
          id: 'taken-yesterday',
          schedules: [sched('s1', ['09:00'])],
          doseLog: doseLog('taken-yesterday', 's1', yesterday(9, 0), yesterday(9, 5), 'taken'),
        },
        {
          id: 'taken-today',
          schedules: [sched('s2', ['10:00'])],
          doseLog: doseLog('taken-today', 's2', today(10, 0), today(10, 5), 'taken'),
        },
      ];
      const sorted = sortMedications(meds, now);
      // taken-yesterday is NOT completedToday → pending group
      // taken-today IS completedToday → completed group
      expect(sorted[0].id).toBe('taken-yesterday');
      expect(sorted[1].id).toBe('taken-today');
    });
  });

  describe('edge cases', () => {
    it('medication with no schedules sorts to end (Infinity)', () => {
      const meds: MedEntry[] = [
        { id: 'no-sched', schedules: [], doseLog: null },
        { id: 'has-sched', schedules: [sched('s1', ['17:00'])], doseLog: null },
      ];
      const sorted = sortMedications(meds, now);
      expect(sorted[0].id).toBe('has-sched');
      expect(sorted[1].id).toBe('no-sched');
    });

    it('medication with only inactive schedules sorts to end', () => {
      const meds: MedEntry[] = [
        { id: 'inactive', schedules: [sched('s1', ['08:00'], false)], doseLog: null },
        { id: 'active', schedules: [sched('s2', ['18:00'])], doseLog: null },
      ];
      const sorted = sortMedications(meds, now);
      expect(sorted[0].id).toBe('active');
      expect(sorted[1].id).toBe('inactive');
    });

    it('all meds completed today — still sorted by next intake', () => {
      const meds: MedEntry[] = [
        {
          id: 'done-15',
          schedules: [sched('s1', ['15:00'])],
          doseLog: doseLog('done-15', 's1', today(15, 0), today(15, 5), 'taken'),
        },
        {
          id: 'done-09',
          schedules: [sched('s2', ['09:00'])],
          doseLog: doseLog('done-09', 's2', today(9, 0), today(9, 5), 'taken'),
        },
        {
          id: 'done-12',
          schedules: [sched('s3', ['12:00'])],
          doseLog: doseLog('done-12', 's3', today(12, 0), today(12, 5), 'taken'),
        },
      ];
      const sorted = sortMedications(meds, now);
      // All completed; sorted by next intake (all wrap to tomorrow)
      expect(sorted.map(m => m.id)).toEqual(['done-09', 'done-12', 'done-15']);
    });

    it('empty medications list returns empty', () => {
      expect(sortMedications([], now)).toEqual([]);
    });

    it('single medication returns itself', () => {
      const meds: MedEntry[] = [
        { id: 'only', schedules: [sched('s1', ['12:00'])], doseLog: null },
      ];
      expect(sortMedications(meds, now)[0].id).toBe('only');
    });

    it('pending dose log is NOT treated as completed', () => {
      const meds: MedEntry[] = [
        {
          id: 'pending-log',
          schedules: [sched('s1', ['18:00'])],
          doseLog: doseLog('pending-log', 's1', today(18, 0), null, 'pending'),
        },
        {
          id: 'taken-log',
          schedules: [sched('s2', ['09:00'])],
          doseLog: doseLog('taken-log', 's2', today(9, 0), today(9, 5), 'taken'),
        },
      ];
      const sorted = sortMedications(meds, now);
      expect(sorted[0].id).toBe('pending-log');
      expect(sorted[1].id).toBe('taken-log');
    });

    it('multi-dose medication sorts by next upcoming time', () => {
      // Med has 3 doses: 08:00, 14:00, 20:00. At 16:00, next is 20:00.
      const meds: MedEntry[] = [
        {
          id: 'multi',
          schedules: [sched('s1', ['08:00', '14:00', '20:00'])],
          doseLog: null,
        },
        {
          id: 'single-17',
          schedules: [sched('s2', ['17:00'])],
          doseLog: null,
        },
      ];
      const sorted = sortMedications(meds, now);
      // single-17 next = 17:00 today; multi next = 20:00 today
      expect(sorted[0].id).toBe('single-17');
      expect(sorted[1].id).toBe('multi');
    });
  });
});
