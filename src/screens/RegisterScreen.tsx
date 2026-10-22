import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  Mail,
  Lock,
} from 'lucide-react-native';
import { AppBackground } from '../components/AppBackground';
import { AuthInput } from '../components/AuthInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { supabase, isSupabaseConfigured } from '../services/supabase';

interface RegisterScreenProps {
  onBack: () => void;
  onRegistered: (email: string) => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onBack,
  onRegistered,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password.trim()) {
      Alert.alert('Required Fields', 'Please enter your institutional email and password.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Password Length', 'Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'The passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: password.trim(),
        });

        setLoading(false);

        if (error) {
          Alert.alert('Registration Error', error.message);
          return;
        }

        if (data?.user) {
          onRegistered(trimmedEmail);
        } else {
          Alert.alert(
            'Check Email',
            'Registration successful! If email confirmation is enabled, please verify your email before logging in.'
          );
          onRegistered(trimmedEmail);
        }
      } catch (err: any) {
        setLoading(false);
        Alert.alert('Network Error', err.message || 'Could not connect to authentication server.');
      }
    } else {
      // Local development fallback
      setTimeout(() => {
        setLoading(false);
        onRegistered(trimmedEmail);
      }, 400);
    }
  };

  return (
    <AppBackground variant="login">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Back Navigation Arrow */}
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={24} color="#9AB9EC" strokeWidth={2.4} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Enter your institutional email & password</Text>
        </View>

        {/* Form: Email, Password & Confirm Password */}
        <View style={styles.formContainer}>
          <AuthInput
            label="Email Address"
            placeholder="student@univ.edu"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            icon={<Mail size={22} color="#9AB9EC" strokeWidth={2} />}
          />

          <AuthInput
            label="Password"
            placeholder="Create your password (min 6 chars)"
            value={password}
            onChangeText={setPassword}
            isPassword
            icon={<Lock size={22} color="#9AB9EC" strokeWidth={2} />}
          />

          <AuthInput
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
            icon={<Lock size={22} color="#9AB9EC" strokeWidth={2} />}
          />

          {/* Primary Action Button */}
          <PrimaryButton
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            showArrow
            style={styles.registerButton}
          />
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerMutedText}>Already have an account? </Text>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
            <Text style={styles.footerHighlightText}>Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 12 : 24,
    paddingBottom: 36,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerContainer: {
    marginBottom: 24,
  },
  title: {
    ...Typography.headlineMedium,
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    ...Typography.bodyLarge,
    fontSize: 15,
    color: Colors.textMuted,
  },
  formContainer: {
    marginBottom: 20,
  },
  registerButton: {
    marginTop: 10,
    marginBottom: 16,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingVertical: 16,
  },
  footerMutedText: {
    ...Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
  },
  footerHighlightText: {
    ...Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textAccentBlue,
    fontWeight: '700',
  },
});
