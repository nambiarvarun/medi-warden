import {
  scheduleReminder,
  cancelMedicationNotifications,
  cancelNotification,
  cancelScheduledTriggers,
  NotificationData,
  showRefillReminder,
  getPendingNotifications,
} from '../notifications/NotificationService';
import {
  MedicationRepository,
  ScheduleRepository,
  DoseLogRepository,
  SettingsRepository,
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
 * Returns the number of notifications scheduled
 */
export async function scheduleMedicationReminders(
  medication: Medication,
  schedules: Schedule[],
  isStrictMode: boolean,
  daysAhead: number = 7
): Promise<number> {
  console.log(`[Scheduler] scheduleMedicationReminders called for ${medication.name} (id: ${medication.id}, active: ${medication.isActive})`);

  try {
    // Cancel only future scheduled (trigger) notifications — NOT displayed ones.
    // Displayed notifications (already fired) must remain visible for the user to act on.
    await cancelScheduledTriggers(medication.id);
    console.log(`[Scheduler] Cancelled future triggers for ${medication.name}`);

    // Skip if medication is inactive
    if (!medication.isActive) {
      console.log(`[Scheduler] Medication ${medication.name} is inactive, skipping scheduling`);
      return 0;
    }

    const now = new Date();
    const nowMs = now.getTime();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();
    const endDate = new Date(nowMs + daysAhead * 24 * 60 * 60 * 1000);

    console.log(`[Scheduler] Scheduling for ${medication.name} from ${now.toLocaleString()} to ${endDate.toLocaleString()} (${daysAhead} days)`);
    console.log(`[Scheduler] Number of schedules: ${schedules.length}`);

    let notificationsScheduled = 0;

    for (const schedule of schedules) {
      if (!schedule.isActive) {
        console.log(`[Scheduler] Schedule ${schedule.id} is inactive, skipping`);
        continue;
      }
      if (!isScheduleActiveOnDate(schedule, now)) {
        console.log(`[Scheduler] Schedule ${schedule.id} is not active on current date, skipping`);
        continue;
      }

      // Get all scheduled times for the next X days, starting from today's midnight
      // so that past-today times are included for dose log creation
      const scheduledTimes = getScheduledTimesInRange(
        todayStart,
        endDate,
        schedule.timesOfDay,
        schedule.scheduleType,
        {
          daysOfWeek: schedule.daysOfWeek || undefined,
          intervalDays: schedule.intervalDays || undefined,
          scheduleStartDate: new Date(schedule.startDate),
        }
      );

      console.log(`[Scheduler] Found ${scheduledTimes.length} scheduled times for schedule ${schedule.id}`);

      for (const scheduledTime of scheduledTimes) {
        const scheduledTimeMs = scheduledTime.getTime();
        const isPastTime = scheduledTimeMs <= nowMs;

        // Always create dose log for today's times (even past ones — marks overdue)
        if (scheduledTimeMs >= todayStartMs && scheduledTimeMs < todayStartMs + 24 * 60 * 60 * 1000) {
          const existingLog = await DoseLogRepository.getByScheduledTime(
            schedule.id,
            scheduledTimeMs
          );

          if (!existingLog) {
            await DoseLogRepository.create({
              medicationId: medication.id,
              scheduleId: schedule.id,
              scheduledTime: scheduledTimeMs,
              actionTime: null,
              status: 'pending',
              snoozedUntil: null,
            });
            console.log(`[Scheduler] Created dose log for ${medication.name} at ${scheduledTime.toLocaleString()}${isPastTime ? ' (overdue)' : ''}`);
          }
        }

        // Skip scheduling notifications for past times
        if (isPastTime) {
          continue;
        }

        const notificationData: NotificationData = {
          medicationId: medication.id,
          scheduleId: schedule.id,
          medicationName: medication.name,
          dosage: medication.dosage,
          scheduledTime: scheduledTimeMs,
          color: medication.color,
        };

        try {
          await scheduleReminder(notificationData, isStrictMode);
          notificationsScheduled++;
          console.log(`[Scheduler] Scheduled notification for ${medication.name} at ${scheduledTime.toLocaleString()}`);
        } catch (error) {
          console.error(`[Scheduler] Failed to schedule notification for ${medication.name} at ${scheduledTime.toLocaleString()}:`, error);
        }
      }
    }

    console.log(`[Scheduler] Total notifications scheduled for ${medication.name}: ${notificationsScheduled}`);
    return notificationsScheduled;
  } catch (error) {
    console.error(`[Scheduler] Error in scheduleMedicationReminders for ${medication.name}:`, error);
    return 0;
  }
}

/**
 * Check if notifications are scheduled far enough ahead and top up if needed.
 * Called after Take/Skip/Snooze actions to ensure continuous notification coverage.
 *
 * @param medicationId - The medication to check
 * @param isStrictMode - Whether to use strict mode for new notifications
 * @param requiredDaysAhead - Minimum days of coverage required (default 14)
 */
export async function checkAndTopUpNotifications(
  medicationId: string,
  isStrictMode: boolean,
  requiredDaysAhead: number = 14
): Promise<void> {
  console.log(`[TopUp] Checking notification coverage for medication: ${medicationId}`);

  try {
    // Get pending notifications for this medication
    const allPending = await getPendingNotifications();
    const medNotifications = allPending.filter(
      (n) => n.notification.data?.medicationId === medicationId
    );

    if (medNotifications.length === 0) {
      console.log(`[TopUp] No pending notifications found for medication ${medicationId}`);
      // No notifications at all - schedule full 14 days
      await rescheduleWithDays(medicationId, isStrictMode, requiredDaysAhead);
      return;
    }

    // Find the latest scheduled notification
    const latestTimestamp = Math.max(
      ...medNotifications.map((n) => {
        const trigger = n.trigger as { timestamp?: number } | undefined;
        return trigger?.timestamp || 0;
      })
    );
    const now = Date.now();
    const daysUntilLatest = (latestTimestamp - now) / (24 * 60 * 60 * 1000);

    console.log(`[TopUp] Latest notification is ${daysUntilLatest.toFixed(1)} days away (need ${requiredDaysAhead})`);

    // If coverage is less than half the required days, top up
    if (daysUntilLatest < requiredDaysAhead / 2) {
      console.log(`[TopUp] Coverage insufficient, rescheduling for ${requiredDaysAhead} days`);
      await rescheduleWithDays(medicationId, isStrictMode, requiredDaysAhead);
    } else {
      console.log(`[TopUp] Coverage sufficient, no action needed`);
    }
  } catch (error) {
    console.error(`[TopUp] Error checking notifications for ${medicationId}:`, error);
  }
}

/**
 * Helper to reschedule a medication with a specific number of days ahead
 */
async function rescheduleWithDays(
  medicationId: string,
  isStrictMode: boolean,
  daysAhead: number
): Promise<void> {
  const medication = await MedicationRepository.getById(medicationId);
  if (!medication || !medication.isActive) {
    console.log(`[TopUp] Medication ${medicationId} not found or inactive, skipping`);
    return;
  }

  const schedules = await ScheduleRepository.getActiveByMedicationId(medicationId);
  if (schedules.length === 0) {
    console.log(`[TopUp] No active schedules for ${medicationId}, skipping`);
    return;
  }

  const count = await scheduleMedicationReminders(medication, schedules, isStrictMode, daysAhead);
  console.log(`[TopUp] Rescheduled ${count} notifications for ${medication.name}`);
}

/**
 * Clean up notifications for inactive or deleted medications.
 * Cancels orphan notifications without touching active ones.
 */
async function cleanupInactiveNotifications(profileId: string): Promise<void> {
  try {
    // Cancel notifications for inactive medications in the profile
    const allMeds = await MedicationRepository.getByProfileId(profileId);
    const inactiveMeds = allMeds.filter(m => !m.isActive);
    for (const med of inactiveMeds) {
      await cancelMedicationNotifications(med.id);
    }
    if (inactiveMeds.length > 0) {
      console.log(`[Scheduler] Cleaned up notifications for ${inactiveMeds.length} inactive medications`);
    }

    // Orphan cleanup: cancel notifications for medications that no longer exist in this profile
    const allMedIds = new Set(allMeds.map(m => m.id));
    const allTriggers = await getPendingNotifications();
    const cancelledOrphanIds = new Set<string>();
    for (const trigger of allTriggers) {
      const triggerMedId = trigger.notification.data?.medicationId as string | undefined;
      if (triggerMedId && !allMedIds.has(triggerMedId) && !cancelledOrphanIds.has(triggerMedId)) {
        await cancelMedicationNotifications(triggerMedId);
        cancelledOrphanIds.add(triggerMedId);
      }
    }
    if (cancelledOrphanIds.size > 0) {
      console.log(`[Scheduler] Cancelled notifications for ${cancelledOrphanIds.size} orphan medications`);
    }
  } catch (error) {
    console.error('[Scheduler] Error in cleanupInactiveNotifications:', error);
  }
}

/**
 * Lightweight startup initialization.
 * Cleans up stale/orphan notifications, then fills gaps for today without
 * cancelling any existing scheduled or displayed notifications.
 */
export async function initializeSchedulingOnStartup(
  profileId: string,
  isStrictMode: boolean
): Promise<void> {
  console.log(`[Scheduler] initializeSchedulingOnStartup called for profile: ${profileId}`);

  try {
    await cleanupInactiveNotifications(profileId);
    await ensureTodaysDosesScheduled(profileId, isStrictMode);
    console.log('[Scheduler] Startup initialization completed');
  } catch (error) {
    console.error('[Scheduler] Error in initializeSchedulingOnStartup:', error);
  }
}

/**
 * Handle a profile switch: cancel old profile's notifications, schedule new profile's.
 */
export async function handleProfileSwitch(
  oldProfileId: string | null,
  newProfileId: string,
  isStrictMode: boolean
): Promise<void> {
  console.log(`[Scheduler] handleProfileSwitch: ${oldProfileId} → ${newProfileId}`);

  try {
    // Cancel all notifications for the old profile's medications
    if (oldProfileId) {
      const oldMeds = await MedicationRepository.getByProfileId(oldProfileId);
      for (const med of oldMeds) {
        await cancelMedicationNotifications(med.id);
      }
      console.log(`[Scheduler] Cancelled notifications for ${oldMeds.length} medications from old profile`);
    }

    // Schedule notifications for the new profile's active medications
    const newActiveMeds = await MedicationRepository.getActiveByProfileId(newProfileId);
    for (const medication of newActiveMeds) {
      const schedules = await ScheduleRepository.getActiveByMedicationId(medication.id);
      await scheduleMedicationReminders(medication, schedules, isStrictMode);
    }
    console.log(`[Scheduler] Scheduled notifications for ${newActiveMeds.length} medications in new profile`);
  } catch (error) {
    console.error('[Scheduler] Error in handleProfileSwitch:', error);
  }
}

/**
 * Schedule reminders for all active medications of a profile.
 * Also cancels stale notifications for inactive medications.
 */
export async function scheduleAllReminders(
  profileId: string,
  isStrictMode: boolean
): Promise<void> {
  console.log(`[Scheduler] scheduleAllReminders called for profile: ${profileId}, strict mode: ${isStrictMode}`);

  try {
    // First: clean up notifications for inactive medications
    // This prevents ghost notifications from deactivated meds
    const allMeds = await MedicationRepository.getByProfileId(profileId);
    const inactiveMeds = allMeds.filter(m => !m.isActive);
    for (const med of inactiveMeds) {
      await cancelMedicationNotifications(med.id);
    }
    if (inactiveMeds.length > 0) {
      console.log(`[Scheduler] Cleaned up notifications for ${inactiveMeds.length} inactive medications`);
    }

    // Then: schedule for active medications
    const activeMeds = allMeds.filter(m => m.isActive);
    console.log(`[Scheduler] Found ${activeMeds.length} active medications`);

    for (const medication of activeMeds) {
      const schedules = await ScheduleRepository.getActiveByMedicationId(
        medication.id
      );
      console.log(`[Scheduler] Medication ${medication.name} has ${schedules.length} active schedules`);
      await scheduleMedicationReminders(medication, schedules, isStrictMode);
    }

    // Orphan cleanup: cancel trigger notifications for medications that no longer exist
    // (e.g., deleted meds whose DB row is gone — can't be caught by inactive check above)
    const activeMedIds = new Set(activeMeds.map(m => m.id));
    const allTriggers = await getPendingNotifications();
    let orphansCancelled = 0;
    for (const trigger of allTriggers) {
      const triggerMedId = trigger.notification.data?.medicationId as string | undefined;
      if (triggerMedId && !activeMedIds.has(triggerMedId)) {
        await cancelMedicationNotifications(triggerMedId);
        orphansCancelled++;
      }
    }
    if (orphansCancelled > 0) {
      console.log(`[Scheduler] Cancelled ${orphansCancelled} orphan trigger notifications`);
    }

    console.log('[Scheduler] Finished scheduling all reminders');
  } catch (error) {
    console.error('[Scheduler] Error in scheduleAllReminders:', error);
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
      snoozedUntil: null,
    });
  }

  // Cancel the scheduled notification for this specific dose time (if still pending)
  await cancelNotification(`reminder-${scheduleId}-${scheduledTime}`);

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

  // Top up notifications to ensure 14 days of coverage
  try {
    const settings = await SettingsRepository.getAll();
    const isStrictMode = settings.reminderMode === 'strict';
    await checkAndTopUpNotifications(medicationId, isStrictMode);
  } catch (error) {
    console.error('[handleTakeAction] Error topping up notifications:', error);
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
  // Include previous day's evening doses (12 hours before today) for after-midnight actions
  const searchStart = startOfDay - 12 * 60 * 60 * 1000;

  // Look for pending dose logs (including yesterday's evening doses)
  for (const schedule of schedules) {
    const pendingDose = await DoseLogRepository.getPendingForSchedule(
      schedule.id,
      searchStart,
      endOfDay
    );

    if (pendingDose) {
      await handleTakeAction(medicationId, schedule.id, pendingDose.scheduledTime);
      return true;
    }
  }

  // Look for skipped dose logs (user wants to undo skip and take instead)
  for (const schedule of schedules) {
    const skippedDose = await DoseLogRepository.getSkippedForSchedule(
      schedule.id,
      searchStart,
      endOfDay
    );

    if (skippedDose) {
      await handleTakeAction(medicationId, schedule.id, skippedDose.scheduledTime);
      return true;
    }
  }

  // No pending or skipped dose found - create one for current time and mark as taken
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
  // Include previous day's evening doses (12 hours before today) for after-midnight actions
  const searchStart = startOfDay - 12 * 60 * 60 * 1000;

  // Look for pending dose logs (including yesterday's evening doses)
  for (const schedule of schedules) {
    const pendingDose = await DoseLogRepository.getPendingForSchedule(
      schedule.id,
      searchStart,
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
      snoozedUntil: null,
    });
  }

  // Cancel the scheduled notification for this specific dose time (if still pending)
  await cancelNotification(`reminder-${scheduleId}-${scheduledTime}`);

  // Top up notifications to ensure 14 days of coverage
  try {
    const settings = await SettingsRepository.getAll();
    const isStrictMode = settings.reminderMode === 'strict';
    await checkAndTopUpNotifications(medicationId, isStrictMode);
  } catch (error) {
    console.error('[handleSkipAction] Error topping up notifications:', error);
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
  console.log(`[handleSnoozeAction] Starting snooze for ${snoozeDuration} minutes, strict=${isStrictMode}`);

  try {
    // Verify medication still exists and is active before scheduling snooze
    const medication = await MedicationRepository.getById(data.medicationId);
    if (!medication || !medication.isActive) {
      console.log(`[handleSnoozeAction] Medication ${data.medicationId} not found or inactive, skipping snooze`);
      return;
    }

    const snoozeTime = Date.now() + snoozeDuration * 60 * 1000;

    // Update the dose log with snooze time
    const doseLog = await DoseLogRepository.getByScheduledTime(
      data.scheduleId,
      data.scheduledTime
    );

    if (doseLog) {
      await DoseLogRepository.updateSnooze(doseLog.id, snoozeTime);
      console.log(`[handleSnoozeAction] Updated dose log ${doseLog.id} with snooze until ${new Date(snoozeTime).toLocaleString()}`);
    }

    // Schedule a new reminder at the exact snooze time
    const snoozeNotificationId = await scheduleReminder(
      {
        ...data,
        scheduledTime: snoozeTime,
      },
      isStrictMode
    );
    console.log(`[handleSnoozeAction] Snooze notification scheduled: ${snoozeNotificationId} at ${new Date(snoozeTime).toLocaleString()}`);
  } catch (error) {
    console.error(`[handleSnoozeAction] Error:`, error);
    throw error;
  }
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
 * Ensure today's doses are scheduled - called on app foreground.
 * Lightweight check: fetches pending notifications once, then fills gaps.
 * Respects schedule type (daily/weekly/interval).
 */
export async function ensureTodaysDosesScheduled(
  profileId: string,
  isStrictMode: boolean
): Promise<void> {
  console.log(`[Scheduler] ensureTodaysDosesScheduled called for profile: ${profileId}`);

  try {
    const medications = await MedicationRepository.getActiveByProfileId(profileId);
    const now = new Date();
    const nowMs = now.getTime();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Fetch all pending notifications ONCE upfront (not inside the loop)
    const allPending = await getPendingNotifications();
    const pendingIds = new Set(allPending.map(n => n.notification.id));

    for (const medication of medications) {
      const schedules = await ScheduleRepository.getActiveByMedicationId(medication.id);

      for (const schedule of schedules) {
        if (!schedule.isActive || !schedule.timesOfDay) continue;
        if (!isScheduleActiveOnDate(schedule, now)) continue;

        // Use getScheduledTimesInRange to correctly handle weekly/interval
        const todayTimes = getScheduledTimesInRange(
          todayStart,
          todayEnd,
          schedule.timesOfDay,
          schedule.scheduleType,
          {
            daysOfWeek: schedule.daysOfWeek || undefined,
            intervalDays: schedule.intervalDays || undefined,
            scheduleStartDate: new Date(schedule.startDate),
          }
        );

        for (const scheduledTime of todayTimes) {
          const scheduledTimeMs = scheduledTime.getTime();

          // Skip past times
          if (scheduledTimeMs <= nowMs) continue;

          // Ensure dose log exists
          const existingLog = await DoseLogRepository.getByScheduledTime(
            schedule.id,
            scheduledTimeMs
          );

          if (!existingLog) {
            await DoseLogRepository.create({
              medicationId: medication.id,
              scheduleId: schedule.id,
              scheduledTime: scheduledTimeMs,
              actionTime: null,
              status: 'pending',
              snoozedUntil: null,
            });
            console.log(`[Scheduler] Created missing dose log for ${medication.name} at ${scheduledTime.toLocaleTimeString()}`);
          }

          // Ensure notification is scheduled
          const notificationId = `reminder-${schedule.id}-${scheduledTimeMs}`;
          if (!pendingIds.has(notificationId)) {
            const notificationData: NotificationData = {
              medicationId: medication.id,
              scheduleId: schedule.id,
              medicationName: medication.name,
              dosage: medication.dosage,
              scheduledTime: scheduledTimeMs,
              color: medication.color,
            };

            try {
              await scheduleReminder(notificationData, isStrictMode);
              pendingIds.add(notificationId);
              console.log(`[Scheduler] Scheduled missing notification for ${medication.name} at ${scheduledTime.toLocaleTimeString()}`);
            } catch (error) {
              console.error(`[Scheduler] Failed to schedule notification:`, error);
            }
          }
        }
      }
    }

    console.log(`[Scheduler] ensureTodaysDosesScheduled completed`);
  } catch (error) {
    console.error(`[Scheduler] Error in ensureTodaysDosesScheduled:`, error);
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
