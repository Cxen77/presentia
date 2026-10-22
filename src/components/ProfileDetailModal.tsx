import React from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, Image, ScrollView } from 'react-native';
import { X, Award, Mail, Phone, Calendar, BookOpen, LogOut } from 'lucide-react-native';
import { StudentProfile } from '../types';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface ProfileDetailModalProps {
  visible: boolean;
  student: StudentProfile;
  onClose: () => void;
  onLogout: () => void;
}

export const ProfileDetailModal: React.FC<ProfileDetailModalProps> = ({
  visible,
  student,
  onClose,
  onLogout,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Student Profile</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#A8B9D0" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Student ID badge preview */}
            <View style={styles.idCard}>
              <Image source={require('../../assets/aryan.jpg')} style={styles.avatar} />
              <View style={styles.idTextCol}>
                <Text style={styles.studentName}>{student.name}</Text>
                <Text style={styles.rollNumber}>ID: {student.rollNumber}</Text>
                <Text style={styles.degree}>{student.degree}</Text>
              </View>
            </View>

            {/* Academic details */}
            <View style={styles.detailsList}>
              <View style={styles.detailRow}>
                <Award size={18} color="#9AB9EC" strokeWidth={2} style={styles.detailIcon} />
                <View style={styles.detailTextCol}>
                  <Text style={styles.detailLabel}>CGPA / Academic Score</Text>
                  <Text style={styles.detailValue}>8.84 / 10.00 (Distinction)</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Calendar size={18} color="#9AB9EC" strokeWidth={2} style={styles.detailIcon} />
                <View style={styles.detailTextCol}>
                  <Text style={styles.detailLabel}>Academic Year</Text>
                  <Text style={styles.detailValue}>2025 – 2026 (Semester 3)</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Mail size={18} color="#9AB9EC" strokeWidth={2} style={styles.detailIcon} />
                <View style={styles.detailTextCol}>
                  <Text style={styles.detailLabel}>Institutional Email</Text>
                  <Text style={styles.detailValue}>aryan.sharma@cs.univ.edu</Text>
                </View>
              </View>
            </View>

            {/* Logout / Switch Account */}
            <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.85}>
              <LogOut size={18} color="#FC8181" strokeWidth={2.2} style={{ marginRight: 8 }} />
              <Text style={styles.logoutText}>Sign Out of Student Account</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0C1E30',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 22,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    ...Typography.titleMedium,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#162F4A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  idCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13283E',
    borderRadius: 22,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1D3B5C',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#B4CBF5',
    marginRight: 16,
  },
  idTextCol: {
    flex: 1,
  },
  studentName: {
    ...Typography.titleSmall,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  rollNumber: {
    fontSize: 13,
    color: '#9AB9EC',
    fontWeight: '600',
    marginBottom: 2,
  },
  degree: {
    fontSize: 12,
    color: '#8EA5C2',
  },
  detailsList: {
    backgroundColor: '#112438',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1A334E',
  },
  detailIcon: {
    marginRight: 14,
  },
  detailTextCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: '#7F94B0',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  logoutBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(252, 129, 129, 0.12)',
    borderWidth: 1,
    borderColor: '#E53E3E',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    color: '#FC8181',
    fontWeight: '700',
    fontSize: 14,
  },
});
