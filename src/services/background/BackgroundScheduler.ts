/**
 * Background Scheduler Service
 *
 * Handles periodic rescheduling of medication reminders in the background.
 * Uses react-native-background-fetch for reliable periodic execution.
 *
 * Setup required:
 * 1. npm install react-native-background-fetch
 * 2. For Android, add to android/app/src/main/AndroidManifest.xml:
 *    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
 * 3. Link is automatic for RN 0.60+
 */

import { initializeSchedulingOnStartup } from '../scheduler/ReminderScheduler';
import { initDatabase } from '../database';
import { SettingsRepository } from '../database/repositories';

// Task ID for the background fetch
export const BACKGROUND_FETCH_TASK_ID = 'com.mediwarden.reschedule';

/**
 * Initialize background fetch for periodic rescheduling
 * Should be called once during app initialization
 */
export async function initializeBackgroundFetch(): Promise<void> {
  try {
    const BackgroundFetch = require('react-native-background-fetch').default;

    // Configure background fetch
    const status = await BackgroundFetch.configure(
      {
        minimumFetchInterval: 15, // Minimum interval in minutes (Android may enforce longer)
        stopOnTerminate: false, // Continue running after app is terminated
        startOnBoot: true, // Start after device reboot
        enableHeadless: true, // Enable headless mode for Android
        requiredNetworkType: BackgroundFetch.NETWORK_TYPE_NONE, // No network required
        requiresCharging: false,
        requiresBatteryNotLow: false,
        requiresStorageNotLow: false,
        requiresDeviceIdle: false,
      },
      async (taskId: string) => {
        // This is called when background fetch fires
        console.log('[BackgroundFetch] Task executed:', taskId);

        try {
          await performBackgroundReschedule();
        } catch (error) {
          console.error('[BackgroundFetch] Error during reschedule:', error);
        }

        // Signal completion
        BackgroundFetch.finish(taskId);
      },
      async (taskId: string) => {
        // Task timeout handler
        console.log('[BackgroundFetch] Task timeout:', taskId);
        BackgroundFetch.finish(taskId);
      }
    );

    console.log('[BackgroundFetch] Configure status:', status);

    // Schedule a periodic task for weekly reschedule
    // Note: Android enforces minimum 15 minutes, so we use that and check internally
    await BackgroundFetch.scheduleTask({
      taskId: BACKGROUND_FETCH_TASK_ID,
      delay: 24 * 60 * 60 * 1000, // First run after 24 hours
      periodic: true,
      forceAlarmManager: true, // Use AlarmManager for more reliable timing
      enableHeadless: true,
    });

    console.log('[BackgroundFetch] Scheduled weekly reschedule task');
  } catch (error) {
    // Background fetch not available - this is okay, we have fallback mechanisms
    console.log('[BackgroundFetch] Not available or failed to initialize:', error);
  }
}

/**
 * Perform the actual rescheduling in background
 */
async function performBackgroundReschedule(): Promise<void> {
  console.log('[BackgroundFetch] Starting background reschedule...');

  try {
    // Initialize database (needed for background context)
    await initDatabase();

    // Get current settings
    const settings = await SettingsRepository.getAll();
    const activeProfileId = settings.activeProfileId;
    const isStrictMode = settings.reminderMode === 'strict';

    if (!activeProfileId) {
      console.log('[BackgroundFetch] No active profile, skipping reschedule');
      return;
    }

    // Lightweight init: cleanup orphans + fill today's gaps (preserves snoozed/displayed notifications)
    await initializeSchedulingOnStartup(activeProfileId, isStrictMode);

    console.log('[BackgroundFetch] Background reschedule completed successfully');
  } catch (error) {
    console.error('[BackgroundFetch] Error during background reschedule:', error);
    throw error;
  }
}

/**
 * Headless task handler for Android
 * This runs even when the app is terminated
 */
export async function backgroundFetchHeadlessTask(event: {
  taskId: string;
  timeout: boolean;
}): Promise<void> {
  const { taskId, timeout } = event;

  if (timeout) {
    console.log('[BackgroundFetch Headless] Task timed out:', taskId);
    const BackgroundFetch = require('react-native-background-fetch').default;
    BackgroundFetch.finish(taskId);
    return;
  }

  console.log('[BackgroundFetch Headless] Task executed:', taskId);

  try {
    await performBackgroundReschedule();
  } catch (error) {
    console.error('[BackgroundFetch Headless] Error:', error);
  }

  const BackgroundFetch = require('react-native-background-fetch').default;
  BackgroundFetch.finish(taskId);
}

/**
 * Stop background fetch (useful for testing or if user disables reminders)
 */
export async function stopBackgroundFetch(): Promise<void> {
  try {
    const BackgroundFetch = require('react-native-background-fetch').default;
    await BackgroundFetch.stop(BACKGROUND_FETCH_TASK_ID);
    console.log('[BackgroundFetch] Stopped');
  } catch (error) {
    console.log('[BackgroundFetch] Error stopping:', error);
  }
}
