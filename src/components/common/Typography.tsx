import React, { ReactNode } from 'react';
import { Text as RNText, TextStyle } from 'react-native';
import { colors, typography } from '../../theme';

export type TypographyVariant = keyof typeof typography;

interface TypographyProps {
  children: ReactNode;
  variant?: TypographyVariant;
  color?: string;
  style?: TextStyle;
  numberOfLines?: number;
}

export const Text = React.memo(function Text({
  children,
  variant = 'bodyMedium',
  color = colors.text.primary,
  style,
  numberOfLines,
}: TypographyProps) {
  return (
    <RNText
      style={[typography[variant], { color }, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </RNText>
  );
});

// Convenience components for common text styles
export const Heading = React.memo(function Heading({
  children,
  variant = 'headlineMedium',
  style,
  ...props
}: TypographyProps) {
  return (
    <Text variant={variant} {...props} style={style}>
      {children}
    </Text>
  );
});

export const Title = React.memo(function Title({
  children,
  variant = 'titleLarge',
  style,
  ...props
}: TypographyProps) {
  return (
    <Text variant={variant} {...props} style={style}>
      {children}
    </Text>
  );
});

export const Subtitle = React.memo(function Subtitle({
  children,
  variant = 'titleMedium',
  color = colors.text.secondary,
  style,
  ...props
}: TypographyProps) {
  return (
    <Text variant={variant} color={color} {...props} style={style}>
      {children}
    </Text>
  );
});

export const Body = React.memo(function Body({
  children,
  variant = 'bodyMedium',
  style,
  ...props
}: TypographyProps) {
  return (
    <Text variant={variant} {...props} style={style}>
      {children}
    </Text>
  );
});

export const Caption = React.memo(function Caption({
  children,
  variant = 'bodySmall',
  color = colors.text.secondary,
  style,
  ...props
}: TypographyProps) {
  return (
    <Text variant={variant} color={color} {...props} style={style}>
      {children}
    </Text>
  );
});

export const Label = React.memo(function Label({
  children,
  variant = 'labelLarge',
  style,
  ...props
}: TypographyProps) {
  return (
    <Text variant={variant} {...props} style={style}>
      {children}
    </Text>
  );
});
