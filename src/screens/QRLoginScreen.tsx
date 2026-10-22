import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react-native';
import { AppBackground } from '../components/AppBackground';
import { QRIllustration } from '../components/QRIllustration';
import { InfoPanel } from '../components/InfoPanel';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface QRLoginScreenProps {
  onBack: () => void;
  onLoginSuccess: () => void;
}

export const QRLoginScreen: React.FC<QRLoginScreenProps> = ({
  onBack,
  onLoginSuccess,
}) => {
  const [scanning, setScanning] = useState(false);
  const [scannedSuccess, setScannedSuccess] = useState(false);

  const handleSimulateScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setScannedSuccess(true);
      setTimeout(() => {
        onLoginSuccess();
      }, 1000);
    }, 1200);
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
          <Text style={styles.title}>Login with QR</Text>
          <Text style={styles.subtitle}>
            Scan the code provided by your institution
          </Text>
        </View>

        {/* Large QR Illustration Panel */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleSimulateScan}
          disabled={scanning || scannedSuccess}
          style={styles.illustrationCard}
        >
          <QRIllustration variant="qr_login" scale={1.05} />

          {/* Interactive Scanning State Overlay */}
          {scanning && (
            <View style={styles.scanningOverlay}>
              <ActivityIndicator size="large" color="#B4CBF5" />
              <Text style={styles.scanningText}>Scanning Institutional QR Code...</Text>
            </View>
          )}

          {scannedSuccess && (
            <View style={styles.scanningOverlay}>
              <CheckCircle2 size={44} color="#4ECCA3" strokeWidth={2.5} />
              <Text style={styles.successText}>Student Badge Verified!</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Action Prompt */}
        <TouchableOpacity
          style={styles.scanActionBtn}
          onPress={handleSimulateScan}
          disabled={scanning || scannedSuccess}
          activeOpacity={0.85}
        >
          <Sparkles size={18} color="#061522" strokeWidth={2.4} style={{ marginRight: 8 }} />
          <Text style={styles.scanActionBtnText}>
            {scanning ? 'Verifying Student Badge...' : 'Tap to Scan Institutional QR'}
          </Text>
        </TouchableOpacity>

        {/* Information Panel below illustration */}
        <InfoPanel
          message={'Make sure you are connected to\nyour college network'}
          style={styles.infoPanel}
        />
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
    marginBottom: 8,
  },
  headerContainer: {
    marginBottom: 20,
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
  illustrationCard: {
    backgroundColor: '#0C1E30',
    borderRadius: 30,
    borderWidth: 1.2,
    borderColor: '#193552',
    height: 330,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 5,
  },
  scanningOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(6, 21, 34, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningText: {
    ...Typography.bodyMedium,
    color: '#B4CBF5',
    marginTop: 14,
    fontWeight: '600',
  },
  successText: {
    ...Typography.titleSmall,
    color: '#4ECCA3',
    marginTop: 12,
    fontWeight: '700',
  },
  scanActionBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.buttonPrimaryBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  scanActionBtnText: {
    ...Typography.button,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.buttonPrimaryText,
  },
  infoPanel: {
    marginTop: 4,
  },
});
