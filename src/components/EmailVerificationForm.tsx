import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Mail } from 'lucide-react-native';
import { AuthInput } from './AuthInput';
import { PrimaryButton } from './PrimaryButton';
import { Colors } from '../theme/colors';
import { authErrorMessage } from '../services/authErrors';
import { resendSignupCode, verifySignupCode } from '../services/registration';

export function EmailVerificationForm({ email, onVerified, onChangeEmail }: {
  email: string;
  onVerified: () => void;
  onChangeEmail: () => void;
}) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const nextResendAt = useRef(0);
  const inFlight = useRef(false);

  const verify = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage('');
    try {
      await verifySignupCode(email, code);
      onVerified();
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const resend = async () => {
    if (inFlight.current) return;
    const seconds = Math.ceil((nextResendAt.current - Date.now()) / 1000);
    if (seconds > 0) {
      setMessage(`Please wait ${seconds} seconds before requesting another code.`);
      return;
    }
    inFlight.current = true;
    setResending(true);
    setMessage('');
    try {
      await resendSignupCode(email);
      nextResendAt.current = Date.now() + 60_000;
      setMessage('Check your inbox and spam folder for the latest code.');
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      inFlight.current = false;
      setResending(false);
    }
  };

  return (
    <View>
      <Text style={styles.description}>Enter the verification code for {email}. Check your inbox and spam folder, or request a new code below.</Text>
      {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
      <AuthInput
        label="Verification code"
        placeholder="Enter email code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoCorrect={false}
        maxLength={10}
        editable={!busy && !resending}
        icon={<Mail size={20} color={Colors.textAccentBlue} />}
      />
      <PrimaryButton title="Verify Email" onPress={verify} loading={busy} disabled={resending || !code.trim()} />
      <TouchableOpacity onPress={resend} disabled={busy || resending} style={styles.link}>
        <Text style={styles.linkText}>{resending ? 'Requesting code…' : 'Resend code'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onChangeEmail} disabled={busy || resending} style={styles.link}>
        <Text style={styles.linkText}>Use a different email</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  description: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 20 },
  message: { color: Colors.textBrightBlue, fontSize: 14, lineHeight: 21, marginBottom: 16 },
  link: { paddingVertical: 14, alignItems: 'center' },
  linkText: { color: Colors.textAccentBlue, fontWeight: '600', fontSize: 14 },
});
