import notifee, {
  AndroidImportance,
  AndroidCategory,
  AndroidVisibility,
  TriggerType,
  TimestampTrigger,
  AlarmType,
  AuthorizationStatus,
  AndroidNotificationSetting,
  EventType,
  Event,
} from '@notifee/react-native';
import { NOTIFICATION_CHANNEL } from '../../utils/constants';

export interface NotificationData {
  medicationId: string;
  scheduleId: string;
  medicationName: string;
  dosage: string;
  scheduledTime: number;
  color: string;
}

/**
 * Initialize notification channels (required for Android)
 */
export async function initializeNotifications(): Promise<void> {
  // Create channels for Android
  await notifee.createChannel({
    id: NOTIFICATION_CHANNEL.REMINDER,
    name: 'Medication Reminders',
    description: 'Reminders to take your medications',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });

  await notifee.createChannel({
    id: NOTIFICATION_CHANNEL.ALARM,
    name: 'Medication Alarms',
    description: 'Full-screen alarms for critical medications',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });

  await notifee.createChannel({
    id: NOTIFICATION_CHANNEL.REFILL,
    name: 'Refill Alerts',
    description: 'Notifications when medications are running low',
    importance: AndroidImportance.DEFAULT,
  });
}

/**
 * Request notification permissions
 */
export async function requestPermissions(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  const hasNotificationPermission =
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL;

  return hasNotificationPermission;
}

/**
 * Check if exact alarm permission is granted (Android 12+)
 */
export async function isExactAlarmPermissionGranted(): Promise<boolean> {
  try {
    const settings = await notifee.getNotificationSettings();
    return settings.android.alarm === AndroidNotificationSetting.ENABLED;
  } catch (error) {
    console.log('[Permissions] Could not check alarm permission:', error);
    return false;
  }
}

/**
 * Open exact alarm permission settings (Android 12+)
 */
export async function openAlarmPermissionSettings(): Promise<void> {
  await notifee.openAlarmPermissionSettings();
}

/**
 * Check if battery optimization is disabled (i.e. app is whitelisted)
 */
export async function isBatteryOptimizationDisabled(): Promise<boolean> {
  try {
    const batteryOptimizationEnabled = await notifee.isBatteryOptimizationEnabled();
    return !batteryOptimizationEnabled; // returns true if optimized (bad for us)
  } catch (error) {
    console.log('[Permissions] Could not check battery optimization:', error);
    return true; // assume OK on failure
  }
}

/**
 * Open battery optimization settings
 */
export async function openBatteryOptimizationSettings(): Promise<void> {
  await notifee.openBatteryOptimizationSettings();
}

/**
 * Get a summary of notification-related permission states
 */
export async function getNotificationPermissionStatus(): Promise<{
  notifications: boolean;
  exactAlarm: boolean;
  batteryOptimized: boolean;
}> {
  const notifSettings = await notifee.requestPermission();
  const notifications =
    notifSettings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    notifSettings.authorizationStatus === AuthorizationStatus.PROVISIONAL;

  const exactAlarm = await isExactAlarmPermissionGranted();
  const batteryOptDisabled = await isBatteryOptimizationDisabled();

  return {
    notifications,
    exactAlarm,
    batteryOptimized: !batteryOptDisabled, // true = battery is being optimized (bad)
  };
}

/**
 * Schedule a medication reminder notification
 */
export async function scheduleReminder(
  data: NotificationData,
  isStrict: boolean
): Promise<string> {
  const notificationId = `reminder-${data.scheduleId}-${data.scheduledTime}`;

  try {
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: data.scheduledTime,
      alarmManager: {
        type: AlarmType.SET_ALARM_CLOCK,
        allowWhileIdle: true,
      },
    };

    if (isStrict) {
      // Full-screen alarm for strict mode
      await notifee.createTriggerNotification(
        {
          id: notificationId,
          title: 'Medication Reminder',
          body: `${data.medicationName}${data.dosage ? ` - ${data.dosage}` : ''}`,
          android: {
            channelId: NOTIFICATION_CHANNEL.ALARM,
            category: AndroidCategory.ALARM,
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            fullScreenAction: {
              id: 'default',
            },
            pressAction: {
              id: 'default',
            },
            actions: [
              {
                title: 'Take',
                pressAction: { id: 'take' },
              },
              {
                title: 'Skip',
                pressAction: { id: 'skip' },
              },
              {
                title: 'Snooze',
                pressAction: { id: 'snooze' },
              },
            ],
          },
          data: {
            medicationId: data.medicationId,
            scheduleId: data.scheduleId,
            scheduledTime: data.scheduledTime.toString(),
            medicationName: data.medicationName,
            dosage: data.dosage,
            type: 'reminder',
          },
        },
        trigger
      );
    } else {
      // Standard notification for relaxed mode
      await notifee.createTriggerNotification(
        {
          id: notificationId,
          title: 'Medication Reminder',
          body: `${data.medicationName}${data.dosage ? ` - ${data.dosage}` : ''}`,
          android: {
            channelId: NOTIFICATION_CHANNEL.REMINDER,
            importance: AndroidImportance.HIGH,
            pressAction: {
              id: 'default',
            },
            actions: [
              {
                title: 'Take',
                pressAction: { id: 'take' },
              },
              {
                title: 'Skip',
                pressAction: { id: 'skip' },
              },
              {
                title: 'Snooze',
                pressAction: { id: 'snooze' },
              },
            ],
          },
          data: {
            medicationId: data.medicationId,
            scheduleId: data.scheduleId,
            scheduledTime: data.scheduledTime.toString(),
            medicationName: data.medicationName,
            dosage: data.dosage,
            type: 'reminder',
          },
        },
        trigger
      );
    }

    return notificationId;
  } catch (error) {
    console.error(`[Notification] Failed to schedule reminder ${notificationId}:`, error);
    throw error;
  }
}

/**
 * Schedule a snooze notification
 */
export async function scheduleSnooze(
  data: NotificationData,
  snoozeDuration: number,
  isStrict: boolean
): Promise<string> {
  const snoozeTime = Date.now() + snoozeDuration * 60 * 1000;
  console.log(`[Snooze] Scheduling for ${snoozeDuration} minutes`);
  return scheduleReminder({ ...data, scheduledTime: snoozeTime }, isStrict);
}

/**
 * Show a refill reminder notification
 */
export async function showRefillReminder(
  medicationId: string,
  medicationName: string,
  stockCount: number
): Promise<void> {
  await notifee.displayNotification({
    id: `refill-${medicationId}`,
    title: 'Low Stock Alert',
    body: `${medicationName} is running low (${stockCount} remaining)`,
    android: {
      channelId: NOTIFICATION_CHANNEL.REFILL,
      pressAction: {
        id: 'default',
      },
    },
    data: {
      medicationId,
      type: 'refill',
    },
  });
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  await notifee.cancelNotification(notificationId);
}

/**
 * Cancel only future scheduled (trigger) notifications for a medication.
 * Does NOT cancel displayed notifications — those remain visible so users can act on them.
 * Used during rescheduling to avoid destroying already-fired notifications.
 */
export async function cancelScheduledTriggers(
  medicationId: string
): Promise<void> {
  try {
    const triggerNotifications = await notifee.getTriggerNotifications();
    let cancelled = 0;
    for (const notification of triggerNotifications) {
      if (notification.notification.data?.medicationId === medicationId) {
        await notifee.cancelNotification(notification.notification.id!);
        cancelled++;
      }
    }
    if (cancelled > 0) {
      console.log(`[Notification] Cancelled ${cancelled} scheduled triggers for ${medicationId}`);
    }
  } catch (error) {
    console.error(`[Notification] Error cancelling triggers for ${medicationId}:`, error);
  }
}

/**
 * Cancel ALL notifications for a medication — both scheduled triggers AND displayed.
 * Use this only for full cleanup: deactivation, deletion, or inactive med cleanup.
 */
export async function cancelMedicationNotifications(
  medicationId: string
): Promise<void> {
  console.log(`[Notification] Full cancel for medication: ${medicationId}`);

  try {
    // Cancel scheduled (trigger) notifications
    const triggerNotifications = await notifee.getTriggerNotifications();
    let cancelledTriggers = 0;
    for (const notification of triggerNotifications) {
      if (notification.notification.data?.medicationId === medicationId) {
        await notifee.cancelNotification(notification.notification.id!);
        cancelledTriggers++;
      }
    }

    // Cancel displayed notifications (already fired but still showing)
    const displayedNotifications = await notifee.getDisplayedNotifications();
    let cancelledDisplayed = 0;
    for (const notification of displayedNotifications) {
      if (notification.notification.data?.medicationId === medicationId) {
        await notifee.cancelNotification(notification.notification.id!);
        cancelledDisplayed++;
      }
    }

    console.log(`[Notification] Cancelled ${cancelledTriggers} triggers + ${cancelledDisplayed} displayed for ${medicationId}`);
  } catch (error) {
    console.error(`[Notification] Error cancelling notifications for ${medicationId}:`, error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await notifee.cancelAllNotifications();
}

/**
 * Get all pending trigger notifications
 */
export async function getPendingNotifications() {
  return notifee.getTriggerNotifications();
}

/**
 * Set up notification event handlers
 */
export function setNotificationHandlers(handlers: {
  onTake: (data: NotificationData) => Promise<void>;
  onSkip: (data: NotificationData) => Promise<void>;
  onSnooze: (data: NotificationData, snoozeDuration: number) => Promise<void>;
  onPress: (data: NotificationData) => void;
}): () => void {
  // Foreground event handler
  const unsubscribeForeground = notifee.onForegroundEvent(
    async ({ type, detail }: Event) => {
      const { notification, pressAction } = detail;

      if (!notification?.data) return;

      const data: NotificationData = {
        medicationId: notification.data.medicationId as string,
        scheduleId: notification.data.scheduleId as string,
        medicationName: (notification.data.medicationName as string) || '',
        dosage: (notification.data.dosage as string) || '',
        scheduledTime: parseInt(notification.data.scheduledTime as string, 10),
        color: '',
      };

      switch (type) {
        case EventType.ACTION_PRESS:
          if (pressAction?.id === 'take') {
            await handlers.onTake(data);
            await notifee.cancelNotification(notification.id!);
          } else if (pressAction?.id === 'skip') {
            await handlers.onSkip(data);
            await notifee.cancelNotification(notification.id!);
          } else if (pressAction?.id === 'snooze') {
            await handlers.onSnooze(data, 15); // Default 15 min
            await notifee.cancelNotification(notification.id!);
          }
          break;

        case EventType.PRESS:
          handlers.onPress(data);
          break;
      }
    }
  );

  // Background event handler is set up in index.js

  return unsubscribeForeground;
}
