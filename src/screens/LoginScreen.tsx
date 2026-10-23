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
  User,
  Lock,
  Check,
} from 'lucide-react-native';
import { AppBackground } from '../components/AppBackground';
import { AuthInput } from '../components/AuthInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { authErrorMessage } from '../services/authErrors';

interface LoginScreenProps {
  onBack: () => void;
  onLoginSuccess: () => void;
  onNavigateRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onBack,
  onLoginSuccess,
  onNavigateRegister,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const trimmedId = identifier.trim();
    if (!trimmedId || !password.trim()) {
      Alert.alert('Required Fields', 'Please enter your email address and password.');
      return;
    }
    if (!trimmedId.includes('@')) {
      Alert.alert('Email Required', 'Sign in with the email address registered to your Supabase account.');
      return;
    }
    if (!isSupabaseConfigured()) {
      Alert.alert('Supabase Not Configured', 'Add the Supabase project URL and publishable key before signing in.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedId,
        password,
      });
      if (error) {
        Alert.alert(
          'Login Failed',
          authErrorMessage(error)
        );
        return;
      }
      if (!data.session) {
        Alert.alert('Login Failed', 'Supabase did not create an authenticated session. Verify your email and try again.');
        return;
      }
      onLoginSuccess();
    } catch (err) {
      Alert.alert('Network Error', authErrorMessage(err));
    } finally {
      setLoading(false);
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
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Login to your student account</Text>
        </View>

        {/* Form Inputs */}
        <View style={styles.formContainer}>
          <AuthInput
            label="Email Address"
            placeholder="student@univ.edu"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            icon={<User size={22} color="#9AB9EC" strokeWidth={2} />}
          />

          <AuthInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            isPassword
            icon={<Lock size={22} color="#9AB9EC" strokeWidth={2} />}
          />

          {/* Remember Me & Forgot Password */}
          <View style={styles.rememberForgotRow}>
            <TouchableOpacity
              style={styles.rememberMeGroup}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Check size={14} color="#061522" strokeWidth={3} />}
              </View>
              <Text style={styles.rememberMeText}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'Password Reset',
                  'If your account is registered, a password reset link will be sent to your institutional email.'
                )
              }
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Primary Login Button */}
          <PrimaryButton
            title="Login"
            onPress={handleLogin}
            loading={loading}
            showArrow
            style={styles.loginButton}
          />
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerMutedText}>Don&apos;t have an account? </Text>
          <TouchableOpacity onPress={onNavigateRegister} activeOpacity={0.7}>
            <Text style={styles.footerHighlightText}>Create Account</Text>
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
    paddingBottom: 28,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerContainer: {
    marginBottom: 16,
  },
  title: {
    ...Typography.headlineMedium,
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    ...Typography.bodyLarge,
    fontSize: 15,
    color: Colors.textMuted,
  },
  formContainer: {
    marginBottom: 20,
  },
  rememberForgotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 24,
    paddingHorizontal: 2,
  },
  rememberMeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#3D5E85',
    backgroundColor: '#0E2235',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#9AB9EC',
    borderColor: '#9AB9EC',
  },
  rememberMeText: {
    ...Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
  },
  forgotPasswordText: {
    ...Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textAccentBlue,
    fontWeight: '500',
  },
  loginButton: {
    marginBottom: 12,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingVertical: 18,
  },
  footerMutedText: {
    ...Typography.bodyMedium,
    fontSize: 15,
    color: Colors.textMuted,
  },
  footerHighlightText: {
    ...Typography.bodyMedium,
    fontSize: 15,
    color: Colors.textAccentBlue,
    fontWeight: '700',
  },
});
