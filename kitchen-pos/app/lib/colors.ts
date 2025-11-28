// Shared color palette for consistent styling
export const colors = {
  // Primary - Pistachio Green
  primary: '#7CB474',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D4E8D1',
  onPrimaryContainer: '#1A3D16',

  // Secondary - Warm Taupe
  secondary: '#8B8578',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#F5F0E8',
  onSecondaryContainer: '#3D3A33',

  // Surface colors - White to Sand
  surface: '#FDFCF9',
  surfaceDim: '#E8E4DB',
  surfaceBright: '#FFFFFF',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FBF9F4',
  surfaceContainer: '#F7F4ED',
  surfaceContainerHigh: '#F2EEE5',
  surfaceContainerHighest: '#EDE8DC',

  // On Surface - Warm Browns
  onSurface: '#2C2A25',
  onSurfaceVariant: '#5C5850',

  // Outline
  outline: '#9C9789',
  outlineVariant: '#D4CFC3',

  // Error & Success
  error: '#BA1A1A',
  onError: '#FFFFFF',
  success: '#5A8A53',
  onSuccess: '#FFFFFF',
} as const;

export type Colors = typeof colors;
