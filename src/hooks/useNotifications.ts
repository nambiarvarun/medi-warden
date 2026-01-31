import { useEffect, useCallback } from 'react';
import { useSettingsStore, useMedicationStore } from '../store';
import {
  initializeNotifications,
  requestPermissions,
  setNotificationHandlers,
  NotificationData,
} from '../services/notifications/NotificationService';
import {
  scheduleMedicationReminders,
  scheduleAllReminders,
  handleTakeAction,
  handleSkipAction,
  handleSnoozeAction,
} from '../services/scheduler/ReminderScheduler';
import { ScheduleRepository } from '../services/database/repositories';

export function useNotifications() {
  const { activeProfileId, reminderMode, snoozeDuration } = useSettingsStore();
  const { medications, decrementStock, loadMedications } = useMedicationStore();

  // Initialize notifications on mount
  useEffect(() => {
    async function init() {
      await initializeNotifications();
      await requestPermissions();
    }
    init();
  }, []);

  // Set up notification handlers
  useEffect(() => {
    const unsubscribe = setNotificationHandlers({
      onTake: async (data: NotificationData) => {
        await handleTakeAction(
          data.medicationId,
          data.scheduleId,
          data.scheduledTime
        );
        // Refresh medications to update stock count in UI
        if (activeProfileId) {
          await loadMedications(activeProfileId);
        }
      },
      onSkip: async (data: NotificationData) => {
        await handleSkipAction(
          data.medicationId,
          data.scheduleId,
          data.scheduledTime
        );
      },
      onSnooze: async (data: NotificationData, duration: number) => {
        await handleSnoozeAction(
          data,
          snoozeDuration,
          reminderMode === 'strict'
        );
      },
      onPress: (data: NotificationData) => {
        // Navigate to medication detail or home screen
        // This would require navigation ref, which we'll handle separately
        console.log('Notification pressed:', data);
      },
    });

    return unsubscribe;
  }, [activeProfileId, snoozeDuration, reminderMode, loadMedications]);

  // Schedule all reminders when profile or medications change
  useEffect(() => {
    if (activeProfileId && medications.length > 0) {
      scheduleAllReminders(activeProfileId, reminderMode === 'strict');
    }
  }, [activeProfileId, medications, reminderMode]);

  // Function to manually schedule reminders for a specific medication
  const scheduleForMedication = useCallback(
    async (medicationId: string) => {
      const medication = medications.find((m) => m.id === medicationId);
      if (!medication) return;

      const schedules = await ScheduleRepository.getActiveByMedicationId(
        medicationId
      );
      await scheduleMedicationReminders(
        medication,
        schedules,
        reminderMode === 'strict'
      );
    },
    [medications, reminderMode]
  );

  // Function to refresh all reminders
  const refreshReminders = useCallback(async () => {
    if (activeProfileId) {
      await scheduleAllReminders(activeProfileId, reminderMode === 'strict');
    }
  }, [activeProfileId, reminderMode]);

  return {
    scheduleForMedication,
    refreshReminders,
  };
}
