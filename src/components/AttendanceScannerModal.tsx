import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { X, QrCode, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react-native';
import Svg, { Rect, Path } from 'react-native-svg';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { attendanceService } from '../services/attendanceService';
import { StudentProfile } from '../types';

interface AttendanceScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onAttendanceSuccess: (updatedStudent: StudentProfile) => void;
}

export const AttendanceScannerModal: React.FC<AttendanceScannerModalProps> = ({
  visible,
  onClose,
  onAttendanceSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [resultState, setResultState] = useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });

  const activeSession = attendanceService.getCurrentSession();

  const handleScanCode = async (codeToVerify?: string) => {
    setLoading(true);
    setResultState({ type: 'idle', message: '' });

    const code = codeToVerify || tokenInput || activeSession.sessionToken;

    // Simulate verification latency
    setTimeout(async () => {
      const result = await attendanceService.markAttendance(code);
      setLoading(false);

      if (result.success && result.newStats) {
        setResultState({
          type: 'success',
          message: result.message,
        });
        setTimeout(() => {
          onAttendanceSuccess(result.newStats!);
          handleClose();
        }, 1400);
      } else {
        setResultState({
          type: 'error',
          message: result.message,
        });
      }
    }, 600);
  };

  const handleClose = () => {
    setResultState({ type: 'idle', message: '' });
    setTokenInput('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.sheetTitle}>Scan Attendance QR</Text>
              <Text style={styles.sheetSubtitle}>
                {activeSession.subjectName} ({activeSession.courseCode})
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <X size={20} color="#A8B9D0" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          {/* Scanner Viewport */}
          <View style={styles.scannerViewport}>
            {/* Ambient Corner Brackets */}
            <Svg width={200} height={200} viewBox="0 0 200 200">
              <Path
                d="M20 50 L20 26 C20 22, 22 20, 26 20 L50 20"
                fill="none"
                stroke="#9AB9EC"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <Path
                d="M150 20 L174 20 C178 20, 180 22, 180 26 L180 50"
                fill="none"
                stroke="#9AB9EC"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <Path
                d="M20 150 L20 174 C20 178, 22 180, 26 180 L50 180"
                fill="none"
                stroke="#9AB9EC"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <Path
                d="M150 180 L174 180 C178 180, 180 178, 180 174 L180 150"
                fill="none"
                stroke="#9AB9EC"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </Svg>

            {/* Center QR Graphic preview */}
            <View style={styles.innerQrPreview}>
              <QrCode size={90} color="#FFFFFF" strokeWidth={1.5} />
              <View style={styles.laserLine} />
            </View>

            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#B4CBF5" />
                <Text style={styles.verifyingText}>Verifying with server...</Text>
              </View>
            )}
          </View>

          {/* Result Alert */}
          {resultState.type !== 'idle' && (
            <View
              style={[
                styles.resultBanner,
                resultState.type === 'success' ? styles.successBanner : styles.errorBanner,
              ]}
            >
              {resultState.type === 'success' ? (
                <CheckCircle2 size={18} color="#4ECCA3" strokeWidth={2.4} style={{ marginRight: 8 }} />
              ) : (
                <AlertCircle size={18} color="#FC8181" strokeWidth={2.4} style={{ marginRight: 8 }} />
              )}
              <Text style={styles.resultBannerText}>{resultState.message}</Text>
            </View>
          )}

          {/* Quick 1-Tap Faculty Classroom Code Scan */}
          <TouchableOpacity
            style={styles.instantScanButton}
            onPress={() => handleScanCode(activeSession.sessionToken)}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Sparkles size={18} color="#061522" strokeWidth={2.2} style={{ marginRight: 8 }} />
            <Text style={styles.instantScanText}>
              Scan Active Faculty QR ({activeSession.room})
            </Text>
          </TouchableOpacity>

          {/* Custom Token Input Option */}
          <View style={styles.manualInputRow}>
            <TextInput
              style={styles.manualInput}
              placeholder="Or enter session token manually"
              placeholderTextColor="#5F7592"
              value={tokenInput}
              onChangeText={setTokenInput}
            />
            <TouchableOpacity
              style={styles.manualSubmit}
              onPress={() => handleScanCode(tokenInput)}
              disabled={loading}
            >
              <Text style={styles.manualSubmitText}>Verify</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0D2033',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#1E3B5A',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    ...Typography.titleMedium,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sheetSubtitle: {
    ...Typography.bodyMedium,
    fontSize: 14,
    color: '#8EA5C2',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#162C44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerViewport: {
    height: 220,
    borderRadius: 24,
    backgroundColor: '#071524',
    borderWidth: 1.5,
    borderColor: '#18304C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  innerQrPreview: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laserLine: {
    position: 'absolute',
    width: 140,
    height: 2,
    backgroundColor: '#9AB9EC',
    shadowColor: '#9AB9EC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7, 21, 36, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyingText: {
    ...Typography.bodyMedium,
    color: '#B4CBF5',
    marginTop: 12,
    fontWeight: '600',
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  successBanner: {
    backgroundColor: 'rgba(78, 204, 163, 0.15)',
    borderWidth: 1,
    borderColor: '#4ECCA3',
  },
  errorBanner: {
    backgroundColor: 'rgba(252, 129, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#FC8181',
  },
  resultBannerText: {
    ...Typography.bodySmall,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
    flex: 1,
  },
  instantScanButton: {
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.buttonPrimaryBg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  instantScanText: {
    ...Typography.button,
    fontSize: 15,
    color: Colors.buttonPrimaryText,
    fontWeight: '700',
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12253A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1D3652',
    paddingHorizontal: 14,
    height: 48,
  },
  manualInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    padding: 0,
  },
  manualSubmit: {
    backgroundColor: '#1C3857',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  manualSubmitText: {
    color: '#B4CBF5',
    fontSize: 12,
    fontWeight: '600',
  },
});
