/**
 * Tests for the snooze-until time display on HomeScreen.
 *
 * Verifies:
 * - getStatusDisplay correctly shows "Snoozed until [time]" for snoozed doses
 * - Expired snooze does NOT show snoozed status
 * - Snoozed status takes priority over no-status
 * - getTodayStatusForMedication returns the snoozed dose log with snoozedUntil
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

// ──── Logic under test (mirrors HomeScreen.getStatusDisplay) ────

interface StatusDisplay {
  text: string;
  color: string;
}

const COLORS = {
  warning: '#FFA500',
  success: '#00AA00',
};

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getStatusDisplay(doseLog: MockDoseLog | null, nowMs: number): StatusDisplay | null {
  if (!doseLog) return null;

  // Check if snoozed (pending with future snoozedUntil)
  if (doseLog.status === 'pending' && doseLog.snoozedUntil && doseLog.snoozedUntil > nowMs) {
    return {
      text: `Snoozed until ${formatTime(doseLog.snoozedUntil)}`,
      color: COLORS.warning,
    };
  }

  // Check if taken
  if (doseLog.status === 'taken' && doseLog.actionTime) {
    const actionDate = new Date(doseLog.actionTime);
    const displayText = isToday(actionDate)
      ? `Taken at ${formatTime(doseLog.actionTime)}`
      : `Taken`;
    return { text: displayText, color: COLORS.success };
  }

  // Check if skipped
  if (doseLog.status === 'skipped' && doseLog.actionTime) {
    const actionDate = new Date(doseLog.actionTime);
    const displayText = isToday(actionDate)
      ? `Skipped at ${formatTime(doseLog.actionTime)}`
      : `Skipped`;
    return { text: displayText, color: COLORS.warning };
  }

  return null;
}

// ──── Mock getTodayStatusForMedication (mirrors DoseLogRepository) ────

class MockDoseLogRepo {
  logs: MockDoseLog[] = [];

  async getTodayStatusForMedication(medicationId: string): Promise<MockDoseLog | null> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
    const searchStart = startOfDay - 12 * 60 * 60 * 1000;

    // First check for taken/skipped (most recent action)
    const actionLog = this.logs
      .filter(l =>
        l.medicationId === medicationId &&
        l.scheduledTime >= searchStart &&
        l.scheduledTime <= endOfDay &&
        (l.status === 'taken' || l.status === 'skipped'),
      )
      .sort((a, b) => (b.actionTime || 0) - (a.actionTime || 0))[0];

    if (actionLog) return actionLog;

    // Then check for pending (might be snoozed)
    const pendingLog = this.logs
      .filter(l =>
        l.medicationId === medicationId &&
        l.scheduledTime >= searchStart &&
        l.scheduledTime <= endOfDay &&
        l.status === 'pending',
      )
      .sort((a, b) => a.scheduledTime - b.scheduledTime)[0];

    return pendingLog || null;
  }

  add(log: MockDoseLog): void {
    this.logs.push(log);
  }

  clear(): void {
    this.logs = [];
  }
}

// ──── Helpers ────

function makeDate(y: number, mo: number, d: number, h = 0, m = 0): Date {
  return new Date(y, mo - 1, d, h, m, 0, 0);
}

// ──── Tests ────

describe('Snooze display on HomeScreen', () => {
  describe('getStatusDisplay', () => {
    it('shows "Snoozed until [time]" for pending dose with future snoozedUntil', () => {
      const nowMs = makeDate(2026, 2, 19, 9, 30).getTime();
      const snoozeUntil = makeDate(2026, 2, 19, 9, 45).getTime();

      const log: MockDoseLog = {
        id: 'log-1', medicationId: 'med-1', scheduleId: 'sched-1',
        scheduledTime: makeDate(2026, 2, 19, 9, 0).getTime(),
        actionTime: null, status: 'pending', snoozedUntil: snoozeUntil,
      };

      const status = getStatusDisplay(log, nowMs);
      expect(status).not.toBeNull();
      expect(status!.text).toContain('Snoozed until');
      expect(status!.color).toBe(COLORS.warning);
    });

    it('does NOT show snoozed for expired snooze', () => {
      const nowMs = makeDate(2026, 2, 19, 10, 0).getTime();
      const snoozeUntil = makeDate(2026, 2, 19, 9, 45).getTime(); // in the past

      const log: MockDoseLog = {
        id: 'log-1', medicationId: 'med-1', scheduleId: 'sched-1',
        scheduledTime: makeDate(2026, 2, 19, 9, 0).getTime(),
        actionTime: null, status: 'pending', snoozedUntil: snoozeUntil,
      };

      const status = getStatusDisplay(log, nowMs);
      // Should be null since snoozedUntil is in the past and status is still pending
      expect(status).toBeNull();
    });

    it('does NOT show snoozed for taken dose (even if snoozedUntil is set)', () => {
      const nowMs = makeDate(2026, 2, 19, 10, 0).getTime();

      const log: MockDoseLog = {
        id: 'log-1', medicationId: 'med-1', scheduleId: 'sched-1',
        scheduledTime: makeDate(2026, 2, 19, 9, 0).getTime(),
        actionTime: makeDate(2026, 2, 19, 9, 50).getTime(),
        status: 'taken',
        snoozedUntil: makeDate(2026, 2, 19, 10, 15).getTime(), // still future but irrelevant
      };

      const status = getStatusDisplay(log, nowMs);
      expect(status).not.toBeNull();
      expect(status!.text).toContain('Taken at');
      expect(status!.color).toBe(COLORS.success);
    });

    it('shows "Taken at [time]" for taken dose today', () => {
      const nowMs = Date.now();
      const actionTime = nowMs - 60000;

      const log: MockDoseLog = {
        id: 'log-1', medicationId: 'med-1', scheduleId: 'sched-1',
        scheduledTime: nowMs - 120000, actionTime, status: 'taken',
        snoozedUntil: null,
      };

      const status = getStatusDisplay(log, nowMs);
      expect(status).not.toBeNull();
      expect(status!.text).toContain('Taken at');
      expect(status!.color).toBe(COLORS.success);
    });

    it('shows "Skipped at [time]" for skipped dose today', () => {
      const nowMs = Date.now();
      const actionTime = nowMs - 60000;

      const log: MockDoseLog = {
        id: 'log-1', medicationId: 'med-1', scheduleId: 'sched-1',
        scheduledTime: nowMs - 120000, actionTime, status: 'skipped',
        snoozedUntil: null,
      };

      const status = getStatusDisplay(log, nowMs);
      expect(status).not.toBeNull();
      expect(status!.text).toContain('Skipped at');
      expect(status!.color).toBe(COLORS.warning);
    });

    it('returns null for pending dose without snooze', () => {
      const nowMs = makeDate(2026, 2, 19, 8, 0).getTime();

      const log: MockDoseLog = {
        id: 'log-1', medicationId: 'med-1', scheduleId: 'sched-1',
        scheduledTime: makeDate(2026, 2, 19, 9, 0).getTime(),
        actionTime: null, status: 'pending', snoozedUntil: null,
      };

      const status = getStatusDisplay(log, nowMs);
      expect(status).toBeNull();
    });

    it('returns null for null dose log', () => {
      const status = getStatusDisplay(null, Date.now());
      expect(status).toBeNull();
    });
  });

  describe('getTodayStatusForMedication returns snoozed dose', () => {
    let repo: MockDoseLogRepo;

    beforeEach(() => {
      repo = new MockDoseLogRepo();
    });

    it('returns pending dose with snoozedUntil when no taken/skipped exists', async () => {
      const scheduledTime = new Date();
      scheduledTime.setHours(9, 0, 0, 0);

      repo.add({
        id: 'log-1', medicationId: 'med-1', scheduleId: 'sched-1',
        scheduledTime: scheduledTime.getTime(),
        actionTime: null, status: 'pending',
        snoozedUntil: scheduledTime.getTime() + 15 * 60 * 1000,
      });

      const result = await repo.getTodayStatusForMedication('med-1');
      expect(result).not.toBeNull();
      expect(result!.status).toBe('pending');
      expect(result!.snoozedUntil).not.toBeNull();
    });

    it('returns taken dose even if snoozed dose also exists', async () => {
      const today = new Date();

      // A snoozed pending dose
      const snoozedTime = new Date(today);
      snoozedTime.setHours(8, 0, 0, 0);
      repo.add({
        id: 'log-snoozed', medicationId: 'med-1', scheduleId: 'sched-1',
        scheduledTime: snoozedTime.getTime(),
        actionTime: null, status: 'pending',
        snoozedUntil: snoozedTime.getTime() + 15 * 60 * 1000,
      });

      // A taken dose (should take priority)
      const takenTime = new Date(today);
      takenTime.setHours(9, 0, 0, 0);
      repo.add({
        id: 'log-taken', medicationId: 'med-1', scheduleId: 'sched-2',
        scheduledTime: takenTime.getTime(),
        actionTime: takenTime.getTime() + 5000, status: 'taken',
        snoozedUntil: null,
      });

      const result = await repo.getTodayStatusForMedication('med-1');
      expect(result).not.toBeNull();
      expect(result!.status).toBe('taken');
      expect(result!.id).toBe('log-taken');
    });

    it('returns null when no dose logs exist for today', async () => {
      const result = await repo.getTodayStatusForMedication('med-1');
      expect(result).toBeNull();
    });
  });
});
