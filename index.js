/**
 * @format
 */

// Polyfill for crypto.getRandomValues (required by uuid)
import 'react-native-get-random-values';

import { AppRegistry } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import App from './src/app/App';
import { name as appName } from './app.json';

// Register background notification handler
notifee.onBackgroundEvent(async ({ type, detail }) => {
  try {
    const { notification, pressAction } = detail;

    if (!notification?.data) return;

    const { medicationId, scheduleId, scheduledTime } = notification.data;

    // Dynamically import to avoid initialization issues
    const { initDatabase } = await import('./src/services/database');
    const {
      handleTakeAction,
      handleSkipAction,
      handleSnoozeAction,
    } = await import('./src/services/scheduler/ReminderScheduler');
    const { SettingsRepository } = await import(
      './src/services/database/repositories'
    );

    // Initialize database for background operations
    await initDatabase();

    switch (type) {
      case EventType.ACTION_PRESS:
        if (pressAction?.id === 'take') {
          await handleTakeAction(
            medicationId,
            scheduleId,
            parseInt(scheduledTime, 10)
          );
          await notifee.cancelNotification(notification.id);
        } else if (pressAction?.id === 'skip') {
          await handleSkipAction(
            medicationId,
            scheduleId,
            parseInt(scheduledTime, 10)
          );
          await notifee.cancelNotification(notification.id);
        } else if (pressAction?.id === 'snooze') {
          const settings = await SettingsRepository.getAll();
          const snoozeDuration = settings.snoozeDuration || 15;
          const isStrict = settings.reminderMode === 'strict';

          console.log('[Snooze] Scheduling snooze notification for', snoozeDuration, 'minutes');

          await handleSnoozeAction(
            {
              medicationId,
              scheduleId,
              medicationName: notification.data.medicationName || '',
              dosage: notification.data.dosage || '',
              scheduledTime: parseInt(scheduledTime, 10),
              color: '',
            },
            snoozeDuration,
            isStrict
          );

          console.log('[Snooze] Snooze notification scheduled successfully');
          await notifee.cancelNotification(notification.id);
        }
        break;

      case EventType.DISMISSED:
        // Notification was dismissed without action
        console.log('Notification dismissed', notification.id);
        break;
    }
  } catch (error) {
    console.error('[Background Handler] Error:', error);
  }
});

AppRegistry.registerComponent(appName, () => App);

// Register headless task for background fetch (if library is installed)
try {
  const BackgroundFetch = require('react-native-background-fetch').default;
  const { backgroundFetchHeadlessTask } = require('./src/services/background');
  BackgroundFetch.registerHeadlessTask(backgroundFetchHeadlessTask);
  console.log('[BackgroundFetch] Headless task registered');
} catch (error) {
  // Background fetch not installed - this is okay, we have fallback mechanisms
  console.log('[BackgroundFetch] Library not available, skipping headless registration');
}
