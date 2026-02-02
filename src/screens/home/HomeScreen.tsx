import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  ScreenWrapper,
  Heading,
  Body,
  Card,
  Button,
  EmptyState,
  Loading,
} from '../../components/common';
import { colors, spacing } from '../../theme';
import { useSettingsStore, useProfileStore, useMedicationStore } from '../../store';
import { formatDate, formatTime } from '../../utils/dateUtils';
import { Schedule, DoseLog } from '../../types';
import { ScheduleRepository, DoseLogRepository } from '../../services/database/repositories';
import { takeMedicationDose, skipMedicationDose } from '../../services/scheduler/ReminderScheduler';

export function HomeScreen() {
  const navigation = useNavigation();
  const { activeProfileId } = useSettingsStore();
  const { profiles, loadProfiles } = useProfileStore();
  const { medications, loadMedications, isLoading } = useMedicationStore();
  const [medicationSchedules, setMedicationSchedules] = useState<Record<string, Schedule[]>>({});
  const [doseStatuses, setDoseStatuses] = useState<Record<string, DoseLog | null>>({});

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  const loadSchedules = useCallback(async () => {
    const schedules: Record<string, Schedule[]> = {};
    for (const med of medications) {
      try {
        const medSchedules = await ScheduleRepository.getByMedicationId(med.id);
        schedules[med.id] = medSchedules;
      } catch (error) {
        console.error('Failed to load schedules for medication:', med.id, error);
      }
    }
    setMedicationSchedules(schedules);
  }, [medications]);

  // Load dose status for each medication
  const loadDoseStatuses = useCallback(async () => {
    const statuses: Record<string, DoseLog | null> = {};
    for (const med of medications) {
      try {
        const status = await DoseLogRepository.getTodayStatusForMedication(med.id);
        statuses[med.id] = status;
      } catch (error) {
        console.error('Failed to load dose status for medication:', med.id, error);
        statuses[med.id] = null;
      }
    }
    setDoseStatuses(statuses);
  }, [medications]);

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    if (activeProfileId) {
      loadMedications(activeProfileId);
    }
  }, [activeProfileId]);

  useEffect(() => {
    if (medications.length > 0) {
      loadSchedules();
      loadDoseStatuses();
    }
  }, [medications, loadSchedules, loadDoseStatuses]);

  // Reload when screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      if (activeProfileId) {
        loadMedications(activeProfileId);
      }
      // Also reload dose statuses when screen focuses
      if (medications.length > 0) {
        loadDoseStatuses();
      }
    }, [activeProfileId, loadMedications, medications.length, loadDoseStatuses])
  );

  // Format times for display
  const formatScheduleTimes = (schedules: Schedule[] | undefined): string => {
    if (!schedules || schedules.length === 0) return '';
    const allTimes: string[] = [];
    schedules.forEach((schedule) => {
      if (schedule.timesOfDay && schedule.isActive) {
        allTimes.push(...schedule.timesOfDay);
      }
    });
    // Sort times and format for display
    return allTimes
      .sort()
      .map((time) => {
        const [hours, minutes] = time.split(':');
        return `${hours}:${minutes}`;
      })
      .join(', ');
  };

  // Helper to get next intake time for sorting
  const getNextIntakeTime = (schedules: Schedule[] | undefined): number => {
    if (!schedules || schedules.length === 0) return Infinity;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const allTimes: string[] = [];
    schedules.forEach((schedule) => {
      if (schedule.isActive && schedule.timesOfDay) {
        allTimes.push(...schedule.timesOfDay);
      }
    });

    if (allTimes.length === 0) return Infinity;

    // Sort times and find first one >= current time
    const sortedTimes = allTimes.sort();
    const nextTime = sortedTimes.find((time) => time >= currentTime) || sortedTimes[0];

    const [hours, minutes] = nextTime.split(':').map(Number);
    const intakeDate = new Date(now);
    intakeDate.setHours(hours, minutes, 0, 0);

    // If time already passed today, it's tomorrow's dose
    if (intakeDate.getTime() < now.getTime()) {
      intakeDate.setDate(intakeDate.getDate() + 1);
    }

    return intakeDate.getTime();
  };

  const today = new Date();
  const activeMeds = medications.filter((m) => m.isActive);

  // Helper to get status display info for a medication
  const getStatusDisplay = (medId: string): { text: string; color: string } | null => {
    const doseLog = doseStatuses[medId];
    if (!doseLog) return null;

    const now = Date.now();

    // Check if snoozed (pending with future snoozedUntil)
    if (doseLog.status === 'pending' && doseLog.snoozedUntil && doseLog.snoozedUntil > now) {
      return {
        text: `Snoozed until ${formatTime(doseLog.snoozedUntil)}`,
        color: colors.warning,
      };
    }

    // Check if taken
    if (doseLog.status === 'taken' && doseLog.actionTime) {
      return {
        text: `Taken at ${formatTime(doseLog.actionTime)}`,
        color: colors.success,
      };
    }

    // Check if skipped
    if (doseLog.status === 'skipped' && doseLog.actionTime) {
      return {
        text: `Skipped at ${formatTime(doseLog.actionTime)}`,
        color: colors.warning,
      };
    }

    return null;
  };

  // Sort medications by next intake time
  const sortedMeds = useMemo(() => {
    return [...activeMeds].sort((a, b) => {
      const timeA = getNextIntakeTime(medicationSchedules[a.id]);
      const timeB = getNextIntakeTime(medicationSchedules[b.id]);
      return timeA - timeB;
    });
  }, [activeMeds, medicationSchedules]);

  // Handle take action from UI
  const handleTake = useCallback(async (medId: string, medName: string) => {
    try {
      const success = await takeMedicationDose(medId);
      if (success) {
        if (activeProfileId) {
          loadMedications(activeProfileId);
        }
        // Reload dose statuses to update UI
        loadDoseStatuses();
        Alert.alert('Done', `${medName} marked as taken`);
      } else {
        Alert.alert('Info', 'No pending dose to take');
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to record dose');
    }
  }, [activeProfileId, loadMedications, loadDoseStatuses]);

  // Handle skip action from UI
  const handleSkip = useCallback(async (medId: string, medName: string) => {
    try {
      const success = await skipMedicationDose(medId);
      if (success) {
        if (activeProfileId) {
          loadMedications(activeProfileId);
        }
        // Reload dose statuses to update UI
        loadDoseStatuses();
        Alert.alert('Done', `${medName} marked as skipped`);
      } else {
        Alert.alert('Info', 'No pending dose to skip');
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to record skip');
    }
  }, [activeProfileId, loadMedications, loadDoseStatuses]);

  if (!activeProfile) {
    return (
      <ScreenWrapper>
        <EmptyState
          title="No Profile Selected"
          message="Please select or create a profile to get started."
          actionLabel="Go to Profiles"
          onAction={() => navigation.navigate('Main', { screen: 'Profiles' })}
        />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <Body color={colors.text.secondary}>Welcome back,</Body>
        <Heading>{activeProfile.name}</Heading>
        <Body color={colors.text.secondary}>{formatDate(today)}</Body>
      </View>

      <View style={styles.section}>
        <Body variant="titleMedium" style={styles.sectionTitle}>
          Today's Medications
        </Body>

        {isLoading ? (
          <Loading message="Loading medications..." />
        ) : activeMeds.length === 0 ? (
          <Card variant="outlined" style={styles.emptyCard}>
            <Body color={colors.text.secondary}>
              No medications scheduled for today.
            </Body>
            <Button
              title="Add Medication"
              onPress={() => navigation.navigate('AddMedication', {})}
              variant="ghost"
              size="small"
              style={styles.addButton}
            />
          </Card>
        ) : (
          sortedMeds.map((med) => {
            const times = formatScheduleTimes(medicationSchedules[med.id]);
            const statusDisplay = getStatusDisplay(med.id);
            const isTaken = doseStatuses[med.id]?.status === 'taken';
            return (
              <Card
                key={med.id}
                style={styles.medicationCard}
                onPress={() =>
                  navigation.navigate('MedicationDetail', { medicationId: med.id })
                }
              >
                <View style={styles.medicationHeader}>
                  <View
                    style={[styles.colorDot, { backgroundColor: med.color }]}
                  />
                  <View style={styles.medicationInfo}>
                    <Body variant="titleMedium">{med.name}</Body>
                    {med.dosage && (
                      <Body color={colors.text.secondary}>{med.dosage}</Body>
                    )}
                  </View>
                  {times && (
                    <View style={styles.timeContainer}>
                      <Body variant="labelLarge" color={colors.primary}>
                        {times}
                      </Body>
                    </View>
                  )}
                </View>
                {statusDisplay && (
                  <View style={styles.statusContainer}>
                    <Body variant="labelMedium" color={statusDisplay.color}>
                      {statusDisplay.text}
                    </Body>
                  </View>
                )}
                {!med.isStockIndefinite && med.stockCount <= med.stockReminderThreshold && (
                  <Body color={colors.warning} variant="bodySmall">
                    Low stock: {med.stockCount} remaining
                  </Body>
                )}
                {!isTaken && (
                  <View style={styles.cardActions}>
                    <Button
                      title="Skip"
                      variant="outline"
                      size="small"
                      onPress={() => handleSkip(med.id, med.name)}
                    />
                    <Button
                      title="Take"
                      variant="primary"
                      size="small"
                      onPress={() => handleTake(med.id, med.name)}
                    />
                  </View>
                )}
              </Card>
            );
          })
        )}
      </View>

      <Button
        title="Add Medication"
        onPress={() => navigation.navigate('AddMedication', {})}
        fullWidth
        style={styles.floatingButton}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  section: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  addButton: {
    marginTop: spacing.sm,
  },
  medicationCard: {
    marginBottom: spacing.sm,
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  medicationInfo: {
    flex: 1,
  },
  timeContainer: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadius.sm,
    marginLeft: spacing.sm,
  },
  statusContainer: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  floatingButton: {
    marginTop: spacing.md,
  },
});
