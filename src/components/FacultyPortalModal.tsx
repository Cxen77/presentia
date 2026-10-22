import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { X, RefreshCw, Users, ShieldCheck, Clock, StopCircle, Play } from 'lucide-react-native';
import { attendanceService } from '../services/attendanceService';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import Svg, { Rect, G } from 'react-native-svg';

interface FacultyPortalModalProps {
  visible: boolean;
  onClose: () => void;
}

export const FacultyPortalModal: React.FC<FacultyPortalModalProps> = ({
  visible,
  onClose,
}) => {
  const [session, setSession] = useState(attendanceService.getCurrentSession());
  const [timeLeft, setTimeLeft] = useState(900); // 15 mins

  useEffect(() => {
    if (!visible) return;
    setSession(attendanceService.getCurrentSession());

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [visible]);

  const handleStartNewSession = () => {
    const newSess = attendanceService.startNewSession('class_1', 15);
    setSession(newSess);
    setTimeLeft(900);
  };

  const handleStopSession = () => {
    attendanceService.stopCurrentSession();
    setSession(attendanceService.getCurrentSession());
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.portalBadge}>
                <ShieldCheck size={13} color="#9AB9EC" strokeWidth={2.4} style={{ marginRight: 4 }} />
                <Text style={styles.portalBadgeText}>FACULTY ATTENDANCE DESK</Text>
              </View>
              <Text style={styles.facultyTitle}>Prof. R. Sengupta</Text>
              <Text style={styles.facultySub}>Dept. of Computer Science & Engineering</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#A8B9D0" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Active Class Card */}
            <View style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <View>
                  <Text style={styles.courseTitle}>{session.subjectName}</Text>
                  <Text style={styles.courseCode}>{session.courseCode} • {session.room}</Text>
                </View>
                <View style={[styles.statusTag, session.isActive ? styles.activeTag : styles.inactiveTag]}>
                  <Text style={styles.statusTagText}>
                    {session.isActive ? 'SESSION LIVE' : 'STOPPED'}
                  </Text>
                </View>
              </View>

              {/* QR Code Display on Classroom Screen */}
              <View style={styles.qrScreenBox}>
                <Svg width={180} height={180} viewBox="0 0 100 100">
                  <Rect width="100" height="100" fill="#FFFFFF" rx="8" />
                  {/* Outer Frame & Finders */}
                  <Rect x="8" y="8" width="26" height="26" rx="4" fill="#061522" />
                  <Rect x="13" y="13" width="16" height="16" rx="2" fill="#FFFFFF" />
                  <Rect x="16" y="16" width="10" height="10" rx="1" fill="#061522" />

                  <Rect x="66" y="8" width="26" height="26" rx="4" fill="#061522" />
                  <Rect x="71" y="13" width="16" height="16" rx="2" fill="#FFFFFF" />
                  <Rect x="74" y="16" width="10" height="10" rx="1" fill="#061522" />

                  <Rect x="8" y="66" width="26" height="26" rx="4" fill="#061522" />
                  <Rect x="13" y="71" width="16" height="16" rx="2" fill="#FFFFFF" />
                  <Rect x="16" y="74" width="10" height="10" rx="1" fill="#061522" />

                  {/* QR Data Pattern */}
                  <Rect x="40" y="10" width="8" height="8" rx="1.5" fill="#061522" />
                  <Rect x="52" y="18" width="8" height="8" rx="1.5" fill="#061522" />
                  <Rect x="40" y="28" width="16" height="6" rx="1.5" fill="#061522" />
                  <Rect x="40" y="40" width="8" height="16" rx="1.5" fill="#061522" />
                  <Rect x="54" y="48" width="8" height="8" rx="1.5" fill="#061522" />
                  <Rect x="68" y="38" width="10" height="8" rx="1.5" fill="#061522" />
                  <Rect x="80" y="50" width="10" height="6" rx="1.5" fill="#061522" />
                  <Rect x="42" y="64" width="16" height="8" rx="1.5" fill="#061522" />
                  <Rect x="64" y="68" width="20" height="16" rx="2" fill="#061522" />
                </Svg>
                <Text style={styles.tokenDisplay}>TOKEN: {session.sessionToken}</Text>
              </View>

              {/* Realtime Attendance Count & Timer */}
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Users size={16} color="#A8B9D0" strokeWidth={2} style={{ marginRight: 6 }} />
                  <Text style={styles.metricNumber}>{session.attendeesCount}</Text>
                  <Text style={styles.metricDesc}>Scanned</Text>
                </View>

                <View style={styles.metricItem}>
                  <Clock size={16} color="#A8B9D0" strokeWidth={2} style={{ marginRight: 6 }} />
                  <Text style={styles.metricNumber}>{formatTime(timeLeft)}</Text>
                  <Text style={styles.metricDesc}>Remaining</Text>
                </View>
              </View>

              {/* Action Controls */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={handleStartNewSession}
                  activeOpacity={0.8}
                >
                  <RefreshCw size={16} color="#061522" strokeWidth={2.4} style={{ marginRight: 6 }} />
                  <Text style={styles.refreshBtnText}>Regenerate Token</Text>
                </TouchableOpacity>

                {session.isActive ? (
                  <TouchableOpacity
                    style={styles.stopBtn}
                    onPress={handleStopSession}
                    activeOpacity={0.8}
                  >
                    <StopCircle size={16} color="#FC8181" strokeWidth={2.2} style={{ marginRight: 6 }} />
                    <Text style={styles.stopBtnText}>End Session</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.startBtn}
                    onPress={handleStartNewSession}
                    activeOpacity={0.8}
                  >
                    <Play size={16} color="#4ECCA3" strokeWidth={2.2} style={{ marginRight: 6 }} />
                    <Text style={styles.startBtnText}>Start Session</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0A1C2E',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 22,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  portalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#162F4A',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  portalBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9AB9EC',
    letterSpacing: 0.5,
  },
  facultyTitle: {
    ...Typography.titleMedium,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  facultySub: {
    fontSize: 13,
    color: '#7F94B0',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#13283E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionCard: {
    backgroundColor: '#11253B',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1D3B5C',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  courseTitle: {
    ...Typography.titleSmall,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  courseCode: {
    fontSize: 13,
    color: '#8EA5C2',
    marginTop: 2,
  },
  statusTag: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  activeTag: {
    backgroundColor: 'rgba(78, 204, 163, 0.2)',
  },
  inactiveTag: {
    backgroundColor: 'rgba(252, 129, 129, 0.2)',
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4ECCA3',
  },
  qrScreenBox: {
    backgroundColor: '#071524',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1A334F',
  },
  tokenDisplay: {
    marginTop: 12,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#9AB9EC',
    letterSpacing: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 18,
    backgroundColor: '#0C1C2D',
    borderRadius: 16,
    paddingVertical: 12,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginRight: 6,
  },
  metricDesc: {
    fontSize: 12,
    color: '#7F94B0',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  refreshBtn: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.buttonPrimaryBg,
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.buttonPrimaryText,
  },
  stopBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#241920',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#54262E',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FC8181',
  },
  startBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#123126',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F5440',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4ECCA3',
  },
});
