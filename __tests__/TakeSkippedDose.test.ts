/**
 * Tests for the "take skipped/snoozed dose" feature.
 *
 * Verifies:
 * - takeMedicationDose finds and converts a skipped dose to taken
 * - takeMedicationDose prefers pending doses over skipped ones
 * - takeMedicationDose handles snoozed doses (still pending, just has snoozedUntil)
 * - HomeScreen button logic: Take shown on skipped, Skip hidden on skipped
 * - isMedCompletedToday only true for 'taken' (not 'skipped')
 */

import { isToday } from 'date-fns';

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
  isStockIndefinite: boolean;
  stockCount: number;
  stockReminderThreshold: number;
}

interface MockSchedule {
  id: string;
  medicationId: string;
  isActive: boolean;
}

class MockDoseLogRepo {
  logs: Map<string, MockDoseLog> = new Map();
  private counter = 0;

  async getByScheduledTime(scheduleId: string, scheduledTime: number): Promise<MockDoseLog | null> {
    return this.logs.get(`${scheduleId}-${scheduledTime}`) || null;
  }

  async getPendingForSchedule(
    scheduleId: string,
    startTime: number,
    endTime: number,
  ): Promise<MockDoseLog | null> {
    for (const log of this.logs.values()) {
      if (
        log.scheduleId === scheduleId &&
        log.scheduledTime >= startTime &&
        log.scheduledTime <= endTime &&
        log.status === 'pending'
      ) {
        return log;
      }
    }
    return null;
  }

  async getSkippedForSchedule(
    scheduleId: string,
    startTime: number,
    endTime: number,
  ): Promise<MockDoseLog | null> {
    for (const log of this.logs.values()) {
      if (
        log.scheduleId === scheduleId &&
        log.scheduledTime >= startTime &&
        log.scheduledTime <= endTime &&
        log.status === 'skipped'
      ) {
        return log;
      }
    }
    return null;
  }

  async create(data: Omit<MockDoseLog, 'id'>): Promise<MockDoseLog> {
    const log: MockDoseLog = { id: `log-${this.counter++}`, ...data };
    this.logs.set(`${data.scheduleId}-${data.scheduledTime}`, log);
    return log;
  }

  async updateStatus(id: string, status: MockDoseLog['status'], actionTime: number): Promise<void> {
    for (const log of this.logs.values()) {
      if (log.id === id) {
        log.status = status;
        log.actionTime = actionTime;
        log.snoozedUntil = null;
        return;
      }
    }
  }

  getAll(): MockDoseLog[] { return [...this.logs.values()]; }
  clear(): void { this.logs.clear(); this.counter = 0; }
}

class MockMedicationRepo {
  medications: Map<string, MockMedication> = new Map();

  async getById(id: string): Promise<MockMedication | null> {
    return this.medications.get(id) || null;
  }

  async decrementStock(id: string): Promise<void> {
    const med = this.medications.get(id);
    if (med && med.stockCount > 0) med.stockCount--;
  }

  add(med: MockMedication): void {
    this.medications.set(med.id, med);
  }
}

class MockScheduleRepo {
  schedules: Map<string, MockSchedule[]> = new Map();

  async getActiveByMedicationId(medicationId: string): Promise<MockSchedule[]> {
    return (this.schedules.get(medicationId) || []).filter(s => s.isActive);
  }

  add(schedule: MockSchedule): void {
    const existing = this.schedules.get(schedule.medicationId) || [];
    existing.push(schedule);
    this.schedules.set(schedule.medicationId, existing);
  }
}

// ──── Logic under test (mirrors ReminderScheduler.takeMedicationDose) ────

async function takeMedicationDose(
  medicationId: string,
  scheduleRepo: MockScheduleRepo,
  doseLogRepo: MockDoseLogRepo,
  medRepo: MockMedicationRepo,
  nowMs: number,
): Promise<boolean> {
  const schedules = await scheduleRepo.getActiveByMedicationId(medicationId);
  if (schedules.length === 0) return false;

  const today = new Date(nowMs);
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
  const searchStart = startOfDay - 12 * 60 * 60 * 1000;

  // Look for pending dose logs first
  for (const schedule of schedules) {
    const pendingDose = await doseLogRepo.getPendingForSchedule(
      schedule.id,
      searchStart,
      endOfDay,
    );
    if (pendingDose) {
      await handleTakeAction(medicationId, schedule.id, pendingDose.scheduledTime, doseLogRepo, medRepo, nowMs);
      return true;
    }
  }

  // Look for skipped dose logs (user wants to undo skip and take instead)
  for (const schedule of schedules) {
    const skippedDose = await doseLogRepo.getSkippedForSchedule(
      schedule.id,
      searchStart,
      endOfDay,
    );
    if (skippedDose) {
      await handleTakeAction(medicationId, schedule.id, skippedDose.scheduledTime, doseLogRepo, medRepo, nowMs);
      return true;
    }
  }

  // No pending or skipped dose found - create one for current time
  if (schedules.length > 0) {
    await handleTakeAction(medicationId, schedules[0].id, nowMs, doseLogRepo, medRepo, nowMs);
    return true;
  }

  return false;
}

async function handleTakeAction(
  medicationId: string,
  scheduleId: string,
  scheduledTime: number,
  doseLogRepo: MockDoseLogRepo,
  medRepo: MockMedicationRepo,
  nowMs: number,
): Promise<void> {
  const doseLog = await doseLogRepo.getByScheduledTime(scheduleId, scheduledTime);

  if (doseLog) {
    await doseLogRepo.updateStatus(doseLog.id, 'taken', nowMs);
  } else {
    await doseLogRepo.create({
      medicationId,
      scheduleId,
      scheduledTime,
      actionTime: nowMs,
      status: 'taken',
      snoozedUntil: null,
    });
  }

  const medication = await medRepo.getById(medicationId);
  if (medication && !medication.isStockIndefinite) {
    await medRepo.decrementStock(medicationId);
  }
}

// ──── HomeScreen logic under test ────

function isMedCompletedToday(doseLog: MockDoseLog | null): boolean {
  if (!doseLog) return false;
  // Only 'taken' is fully completed; 'skipped' still allows taking
  return doseLog.status === 'taken' && !!doseLog.actionTime && isToday(new Date(doseLog.actionTime));
}

function getButtonVisibility(doseLog: MockDoseLog | null): { showTake: boolean; showSkip: boolean } {
  const isCompletedToday = isMedCompletedToday(doseLog);
  const isSkipped = doseLog?.status === 'skipped';
  return {
    showTake: !isCompletedToday,
    showSkip: !isCompletedToday && !isSkipped,
  };
}

// ──── Helpers ────

function makeDate(y: number, mo: number, d: number, h = 0, m = 0): Date {
  return new Date(y, mo - 1, d, h, m, 0, 0);
}

function makeMed(overrides: Partial<MockMedication> = {}): MockMedication {
  return {
    id: 'med-1',
    name: 'Aspirin',
    dosage: '100mg',
    color: '#FF0000',
    isActive: true,
    isStockIndefinite: true,
    stockCount: 30,
    stockReminderThreshold: 5,
    ...overrides,
  };
}

// ──── Tests ────

describe('Take skipped dose', () => {
  let doseLogRepo: MockDoseLogRepo;
  let medRepo: MockMedicationRepo;
  let scheduleRepo: MockScheduleRepo;

  beforeEach(() => {
    doseLogRepo = new MockDoseLogRepo();
    medRepo = new MockMedicationRepo();
    scheduleRepo = new MockScheduleRepo();
  });

  describe('takeMedicationDose with skipped doses', () => {
    it('finds and converts a skipped dose to taken', async () => {
      const med = makeMed();
      medRepo.add(med);
      scheduleRepo.add({ id: 'sched-1', medicationId: 'med-1', isActive: true });

      const scheduledTime = makeDate(2026, 2, 19, 9, 0).getTime();
      const nowMs = makeDate(2026, 2, 19, 10, 0).getTime();

      // Create a skipped dose log
      await doseLogRepo.create({
        medicationId: 'med-1',
        scheduleId: 'sched-1',
        scheduledTime,
        actionTime: makeDate(2026, 2, 19, 9, 5).getTime(),
        status: 'skipped',
        snoozedUntil: null,
      });

      const result = await takeMedicationDose('med-1', scheduleRepo, doseLogRepo, medRepo, nowMs);

      expect(result).toBe(true);

      // Verify the dose log was updated to taken
      const updatedLog = await doseLogRepo.getByScheduledTime('sched-1', scheduledTime);
      expect(updatedLog).not.toBeNull();
      expect(updatedLog!.status).toBe('taken');
      expect(updatedLog!.actionTime).toBe(nowMs);
    });

    it('prefers pending dose over skipped dose', async () => {
      const med = makeMed();
      medRepo.add(med);
      scheduleRepo.add({ id: 'sched-1', medicationId: 'med-1', isActive: true });
      scheduleRepo.add({ id: 'sched-2', medicationId: 'med-1', isActive: true });

      const skippedTime = makeDate(2026, 2, 19, 8, 0).getTime();
      const pendingTime = makeDate(2026, 2, 19, 12, 0).getTime();
      const nowMs = makeDate(2026, 2, 19, 13, 0).getTime();

      // Create a skipped dose for sched-1
      await doseLogRepo.create({
        medicationId: 'med-1',
        scheduleId: 'sched-1',
        scheduledTime: skippedTime,
        actionTime: makeDate(2026, 2, 19, 8, 5).getTime(),
        status: 'skipped',
        snoozedUntil: null,
      });

      // Create a pending dose for sched-2
      await doseLogRepo.create({
        medicationId: 'med-1',
        scheduleId: 'sched-2',
        scheduledTime: pendingTime,
        actionTime: null,
        status: 'pending',
        snoozedUntil: null,
      });

      const result = await takeMedicationDose('med-1', scheduleRepo, doseLogRepo, medRepo, nowMs);
      expect(result).toBe(true);

      // Pending dose should be taken (preferred over skipped)
      const pendingLog = await doseLogRepo.getByScheduledTime('sched-2', pendingTime);
      expect(pendingLog!.status).toBe('taken');

      // Skipped dose should remain skipped
      const skippedLog = await doseLogRepo.getByScheduledTime('sched-1', skippedTime);
      expect(skippedLog!.status).toBe('skipped');
    });

    it('handles snoozed dose (pending with snoozedUntil) as regular pending', async () => {
      const med = makeMed();
      medRepo.add(med);
      scheduleRepo.add({ id: 'sched-1', medicationId: 'med-1', isActive: true });

      const scheduledTime = makeDate(2026, 2, 19, 9, 0).getTime();
      const nowMs = makeDate(2026, 2, 19, 9, 30).getTime();
      const snoozeUntil = makeDate(2026, 2, 19, 9, 15).getTime();

      // Create a snoozed dose (pending with snoozedUntil)
      await doseLogRepo.create({
        medicationId: 'med-1',
        scheduleId: 'sched-1',
        scheduledTime,
        actionTime: null,
        status: 'pending',
        snoozedUntil: snoozeUntil,
      });

      const result = await takeMedicationDose('med-1', scheduleRepo, doseLogRepo, medRepo, nowMs);
      expect(result).toBe(true);

      // Snoozed dose is found as pending and taken
      const updatedLog = await doseLogRepo.getByScheduledTime('sched-1', scheduledTime);
      expect(updatedLog!.status).toBe('taken');
      expect(updatedLog!.snoozedUntil).toBeNull(); // cleared by updateStatus
    });

    it('returns false when no schedules exist', async () => {
      const med = makeMed();
      medRepo.add(med);
      // No schedules added

      const nowMs = makeDate(2026, 2, 19, 10, 0).getTime();
      const result = await takeMedicationDose('med-1', scheduleRepo, doseLogRepo, medRepo, nowMs);
      expect(result).toBe(false);
    });

    it('creates a new dose log when no pending or skipped dose exists', async () => {
      const med = makeMed();
      medRepo.add(med);
      scheduleRepo.add({ id: 'sched-1', medicationId: 'med-1', isActive: true });

      const nowMs = makeDate(2026, 2, 19, 10, 0).getTime();

      // No dose logs at all
      const result = await takeMedicationDose('med-1', scheduleRepo, doseLogRepo, medRepo, nowMs);
      expect(result).toBe(true);

      // A new dose log should have been created at current time
      const allLogs = doseLogRepo.getAll();
      expect(allLogs).toHaveLength(1);
      expect(allLogs[0].status).toBe('taken');
      expect(allLogs[0].scheduledTime).toBe(nowMs);
    });

    it('decrements stock for non-indefinite medication when taking skipped dose', async () => {
      const med = makeMed({ isStockIndefinite: false, stockCount: 10 });
      medRepo.add(med);
      scheduleRepo.add({ id: 'sched-1', medicationId: 'med-1', isActive: true });

      const scheduledTime = makeDate(2026, 2, 19, 9, 0).getTime();
      const nowMs = makeDate(2026, 2, 19, 10, 0).getTime();

      await doseLogRepo.create({
        medicationId: 'med-1',
        scheduleId: 'sched-1',
        scheduledTime,
        actionTime: makeDate(2026, 2, 19, 9, 5).getTime(),
        status: 'skipped',
        snoozedUntil: null,
      });

      await takeMedicationDose('med-1', scheduleRepo, doseLogRepo, medRepo, nowMs);

      // Stock should be decremented
      const updatedMed = await medRepo.getById('med-1');
      expect(updatedMed!.stockCount).toBe(9);
    });

    it('does not decrement stock for indefinite medication', async () => {
      const med = makeMed({ isStockIndefinite: true, stockCount: 10 });
      medRepo.add(med);
      scheduleRepo.add({ id: 'sched-1', medicationId: 'med-1', isActive: true });

      const scheduledTime = makeDate(2026, 2, 19, 9, 0).getTime();
      const nowMs = makeDate(2026, 2, 19, 10, 0).getTime();

      await doseLogRepo.create({
        medicationId: 'med-1',
        scheduleId: 'sched-1',
        scheduledTime,
        actionTime: makeDate(2026, 2, 19, 9, 5).getTime(),
        status: 'skipped',
        snoozedUntil: null,
      });

      await takeMedicationDose('med-1', scheduleRepo, doseLogRepo, medRepo, nowMs);

      const updatedMed = await medRepo.getById('med-1');
      expect(updatedMed!.stockCount).toBe(10); // unchanged
    });
  });

  describe('getSkippedForSchedule', () => {
    it('finds a skipped dose within time range', async () => {
      const scheduledTime = makeDate(2026, 2, 19, 9, 0).getTime();
      const startTime = makeDate(2026, 2, 19, 0, 0).getTime();
      const endTime = makeDate(2026, 2, 19, 23, 59).getTime();

      await doseLogRepo.create({
        medicationId: 'med-1',
        scheduleId: 'sched-1',
        scheduledTime,
        actionTime: makeDate(2026, 2, 19, 9, 5).getTime(),
        status: 'skipped',
        snoozedUntil: null,
      });

      const result = await doseLogRepo.getSkippedForSchedule('sched-1', startTime, endTime);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('skipped');
      expect(result!.scheduledTime).toBe(scheduledTime);
    });

    it('returns null when no skipped dose exists', async () => {
      const startTime = makeDate(2026, 2, 19, 0, 0).getTime();
      const endTime = makeDate(2026, 2, 19, 23, 59).getTime();

      // Create a pending dose (not skipped)
      await doseLogRepo.create({
        medicationId: 'med-1',
        scheduleId: 'sched-1',
        scheduledTime: makeDate(2026, 2, 19, 9, 0).getTime(),
        actionTime: null,
        status: 'pending',
        snoozedUntil: null,
      });

      const result = await doseLogRepo.getSkippedForSchedule('sched-1', startTime, endTime);
      expect(result).toBeNull();
    });

    it('ignores skipped doses outside time range', async () => {
      const startTime = makeDate(2026, 2, 19, 0, 0).getTime();
      const endTime = makeDate(2026, 2, 19, 23, 59).getTime();

      // Create a skipped dose for yesterday (outside range)
      await doseLogRepo.create({
        medicationId: 'med-1',
        scheduleId: 'sched-1',
        scheduledTime: makeDate(2026, 2, 18, 9, 0).getTime(),
        actionTime: makeDate(2026, 2, 18, 9, 5).getTime(),
        status: 'skipped',
        snoozedUntil: null,
      });

      const result = await doseLogRepo.getSkippedForSchedule('sched-1', startTime, endTime);
      expect(result).toBeNull();
    });

    it('ignores skipped doses for different schedule', async () => {
      const startTime = makeDate(2026, 2, 19, 0, 0).getTime();
      const endTime = makeDate(2026, 2, 19, 23, 59).getTime();

      await doseLogRepo.create({
        medicationId: 'med-1',
        scheduleId: 'sched-2', // different schedule
        scheduledTime: makeDate(2026, 2, 19, 9, 0).getTime(),
        actionTime: makeDate(2026, 2, 19, 9, 5).getTime(),
        status: 'skipped',
        snoozedUntil: null,
      });

      const result = await doseLogRepo.getSkippedForSchedule('sched-1', startTime, endTime);
      expect(result).toBeNull();
    });
  });

  describe('HomeScreen button visibility', () => {
    it('shows Take and Skip for pending dose', () => {
      const log: MockDoseLog = {
        id: 'log-1', medicationId: 'med-1', scheduleId: 'sched-1',
        scheduledTime: Date.now(), actionTime: null, status: 'pending', snoozedUntil: null,
      };
      const { showTake, showSkip } = getButtonVisibility(log);
      expect(showTake).toBe(true);
      expect(showSkip).toBe(true);
    });

    it('shows Take and Skip for snoozed dose (still pending)', () => {
      const now = Date.now();
      const log: MockDoseLog = {
        id: 'log-1', medicationId: 'med-1', scheduleId: 'sched-1',
        scheduledTime: now - 60000, actionTime: null, status: 'pending',
        snoozedUntil: now + 5 * 60 * 1000,
      };
      const { showTake, showSkip } = getButtonVisibility(log);
      expect(showTake).toBe(true);
      expect(showSkip).toBe(true);
    });

    it('shows only Take for skipped dose (no Skip button)', () => {
      const log: MockDoseLog = {
        id: 'log-1', medicationId: 'med-1', scheduleId: 'sched-1',
        scheduledTime: Date.now() - 60000, actionTime: Date.now(), status: 'skipped',
        snoozedUntil: null,
      };
      const { showTake, showSkip } = getButtonVisibility(log);
      expect(showTake).toBe(true);
      expect(showSkip).toBe(false);
    });

    it('hides both buttons for taken dose', () => {
      const log: MockDoseLog = {
        id: 'log-1', medicationId: 'med-1', scheduleId: 'sched-1',
        scheduledTime: Date.now() - 60000, actionTime: Date.now(), status: 'taken',
        snoozedUntil: null,
      };
      const { showTake, showSkip } = getButtonVisibility(log);
      expect(showTake).toBe(false);
      expect(showSkip).toBe(false);
    });

    it('shows Take and Skip when no dose log exists', () => {
      const { showTake, showSkip } = getButtonVisibility(null);
      expect(showTake).toBe(true);
      expect(showSkip).toBe(true);
    });
  });

  describe('isMedCompletedToday', () => {
    it('returns true for taken today', () => {
      const log: MockDoseLog = {
        id: 'log-1', medicationId: 'med-1', scheduleId: 'sched-1',
        scheduledTime: Date.now() - 60000, actionTime: Date.now(), status: 'taken',
        snoozedUntil: null,
      };
      expect(isMedCompletedToday(log)).toBe(true);
    });

    it('returns false for skipped today', () => {
      const log: MockDoseLog = {
        id: 'log-1', medicationId: 'med-1', scheduleId: 'sched-1',
        scheduledTime: Date.now() - 60000, actionTime: Date.now(), status: 'skipped',
        snoozedUntil: null,
      };
      expect(isMedCompletedToday(log)).toBe(false);
    });

    it('returns false for pending', () => {
      const log: MockDoseLog = {
        id: 'log-1', medicationId: 'med-1', scheduleId: 'sched-1',
        scheduledTime: Date.now(), actionTime: null, status: 'pending',
        snoozedUntil: null,
      };
      expect(isMedCompletedToday(log)).toBe(false);
    });

    it('returns false for taken yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const log: MockDoseLog = {
        id: 'log-1', medicationId: 'med-1', scheduleId: 'sched-1',
        scheduledTime: yesterday.getTime(), actionTime: yesterday.getTime(), status: 'taken',
        snoozedUntil: null,
      };
      expect(isMedCompletedToday(log)).toBe(false);
    });

    it('returns false for null dose log', () => {
      expect(isMedCompletedToday(null)).toBe(false);
    });
  });
});
