import {
  scheduleReminder,
  scheduleSnooze,
  cancelMedicationNotifications,
  NotificationData,
  showRefillReminder,
} from '../notifications/NotificationService';
import {
  MedicationRepository,
  ScheduleRepository,
  DoseLogRepository,
} from '../database/repositories';
import { Medication, Schedule } from '../../types';
import {
  getNextOccurrence,
  getScheduledTimesInRange,
} from '../../utils/dateUtils';
import { isScheduleActiveOnDate } from '../../utils/scheduleUtils';
import { AUTO_MISS_TIMEOUT } from '../../utils/constants';

/**
 * Schedule all upcoming reminders for a medication
 */
export async function scheduleMedicationReminders(
  medication: Medication,
  schedules: Schedule[],
  isStrictMode: boolean,
  daysAhead: number = 7
): Promise<void> {
  // Cancel existing notifications for this medication
  await cancelMedicationNotifications(medication.id);

  const now = new Date();
  const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  for (const schedule of schedules) {
    if (!schedule.isActive || !isScheduleActiveOnDate(schedule, now)) {
      continue;
    }

    // Get all scheduled times for the next X days
    const scheduledTimes = getScheduledTimesInRange(
      now,
      endDate,
      schedule.timesOfDay,
      schedule.scheduleType,
      {
        daysOfWeek: schedule.daysOfWeek || undefined,
        intervalDays: schedule.intervalDays || undefined,
        scheduleStartDate: new Date(schedule.startDate),
      }
    );

    // Schedule notifications for each time
    for (const scheduledTime of scheduledTimes) {
      // Skip times in the past
      if (scheduledTime.getTime() <= Date.now()) {
        continue;
      }

      const notificationData: NotificationData = {
        medicationId: medication.id,
        scheduleId: schedule.id,
        medicationName: medication.name,
        dosage: medication.dosage,
        scheduledTime: scheduledTime.getTime(),
        color: medication.color,
      };

      await scheduleReminder(notificationData, isStrictMode);

      // Create a pending dose log entry
      const existingLog = await DoseLogRepository.getByScheduledTime(
        schedule.id,
        scheduledTime.getTime()
      );

      if (!existingLog) {
        await DoseLogRepository.create({
          medicationId: medication.id,
          scheduleId: schedule.id,
          scheduledTime: scheduledTime.getTime(),
          actionTime: null,
          status: 'pending',
        });
      }
    }
  }
}

/**
 * Schedule reminders for all active medications of a profile
 */
export async function scheduleAllReminders(
  profileId: string,
  isStrictMode: boolean
): Promise<void> {
  const medications = await MedicationRepository.getActiveByProfileId(profileId);

  for (const medication of medications) {
    const schedules = await ScheduleRepository.getActiveByMedicationId(
      medication.id
    );
    await scheduleMedicationReminders(medication, schedules, isStrictMode);
  }
}

/**
 * Handle the "Take" action from a notification
 */
export async function handleTakeAction(
  medicationId: string,
  scheduleId: string,
  scheduledTime: number
): Promise<void> {
  // Find the pending dose log
  const doseLog = await DoseLogRepository.getByScheduledTime(
    scheduleId,
    scheduledTime
  );

  if (doseLog) {
    // Update status to taken
    await DoseLogRepository.updateStatus(doseLog.id, 'taken', Date.now());
  } else {
    // Create a new log entry
    await DoseLogRepository.create({
      medicationId,
      scheduleId,
      scheduledTime,
      actionTime: Date.now(),
      status: 'taken',
    });
  }

  // Get medication to check if stock is indefinite
  const medication = await MedicationRepository.getById(medicationId);

  // Only decrement stock and check refill if NOT indefinite
  if (medication && !medication.isStockIndefinite) {
    await MedicationRepository.decrementStock(medicationId);

    // Refresh medication to get updated stock count
    const updatedMed = await MedicationRepository.getById(medicationId);
    if (
      updatedMed &&
      updatedMed.stockCount <= updatedMed.stockReminderThreshold
    ) {
      await showRefillReminder(
        updatedMed.id,
        updatedMed.name,
        updatedMed.stockCount
      );
    }
  }
}

/**
 * Take the current/next pending dose for a medication (called from app UI)
 * Returns true if a dose was taken, false if no pending dose found
 */
export async function takeMedicationDose(medicationId: string): Promise<boolean> {
  // Get schedules for this medication
  const schedules = await ScheduleRepository.getActiveByMedicationId(medicationId);
  if (schedules.length === 0) return false;

  const now = Date.now();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

  // Look for pending dose logs for today
  for (const schedule of schedules) {
    const pendingDose = await DoseLogRepository.getPendingForSchedule(
      schedule.id,
      startOfDay,
      endOfDay
    );

    if (pendingDose) {
      await handleTakeAction(medicationId, schedule.id, pendingDose.scheduledTime);
      return true;
    }
  }

  // No pending dose found - create one for current time and mark as taken
  if (schedules.length > 0) {
    await handleTakeAction(medicationId, schedules[0].id, now);
    return true;
  }

  return false;
}

/**
 * Skip the current/next pending dose for a medication (called from app UI)
 * Returns true if a dose was skipped, false if no pending dose found
 */
export async function skipMedicationDose(medicationId: string): Promise<boolean> {
  // Get schedules for this medication
  const schedules = await ScheduleRepository.getActiveByMedicationId(medicationId);
  if (schedules.length === 0) return false;

  const now = Date.now();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

  // Look for pending dose logs for today
  for (const schedule of schedules) {
    const pendingDose = await DoseLogRepository.getPendingForSchedule(
      schedule.id,
      startOfDay,
      endOfDay
    );

    if (pendingDose) {
      await handleSkipAction(medicationId, schedule.id, pendingDose.scheduledTime);
      return true;
    }
  }

  // No pending dose found - create one for current time and mark as skipped
  if (schedules.length > 0) {
    await handleSkipAction(medicationId, schedules[0].id, now);
    return true;
  }

  return false;
}

/**
 * Handle the "Skip" action from a notification
 */
export async function handleSkipAction(
  medicationId: string,
  scheduleId: string,
  scheduledTime: number
): Promise<void> {
  const doseLog = await DoseLogRepository.getByScheduledTime(
    scheduleId,
    scheduledTime
  );

  if (doseLog) {
    await DoseLogRepository.updateStatus(doseLog.id, 'skipped', Date.now());
  } else {
    await DoseLogRepository.create({
      medicationId,
      scheduleId,
      scheduledTime,
      actionTime: Date.now(),
      status: 'skipped',
    });
  }
}

/**
 * Handle the "Snooze" action from a notification
 */
export async function handleSnoozeAction(
  data: NotificationData,
  snoozeDuration: number,
  isStrictMode: boolean
): Promise<void> {
  const snoozeUntil = Date.now() + snoozeDuration * 60 * 1000;

  // Update the dose log with snooze time
  const doseLog = await DoseLogRepository.getByScheduledTime(
    data.scheduleId,
    data.scheduledTime
  );

  if (doseLog) {
    await DoseLogRepository.updateSnooze(doseLog.id, snoozeUntil);
  }

  // Schedule a new reminder for later
  await scheduleSnooze(data, snoozeDuration, isStrictMode);
}

/**
 * Check for and mark missed doses
 * Should be called periodically (e.g., every 30 minutes)
 */
export async function checkMissedDoses(): Promise<void> {
  const cutoffTime = Date.now() - AUTO_MISS_TIMEOUT;

  // Get all pending doses that are past the auto-miss timeout
  const pendingDoses = await DoseLogRepository.getPending(cutoffTime);

  if (pendingDoses.length > 0) {
    const missedIds = pendingDoses.map((dose) => dose.id);
    await DoseLogRepository.markAsMissed(missedIds);
  }
}

/**
 * Get today's doses for a profile
 */
export async function getTodaysDoses(profileId: string) {
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0)).getTime();
  const endOfDay = new Date(now.setHours(23, 59, 59, 999)).getTime();

  const logs = await DoseLogRepository.getByProfileId(
    profileId,
    startOfDay,
    endOfDay
  );

  // Group by medication
  const medications = await MedicationRepository.getActiveByProfileId(profileId);
  const dosesMap = new Map<
    string,
    {
      medication: Medication;
      doses: typeof logs;
    }
  >();

  for (const med of medications) {
    dosesMap.set(med.id, {
      medication: med,
      doses: logs.filter((log) => log.medicationId === med.id),
    });
  }

  return Array.from(dosesMap.values());
}

/**
 * Calculate when the next dose is due for a medication
 */
export function getNextDoseTime(schedule: Schedule): Date | null {
  if (!schedule.isActive) return null;

  const now = new Date();
  if (!isScheduleActiveOnDate(schedule, now)) return null;

  // Find the next occurrence
  for (const timeStr of schedule.timesOfDay) {
    const nextTime = getNextOccurrence(timeStr, schedule.scheduleType, {
      daysOfWeek: schedule.daysOfWeek || undefined,
      intervalDays: schedule.intervalDays || undefined,
    });

    // For now, return the first upcoming time
    // In a full implementation, we'd compare all times and return the soonest
    if (nextTime.getTime() > Date.now()) {
      return nextTime;
    }
  }

  return null;
}
