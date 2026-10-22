import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import {
  GraduationCap,
  ChevronRight,
  Pencil,
  BarChart2,
  BookOpen,
  Clock,
  QrCode,
  User,
} from 'lucide-react-native';
import { StudentProfile } from '../types';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface StudentProfileCardProps {
  student: StudentProfile;
  enrolledClassesCount?: number;
  onPressProfile?: () => void;
  onEditAvatar?: () => void;
  onPressScanQR?: () => void;
}

export const StudentProfileCard: React.FC<StudentProfileCardProps> = ({
  student,
  enrolledClassesCount = 0,
  onPressProfile,
  onEditAvatar,
  onPressScanQR,
}) => {
  const hasCustomAvatar = Boolean(student.avatarUrl && student.avatarUrl.startsWith('http'));

  return (
    <View style={styles.cardContainer}>
      {/* Decorative internal pale-blue organic waves on right edge */}
      <View style={styles.wavesWrapper} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 350 260" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="cardWave1" x1="1" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#C9DCF8" stopOpacity="0.45" />
              <Stop offset="100%" stopColor="#EBF2FC" stopOpacity="0.05" />
            </LinearGradient>
            <LinearGradient id="cardWave2" x1="1" y1="0.5" x2="0.3" y2="1">
              <Stop offset="0%" stopColor="#BACFF2" stopOpacity="0.3" />
              <Stop offset="100%" stopColor="#EBF2FC" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path
            d="M200 0 C240 30, 260 70, 240 120 C220 170, 270 200, 350 180 L350 0 Z"
            fill="url(#cardWave1)"
          />
          <Path
            d="M250 0 C280 40, 310 80, 290 140 C280 180, 310 220, 350 230 L350 0 Z"
            fill="url(#cardWave2)"
          />
        </Svg>
      </View>

      {/* Top Profile Section */}
      <View style={styles.profileRow}>
        {/* Avatar with ring and edit badge */}
        <View style={styles.avatarContainer}>
          {hasCustomAvatar ? (
            <Image
              source={{ uri: student.avatarUrl }}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : student.avatarUrl === 'assets/aryan.jpg' ? (
            <Image
              source={require('../../assets/aryan.jpg')}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
              <User size={40} color="#5A7B9E" strokeWidth={1.8} />
            </View>
          )}

          <TouchableOpacity
            style={styles.editBadge}
            onPress={onEditAvatar}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Pencil size={12} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {/* Profile Info */}
        <View style={styles.infoColumn}>
          <Text style={styles.studentName} numberOfLines={1}>
            {student.name || 'Student Name'}
          </Text>
          <Text style={styles.degreeText} numberOfLines={1}>
            {student.degree || 'Degree Program'}
          </Text>
          <Text style={styles.rollNumberText}>
            USN: {student.rollNumber || 'Not assigned'}
          </Text>

          {/* Semester Badge */}
          <View style={styles.semesterBadge}>
            <GraduationCap
              size={14}
              color={Colors.badgeSemesterText}
              strokeWidth={2.2}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.semesterText}>{student.semester || 'Semester'}</Text>
          </View>
        </View>

        {/* Right Action Icons Column: Dedicated QR Scanner & Profile Details */}
        <View style={styles.profileActionsCol}>
          {/* Recognizable Quick QR Scanner Icon Button */}
          <TouchableOpacity
            style={styles.qrScannerButton}
            onPress={onPressScanQR}
            activeOpacity={0.8}
            accessibilityLabel="Scan QR Code"
          >
            <QrCode size={19} color="#061522" strokeWidth={2.2} />
          </TouchableOpacity>

          {/* Profile details arrow */}
          <TouchableOpacity
            style={styles.chevronButton}
            onPress={onPressProfile}
            activeOpacity={0.8}
            accessibilityLabel="View Profile Details"
          >
            <ChevronRight size={18} color="#5C6F84" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Subtle Horizontal Divider */}
      <View style={styles.divider} />

      {/* Bottom Academic Overview Strip */}
      <View style={styles.statsStrip}>
        {/* Stat 1: Enrolled Classes */}
        <View style={styles.statColumn}>
          <View style={styles.statIconRow}>
            <BookOpen size={18} color={Colors.textDarkNavy} strokeWidth={2.2} />
            <Text style={styles.statValue}>{enrolledClassesCount}</Text>
          </View>
          <Text style={styles.statLabel}>Enrolled Classes</Text>
        </View>

        {/* Vertical Divider 1 */}
        <View style={styles.verticalDivider} />

        {/* Stat 2: Active Academic Term */}
        <View style={styles.statColumn}>
          <View style={styles.statIconRow}>
            <GraduationCap size={18} color={Colors.textDarkNavy} strokeWidth={2.2} />
            <Text style={styles.statValue}>{student.semester.split(' ')[0] || 'Fall'}</Text>
          </View>
          <Text style={styles.statLabel}>Active Term</Text>
        </View>

        {/* Vertical Divider 2 */}
        <View style={styles.verticalDivider} />

        {/* Stat 3: Institutional Status */}
        <View style={styles.statColumn}>
          <View style={styles.statIconRow}>
            <Clock size={18} color={Colors.textDarkNavy} strokeWidth={2.2} />
            <Text style={styles.statValue}>Active</Text>
          </View>
          <Text style={styles.statLabel}>Student Status</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: Colors.cardProfile,
    borderRadius: 32,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6,
    marginBottom: 24,
  },
  wavesWrapper: {
    ...StyleSheet.absoluteFill,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2.5,
    borderColor: '#B4CBF5',
  },
  avatarPlaceholder: {
    backgroundColor: '#D9E6F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#162C44',
    borderWidth: 2,
    borderColor: Colors.cardProfile,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  studentName: {
    ...Typography.titleLarge,
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textDarkNavy,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  degreeText: {
    ...Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textDarkMuted,
    marginBottom: 2,
  },
  rollNumberText: {
    ...Typography.bodySmall,
    fontSize: 13,
    color: Colors.textDarkMuted,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  semesterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.badgeSemesterBg,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  semesterText: {
    ...Typography.badge,
    fontSize: 12,
    color: Colors.badgeSemesterText,
    fontWeight: '700',
  },
  profileActionsCol: {
    alignItems: 'center',
    gap: 8,
    marginLeft: 6,
  },
  qrScannerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2ECF8',
    borderWidth: 1.5,
    borderColor: '#9AB9EC',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chevronButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 16,
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    ...Typography.titleMedium,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textDarkNavy,
    marginLeft: 6,
  },
  statLabel: {
    ...Typography.bodySmall,
    fontSize: 11,
    color: Colors.textDarkMuted,
    fontWeight: '600',
  },
  verticalDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },
});
