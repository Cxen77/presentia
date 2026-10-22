import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface FeatureRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export const FeatureRow: React.FC<FeatureRowProps> = ({ icon, title, description }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconTile}>{icon}</View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#13263B',
    borderWidth: 1,
    borderColor: '#1D3652',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    ...Typography.titleSmall,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  description: {
    ...Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
  },
});
