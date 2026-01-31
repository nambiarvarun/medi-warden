import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, spacing } from '../../theme';
import { Body } from './Typography';

interface TimePickerProps {
  value: string; // Format: "HH:mm"
  onChange: (time: string) => void;
  label?: string;
}

export function TimePicker({ value, onChange, label }: TimePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  // Parse time string to Date object
  const getDateFromTime = (timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours || 0);
    date.setMinutes(minutes || 0);
    date.setSeconds(0);
    return date;
  };

  // Format Date to time string
  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Format for display (respects device locale)
  const formatDisplayTime = (timeStr: string): string => {
    const date = getDateFromTime(timeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (event.type === 'set' && selectedDate) {
      onChange(formatTime(selectedDate));
    }
  };

  const handleDismiss = () => {
    setShowPicker(false);
  };

  return (
    <View style={styles.container}>
      {label && <Body variant="labelLarge" style={styles.label}>{label}</Body>}
      <TouchableOpacity
        style={styles.button}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.7}
      >
        <Body variant="bodyLarge">{formatDisplayTime(value)}</Body>
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={getDateFromTime(value)}
          mode="time"
          is24Hour={true}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          onTouchCancel={handleDismiss}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  label: {
    marginBottom: spacing.xs,
    color: colors.text.primary,
  },
  button: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: spacing.borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
});
