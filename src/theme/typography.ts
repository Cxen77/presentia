import { Platform, TextStyle } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  web: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  default: 'System',
});

export const Typography = {
  fontFamily,

  // Headlines
  headlineLarge: {
    fontFamily,
    fontSize: 40,
    fontWeight: '800' as TextStyle['fontWeight'],
    lineHeight: 46,
    letterSpacing: -0.8,
  },
  headlineMedium: {
    fontFamily,
    fontSize: 34,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  headlineSmall: {
    fontFamily,
    fontSize: 28,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 34,
  },

  // Titles
  titleLarge: {
    fontFamily,
    fontSize: 22,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 28,
  },
  titleMedium: {
    fontFamily,
    fontSize: 20,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 26,
  },
  titleSmall: {
    fontFamily,
    fontSize: 16,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 22,
  },

  // Body
  bodyLarge: {
    fontFamily,
    fontSize: 16,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 22,
  },
  bodyMedium: {
    fontFamily,
    fontSize: 14,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 20,
  },
  bodySmall: {
    fontFamily,
    fontSize: 12,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 16,
  },

  // Labels & Buttons
  button: {
    fontFamily,
    fontSize: 16,
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: 0.2,
  },
  label: {
    fontFamily,
    fontSize: 15,
    fontWeight: '500' as TextStyle['fontWeight'],
  },
  badge: {
    fontFamily,
    fontSize: 13,
    fontWeight: '600' as TextStyle['fontWeight'],
  },
};
