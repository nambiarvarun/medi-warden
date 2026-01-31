import notifee, {
  AndroidImportance,
  AndroidCategory,
  AndroidVisibility,
  TriggerType,
  TimestampTrigger,
  AuthorizationStatus,
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
  return (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Schedule a medication reminder notification
 */
export async function scheduleReminder(
  data: NotificationData,
  isStrict: boolean
): Promise<string> {
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: data.scheduledTime,
    alarmManager: {
      allowWhileIdle: true,
    },
  };

  const notificationId = `reminder-${data.scheduleId}-${data.scheduledTime}`;

  if (isStrict) {
    // Full-screen alarm for strict mode
    await notifee.createTriggerNotification(
      {
        id: notificationId,
        title: 'Time to take your medication',
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
          type: 'reminder',
        },
      },
      trigger
    );
  }

  return notificationId;
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
 * Cancel all notifications for a medication
 */
export async function cancelMedicationNotifications(
  medicationId: string
): Promise<void> {
  const notifications = await notifee.getTriggerNotifications();
  for (const notification of notifications) {
    if (notification.notification.data?.medicationId === medicationId) {
      await notifee.cancelNotification(notification.notification.id!);
    }
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
        medicationName: notification.title || '',
        dosage: '',
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
