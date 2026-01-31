import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  ScreenWrapper,
  Input,
  Button,
  ColorPicker,
  Body,
  Card,
  TimePicker,
} from '../../components/common';
import { colors, spacing } from '../../theme';
import { useSettingsStore, useMedicationStore } from '../../store';
import { RootStackParamList } from '../../app/navigation/types';
import { ScheduleType } from '../../types';
import { DAYS_OF_WEEK, DEFAULT_STOCK_REMINDER_THRESHOLD } from '../../utils/constants';

type AddMedicationRouteProp = RouteProp<RootStackParamList, 'AddMedication'>;

export function AddMedicationScreen() {
  const navigation = useNavigation();
  const route = useRoute<AddMedicationRouteProp>();
  const { activeProfileId } = useSettingsStore();
  const { addMedication, getMedicationWithSchedules, updateMedicationWithSchedules } =
    useMedicationStore();

  const isEditing = !!route.params?.medicationId;

  // Form state
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState<string>(colors.medicationColors[0]);
  const [stockCount, setStockCount] = useState('');
  const [stockThreshold, setStockThreshold] = useState(
    DEFAULT_STOCK_REMINDER_THRESHOLD.toString()
  );
  const [isStockIndefinite, setIsStockIndefinite] = useState(false);

  // Schedule state
  const [scheduleType, setScheduleType] = useState<ScheduleType>('daily');
  const [timesOfDay, setTimesOfDay] = useState<string[]>(['09:00']);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]); // Weekdays
  const [intervalDays, setIntervalDays] = useState('1');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEditing && route.params?.medicationId) {
      loadMedication(route.params.medicationId);
    }
  }, [isEditing, route.params?.medicationId]);

  const loadMedication = async (id: string) => {
    const medWithSchedules = await getMedicationWithSchedules(id);
    if (medWithSchedules) {
      setName(medWithSchedules.name);
      setDosage(medWithSchedules.dosage);
      setNotes(medWithSchedules.notes);
      setColor(medWithSchedules.color);
      setStockCount(medWithSchedules.stockCount.toString());
      setStockThreshold(medWithSchedules.stockReminderThreshold.toString());
      setIsStockIndefinite(medWithSchedules.isStockIndefinite);

      if (medWithSchedules.schedules.length > 0) {
        const schedule = medWithSchedules.schedules[0];
        setScheduleType(schedule.scheduleType);
        setTimesOfDay(schedule.timesOfDay);
        if (schedule.daysOfWeek) {
          setDaysOfWeek(schedule.daysOfWeek);
        }
        if (schedule.intervalDays) {
          setIntervalDays(schedule.intervalDays.toString());
        }
      }
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Medication name is required';
    }

    if (timesOfDay.length === 0) {
      newErrors.times = 'At least one time is required';
    }

    if (scheduleType === 'weekly' && daysOfWeek.length === 0) {
      newErrors.days = 'Select at least one day';
    }

    if (scheduleType === 'interval') {
      const interval = parseInt(intervalDays, 10);
      if (isNaN(interval) || interval < 1) {
        newErrors.interval = 'Interval must be at least 1 day';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !activeProfileId) return;

    setIsSubmitting(true);

    try {
      const medicationData = {
        profileId: activeProfileId,
        name: name.trim(),
        dosage: dosage.trim(),
        notes: notes.trim(),
        color,
        stockCount: isStockIndefinite ? 0 : (parseInt(stockCount, 10) || 0),
        stockReminderThreshold: isStockIndefinite ? 0 : (parseInt(stockThreshold, 10) || DEFAULT_STOCK_REMINDER_THRESHOLD),
        isStockIndefinite,
        isActive: true,
      };

      const scheduleData = {
        scheduleType,
        timesOfDay,
        daysOfWeek: scheduleType === 'weekly' ? daysOfWeek : null,
        intervalDays: scheduleType === 'interval' ? parseInt(intervalDays, 10) : null,
        startDate: Date.now(),
        endDate: null,
        durationDays: null,
        isActive: true,
      };

      if (isEditing && route.params?.medicationId) {
        await updateMedicationWithSchedules(route.params.medicationId, medicationData, [scheduleData]);
      } else {
        await addMedication(medicationData, [scheduleData]);
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save medication. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTime = () => {
    setTimesOfDay([...timesOfDay, '12:00']);
  };

  const removeTime = (index: number) => {
    if (timesOfDay.length > 1) {
      setTimesOfDay(timesOfDay.filter((_, i) => i !== index));
    }
  };

  const updateTime = (index: number, value: string) => {
    const newTimes = [...timesOfDay];
    newTimes[index] = value;
    setTimesOfDay(newTimes);
  };

  const toggleDayOfWeek = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter((d) => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort());
    }
  };

  return (
    <ScreenWrapper scrollable={false} padded={false}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label="Medication Name *"
            value={name}
            onChangeText={setName}
            placeholder="e.g., Aspirin"
            error={errors.name}
          />

          <Input
            label="Dosage"
            value={dosage}
            onChangeText={setDosage}
            placeholder="e.g., 100mg"
          />

          <Input
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional instructions..."
            multiline
            numberOfLines={3}
          />

          <ColorPicker
            label="Color"
            value={color}
            onChange={setColor}
          />

          <View style={styles.switchRow}>
            <Body>Indefinite Stock</Body>
            <Switch
              value={isStockIndefinite}
              onValueChange={setIsStockIndefinite}
              trackColor={{ false: colors.gray[300], true: colors.primary }}
            />
          </View>
          <Body variant="bodySmall" color={colors.text.secondary} style={styles.switchHint}>
            Enable if you don't need to track stock or refill alerts
          </Body>

          {!isStockIndefinite && (
            <View style={styles.row}>
              <Input
                label="Current Stock"
                value={stockCount}
                onChangeText={setStockCount}
                keyboardType="numeric"
                placeholder="0"
                containerStyle={styles.halfInput}
              />
              <Input
                label="Refill Alert (days)"
                value={stockThreshold}
                onChangeText={setStockThreshold}
                keyboardType="numeric"
                placeholder="7"
                containerStyle={styles.halfInput}
              />
            </View>
          )}

          <Card variant="outlined" style={styles.scheduleSection}>
            <Body variant="titleMedium" style={styles.sectionTitle}>
              Schedule
            </Body>

            <View style={styles.scheduleTypes}>
              {(['daily', 'weekly', 'interval'] as ScheduleType[]).map((type) => (
                <Button
                  key={type}
                  title={type.charAt(0).toUpperCase() + type.slice(1)}
                  variant={scheduleType === type ? 'primary' : 'outline'}
                  size="small"
                  onPress={() => setScheduleType(type)}
                  style={styles.scheduleTypeButton}
                />
              ))}
            </View>

            {scheduleType === 'weekly' && (
              <View style={styles.daysContainer}>
                <Body variant="labelMedium" style={styles.label}>
                  Days of Week
                </Body>
                <View style={styles.daysRow}>
                  {DAYS_OF_WEEK.map((day) => (
                    <Button
                      key={day.value}
                      title={day.label}
                      variant={daysOfWeek.includes(day.value) ? 'primary' : 'outline'}
                      size="small"
                      onPress={() => toggleDayOfWeek(day.value)}
                      style={styles.dayButton}
                    />
                  ))}
                </View>
                {errors.days && (
                  <Body color={colors.error} variant="bodySmall">
                    {errors.days}
                  </Body>
                )}
              </View>
            )}

            {scheduleType === 'interval' && (
              <Input
                label="Every X Days"
                value={intervalDays}
                onChangeText={setIntervalDays}
                keyboardType="numeric"
                error={errors.interval}
              />
            )}

            <View style={styles.timesContainer}>
              <Body variant="labelMedium" style={styles.label}>
                Times
              </Body>
              {timesOfDay.map((time, index) => (
                <View key={index} style={styles.timeRow}>
                  <View style={styles.timePickerContainer}>
                    <TimePicker
                      value={time}
                      onChange={(value) => updateTime(index, value)}
                    />
                  </View>
                  {timesOfDay.length > 1 && (
                    <Button
                      title="Remove"
                      variant="ghost"
                      size="small"
                      onPress={() => removeTime(index)}
                    />
                  )}
                </View>
              ))}
              <Button
                title="+ Add Time"
                variant="ghost"
                size="small"
                onPress={addTime}
              />
              {errors.times && (
                <Body color={colors.error} variant="bodySmall">
                  {errors.times}
                </Body>
              )}
            </View>
          </Card>

          <Button
            title={isEditing ? 'Save Changes' : 'Add Medication'}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
            fullWidth
            style={styles.submitButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screenHorizontal,
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  switchHint: {
    marginBottom: spacing.md,
  },
  scheduleSection: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  scheduleTypes: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  scheduleTypeButton: {
    flex: 1,
  },
  daysContainer: {
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
    color: colors.text.primary,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dayButton: {
    minWidth: 44,
  },
  timesContainer: {
    marginTop: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  timePickerContainer: {
    flex: 1,
  },
  submitButton: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
});
