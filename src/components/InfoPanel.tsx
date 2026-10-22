import React from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { Info } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface InfoPanelProps {
  message?: string;
  style?: ViewStyle;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({
  message = 'Make sure you are connected to\nyour college network',
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <Info size={18} color="#B4CBF5" strokeWidth={2.4} />
      </View>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardInput,
    borderWidth: 1.2,
    borderColor: Colors.borderInput,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1C3857',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  text: {
    ...Typography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: '#8EA5C2',
    flex: 1,
  },
});
