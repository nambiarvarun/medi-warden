import { TextStyle, Platform } from 'react-native';

// Lato font families for different weights
const fonts = {
  regular: Platform.select({
    ios: 'Lato-Regular',
    android: 'Lato-Regular',
    default: 'Lato-Regular',
  }),
  medium: Platform.select({
    ios: 'Lato-Medium',
    android: 'Lato-Medium',
    default: 'Lato-Medium',
  }),
  bold: Platform.select({
    ios: 'Lato-Bold',
    android: 'Lato-Bold',
    default: 'Lato-Bold',
  }),
  light: Platform.select({
    ios: 'Lato-Light',
    android: 'Lato-Light',
    default: 'Lato-Light',
  }),
};

export const typography = {
  // Display styles - for large headers
  displayLarge: {
    fontFamily: fonts.regular,
    fontSize: 57,
    fontWeight: '400',
    lineHeight: 64,
    letterSpacing: -0.25,
  } as TextStyle,

  displayMedium: {
    fontFamily: fonts.regular,
    fontSize: 45,
    fontWeight: '400',
    lineHeight: 52,
    letterSpacing: 0,
  } as TextStyle,

  displaySmall: {
    fontFamily: fonts.regular,
    fontSize: 36,
    fontWeight: '400',
    lineHeight: 44,
    letterSpacing: 0,
  } as TextStyle,

  // Headline styles - for section headers
  headlineLarge: {
    fontFamily: fonts.regular,
    fontSize: 32,
    fontWeight: '400',
    lineHeight: 40,
    letterSpacing: 0,
  } as TextStyle,

  headlineMedium: {
    fontFamily: fonts.regular,
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 36,
    letterSpacing: 0,
  } as TextStyle,

  headlineSmall: {
    fontFamily: fonts.regular,
    fontSize: 24,
    fontWeight: '400',
    lineHeight: 32,
    letterSpacing: 0,
  } as TextStyle,

  // Title styles - for card titles, list items
  titleLarge: {
    fontFamily: fonts.medium,
    fontSize: 22,
    fontWeight: '500',
    lineHeight: 28,
    letterSpacing: 0,
  } as TextStyle,

  titleMedium: {
    fontFamily: fonts.medium,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: 0.15,
  } as TextStyle,

  titleSmall: {
    fontFamily: fonts.medium,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: 0.1,
  } as TextStyle,

  // Body styles - for main content
  bodyLarge: {
    fontFamily: fonts.regular,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    letterSpacing: 0.5,
  } as TextStyle,

  bodyMedium: {
    fontFamily: fonts.regular,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: 0.25,
  } as TextStyle,

  bodySmall: {
    fontFamily: fonts.regular,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    letterSpacing: 0.4,
  } as TextStyle,

  // Label styles - for buttons, chips
  labelLarge: {
    fontFamily: fonts.medium,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: 0.1,
  } as TextStyle,

  labelMedium: {
    fontFamily: fonts.medium,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: 0.5,
  } as TextStyle,

  labelSmall: {
    fontFamily: fonts.medium,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: 0.5,
  } as TextStyle,
} as const;

export type TypographyKey = keyof typeof typography;
