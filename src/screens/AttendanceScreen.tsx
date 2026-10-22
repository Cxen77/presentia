import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react-native';
import { AppBackground } from '../components/AppBackground';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { attendanceService } from '../services/attendanceService';

export const AttendanceScreen: React.FC = () => {
  const student = attendanceService.getStudentProfile();

  const subjects = [
    { code: 'CS201', name: 'Data Structures', attended: 24, total: 27, percent: 89, isEligible: true },
    { code: 'CS203', name: 'Database Management', attended: 22, total: 25, percent: 88, isEligible: true },
    { code: 'CS205', name: 'Operating Systems', attended: 21, total: 26, percent: 81, isEligible: true },
    { code: 'CS207', name: 'Computer Networks', attended: 23, total: 27, percent: 85, isEligible: true },
  ];

  return (
    <AppBackground variant="dashboard">
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Attendance</Text>
          <Text style={styles.subtitle}>Overall Semester Record: {student.attendancePercent}%</Text>
        </View>

        {/* Overview Banner */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewTop}>
            <View>
              <Text style={styles.overviewLabel}>Semester Eligibility</Text>
              <Text style={styles.overviewStatus}>EXAM READY</Text>
            </View>
            <View style={styles.percentCircle}>
              <Text style={styles.percentText}>{student.attendancePercent}%</Text>
            </View>
          </View>
          <Text style={styles.overviewNotice}>
            All subjects are currently above the mandatory university minimum of 75%.
          </Text>
        </View>

        {/* Subject Breakdown */}
        <Text style={styles.sectionHeading}>Subject Breakdown</Text>
        <View style={styles.subjectList}>
          {subjects.map((item) => (
            <View key={item.code} style={styles.subjectCard}>
              <View style={styles.subjectHeader}>
                <View>
                  <Text style={styles.subjectName}>{item.name}</Text>
                  <Text style={styles.subjectCode}>{item.code}</Text>
                </View>
                <Text style={styles.subjectPercent}>{item.percent}%</Text>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${item.percent}%` }]} />
              </View>

              <View style={styles.subjectFooter}>
                <Text style={styles.attendedRatio}>
                  {item.attended} attended / {item.total} lectures
                </Text>
                <View style={styles.statusIndicator}>
                  <CheckCircle2 size={13} color="#4ECCA3" strokeWidth={2.4} style={{ marginRight: 4 }} />
                  <Text style={styles.statusText}>Eligible</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    ...Typography.headlineMedium,
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  overviewCard: {
    backgroundColor: '#122B45',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#21466E',
    marginBottom: 24,
  },
  overviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  overviewLabel: {
    fontSize: 13,
    color: '#9AB9EC',
    fontWeight: '600',
  },
  overviewStatus: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  percentCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1C3E63',
    borderWidth: 2,
    borderColor: '#9AB9EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  overviewNotice: {
    fontSize: 12,
    color: '#A8B9D0',
    lineHeight: 18,
  },
  sectionHeading: {
    ...Typography.titleSmall,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  subjectList: {
    gap: 12,
  },
  subjectCard: {
    backgroundColor: Colors.cardCharcoal,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#263748',
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subjectName: {
    ...Typography.titleSmall,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subjectCode: {
    fontSize: 12,
    color: '#7F94B0',
    marginTop: 1,
  },
  subjectPercent: {
    fontSize: 18,
    fontWeight: '800',
    color: '#9AB9EC',
  },
  progressBarBg: {
    height: 7,
    backgroundColor: '#111D28',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4ECCA3',
    borderRadius: 4,
  },
  subjectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendedRatio: {
    fontSize: 12,
    color: '#8EA5C2',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    color: '#4ECCA3',
    fontWeight: '600',
  },
});
