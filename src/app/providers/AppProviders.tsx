import React, { ReactNode, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
  scheduleAllReminders,
  handleTakeAction,
  handleSkipAction,
  handleSnoozeAction,
} from '../../services/scheduler/ReminderScheduler';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const [isDbReady, setIsDbReady] = useState(false);
  const { loadSettings, isLoading: settingsLoading } = useSettingsStore();
  const { loadProfiles } = useProfileStore();

  useEffect(() => {
    initializeApp();
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

      // Schedule reminders for active profile
      const { activeProfileId, reminderMode, snoozeDuration } = useSettingsStore.getState();
      if (activeProfileId) {
        await scheduleAllReminders(activeProfileId, reminderMode === 'strict');
      }

      // Set up notification handlers
      setNotificationHandlers({
        onTake: async (data) => {
          await handleTakeAction(data.medicationId, data.scheduleId, data.scheduledTime);
        },
        onSkip: async (data) => {
          await handleSkipAction(data.medicationId, data.scheduleId, data.scheduledTime);
        },
        onSnooze: async (data, duration) => {
          const snooze = snoozeDuration || 15;
          await handleSnoozeAction(data, snooze, reminderMode === 'strict');
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
