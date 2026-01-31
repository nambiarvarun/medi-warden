import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import {
  ScreenWrapper,
  Heading,
  Body,
  Card,
  Button,
} from '../../components/common';
import { colors, spacing } from '../../theme';
import { useSettingsStore } from '../../store';
import { ReminderMode, SnoozeDuration } from '../../types';
import { SNOOZE_OPTIONS } from '../../utils/constants';

export function SettingsScreen() {
  const {
    reminderMode,
    snoozeDuration,
    securityEnabled,
    setReminderMode,
    setSnoozeDuration,
    setSecurityEnabled,
  } = useSettingsStore();

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

      <Card variant="filled" style={styles.infoCard}>
        <Body variant="titleSmall">About Medi-Warden</Body>
        <Body variant="bodySmall" color={colors.text.secondary}>
          Version 1.0.0
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
  infoCard: {
    marginTop: spacing.xl,
  },
});
