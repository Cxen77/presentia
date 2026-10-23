import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Bell,
  ChevronDown,
  Presentation,
  Plus,
  BookOpen,
  QrCode,
  Sparkles,
} from 'lucide-react-native';
import { AppBackground } from '../components/AppBackground';
import { StudentProfileCard } from '../components/StudentProfileCard';
import { ClassCard } from '../components/ClassCard';
import { JoinClassModal } from '../components/JoinClassModal';
import { ClassDetailsModal } from '../components/ClassDetailsModal';
import { QRScannerModal } from '../components/QRScannerModal';
import { NotificationsModal } from '../components/NotificationsModal';
import { ProfileDetailModal } from '../components/ProfileDetailModal';
import { ClassScheduleItem, StudentProfile } from '../types';
import { studentService } from '../services/studentService';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface HomeScreenProps {
  onLogout: () => void;
  onNavigateTab: (tab: any) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onLogout, onNavigateTab }) => {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [classes, setClasses] = useState<ClassScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals state
  const [joinClassVisible, setJoinClassVisible] = useState(false);
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassScheduleItem | null>(null);
  const [classDetailsVisible, setClassDetailsVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [profileDetailVisible, setProfileDetailVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const profile = await studentService.getProfile();
      if (!profile) {
        setStudent(null);
        setClasses([]);
        setLoadError('Sign in and complete your student profile to use the class dashboard.');
        return;
      }
      setStudent(profile);
      const enrolled = await studentService.getEnrolledClasses(profile.id);
      setClasses(enrolled);
      setLoadError(null);
    } catch (err) {
      console.error('Error loading home data:', err);
      setStudent(null);
      setClasses([]);
      setLoadError(err instanceof Error ? err.message : 'Unable to load your class dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenClassDetails = (item: ClassScheduleItem) => {
    setSelectedClass(item);
    setClassDetailsVisible(true);
  };

  if (!student) {
    return (
      <AppBackground variant="dashboard">
        <View style={styles.loadingContainer}>
          {loading && <ActivityIndicator size="large" color="#9AB9EC" />}
          <Text style={styles.loadingText}>
            {loading ? 'Loading your student profile...' : loadError}
          </Text>
          {!loading && (
            <TouchableOpacity style={styles.emptyJoinBtn} onPress={onLogout}>
              <Text style={styles.emptyJoinBtnText}>Return to Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      </AppBackground>
    );
  }
  const currentStudent = student;

  return (
    <AppBackground variant="dashboard">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Greeting & Header Bar */}
        <View style={styles.topHeader}>
          <View style={styles.greetingCol}>
            <Text style={styles.helloText}>Hello,</Text>
            <Text style={styles.studentFirstName}>{currentStudent.firstName}</Text>
            <Text style={styles.supportingGreeting}>Let's make today count</Text>
          </View>

          <View style={styles.headerActionsRow}>
            {/* Quick QR Scanner Header Shortcut */}
            <TouchableOpacity
              style={styles.qrHeaderButton}
              onPress={() => setQrScannerVisible(true)}
              activeOpacity={0.8}
              accessibilityLabel="Scan QR"
            >
              <QrCode size={18} color="#9AB9EC" strokeWidth={2.2} />
            </TouchableOpacity>

            {/* Notification Bell Button */}
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => setNotificationsVisible(true)}
              activeOpacity={0.8}
            >
              <Bell size={20} color="#FFFFFF" strokeWidth={2} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Dominant Student Profile Card */}
        <StudentProfileCard
          student={currentStudent}
          enrolledClassesCount={classes.length}
          onPressProfile={() => setProfileDetailVisible(true)}
          onPressScanQR={() => setQrScannerVisible(true)}
          onEditAvatar={() => {
            Alert.alert(
              'Profile Photo',
              'To update your profile photo, visit the Profile tab.'
            );
          }}
        />

        {/* Classes Section Header with Obvious "+ Join Class" Action */}
        <View style={styles.classesSectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Enrolled Classes</Text>
            <Text style={styles.sectionSubtitle}>
              {classes.length} {classes.length === 1 ? 'class' : 'classes'} enrolled
            </Text>
          </View>

          {/* Obvious + Join Class Button */}
          <TouchableOpacity
            style={styles.joinClassHeaderBtn}
            onPress={() => setJoinClassVisible(true)}
            activeOpacity={0.85}
          >
            <Plus size={16} color="#061522" strokeWidth={3} style={{ marginRight: 4 }} />
            <Text style={styles.joinClassHeaderBtnText}>Join Class</Text>
          </TouchableOpacity>
        </View>

        {/* Enrolled Classes List or Clean Empty State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#9AB9EC" />
            <Text style={styles.loadingText}>Loading your enrolled classes...</Text>
          </View>
        ) : classes.length === 0 ? (
          /* Clean Empty State */
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconCircle}>
              <BookOpen size={36} color="#9AB9EC" strokeWidth={1.8} />
            </View>
            <Text style={styles.emptyTitle}>No Classes Joined Yet</Text>
            <Text style={styles.emptySubtitle}>
              Ask your teacher for a class code (or scan an invitation QR) to enroll in your courses.
            </Text>

            <TouchableOpacity
              style={styles.emptyJoinBtn}
              onPress={() => setJoinClassVisible(true)}
              activeOpacity={0.85}
            >
              <Plus size={18} color="#061522" strokeWidth={2.8} style={{ marginRight: 6 }} />
              <Text style={styles.emptyJoinBtnText}>Join Your First Class</Text>
            </TouchableOpacity>

          </View>
        ) : (
          /* Real Enrolled Class Cards */
          <View style={styles.classesList}>
            {classes.map((classItem) => (
              <ClassCard
                key={classItem.id}
                item={classItem}
                onPressAction={() => handleOpenClassDetails(classItem)}
                onPressCard={() => handleOpenClassDetails(classItem)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Join Class Modal */}
      <JoinClassModal
        visible={joinClassVisible}
        studentProfileId={currentStudent.id}
        onClose={() => setJoinClassVisible(false)}
        onClassJoined={loadData}
      />

      {/* Class Details Modal */}
      <ClassDetailsModal
        visible={classDetailsVisible}
        classItem={selectedClass}
        studentProfileId={currentStudent.id}
        onClose={() => {
          setClassDetailsVisible(false);
          setSelectedClass(null);
        }}
        onClassUpdated={loadData}
      />

      {/* Dedicated QR Scanner Modal */}
      <QRScannerModal
        visible={qrScannerVisible}
        studentProfileId={currentStudent.id}
        onClose={() => setQrScannerVisible(false)}
        onClassEnrolled={loadData}
      />

      {/* Notifications Modal */}
      <NotificationsModal
        visible={notificationsVisible}
        onClose={() => setNotificationsVisible(false)}
      />

      {/* Profile Detail Modal */}
      <ProfileDetailModal
        visible={profileDetailVisible}
        student={currentStudent}
        onClose={() => setProfileDetailVisible(false)}
        onLogout={onLogout}
      />
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 18,
    paddingBottom: 20,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 4,
  },
  greetingCol: {
    flex: 1,
  },
  helloText: {
    fontSize: 22,
    color: '#8EA5C2',
    fontWeight: '500',
    lineHeight: 26,
  },
  studentFirstName: {
    ...Typography.headlineMedium,
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  supportingGreeting: {
    fontSize: 16,
    color: '#7F94B0',
    marginTop: 2,
    fontWeight: '400',
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  qrHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#12273F',
    borderWidth: 1,
    borderColor: '#1D3B5C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.cardElevated,
    borderWidth: 1,
    borderColor: '#1D3550',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
  },
  classesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    ...Typography.titleLarge,
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#7F94B0',
    marginTop: 2,
    fontWeight: '500',
  },
  joinClassHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.buttonPrimaryBg,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  joinClassHeaderBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.buttonPrimaryText,
  },
  classesList: {
    marginBottom: 10,
  },
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#7F94B0',
    fontSize: 14,
    marginTop: 12,
  },
  emptyStateContainer: {
    backgroundColor: '#0F2338',
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#1D3B5C',
    padding: 28,
    alignItems: 'center',
    textAlign: 'center',
    marginVertical: 8,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#183654',
    borderWidth: 1.5,
    borderColor: '#2A527A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#7F94B0',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  emptyJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.buttonPrimaryBg,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  emptyJoinBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.buttonPrimaryText,
  },
});
