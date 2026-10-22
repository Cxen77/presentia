import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface AuthInputProps extends TextInputProps {
  label: string;
  icon: React.ReactNode;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
}

export const AuthInput: React.FC<AuthInputProps> = ({
  label,
  icon,
  isPassword = false,
  containerStyle,
  value,
  onChangeText,
  placeholder,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!isPassword);

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
        containerStyle,
      ]}
    >
      <View style={styles.leftIconContainer}>{icon}</View>

      <View style={styles.inputArea}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={styles.textInput}
          autoCapitalize="none"
          {...rest}
        />
      </View>

      {isPassword && (
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.rightIconButton}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {showPassword ? (
            <EyeOff size={20} color={Colors.textSecondary} strokeWidth={1.8} />
          ) : (
            <Eye size={20} color={Colors.textSecondary} strokeWidth={1.8} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 78,
    borderRadius: 22,
    backgroundColor: Colors.cardInput,
    borderWidth: 1.2,
    borderColor: Colors.borderInput,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  containerFocused: {
    borderColor: Colors.borderInputFocused,
    backgroundColor: '#12263C',
  },
  leftIconContainer: {
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
  },
  inputArea: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    ...Typography.label,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  textInput: {
    ...Typography.bodyMedium,
    fontSize: 15,
    color: Colors.textPrimary,
    padding: 0,
    margin: 0,
  },
  rightIconButton: {
    padding: 6,
    marginLeft: 10,
  },
});
