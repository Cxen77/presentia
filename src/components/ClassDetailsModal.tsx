import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  X,
  BookOpen,
  User,
  Clock,
  MapPin,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  GraduationCap,
} from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { ClassScheduleItem } from '../types';
import { studentService } from '../services/studentService';

interface ClassDetailsModalProps {
  visible: boolean;
  classItem: ClassScheduleItem | null;
  studentProfileId: string;
  onClose: () => void;
  onClassUpdated: () => void;
}

export const ClassDetailsModal: React.FC<ClassDetailsModalProps> = ({
  visible,
  classItem,
  studentProfileId,
  onClose,
  onClassUpdated,
}) => {
  const [loading, setLoading] = useState(false);

  if (!classItem) return null;

  const handleLeaveClass = () => {
    Alert.alert(
      'Leave Class?',
      `Are you sure you want to withdraw from ${classItem.subject} (${classItem.courseCode})? Your enrollment record will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave Class',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await studentService.leaveClass(
                studentProfileId,
                classItem.id,
                classItem.enrollmentId
              );
              setLoading(false);
              if (res.success) {
                Alert.alert(
                  'Withdrawn',
                  `You have successfully left ${classItem.subject}.`
                );
                onClassUpdated();
                onClose();
              } else {
                Alert.alert('Error', res.error || 'Failed to leave class.');
              }
            } catch (err: any) {
              setLoading(false);
              Alert.alert('Error', err.message || 'Network error occurred.');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.badgeRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{classItem.classType || 'Theory'}</Text>
              </View>
              {classItem.enrollmentCode && (
                <View style={styles.codeBadge}>
                  <Text style={styles.codeBadgeText}>Code: {classItem.enrollmentCode}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color="#8EA5C2" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          {/* Title & Course Code */}
          <Text style={styles.title}>{classItem.subject}</Text>
          <Text style={styles.courseCode}>{classItem.courseCode} • 4 Academic Credits</Text>

          {/* Details Grid */}
          <View style={styles.detailsList}>
            {/* Instructor */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <User size={18} color="#9AB9EC" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Instructor</Text>
                <Text style={styles.detailValue}>
                  {classItem.teacherName || 'Faculty Assigned via Registrar'}
                </Text>
              </View>
            </View>

            {/* Timetable / Schedule */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <Clock size={18} color="#9AB9EC" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Schedule</Text>
                <Text style={styles.detailValue}>{classItem.timeSlot || 'Mon, Wed, Fri'}</Text>
              </View>
            </View>

            {/* Classroom / Location */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <MapPin size={18} color="#9AB9EC" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>{classItem.room || 'Campus Lecture Hall'}</Text>
              </View>
            </View>

            {/* Department */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <GraduationCap size={18} color="#9AB9EC" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Department</Text>
                <Text style={styles.detailValue}>
                  {classItem.department || 'Computer Science & Engineering'}
                </Text>
              </View>
            </View>
          </View>

          {/* Leave Class Action */}
          <TouchableOpacity
            style={styles.leaveClassBtn}
            onPress={handleLeaveClass}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FC8181" />
            ) : (
              <>
                <Trash2 size={16} color="#FC8181" strokeWidth={2.2} style={{ marginRight: 8 }} />
                <Text style={styles.leaveClassText}>Withdraw / Leave Class</Text>
              </>
            )}
          </TouchableOpacity>
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
    backgroundColor: '#0E2135',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1.5,
    borderTopColor: '#1E3C60',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    backgroundColor: '#183654',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9AB9EC',
  },
  codeBadge: {
    backgroundColor: '#10283E',
    borderWidth: 1,
    borderColor: '#1F4268',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  codeBadgeText: {
    fontSize: 11,
    color: '#8EA5C2',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#152C44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...Typography.headlineMedium,
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  courseCode: {
    fontSize: 14,
    color: '#8EA5C2',
    fontWeight: '500',
    marginBottom: 22,
  },
  detailsList: {
    backgroundColor: '#081726',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#18304C',
    padding: 16,
    gap: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#132B45',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C7A9D',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 2,
  },
  leaveClassBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(252, 129, 129, 0.1)',
    borderWidth: 1.5,
    borderColor: '#FC8181',
  },
  leaveClassText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FC8181',
  },
});
