import React, { ReactNode } from 'react';
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing } from '../../theme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'elevated' | 'outlined' | 'filled';
}

export const Card = React.memo(function Card({
  children,
  style,
  onPress,
  variant = 'elevated',
}: CardProps) {
  const cardStyle = [
    styles.base,
    styles[variant],
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
});

const styles = StyleSheet.create({
  base: {
    borderRadius: spacing.borderRadius.md,
    padding: spacing.md,
  },
  elevated: {
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  outlined: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  filled: {
    backgroundColor: colors.surfaceVariant,
  },
});
