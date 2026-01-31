export const spacing = {
  // Base spacing unit = 4px
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,

  // Screen padding
  screenHorizontal: 16,
  screenVertical: 16,

  // Card padding
  cardHorizontal: 16,
  cardVertical: 12,

  // Component spacing
  componentGap: 12,
  sectionGap: 24,

  // Border radius
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
} as const;

export type SpacingKey = keyof typeof spacing;
