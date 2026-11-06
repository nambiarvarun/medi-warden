import React from 'react';
import { View, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing } from '../../theme';
import { Text } from './Typography';

interface LoadingProps {
  message?: string;
  size?: 'small' | 'large';
  style?: ViewStyle;
}

export const Loading = React.memo(function Loading({
  message,
  size = 'large',
  style,
}: LoadingProps) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={colors.primary} />
      {message && (
        <Text variant="bodyMedium" color={colors.text.secondary} style={styles.message}>
          {message}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  message: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
