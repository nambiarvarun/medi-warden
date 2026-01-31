export const colors = {
  // Primary palette from user specification
  primary: '#0C2C55', // Dark blue - main brand color
  secondary: '#296374', // Teal - secondary actions
  accent: '#629FAD', // Light teal - highlights, accents
  background: '#EDEDCE', // Cream/off-white - main background

  // Derived colors
  primaryLight: '#1A4A7A',
  primaryDark: '#081D3A',
  secondaryLight: '#3A8495',
  secondaryDark: '#1D4A58',

  // Semantic colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',

  // Neutral colors
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },

  // Text colors
  text: {
    primary: '#0C2C55',
    secondary: '#296374',
    disabled: '#9E9E9E',
    inverse: '#FFFFFF',
  },

  // Background variants
  surface: '#FFFFFF',
  surfaceVariant: '#F5F5F0',
  backdrop: 'rgba(0, 0, 0, 0.5)',

  // Medication colors for visual identification
  medicationColors: [
    '#629FAD', // Default - light teal
    '#E57373', // Red
    '#FFB74D', // Orange
    '#FFF176', // Yellow
    '#81C784', // Green
    '#64B5F6', // Blue
    '#BA68C8', // Purple
    '#F06292', // Pink
    '#4DB6AC', // Teal
    '#A1887F', // Brown
  ],
} as const;

export type ColorKey = keyof typeof colors;
