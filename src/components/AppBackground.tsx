import React from 'react';
import { StyleSheet, View, ViewStyle, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { DecorativeBlobs } from './DecorativeBlobs';

interface AppBackgroundProps {
  children: React.ReactNode;
  variant?: 'onboarding' | 'login' | 'dashboard';
  style?: ViewStyle;
  disableSafeArea?: boolean;
}

export const AppBackground: React.FC<AppBackgroundProps> = ({
  children,
  variant = 'onboarding',
  style,
  disableSafeArea = false,
}) => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <DecorativeBlobs variant={variant} />
      {disableSafeArea ? (
        <View style={[styles.inner, style]}>{children}</View>
      ) : (
        <SafeAreaView style={[styles.safeArea, style]}>{children}</SafeAreaView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
});
