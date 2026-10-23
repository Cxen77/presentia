import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
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
import { isSupabaseConfigured } from '../services/supabase';
import { authErrorMessage } from '../services/authErrors';
import { registerStudent } from '../services/registration';
import { EmailVerificationForm } from '../components/EmailVerificationForm';

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
  const [pendingEmail, setPendingEmail] = useState('');
  const [message, setMessage] = useState('');
  const showMessage = (_title: string, text: string) => setMessage(text);

  const handleRegister = async () => {
    setMessage('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password.trim()) {
      showMessage('Required Fields', 'Please enter your institutional email and password.');
      return;
    }

    if (password.length < 6) {
      showMessage('Password Length', 'Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      showMessage('Password Mismatch', 'The passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    if (isSupabaseConfigured()) {
      try {
        const result = await registerStudent(email, password);
        if (result.status === 'verified') {
          onRegistered(result.email);
        } else if (result.status === 'existing_account') {
          showMessage('Account Already Registered', 'An account already exists. Sign in with its password, or select Verify existing email if it is still unconfirmed.');
        } else {
          setPendingEmail(result.email);
          setPassword('');
          setConfirmPassword('');
        }
        setLoading(false);
      } catch (err: any) {
        setLoading(false);
        showMessage('Network Error', authErrorMessage(err));
      }
    } else {
      setLoading(false);
      showMessage('Supabase Not Configured', 'Configure the project URL and public key before registering.');
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
          <Text style={styles.title}>{pendingEmail ? 'Verify Your Email' : 'Create Account'}</Text>
          <Text style={styles.subtitle}>{pendingEmail ? 'Confirm your student account' : 'Enter your institutional email & password'}</Text>
        </View>

        {/* Form: Email, Password & Confirm Password */}
        <View style={styles.formContainer}>
          {!!message && <Text style={{ color: '#F87171', marginBottom: 16 }}>{message}</Text>}
          {pendingEmail ? (
            <EmailVerificationForm
              key={pendingEmail}
              email={pendingEmail}
              onVerified={() => onRegistered(pendingEmail)}
              onChangeEmail={() => { setPendingEmail(''); setMessage(''); }}
            />
          ) : (
          <>
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
          <TouchableOpacity
            disabled={loading}
            onPress={() => {
              if (!email.trim().includes('@')) { setMessage('Enter your registered email address first.'); return; }
              setMessage('');
              setPassword('');
              setConfirmPassword('');
              setPendingEmail(email.trim());
            }}
            style={{ paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#9AB9EC', fontWeight: '600' }}>Verify existing email</Text>
          </TouchableOpacity>
          </>
          )}

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
