import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import {
  X,
  Camera,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { studentService } from '../services/studentService';
import { DatabaseClass } from '../types';

interface QRScannerModalProps {
  visible: boolean;
  studentProfileId: string;
  onClose: () => void;
  onClassEnrolled: () => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = (props) =>
  props.visible ? <QRScannerContent {...props} /> : null;

const QRScannerContent: React.FC<QRScannerModalProps> = ({
  visible,
  studentProfileId,
  onClose,
  onClassEnrolled,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [validating, setValidating] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  // States for verification result
  const [detectedClass, setDetectedClass] = useState<DatabaseClass | null>(null);
  const [attendanceNotice, setAttendanceNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBarcodeScanned = async (data: string) => {
    if (scanned || validating || enrolling) return;
    setScanned(true);
    setValidating(true);
    setErrorMessage(null);
    setAttendanceNotice(null);
    setDetectedClass(null);

    try {
      const validation = await studentService.validateQRPayload(data);
      setValidating(false);

      if (validation.type === 'class_invite' && validation.classData) {
        setDetectedClass(validation.classData);
      } else if (validation.type === 'attendance_session') {
        setAttendanceNotice(
          validation.message ||
            'Attendance Session Detected: Attendance scanning will be enabled in a later release.'
        );
      } else {
        setErrorMessage(
          validation.message || 'Invalid or unrecognized QR code. Please scan a valid class invitation.'
        );
      }
    } catch (err: any) {
      setValidating(false);
      setErrorMessage(err.message || 'Error communicating with validation server.');
    }
  };

  const handleConfirmEnrollment = async () => {
    if (!detectedClass) return;
    setEnrolling(true);

    try {
      const res = await studentService.joinClassByCode(
        studentProfileId,
        detectedClass.enrollment_code
      );
      setEnrolling(false);

      if (res.success) {
        Alert.alert(
          'Enrolled!',
          `You have joined ${detectedClass.class_name} (${detectedClass.course_code}).`
        );
        onClassEnrolled();
        handleClose();
      } else {
        Alert.alert('Enrollment Notice', res.error || 'Could not complete enrollment.');
      }
    } catch (err: any) {
      setEnrolling(false);
      Alert.alert('Error', err.message || 'Enrollment failed.');
    }
  };

  const handleClose = () => {
    setScanned(false);
    setDetectedClass(null);
    setAttendanceNotice(null);
    setErrorMessage(null);
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
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Scan QR Code</Text>
              <Text style={styles.subtitle}>Scan class invitation or course code</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#8EA5C2" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          {/* Camera Viewport or Permission Handler */}
          {!permission?.granted ? (
            <View style={styles.permissionBox}>
              <Camera size={44} color="#9AB9EC" strokeWidth={1.8} style={{ marginBottom: 12 }} />
              <Text style={styles.permissionTitle}>Camera Access Needed</Text>
              <Text style={styles.permissionText}>
                We need access to your camera to scan university class QR codes and invitations.
              </Text>
              <TouchableOpacity
                style={styles.permissionBtn}
                onPress={requestPermission}
                activeOpacity={0.8}
              >
                <Text style={styles.permissionBtnText}>Enable Camera</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraFrame}>
              {Platform.OS === 'web' ? (
                // CameraView on web or simulated view
                <View style={styles.webCameraContainer}>
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    barcodeScannerSettings={{
                      barcodeTypes: ['qr'],
                    }}
                    onBarcodeScanned={({ data }) => handleBarcodeScanned(data)}
                  />
                  {/* Visual Guide Overlays */}
                  <View style={styles.scanGuide}>
                    <Svg width={200} height={200} viewBox="0 0 200 200">
                      <Path d="M20 50 L20 26 C20 22, 22 20, 26 20 L50 20" fill="none" stroke="#9AB9EC" strokeWidth="4" strokeLinecap="round" />
                      <Path d="M150 20 L174 20 C178 20, 180 22, 180 26 L180 50" fill="none" stroke="#9AB9EC" strokeWidth="4" strokeLinecap="round" />
                      <Path d="M20 150 L20 174 C20 178, 22 180, 26 180 L50 180" fill="none" stroke="#9AB9EC" strokeWidth="4" strokeLinecap="round" />
                      <Path d="M150 180 L174 180 C178 180, 180 178, 180 174 L180 150" fill="none" stroke="#9AB9EC" strokeWidth="4" strokeLinecap="round" />
                    </Svg>
                    <View style={styles.laserBar} />
                  </View>
                </View>
              ) : (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                  }}
                  onBarcodeScanned={({ data }) => handleBarcodeScanned(data)}
                >
                  <View style={styles.scanGuide}>
                    <Svg width={200} height={200} viewBox="0 0 200 200">
                      <Path d="M20 50 L20 26 C20 22, 22 20, 26 20 L50 20" fill="none" stroke="#9AB9EC" strokeWidth="4" strokeLinecap="round" />
                      <Path d="M150 20 L174 20 C178 20, 180 22, 180 26 L180 50" fill="none" stroke="#9AB9EC" strokeWidth="4" strokeLinecap="round" />
                      <Path d="M20 150 L20 174 C20 178, 22 180, 26 180 L50 180" fill="none" stroke="#9AB9EC" strokeWidth="4" strokeLinecap="round" />
                      <Path d="M150 180 L174 180 C178 180, 180 178, 180 174 L180 150" fill="none" stroke="#9AB9EC" strokeWidth="4" strokeLinecap="round" />
                    </Svg>
                    <View style={styles.laserBar} />
                  </View>
                </CameraView>
              )}

              {validating && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#9AB9EC" />
                  <Text style={styles.loadingText}>Validating code with university database...</Text>
                </View>
              )}
            </View>
          )}

          {/* Detected Class Invitation Banner & Confirm Button */}
          {detectedClass && (
            <View style={styles.classResultCard}>
              <View style={styles.classResultHeader}>
                <ShieldCheck size={20} color="#4ECCA3" strokeWidth={2.4} style={{ marginRight: 8 }} />
                <Text style={styles.classResultTitle}>Class Invitation Verified</Text>
              </View>
              <Text style={styles.classResultName}>{detectedClass.class_name}</Text>
              <Text style={styles.classResultMeta}>
                {detectedClass.course_code} • {detectedClass.teacher_name || 'Faculty'}
              </Text>

              <TouchableOpacity
                style={styles.confirmEnrollBtn}
                onPress={handleConfirmEnrollment}
                activeOpacity={0.85}
                disabled={enrolling}
              >
                {enrolling ? (
                  <ActivityIndicator size="small" color="#061522" />
                ) : (
                  <>
                    <CheckCircle2 size={16} color="#061522" strokeWidth={2.4} style={{ marginRight: 6 }} />
                    <Text style={styles.confirmEnrollText}>Confirm & Enroll in Class</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Attendance Notice (Phase Scope Notice) */}
          {attendanceNotice && (
            <View style={styles.attendanceNoticeCard}>
              <Info size={20} color="#9AB9EC" strokeWidth={2.2} style={{ marginRight: 10, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>Attendance Session Detected</Text>
                <Text style={styles.noticeBody}>{attendanceNotice}</Text>
              </View>
            </View>
          )}

          {/* Error Message */}
          {errorMessage && (
            <View style={styles.errorNoticeCard}>
              <AlertTriangle size={20} color="#FC8181" strokeWidth={2.2} style={{ marginRight: 10, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorTitle}>Scan Error</Text>
                <Text style={styles.errorBody}>{errorMessage}</Text>
              </View>
            </View>
          )}

          {/* Quick Simulation / Testing Helper (Allows testing without physical camera) */}
          <View style={styles.testSection}>
            <Text style={styles.testLabel}>QUICK TEST PAYLOADS:</Text>
            <View style={styles.testPillsRow}>
              <TouchableOpacity
                style={styles.testPill}
                onPress={() => handleBarcodeScanned('INVITE-CS201-FALL')}
                activeOpacity={0.8}
              >
                <Text style={styles.testPillText}>Class QR: CS201</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.testPill}
                onPress={() => handleBarcodeScanned('CS203-DB')}
                activeOpacity={0.8}
              >
                <Text style={styles.testPillText}>Class Code: CS203</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.testPill, styles.testPillAttendance]}
                onPress={() => handleBarcodeScanned('ATT-CS201-SESSION-TOKEN')}
                activeOpacity={0.8}
              >
                <Text style={styles.testPillAttendanceText}>Attendance QR (Notice)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 10, 18, 0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0D2033',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1.5,
    borderTopColor: '#1E3B5A',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    ...Typography.titleMedium,
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#8EA5C2',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#162C44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionBox: {
    height: 240,
    backgroundColor: '#081726',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#18304C',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  permissionText: {
    fontSize: 13,
    color: '#7F94B0',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  permissionBtn: {
    backgroundColor: '#1B4B78',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  cameraFrame: {
    height: 240,
    borderRadius: 24,
    backgroundColor: '#071524',
    borderWidth: 1.5,
    borderColor: '#1D3B5C',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  webCameraContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanGuide: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laserBar: {
    position: 'absolute',
    width: 150,
    height: 2,
    backgroundColor: '#9AB9EC',
    shadowColor: '#9AB9EC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7, 21, 36, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#B4CBF5',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  classResultCard: {
    backgroundColor: '#122D47',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#305A87',
    padding: 16,
    marginBottom: 16,
  },
  classResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  classResultTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4ECCA3',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  classResultName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  classResultMeta: {
    fontSize: 13,
    color: '#A8B9D0',
    marginBottom: 14,
  },
  confirmEnrollBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.buttonPrimaryBg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmEnrollText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.buttonPrimaryText,
  },
  attendanceNoticeCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(154, 185, 236, 0.12)',
    borderWidth: 1,
    borderColor: '#3D5E85',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9AB9EC',
    marginBottom: 2,
  },
  noticeBody: {
    fontSize: 12,
    color: '#C3D4EA',
    lineHeight: 17,
  },
  errorNoticeCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(252, 129, 129, 0.12)',
    borderWidth: 1,
    borderColor: '#FC8181',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FC8181',
    marginBottom: 2,
  },
  errorBody: {
    fontSize: 12,
    color: '#FED7D7',
    lineHeight: 17,
  },
  testSection: {
    marginTop: 4,
  },
  testLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5C7A9D',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  testPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  testPill: {
    backgroundColor: '#12253A',
    borderWidth: 1,
    borderColor: '#1D3855',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  testPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9AB9EC',
  },
  testPillAttendance: {
    borderColor: '#3A526E',
  },
  testPillAttendanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A8B9D0',
  },
});
