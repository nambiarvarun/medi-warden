import React, { ReactNode, useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, AppStateStatus } from 'react-native';
import { initDatabase } from '../../services/database';
import { useSettingsStore, useProfileStore } from '../../store';
import { Loading } from '../../components/common';
import { colors } from '../../theme';
import { View, StyleSheet } from 'react-native';
import {
  initializeNotifications,
  requestPermissions,
  setNotificationHandlers,
} from '../../services/notifications/NotificationService';
import {
  initializeSchedulingOnStartup,
  handleTakeAction,
  handleSkipAction,
  handleSnoozeAction,
  ensureTodaysDosesScheduled,
} from '../../services/scheduler/ReminderScheduler';
import { initializeBackgroundFetch } from '../../services/background';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const [isDbReady, setIsDbReady] = useState(false);
  const { loadSettings, isLoading: settingsLoading } = useSettingsStore();
  const { loadProfiles } = useProfileStore();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    initializeApp();
  }, []);

  // Listen for app state changes to ensure notifications are scheduled when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[AppProviders] App came to foreground, checking notifications...');
        const { activeProfileId, reminderMode } = useSettingsStore.getState();
        if (activeProfileId) {
          try {
            await ensureTodaysDosesScheduled(activeProfileId, reminderMode === 'strict');
          } catch (error) {
            console.error('[AppProviders] Error ensuring today\'s doses:', error);
          }
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize database
      await initDatabase();
      setIsDbReady(true);

      // Initialize notifications
      await initializeNotifications();
      await requestPermissions();

      // Load initial data
      await Promise.all([loadSettings(), loadProfiles()]);

      // Lightweight startup: cleanup orphans + fill today's gaps (preserves snoozed/displayed notifications)
      const { activeProfileId, reminderMode } = useSettingsStore.getState();
      console.log(`[AppProviders] Active profile: ${activeProfileId}, reminder mode: ${reminderMode}`);
      if (activeProfileId) {
        console.log('[AppProviders] Running lightweight scheduling init...');
        await initializeSchedulingOnStartup(activeProfileId, reminderMode === 'strict');
        console.log('[AppProviders] Finished scheduling init');
      } else {
        console.log('[AppProviders] No active profile, skipping reminder scheduling');
      }

      // Initialize background fetch for periodic rescheduling
      await initializeBackgroundFetch();

      // Set up notification handlers
      setNotificationHandlers({
        onTake: async (data) => {
          await handleTakeAction(data.medicationId, data.scheduleId, data.scheduledTime);
        },
        onSkip: async (data) => {
          await handleSkipAction(data.medicationId, data.scheduleId, data.scheduledTime);
        },
        onSnooze: async (data, _duration) => {
          try {
            // Always get fresh settings to avoid stale closure issues
            const currentSettings = useSettingsStore.getState();
            const snooze = currentSettings.snoozeDuration || 15;
            const isStrict = currentSettings.reminderMode === 'strict';
            console.log(`[Foreground Snooze] Scheduling for ${snooze} minutes, strict=${isStrict}`);
            await handleSnoozeAction(data, snooze, isStrict);
            console.log('[Foreground Snooze] Completed successfully');
          } catch (error) {
            console.error('[Foreground Snooze] Error:', error);
          }
        },
        onPress: (data) => {
          // Navigate to medication detail - handled by navigation
          console.log('Notification pressed:', data.medicationId);
        },
      });
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  };

  if (!isDbReady || settingsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Loading message="Loading Medi-Warden..." />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {children}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
