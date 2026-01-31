import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import {
  ScreenWrapper,
  Heading,
  Body,
  Card,
  Button,
  Loading,
} from '../../components/common';
import { colors, spacing } from '../../theme';
import { useMedicationStore } from '../../store';
import { RootStackParamList } from '../../app/navigation/types';
import { MedicationWithSchedule } from '../../types';
import { getScheduleDescription } from '../../utils/scheduleUtils';

type MedicationDetailRouteProp = RouteProp<RootStackParamList, 'MedicationDetail'>;

export function MedicationDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<MedicationDetailRouteProp>();
  const { getMedicationWithSchedules, deleteMedication, updateMedication } =
    useMedicationStore();

  const [medication, setMedication] = useState<MedicationWithSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMedication = useCallback(async () => {
    setIsLoading(true);
    const med = await getMedicationWithSchedules(route.params.medicationId);
    setMedication(med);
    setIsLoading(false);
  }, [route.params.medicationId, getMedicationWithSchedules]);

  // Reload data whenever screen comes into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      loadMedication();
    }, [loadMedication])
  );

  const handleEdit = () => {
    navigation.navigate('AddMedication', {
      medicationId: route.params.medicationId,
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Medication',
      'Are you sure you want to delete this medication? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteMedication(route.params.medicationId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleToggleActive = async () => {
    if (!medication) return;
    await updateMedication(medication.id, { isActive: !medication.isActive });
    loadMedication();
  };

  if (isLoading) {
    return (
      <ScreenWrapper>
        <Loading message="Loading medication details..." />
      </ScreenWrapper>
    );
  }

  if (!medication) {
    return (
      <ScreenWrapper>
        <Body>Medication not found</Body>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <View style={[styles.colorBadge, { backgroundColor: medication.color }]} />
        <Heading>{medication.name}</Heading>
        {!medication.isActive && (
          <Body color={colors.gray[500]} variant="labelSmall">
            (Inactive)
          </Body>
        )}
      </View>

      {medication.dosage && (
        <Card variant="outlined" style={styles.section}>
          <Body variant="labelMedium" color={colors.text.secondary}>
            Dosage
          </Body>
          <Body variant="bodyLarge">{medication.dosage}</Body>
        </Card>
      )}

      {medication.notes && (
        <Card variant="outlined" style={styles.section}>
          <Body variant="labelMedium" color={colors.text.secondary}>
            Notes
          </Body>
          <Body>{medication.notes}</Body>
        </Card>
      )}

      {!medication.isStockIndefinite && (
        <Card variant="outlined" style={styles.section}>
          <Body variant="labelMedium" color={colors.text.secondary}>
            Stock
          </Body>
          <View style={styles.stockRow}>
            <Body variant="bodyLarge">
              {medication.stockCount} remaining
            </Body>
            {medication.stockCount <= medication.stockReminderThreshold && (
              <Body color={colors.warning} variant="labelSmall">
                Low stock
              </Body>
            )}
          </View>
          <Body variant="bodySmall" color={colors.text.secondary}>
            Refill reminder at {medication.stockReminderThreshold} days
          </Body>
        </Card>
      )}

      <Card variant="outlined" style={styles.section}>
        <Body variant="labelMedium" color={colors.text.secondary}>
          Schedule
        </Body>
        {medication.schedules.length === 0 ? (
          <Body color={colors.text.secondary}>No schedule set</Body>
        ) : (
          medication.schedules.map((schedule) => (
            <Body key={schedule.id} variant="bodyLarge">
              {getScheduleDescription(schedule)}
            </Body>
          ))
        )}
      </Card>

      <View style={styles.actions}>
        <Button
          title="Edit"
          onPress={handleEdit}
          variant="primary"
          fullWidth
          style={styles.actionButton}
        />
        <Button
          title={medication.isActive ? 'Deactivate' : 'Activate'}
          onPress={handleToggleActive}
          variant="outline"
          fullWidth
          style={styles.actionButton}
        />
        <Button
          title="Delete"
          onPress={handleDelete}
          variant="ghost"
          fullWidth
          textStyle={{ color: colors.error }}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  colorBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  section: {
    marginBottom: spacing.md,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  actionButton: {
    marginBottom: spacing.xs,
  },
});
