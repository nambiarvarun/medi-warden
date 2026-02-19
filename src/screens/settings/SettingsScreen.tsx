import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  ScreenWrapper,
  Heading,
  Body,
  Card,
  Button,
} from '../../components/common';
import { colors, spacing } from '../../theme';
import { useSettingsStore, useMedicationStore, useProfileStore } from '../../store';
import { ReminderMode, SnoozeDuration } from '../../types';
import { SNOOZE_OPTIONS } from '../../utils/constants';
import {
  getNotificationPermissionStatus,
  openAlarmPermissionSettings,
  openBatteryOptimizationSettings,
  cancelAllNotifications,
} from '../../services/notifications/NotificationService';
import { resetAllData, resetDoseHistory } from '../../services/database';
import { scheduleAllReminders } from '../../services/scheduler/ReminderScheduler';

export function SettingsScreen() {
  const {
    reminderMode,
    snoozeDuration,
    securityEnabled,
    setReminderMode,
    setSnoozeDuration,
    setSecurityEnabled,
  } = useSettingsStore();

  const navigation = useNavigation();

  const [permissionStatus, setPermissionStatus] = useState<{
    notifications: boolean;
    exactAlarm: boolean;
    batteryOptimized: boolean;
  } | null>(null);

  // Refresh permission status when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        getNotificationPermissionStatus().then(setPermissionStatus);
      }
    }, [])
  );

  const handleReminderModeChange = (mode: ReminderMode) => {
    setReminderMode(mode);
  };

  const handleSnoozeChange = (duration: SnoozeDuration) => {
    setSnoozeDuration(duration);
  };

  const handleSecurityToggle = () => {
    if (!securityEnabled) {
      Alert.alert(
        'Enable Security',
        'This will require PIN/Biometric to access the app.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: () => setSecurityEnabled(true),
          },
        ]
      );
    } else {
      setSecurityEnabled(false);
    }
  };

  const handleResetSchedules = () => {
    Alert.alert(
      'Reset Schedules',
      'This will cancel all scheduled notifications. They will be rescheduled when you reopen the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await cancelAllNotifications();
            Alert.alert('Done', 'All scheduled notifications have been cancelled.');
          },
        },
      ]
    );
  };

  const handleRecreateSchedules = () => {
    Alert.alert(
      'Recreate Schedules',
      'This will cancel all scheduled notifications and recreate them from scratch. Use this if reminders seem out of sync.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Recreate',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelAllNotifications();
              const { activeProfileId, reminderMode } = useSettingsStore.getState();
              if (activeProfileId) {
                await scheduleAllReminders(activeProfileId, reminderMode === 'strict');
              }
              Alert.alert('Done', 'All schedules have been recreated.');
            } catch (error) {
              console.error('[Settings] Recreate schedules failed:', error);
              Alert.alert('Error', 'Failed to recreate schedules. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleResetHistory = () => {
    Alert.alert(
      'Reset History',
      'This will permanently delete all dose history (taken, skipped, missed records). Your medications and schedules will not be affected. This cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete History',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetDoseHistory();
              Alert.alert('Done', 'All dose history has been cleared.');
            } catch (error) {
              console.error('[Settings] Reset history failed:', error);
              Alert.alert('Error', 'Failed to reset history. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleResetAll = () => {
    Alert.alert(
      'Reset All Data',
      'This will permanently delete ALL medications, profiles, dose history, and settings. The app will restart as if freshly installed. This cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelAllNotifications();
              await resetAllData();
              useSettingsStore.getState().reset();
              useMedicationStore.getState().reset();
              useProfileStore.getState().reset();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Onboarding' }],
              });
            } catch (error) {
              console.error('[Settings] Reset all failed:', error);
              Alert.alert('Error', 'Failed to reset data. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenWrapper>
      <Heading style={styles.heading}>Settings</Heading>

      <Card variant="outlined" style={styles.section}>
        <Body variant="titleSmall" style={styles.sectionTitle}>
          Reminder Mode
        </Body>
        <Body variant="bodySmall" color={colors.text.secondary} style={styles.description}>
          Choose how you want to be reminded about medications
        </Body>
        <View style={styles.optionsRow}>
          <Button
            title="Strict"
            variant={reminderMode === 'strict' ? 'primary' : 'outline'}
            onPress={() => handleReminderModeChange('strict')}
            style={styles.optionButton}
          />
          <Button
            title="Relaxed"
            variant={reminderMode === 'relaxed' ? 'primary' : 'outline'}
            onPress={() => handleReminderModeChange('relaxed')}
            style={styles.optionButton}
          />
        </View>
        <Body variant="bodySmall" color={colors.text.secondary}>
          {reminderMode === 'strict'
            ? 'Full-screen alarm that appears even when phone is locked'
            : 'Standard notification that can be dismissed'}
        </Body>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <Body variant="titleSmall" style={styles.sectionTitle}>
          Snooze Duration
        </Body>
        <Body variant="bodySmall" color={colors.text.secondary} style={styles.description}>
          How long to wait before reminding again
        </Body>
        <View style={styles.optionsRow}>
          {SNOOZE_OPTIONS.map((duration) => (
            <Button
              key={duration}
              title={`${duration}m`}
              variant={snoozeDuration === duration ? 'primary' : 'outline'}
              size="small"
              onPress={() => handleSnoozeChange(duration)}
              style={styles.snoozeButton}
            />
          ))}
        </View>
      </Card>

      <Card variant="outlined" style={styles.section}>
        <View style={styles.securityRow}>
          <View style={styles.securityInfo}>
            <Body variant="titleSmall">App Security</Body>
            <Body variant="bodySmall" color={colors.text.secondary}>
              Require PIN or biometric to open app
            </Body>
          </View>
          <View
            style={[
              styles.toggle,
              securityEnabled && styles.toggleActive,
            ]}
            onTouchEnd={handleSecurityToggle}
          >
            <View
              style={[
                styles.toggleThumb,
                securityEnabled && styles.toggleThumbActive,
              ]}
            />
          </View>
        </View>
      </Card>

      {Platform.OS === 'android' && permissionStatus && (
        <Card variant="outlined" style={styles.section}>
          <Body variant="titleSmall" style={styles.sectionTitle}>
            Notification Reliability
          </Body>
          <Body variant="bodySmall" color={colors.text.secondary} style={styles.description}>
            For reliable medication reminders, these permissions should be enabled
          </Body>

          <View style={styles.permissionRow}>
            <View style={styles.permissionInfo}>
              <Body variant="bodyMedium">Notifications</Body>
              <Body variant="bodySmall" color={colors.text.secondary}>
                Required to show reminders
              </Body>
            </View>
            <Body
              variant="labelMedium"
              color={permissionStatus.notifications ? colors.success : colors.error}
            >
              {permissionStatus.notifications ? 'Enabled' : 'Disabled'}
            </Body>
          </View>

          <View style={styles.permissionRow}>
            <View style={styles.permissionInfo}>
              <Body variant="bodyMedium">Exact Alarms</Body>
              <Body variant="bodySmall" color={colors.text.secondary}>
                Ensures reminders fire at the exact scheduled time
              </Body>
            </View>
            {permissionStatus.exactAlarm ? (
              <Body variant="labelMedium" color={colors.success}>Enabled</Body>
            ) : (
              <Button
                title="Enable"
                variant="outline"
                size="small"
                onPress={() => {
                  openAlarmPermissionSettings();
                }}
              />
            )}
          </View>

          <View style={styles.permissionRow}>
            <View style={styles.permissionInfo}>
              <Body variant="bodyMedium">Battery Optimization</Body>
              <Body variant="bodySmall" color={colors.text.secondary}>
                Disable to prevent Android from killing reminders
              </Body>
            </View>
            {!permissionStatus.batteryOptimized ? (
              <Body variant="labelMedium" color={colors.success}>Unrestricted</Body>
            ) : (
              <Button
                title="Fix"
                variant="outline"
                size="small"
                onPress={() => {
                  Alert.alert(
                    'Disable Battery Optimization',
                    'On the next screen, find Medi-Warden and select "Don\'t optimize" or "Unrestricted" to ensure reminders work reliably.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Open Settings',
                        onPress: () => openBatteryOptimizationSettings(),
                      },
                    ]
                  );
                }}
              />
            )}
          </View>
        </Card>
      )}

      <Card variant="outlined" style={styles.section}>
        <Body variant="titleSmall" style={styles.sectionTitle}>
          Reset Options
        </Body>
        <Body variant="bodySmall" color={colors.text.secondary} style={styles.description}>
          Reset or recreate app data when things seem out of sync
        </Body>
        <View style={styles.resetButtonsColumn}>
          <View style={styles.resetButtonsRow}>
            <Button
              title="Reset Schedules"
              variant="outline"
              onPress={handleResetSchedules}
              style={styles.resetButton}
            />
            <Button
              title="Recreate Schedules"
              variant="outline"
              onPress={handleRecreateSchedules}
              style={styles.resetButton}
            />
          </View>
          <View style={styles.resetButtonsRow}>
            <Button
              title="Reset History"
              variant="outline"
              onPress={handleResetHistory}
              style={styles.resetButton}
            />
            <Button
              title="Reset All"
              variant="primary"
              onPress={handleResetAll}
              style={{ ...styles.resetButton, ...styles.resetAllButton }}
            />
          </View>
        </View>
      </Card>

      <Card variant="filled" style={styles.infoCard}>
        <Body variant="titleSmall">About Medi-Warden</Body>
        <Body variant="bodySmall" color={colors.text.secondary}>
          Version 1.14.T2
        </Body>
        <Body variant="bodySmall" color={colors.text.secondary}>
          Your personal medication reminder assistant
        </Body>
      </Card>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.xs,
  },
  description: {
    marginBottom: spacing.md,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  optionButton: {
    flex: 1,
  },
  snoozeButton: {
    flex: 1,
    minWidth: 50,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityInfo: {
    flex: 1,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.gray[300],
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  permissionInfo: {
    flex: 1,
  },
  resetButtonsColumn: {
    gap: spacing.sm,
  },
  resetButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  resetButton: {
    flex: 1,
  },
  resetAllButton: {
    backgroundColor: colors.error,
  },
  infoCard: {
    marginTop: spacing.xl,
  },
});
