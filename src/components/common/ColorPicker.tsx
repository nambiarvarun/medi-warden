import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors, spacing } from '../../theme';
import { Text } from './Typography';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  style?: ViewStyle;
}

export function ColorPicker({
  value,
  onChange,
  label,
  style,
}: ColorPickerProps) {
  return (
    <View style={[styles.container, style]}>
      {label && <Text variant="labelLarge" style={styles.label}>{label}</Text>}
      <View style={styles.colorsContainer}>
        {colors.medicationColors.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorOption,
              { backgroundColor: color },
              value === color && styles.selected,
            ]}
            onPress={() => onChange(color)}
            activeOpacity={0.7}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.sm,
    color: colors.text.primary,
  },
  colorsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: spacing.borderRadius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selected: {
    borderColor: colors.primary,
    borderWidth: 3,
  },
});
