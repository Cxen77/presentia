import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  AppState,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import {
  ArrowLeft,
  ArrowRight,
  User,
  Lock,
  Mail,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  ShieldCheck,
  Plus,
  BookOpen,
  QrCode,
  Sparkles,
  Camera,
  GraduationCap,
  ChevronRight,
  ChevronDown,
  Pencil,
  BarChart2,
  Clock,
  MapPin,
  Trash2,
  LogOut,
  Shield,
  HelpCircle,
  Award,
  Bell,
  Home as HomeIcon,
  Calendar,
  ImagePlus,
  UploadCloud,
  SkipForward,
  Presentation,
  X,
  RefreshCw,
} from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as studentApi from './src/services/api';
import { authErrorMessage } from './src/services/authErrors';
import { registerStudent } from './src/services/registration';
import { EmailVerificationForm } from './src/components/EmailVerificationForm';
import { router } from 'expo-router';
import { WelcomeScreen } from './src/components/WelcomeScreen';
import { getUnauthenticatedEntry, markWelcomeSeen } from './src/services/welcomeState';
import { PROFILE_SETUP_STEPS, profileStepError } from './src/services/profileSetup';
import { StudentClassCard } from './src/components/StudentClassCard';
import { SelfieCheckInModal } from './src/components/SelfieCheckInModal';
import { AttendanceDecisionNotice, StudentAttendanceView, StudentClassesView } from './src/components/StudentActivity';
import { ProfileSettingsModal, type SettingsSection } from './src/components/ProfileSettingsModal';
import { clearStudentCache } from './src/services/studentCache';
import { getAttendanceLocation, warmGrantedLocation } from './src/services/checkInLocation';
import { uploadCloudinaryImage, uploadImageToCloudinary, optimizedAvatarUrl } from './src/services/cloudinary';
import { SkeletonBlock, ClassCardSkeleton } from './src/components/Skeleton';
export { uploadImageToCloudinary } from './src/services/cloudinary';

WebBrowser.maybeCompleteAuthSession();

// ============================================================================
// 1. DESIGN TOKENS & THEMING
// ============================================================================
export const Colors = {
  background: '#061522',
  backgroundDark: '#081B2A',
  backgroundSecondary: '#0B2032',
  cardProfile: '#F3F2EF',
  cardDataStructures: '#203954',
  cardCharcoal: '#202D39',
  cardInput: '#102235',
  cardElevated: '#142539',
  borderSubtle: '#1C334A',
  borderInput: '#1E354D',
  borderInputFocused: '#436B9B',
  borderLight: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#FFFFFF',
  textSecondary: '#A8B9D0',
  textMuted: '#7F94B0',
  textDarkNavy: '#061522',
  textDarkMuted: '#5C6F84',
  textAccentBlue: '#9AB9EC',
  textBrightBlue: '#B4CBF5',
  buttonPrimaryBg: '#F3F2EF',
  buttonPrimaryText: '#061522',
  badgeSemesterBg: '#DDE8F8',
  badgeSemesterText: '#1A324E',
  navBackground: '#0C1B2B',
  navActiveBg: '#F3F2EF',
  navActiveText: '#061522',
  navInactive: '#7F94B0',
};

export const Typography = {
  headlineLarge: { fontSize: 36, fontWeight: '800' as const, color: '#FFFFFF' },
  headlineMedium: { fontSize: 28, fontWeight: '700' as const, color: '#FFFFFF' },
  titleLarge: { fontSize: 22, fontWeight: '700' as const, color: '#FFFFFF' },
  titleMedium: { fontSize: 18, fontWeight: '600' as const, color: '#FFFFFF' },
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, color: '#A8B9D0' },
  bodyMedium: { fontSize: 14, fontWeight: '400' as const, color: '#8EA5C2' },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, color: '#7F94B0' },
  button: { fontSize: 16, fontWeight: '700' as const },
  badge: { fontSize: 12, fontWeight: '600' as const },
};

// ============================================================================
// 2. DATA TYPES
// ============================================================================
export type ScreenName = 'onboarding' | 'login' | 'register' | 'profile_setup' | 'main';
export type TabName = 'home' | 'classes' | 'attendance' | 'profile';
export type AttendanceStatus = 'Not Started' | 'Available' | 'Present' | 'Late' | 'Absent' | 'Pending' | 'Rejected';

export interface StudentProfile {
  id: string;
  userId?: string;
  email?: string;
  name: string;
  firstName: string;
  degree: string;
  rollNumber: string;
  classRollNumber?: string;
  section?: string;
  semester: string;
  avatarUrl: string;
  attendancePercent: number;
  totalClasses: number;
  presentToday: number;
}

export interface ClassScheduleItem {
  id: string;
  subject: string;
  courseCode: string;
  classType: string;
  timeSlot: string;
  room: string;
  iconName: 'monitor' | 'book' | 'users' | 'chart';
  isHighlighted?: boolean;
  status: AttendanceStatus;
  teacherName?: string;
  department?: string;
  enrollmentCode?: string;
  enrollmentId?: string;
}

export interface DatabaseClass {
  id: string;
  course_code: string;
  class_name: string;
  department: string;
  enrollment_code: string;
  teacher_name?: string;
  schedule_info?: string;
  room?: string;
  class_type?: string;
  credits?: number;
  is_active?: boolean;
}

// ============================================================================
// 3. BACKEND CLIENTS & SERVICES (SUPABASE & CLOUDINARY)
// ============================================================================
import { supabase, isSupabaseConfigured } from './src/services/supabase';
export { supabase, isSupabaseConfigured };

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export async function submitAttendanceApi(data: { qrToken: string; verificationPhotoUrl: string; verificationPhotoSignature: string; scanTicket: string; location:studentApi.CheckInLocation }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    throw new Error('Please sign in to submit attendance.');
  }

  const res = await fetch(`${API_BASE_URL}/api/attendance/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    let errorMsg = 'Failed to submit attendance';
    try {
      const errJson = await res.json();
      errorMsg = errJson.error || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  return res.json();
}


class StudentService {
  async getProfile(): Promise<StudentProfile | null> {
    if (!isSupabaseConfigured()) return null;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(`Authentication failed: ${authError.message}`);
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      throw new Error(
        error.code === 'PGRST205'
          ? 'Supabase profile table is missing. Run supabase/migration_000_core_schema.sql.'
          : `Failed to load your profile: ${error.message}`
      );
    }
    if (!data || !data.full_name?.trim() || !data.roll_number?.trim() || !data.degree?.trim() || !data.semester?.trim()) return null;

    const profile: StudentProfile = {
      id: data.id,
      userId: data.user_id,
      email: data.email || user.email || '',
      name: data.full_name,
      firstName: data.first_name || data.full_name.split(' ')[0],
      degree: data.degree || 'Computer Science',
      rollNumber: data.roll_number,
      classRollNumber: data.class_roll_number || '',
      section: data.section || '',
      semester: data.semester || '3rd Semester',
      avatarUrl: data.avatar_url || '',
      attendancePercent: 0,
      totalClasses: 0,
      presentToday: 0,
    };
    await AsyncStorage.setItem('app_student_profile', JSON.stringify(profile));
    return profile;
  }

  async saveProfile(profileData: {
    fullName: string;
    rollNumber: string;
    classRollNumber?: string;
    section?: string;
    department: string;
    semester: string;
    avatarUrl?: string;
  }): Promise<{ success: boolean; profile?: StudentProfile; error?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase is not configured. Sign in with a real Supabase account to save your profile.' };
    }
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { success: false, error: 'Sign in with a valid Supabase account before saving your profile.' };
      }
      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          {
            user_id: user.id,
            email: user.email || '',
            full_name: profileData.fullName.trim(),
            first_name: profileData.fullName.trim().split(' ')[0],
            roll_number: profileData.rollNumber.trim().toUpperCase(),
            degree: profileData.department.trim(),
            ...(profileData.classRollNumber !== undefined ? {class_roll_number:profileData.classRollNumber.trim()}:{}),
            ...(profileData.section !== undefined ? {section:profileData.section.trim().toUpperCase()}:{}),
            semester: profileData.semester.trim(),
            avatar_url: profileData.avatarUrl || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single();
      if (error) {
        return {
          success: false,
          error: error.code === 'PGRST205'
            ? 'Supabase profile table is missing. Run supabase/migration_000_core_schema.sql.'
            : error.code === '23505' && /roll_number/.test(error.message)
              ? 'This roll number is already linked to another account. Use your original account or enter your own roll number.'
              : error.message,
        };
      }
      const profile: StudentProfile = {
        id: data.id,
        userId: data.user_id,
        email: data.email,
        name: data.full_name,
        firstName: data.first_name,
        degree: data.degree,
        rollNumber: data.roll_number,
      classRollNumber: data.class_roll_number || '',
      section: data.section || '',
        semester: data.semester,
        avatarUrl: data.avatar_url || '',
        attendancePercent: 0,
        totalClasses: 0,
        presentToday: 0,
      };
      await AsyncStorage.setItem('app_student_profile', JSON.stringify(profile));
      return { success: true, profile };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to save profile.' };
    }
  }

  async getEnrolledClasses(_studentProfileId?: string): Promise<ClassScheduleItem[]> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw new Error(`Could not verify Supabase sign-in: ${error.message}`);
    if (!user) throw new Error('Sign in with a valid Supabase account to view enrolled classes.');

    const enrolled = await studentApi.getMyEnrolledClasses();
    const classes: ClassScheduleItem[] = enrolled.map((item) => ({
      id: item.id,
      enrollmentId: item.enrollmentId,
      subject: item.subject,
      courseCode: item.courseCode,
      classType: item.classType || 'Theory',
      timeSlot: item.timeSlot || '',
      room: item.room || '',
      iconName: item.courseCode === 'CS201' ? 'chart' : 'book',
      isHighlighted: item.courseCode === 'CS201',
      status: item.attendanceStatus==='PRESENT'?'Present':item.attendanceStatus==='PENDING'?'Pending':item.attendanceStatus==='REJECTED'?'Rejected':item.sessionStatus==='ACTIVE'?'Available':'Not Started',
      teacherName: item.teacherName,
      department: item.department,
      enrollmentCode: item.enrollmentCode,
    }));
    await AsyncStorage.setItem('app_enrolled_classes', JSON.stringify(classes));
    return classes;
  }

  async joinClassByCode(
    _studentProfileId: string,
    enrollmentCode: string
  ): Promise<{ success: boolean; classData?: DatabaseClass; error?: string }> {
    const code = enrollmentCode.trim().toUpperCase();
    if (!code) return { success: false, error: 'Please enter a class code.' };

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      return { success: false, error: `Could not verify Supabase sign-in: ${error.message}` };
    }
    if (!user) {
      return { success: false, error: 'Sign in with a valid Supabase account before joining a class.' };
    }

    try {
      const response = await studentApi.joinClassByCode(code);
      const data = response.classData;
      return {
        success: true,
        classData: {
          id: data.id,
          course_code: data.courseCode,
          class_name: data.className,
          department: data.department,
          enrollment_code: data.enrollmentCode,
          teacher_name: data.teacherName,
          schedule_info: data.scheduleInfo,
          room: data.room,
          class_type: data.classType,
          credits: data.credits,
          is_active: data.isActive,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unable to reach the enrollment service.',
      };
    }
  }

  async leaveClass(_studentProfileId: string, _classId: string, enrollmentId?: string): Promise<{ success: boolean; error?: string }> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return { success: false, error: 'Sign in with a valid Supabase account before leaving a class.' };
    }
    if (!enrollmentId) {
      return { success: false, error: 'Enrollment details are missing. Refresh your class list and try again.' };
    }
    try {
      await studentApi.leaveClass(enrollmentId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to leave this class.' };
    }
  }

  async validateQRPayload(payload: string): Promise<{
    type: 'class_invite' | 'attendance_session' | 'invalid';
    classData?: DatabaseClass;
    attendanceToken?: string;
    courseCode?: string;
    message?: string;
  }> {
    const trimmed = payload.trim();

    // 1. Check for JSON structured payload from faculty portal
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === 'ATTENDANCE_CHECKIN' || parsed.token) {
        return {
          type: 'attendance_session',
          attendanceToken: parsed.token,
          courseCode: parsed.courseCode,
          message: `Live Attendance Session for ${parsed.courseCode || 'Class'}. Ready to check in.`,
        };
      }
    } catch {}

    // 2. Check for raw token string ATT-...
    if (trimmed.startsWith('ATT-')) {
      const parts = trimmed.split('-');
      const course = parts.length > 1 ? parts[1] : undefined;
      return {
        type: 'attendance_session',
        attendanceToken: trimmed,
        courseCode: course,
        message: 'Live Attendance QR Detected. Ready to check in.',
      };
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { type: 'invalid', message: 'Sign in with a valid Supabase account before scanning a class invitation.' };
    }

    const { data: invite, error: inviteError } = await supabase
      .from('class_invitations')
      .select('class_id, is_active, expires_at')
      .eq('invitation_code', trimmed)
      .maybeSingle();
    if (inviteError) {
      return {
        type: 'invalid',
        message: inviteError.code === 'PGRST205'
          ? 'Supabase class invitation table is missing. Run supabase/migration_000_core_schema.sql.'
          : `Could not validate invitation: ${inviteError.message}`,
      };
    }
    if (invite) {
      if (!invite.is_active) {
        return { type: 'invalid', message: 'This class invitation QR has been revoked by the instructor.' };
      }
      if (new Date(invite.expires_at).getTime() < Date.now()) {
        return { type: 'invalid', message: 'This class invitation QR has expired.' };
      }
      const { data: invitedClass, error: invitedClassError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', invite.class_id)
        .eq('is_active', true)
        .maybeSingle();
      if (invitedClassError) {
        return {
          type: 'invalid',
          message: invitedClassError.code === 'PGRST205'
            ? 'Supabase classes table is missing. Run supabase/migration_000_core_schema.sql.'
            : `Could not validate invitation class: ${invitedClassError.message}`,
        };
      }
      if (!invitedClass) {
        return { type: 'invalid', message: 'The class for this invitation is inactive or unavailable.' };
      }
      return { type: 'class_invite', classData: invitedClass };
    }

    const { data: directClass, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('enrollment_code', trimmed.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();
    if (classError) {
      return {
        type: 'invalid',
        message: classError.code === 'PGRST205'
          ? 'Supabase classes table is missing. Run supabase/migration_000_core_schema.sql.'
          : `Could not validate class code: ${classError.message}`,
      };
    }
    if (directClass) return { type: 'class_invite', classData: directClass };
    return { type: 'invalid', message: 'Unrecognized QR code. Please scan a valid class QR.' };
  }
}

export const studentService = new StudentService();

// ============================================================================
// 4. SHARED UI COMPONENTS (BACKGROUND, BLOBS, INPUTS, CARDS, MODALS)
// ============================================================================

export const DecorativeBlobs: React.FC<{ variant?: 'onboarding' | 'login' | 'dashboard' }> = ({ variant = 'onboarding' }) => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="topBlob" x1="0.5" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#1C3D61" stopOpacity="0.55" />
            <Stop offset="100%" stopColor="#0B1E32" stopOpacity="0.1" />
          </LinearGradient>
          <LinearGradient id="midBlob" x1="0" y1="0.3" x2="1" y2="0.8">
            <Stop offset="0%" stopColor="#142B44" stopOpacity="0.65" />
            <Stop offset="100%" stopColor="#081827" stopOpacity="0.2" />
          </LinearGradient>
        </Defs>
        <Path d="M140 -20 C220 -40, 320 20, 360 110 C400 200, 320 280, 220 270 C120 260, 40 220, 20 130 C0 40, 60 0, 140 -20 Z" fill="url(#topBlob)" />
        <Path d="M-60 220 C20 180, 120 240, 160 340 C200 440, 140 540, 40 560 C-60 580, -140 500, -150 400 C-160 300, -140 260, -60 220 Z" fill="url(#midBlob)" />
      </Svg>
    </View>
  );
};

export const AppBackground: React.FC<{ children: React.ReactNode; variant?: 'onboarding' | 'login' | 'dashboard' }> = ({
  children,
  variant = 'dashboard',
}) => {
  return (
    <View style={styles.appBgContainer}>
      <StatusBar barStyle="light-content" />
      <DecorativeBlobs variant={variant} />
      <SafeAreaView style={styles.appBgInner}>{children}</SafeAreaView>
    </View>
  );
};

export const AuthInput: React.FC<{
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  isPassword?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  icon?: React.ReactNode;
}> = ({ label, placeholder, value, onChangeText, isPassword, keyboardType, autoCapitalize, icon }) => {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <View style={styles.authInputContainer}>
      <Text style={styles.authInputLabel}>{label}</Text>
      <View style={styles.authInputFieldWrap}>
        {icon && <View style={styles.authInputIcon} pointerEvents="none">{icon}</View>}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={isPassword ? 'Hidden by default' : undefined}
          style={styles.authTextInput}
          placeholder={placeholder}
          placeholderTextColor="#4C688A"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.authPasswordToggle}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Text style={styles.authPasswordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export const StudentProfileCard: React.FC<{
  student: StudentProfile;
  enrolledClassesCount?: number;
  onPressProfile?: () => void;
  onEditAvatar?: () => void;
  onPressScanQR?: () => void;
}> = ({ student, enrolledClassesCount = 0, onPressProfile, onEditAvatar, onPressScanQR }) => {
  const hasCustomAvatar = Boolean(student.avatarUrl && student.avatarUrl.startsWith('http'));
  return (
    <View style={styles.profileCardContainer}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 350 260" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="wave1" x1="1" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#C9DCF8" stopOpacity="0.45" />
              <Stop offset="100%" stopColor="#EBF2FC" stopOpacity="0.05" />
            </LinearGradient>
          </Defs>
          <Path d="M200 0 C240 30, 260 70, 240 120 C220 170, 270 200, 350 180 L350 0 Z" fill="url(#wave1)" />
        </Svg>
      </View>
      <View style={styles.profileRow}>
        <View style={styles.avatarContainer}>
          {hasCustomAvatar ? (
            <Image source={{ uri: optimizedAvatarUrl(student.avatarUrl) }} style={styles.avatarImage} />
          ) : student.avatarUrl === 'assets/aryan.jpg' ? (
            <Image source={require('./assets/aryan.jpg')} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
              <User size={38} color="#5A7B9E" strokeWidth={1.8} />
            </View>
          )}
          <TouchableOpacity style={styles.editBadge} onPress={onEditAvatar} accessibilityRole="button" accessibilityLabel="Edit profile photo">
            <Pencil size={11} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoColumn}>
          <Text style={styles.studentName} numberOfLines={1}>{student.name || 'Student Name'}</Text>
          <Text style={styles.degreeText} numberOfLines={1}>{student.degree || 'Degree Program'}</Text>
          <Text style={styles.rollNumberText}>USN: {student.rollNumber || 'Not assigned'}</Text>
          <View style={styles.semesterBadge}>
            <GraduationCap size={13} color={Colors.badgeSemesterText} strokeWidth={2.2} style={{ marginRight: 5 }} />
            <Text style={styles.semesterText}>{student.semester || '3rd Semester'}</Text>
          </View>
        </View>

        <View style={styles.profileActionsCol}>
          <TouchableOpacity style={styles.qrScannerButton} onPress={onPressScanQR} accessibilityRole="button" accessibilityLabel="Scan attendance QR">
            <QrCode size={19} color="#061522" strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.chevronButton} onPress={onPressProfile} accessibilityRole="button" accessibilityLabel="Open my profile">
            <ChevronRight size={18} color="#5C6F84" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.statsStrip}>
        <View style={styles.statColumn}>
          <View style={styles.statIconRow}>
            <BookOpen size={17} color={Colors.textDarkNavy} strokeWidth={2.2} />
            <Text style={styles.statValue}>{enrolledClassesCount}</Text>
          </View>
          <Text style={styles.statLabel}>Enrolled Classes</Text>
        </View>
        <View style={styles.verticalDivider} />
        <View style={styles.statColumn}>
          <View style={styles.statIconRow}>
            <GraduationCap size={17} color={Colors.textDarkNavy} strokeWidth={2.2} />
            <Text style={styles.statValue}>{student.semester?.split(' ')[0] || 'Fall'}</Text>
          </View>
          <Text style={styles.statLabel}>Active Term</Text>
        </View>
        <View style={styles.verticalDivider} />
        <View style={styles.statColumn}>
          <View style={styles.statIconRow}>
            <Clock size={17} color={Colors.textDarkNavy} strokeWidth={2.2} />
            <Text style={styles.statValue}>Active</Text>
          </View>
          <Text style={styles.statLabel}>Student Status</Text>
        </View>
      </View>
    </View>
  );
};

export const ClassCard: React.FC<{ item: ClassScheduleItem; onPressAction: () => void; onPressCard: () => void }> = ({ item, onPressCard }) => <StudentClassCard item={item} onPress={onPressCard}/>;

// ============================================================================
// 5. MODALS (JOIN CLASS, CLASS DETAILS, QR SCANNER)
// ============================================================================

export const JoinClassModal: React.FC<{
  visible: boolean;
  studentProfileId: string;
  onClose: () => void;
  onClassJoined: () => void;
}> = ({ visible, studentProfileId, onClose, onClassJoined }) => {
  const [classCode, setClassCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });

  const handleJoin = async () => {
    if (!classCode.trim()) {
      setResult({ type: 'error', message: 'Please enter a valid class code.' });
      return;
    }
    setLoading(true);
    setResult({ type: 'idle', message: '' });
    try {
      const res = await studentService.joinClassByCode(studentProfileId, classCode.trim());
      setLoading(false);
      if (res.success && res.classData) {
        setResult({ type: 'success', message: `Joined ${res.classData.class_name} successfully!` });
        onClassJoined();
        setTimeout(() => {
          setClassCode('');
          setResult({ type: 'idle', message: '' });
          onClose();
        }, 1200);
      } else {
        setResult({ type: 'error', message: res.error || 'Failed to join class.' });
      }
    } catch (err: any) {
      setLoading(false);
      setResult({ type: 'error', message: err.message || 'Error occurred.' });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlayCenter}>
        <View style={styles.joinModalBox}>
          <View style={styles.modalHeaderRow}>
            <View style={styles.modalHeaderIcon}>
              <Plus size={20} color="#9AB9EC" strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.modalTitle}>Join a Class</Text>
              <Text style={styles.modalSubtitle}>Enter the code from your instructor</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <X size={18} color="#8EA5C2" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <Text style={styles.joinInputLabel}>CLASS CODE</Text>
          <TextInput
            style={styles.joinInput}
            placeholder="e.g. CS201-DS"
            placeholderTextColor="#4C688A"
            value={classCode}
            onChangeText={(text) => {
              setClassCode(text.toUpperCase());
              setResult({ type: 'idle', message: '' });
            }}
            autoCapitalize="characters"
          />

          {result.type !== 'idle' && (
            <View style={[styles.resultBanner, result.type === 'success' ? styles.resultSuccess : styles.resultError]}>
              {result.type === 'success' ? (
                <CheckCircle2 size={16} color="#4ECCA3" strokeWidth={2.4} style={{ marginRight: 6 }} />
              ) : (
                <AlertCircle size={16} color="#FC8181" strokeWidth={2.4} style={{ marginRight: 6 }} />
              )}
              <Text style={styles.resultBannerText}>{result.message}</Text>
            </View>
          )}

          <View style={styles.modalActionButtons}>
            <TouchableOpacity onPress={onClose} style={styles.modalCancelBtn}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleJoin} style={styles.modalConfirmBtn} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color="#061522" /> : <Text style={styles.modalConfirmText}>Join Class</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const ClassDetailsModal: React.FC<{
  visible: boolean;
  classItem: ClassScheduleItem | null;
  studentProfileId: string;
  onClose: () => void;
  onClassUpdated: () => void;
}> = ({ visible, classItem, studentProfileId, onClose, onClassUpdated }) => {
  const [loading, setLoading] = useState(false);
  if (!classItem) return null;

  const handleLeave = () => {
    Alert.alert('Withdraw from Class?', `Are you sure you want to leave ${classItem.subject}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave Class',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const res = await studentService.leaveClass(studentProfileId, classItem.id, classItem.enrollmentId);
          setLoading(false);
          if (res.success) {
            onClassUpdated();
            onClose();
          } else {
            Alert.alert('Error', res.error || 'Could not leave class.');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlayBottom}>
        <View style={styles.detailsSheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetBadge}>
              <Text style={styles.sheetBadgeText}>{classItem.courseCode} • {classItem.classType}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <X size={18} color="#8EA5C2" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <Text style={styles.detailsTitle}>{classItem.subject}</Text>

          <View style={styles.detailsBox}>
            <View style={styles.detailItem}>
              <User size={16} color="#9AB9EC" style={{ marginRight: 10 }} />
              <View>
                <Text style={styles.detailLabel}>Instructor</Text>
                <Text style={styles.detailVal}>{classItem.teacherName || 'Faculty Assigned'}</Text>
              </View>
            </View>
            <View style={styles.detailItem}>
              <Clock size={16} color="#9AB9EC" style={{ marginRight: 10 }} />
              <View>
                <Text style={styles.detailLabel}>Schedule</Text>
                <Text style={styles.detailVal}>{classItem.timeSlot}</Text>
              </View>
            </View>
            <View style={styles.detailItem}>
              <MapPin size={16} color="#9AB9EC" style={{ marginRight: 10 }} />
              <View>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailVal}>{classItem.room}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#FC8181" /> : (
              <>
                <Trash2 size={16} color="#FC8181" style={{ marginRight: 6 }} />
                <Text style={styles.leaveBtnText}>Withdraw from Class</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const QRScannerModal: React.FC<{
  visible: boolean;
  studentProfileId: string;
  profileAvatarUri?: string;
  onClose: () => void;
  onClassEnrolled: () => void;
}> = ({ visible, studentProfileId, profileAvatarUri, onClose, onClassEnrolled }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [detectedClass, setDetectedClass] = useState<DatabaseClass | null>(null);
  const [detectedAttendance, setDetectedAttendance] = useState<{ token: string; courseCode?: string; scanTicket:string; expiresAt:number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [submittingAttendance, setSubmittingAttendance] = useState(false);
  const [attendanceSuccess, setAttendanceSuccess] = useState(false);
  const [selfieVisible, setSelfieVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setDetectedClass(null);
      setDetectedAttendance(null);
      setNotice(null);
      setErrorMsg(null);
      setAttendanceSuccess(false);
      setSelfieVisible(false);
      void warmGrantedLocation().catch(()=>{});
    }
  }, [visible]);

  const handleScan = async (data: string) => {
    if (scanned || enrolling || submittingAttendance) return;
    setScanned(true);
    setNotice(null);
    setErrorMsg(null);
    const res = await studentService.validateQRPayload(data);
    if (res.type === 'class_invite' && res.classData) {
      setDetectedClass(res.classData);
      setDetectedAttendance(null);
    } else if (res.type === 'attendance_session' && res.attendanceToken) {
      try {
        const location=await getAttendanceLocation();
        const scan = await studentApi.validateAttendanceScan(res.attendanceToken,location);
        setDetectedAttendance({ token: res.attendanceToken, courseCode: res.courseCode, ...scan });
        setSelfieVisible(true); setDetectedClass(null); setNotice('QR verified. Take your selfie within three minutes.');
      } catch (error) { setErrorMsg(error instanceof Error ? error.message : 'Could not validate this QR.'); }
    } else {
      setErrorMsg(res.message || 'Invalid QR code.');
    }
  };

  const confirmJoin = async () => {
    if (!detectedClass) return;
    setEnrolling(true);
    const res = await studentService.joinClassByCode(studentProfileId, detectedClass.enrollment_code);
    setEnrolling(false);
    if (res.success) {
      Alert.alert('Enrolled!', `You joined ${detectedClass.class_name}.`);
      onClassEnrolled();
      onClose();
    } else {
      Alert.alert('Notice', res.error || 'Failed to enroll.');
    }
  };

  const submitAttendanceSelfie = async (photoUri: string) => {
    if (!detectedAttendance) throw new Error('Scan the attendance QR again before sending your selfie.');
    if (Date.now() >= detectedAttendance.expiresAt) throw new Error('Check-in expired. Close the camera and scan the latest QR again.');
    setSubmittingAttendance(true);
    try {
      const receipt = await uploadCloudinaryImage(photoUri, 'attendance_verification');
      const location=await getAttendanceLocation(true);
      await submitAttendanceApi({ qrToken: detectedAttendance.token, verificationPhotoUrl: receipt.url, verificationPhotoSignature: receipt.signature, scanTicket:detectedAttendance.scanTicket,location });
      setAttendanceSuccess(true);
    } finally { setSubmittingAttendance(false); }
  };

  if (!visible) return null;
  if (selfieVisible && detectedAttendance) {
    return <SelfieCheckInModal courseCode={detectedAttendance.courseCode} profileAvatarUri={profileAvatarUri} onClose={() => setSelfieVisible(false)} onSubmit={submitAttendanceSelfie} onComplete={() => { onClassEnrolled(); onClose(); }} />;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlayBottom}>
        <View style={styles.detailsSheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.modalTitle}>Scan QR Code</Text>
              <Text style={styles.modalSubtitle}>Scan class invitation or attendance session QR</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <X size={18} color="#8EA5C2" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <Text style={{ color: '#91a5bf', fontSize: 11, lineHeight: 17, marginBottom: 12 }}>Attendance saves your location when you scan and send your selfie. Your teacher can review it with your check-in.</Text>
          {!permission?.granted ? (
            <View style={styles.cameraPlaceholderBox}>
              <Camera size={38} color="#9AB9EC" style={{ marginBottom: 10 }} />
              <Text style={styles.permissionTitle}>Camera Permission Required</Text>
              <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
                <Text style={styles.permButtonText}>Grant Access</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraViewWrap}>
              <CameraView
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={({ data }) => handleScan(data)}
              />
              <View style={styles.scanTargetBox} />
            </View>
          )}

          {detectedClass && (
            <View style={styles.detectedClassCard}>
              <Text style={styles.detectedClassTitle}>Class Invitation Found</Text>
              <Text style={styles.detectedClassName}>{detectedClass.class_name} ({detectedClass.course_code})</Text>
              <TouchableOpacity style={styles.confirmJoinBtn} onPress={confirmJoin} disabled={enrolling}>
                {enrolling ? <ActivityIndicator size="small" color="#061522" /> : <Text style={styles.confirmJoinText}>Confirm & Enroll</Text>}
              </TouchableOpacity>
            </View>
          )}

          {detectedAttendance && (
            <View style={styles.detectedClassCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <CheckCircle2 size={18} color="#4ADE80" style={{ marginRight: 6 }} />
                <Text style={styles.detectedClassTitle}>Live Attendance Session Found</Text>
              </View>
              <Text style={styles.detectedClassName}>
                {detectedAttendance.courseCode ? `Course: ${detectedAttendance.courseCode}` : 'Live Attendance Session'}
              </Text>
              <Text style={{ color: '#8EA5C2', fontSize: 11, marginBottom: 12 }}>
                Take a fresh selfie for your faculty to compare with your profile photo.
              </Text>
              <TouchableOpacity
                style={[styles.confirmJoinBtn, { backgroundColor: '#4ADE80' }]}
                onPress={() => setSelfieVisible(true)}
                disabled={submittingAttendance || attendanceSuccess}
              >
                {submittingAttendance ? (
                  <ActivityIndicator size="small" color="#061522" />
                ) : attendanceSuccess ? (
                  <Text style={styles.confirmJoinText}>✓ Submitted (Awaiting Verification)</Text>
                ) : (
                  <Text style={styles.confirmJoinText}>Take attendance selfie</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {notice && !detectedAttendance && (
            <View style={styles.noticeBox}>
              <Info size={16} color="#9AB9EC" style={{ marginRight: 6 }} />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          )}

          {errorMsg && (
            <View style={styles.errorBox}>
              <AlertTriangle size={16} color="#FC8181" style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// 6. MAIN SCREENS
// ============================================================================

/** Quiet entrance: children fade in and rise once on mount. */
const FadeSlide: React.FC<{ delay?: number; children: React.ReactNode; style?: any }> = ({ delay = 0, children, style }) => {
  const [progress] = React.useState(() => new Animated.Value(0));
  React.useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 460, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [progress, delay]);
  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
};

// A. ONBOARDING SCREEN
export const OnboardingScreen: React.FC<{ onGetStarted: () => void }> = ({ onGetStarted }) => <WelcomeScreen onContinue={onGetStarted}/>;

// B. LOGIN SCREEN
export const LoginScreen: React.FC<{ onBack?: () => void; onLoginSuccess: () => void; onNavigateRegister: () => void; initialError?: string; onClearError?: () => void }> = ({
  onBack,
  onLoginSuccess,
  onNavigateRegister,
  initialError,
  onClearError,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const visibleError = errorMessage || initialError;

  const handleLogin = async () => {
    setErrorMessage(null);
    onClearError?.();
    if (!identifier.trim() || !password.trim()) {
      setErrorMessage('Please enter your email address and password.');
      return;
    }
    if (!identifier.trim().includes('@')) {
      setErrorMessage('Sign in with the email address registered to your Supabase account.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setErrorMessage('Supabase is not configured. Add the project URL and publishable key before signing in.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: identifier.trim(),
        password,
      });
      if (error) {
        setErrorMessage(authErrorMessage(error));
        return;
      }
      if (!data.session) {
        setErrorMessage('Supabase did not create an authenticated session. Confirm your email and try again.');
        return;
      }
      onLoginSuccess();
    } catch (err) {
      setErrorMessage(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    onClearError?.();
    if (!isSupabaseConfigured()) {
      Alert.alert('Supabase Not Configured', 'Add the Supabase project URL and publishable key before signing in.');
      return;
    }

    try {
      setGoogleLoading(true);
      const redirectTo = makeRedirectUri({
        scheme: 'classattendance',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        setGoogleLoading(false);
        setErrorMessage(authErrorMessage(error));
        return;
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === 'success' && result.url) {
          const callbackError = new URLSearchParams(result.url.split('#')[1] || result.url.split('?')[1] || '').get('error_description');
          if (callbackError) throw new Error(callbackError);
          const parsed = Linking.parse(result.url);
          const params = (parsed.queryParams || {}) as Record<string, any>;
          let accessToken = params.access_token as string | undefined;
          let refreshToken = params.refresh_token as string | undefined;

          // If tokens are returned in the hash fragment (#access_token=...):
          if (!accessToken && result.url.includes('#')) {
            const hash = result.url.split('#')[1];
            const hashParts = new URLSearchParams(hash);
            accessToken = hashParts.get('access_token') || undefined;
            refreshToken = hashParts.get('refresh_token') || undefined;
          }

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
            setGoogleLoading(false);
            onLoginSuccess();
            return;
          }
          throw new Error('Google did not return an authenticated session. Please try again.');
        }
      }
      setGoogleLoading(false);
    } catch (err: any) {
      setGoogleLoading(false);
      setErrorMessage(authErrorMessage(err));
    }
  };

  return (
    <AppBackground variant="login">
      <ScrollView contentContainerStyle={styles.screenPadding}>
        {onBack && <TouchableOpacity onPress={onBack} style={styles.backArrow}>
          <ArrowLeft size={24} color="#9AB9EC" strokeWidth={2.2} />
        </TouchableOpacity>}
        <Text style={styles.authTitle}>Welcome Back</Text>
        <Text style={styles.authSubtitle}>Login to your student account</Text>

        <View style={styles.formSection}>
          {!!visibleError && (
            <View style={styles.errorBanner}>
              <AlertCircle size={16} color="#F87171" style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={styles.errorBannerText}>{visibleError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.googleAuthBtn}
            onPress={handleGoogleLogin}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color="#9AB9EC" />
            ) : (
              <>
                <Svg width={18} height={18} viewBox="0 0 24 24" style={{ marginRight: 10 }}>
                  <Path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.665-5.17 3.665-9.09z" />
                  <Path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.09C3.27 21.48 7.34 24 12 24z" />
                  <Path fill="#FBBC05" d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.59H1.26C.46 8.18 0 9.99 0 12s.46 3.82 1.26 5.41l4.02-3.09z" />
                  <Path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.52 1.26 6.59l4.02 3.09c.95-2.83 3.6-4.93 6.72-4.93z" />
                </Svg>
                <Text style={styles.googleAuthText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR SIGN IN WITH PASSWORD</Text>
            <View style={styles.dividerLine} />
          </View>

          <AuthInput
            label="Email Address"
            placeholder="student@univ.edu"
            value={identifier}
            onChangeText={setIdentifier}
            keyboardType="email-address"
            autoCapitalize="none"
            icon={<User size={20} color="#9AB9EC" />}
          />
          <AuthInput
            label="Password"
            placeholder="Enter password"
            value={password}
            onChangeText={setPassword}
            isPassword
            icon={<Lock size={20} color="#9AB9EC" />}
          />
          <TouchableOpacity style={styles.primaryActionBtn} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#061522" /> : <Text style={styles.primaryActionText}>Login</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.authFooter}>
          <Text style={styles.authFooterMuted}>Don't have an account? </Text>
          <TouchableOpacity onPress={onNavigateRegister}>
            <Text style={styles.authFooterHighlight}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppBackground>
  );
};

// C. REGISTER SCREEN
export const RegisterScreen: React.FC<{ onBack: () => void; onRegistered: (email: string) => void }> = ({
  onBack,
  onRegistered,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [message, setMessage] = useState('');
  const showMessage = (_title: string, text: string) => setMessage(text);

  const handleRegister = async () => {
    setMessage('');
    if (!email.trim() || !password.trim()) {
      showMessage('Required', 'Please enter your email and password.');
      return;
    }
    if (password.length < 6) {
      showMessage('Password Length', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      showMessage('Mismatch', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    if (isSupabaseConfigured()) {
      try {
        const result = await registerStudent(email, password);
        if (result.status === 'verified') {
          onRegistered(result.email);
        } else if (result.status === 'existing_account') {
          showMessage('Account Already Registered', 'An account already exists. Sign in with its password, or select Verify existing email if it is still unconfirmed.');
        } else {
          setPendingEmail(result.email);
          setPassword('');
          setConfirmPassword('');
        }
        setLoading(false);
      } catch (err: any) {
        setLoading(false);
        showMessage('Error', authErrorMessage(err));
      }
    } else {
      setLoading(false);
      showMessage('Supabase Not Configured', 'Add the Supabase project URL and publishable key before creating an account.');
    }
  };

  return (
    <AppBackground variant="login">
      <ScrollView contentContainerStyle={styles.screenPadding}>
        <TouchableOpacity onPress={onBack} style={styles.backArrow}>
          <ArrowLeft size={24} color="#9AB9EC" strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.authTitle}>{pendingEmail ? 'Verify Your Email' : 'Create Account'}</Text>
        <Text style={styles.authSubtitle}>{pendingEmail ? 'Confirm your student account' : 'Enter your institutional email & password'}</Text>

        <View style={styles.formSection}>
          {!!message && <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{message}</Text></View>}
          {pendingEmail ? (
            <EmailVerificationForm
              key={pendingEmail}
              email={pendingEmail}
              onVerified={() => onRegistered(pendingEmail)}
              onChangeEmail={() => { setPendingEmail(''); setMessage(''); }}
            />
          ) : (
          <>
          <AuthInput
            label="Email Address"
            placeholder="student@univ.edu"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            icon={<Mail size={20} color="#9AB9EC" />}
          />
          <AuthInput
            label="Password"
            placeholder="Min 6 characters"
            value={password}
            onChangeText={setPassword}
            isPassword
            icon={<Lock size={20} color="#9AB9EC" />}
          />
          <AuthInput
            label="Confirm Password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
            icon={<Lock size={20} color="#9AB9EC" />}
          />
          <TouchableOpacity style={styles.primaryActionBtn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#061522" /> : <Text style={styles.primaryActionText}>Create Account</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            disabled={loading}
            onPress={() => {
              if (!email.trim().includes('@')) { setMessage('Enter your registered email address first.'); return; }
              setMessage('');
              setPassword('');
              setConfirmPassword('');
              setPendingEmail(email.trim());
            }}
            style={{ paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#9AB9EC', fontWeight: '600' }}>Verify existing email</Text>
          </TouchableOpacity>
          </>
          )}

        </View>

        <View style={styles.authFooter}>
          <Text style={styles.authFooterMuted}>Already have an account? </Text>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.authFooterHighlight}>Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppBackground>
  );
};

// D. PROFILE SETUP SCREEN (STEP-BY-STEP QUESTIONNAIRE - NEXT BUTTON 100% FIXED)
export const ProfileSetupScreen: React.FC<{ initialEmail?: string; onComplete: () => void; onChangeAccount?: () => void }> = ({
  initialEmail,
  onComplete,
  onChangeAccount,
}) => {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [usn, setUsn] = useState('');
  const [classRollNumber,setClassRollNumber]=useState(''),[section,setSection]=useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [semester, setSemester] = useState('3rd');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [setupError, setSetupError] = useState('');

  const departments = [
    'Computer Science',
    'Information Science',
    'Electronics & Comm.',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Artificial Intelligence',
    'Data Science',
  ];

  const semesters = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

  // NEXT BUTTON HANDLER (SYNCHRONOUS & RELIABLE - NEVER DROPS CLICKS)
  const goNext = () => {
    if (saving) return;
    setSetupError('');

    const error=profileStepError(step,{fullName,usn,classRollNumber,section});
    if(error){setSetupError(error);return;}

    if (step < PROFILE_SETUP_STEPS) {
      setStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const goBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  };

  const handlePickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission', 'Photo library access needed.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setPhotoUri(res.assets[0].uri);
      }
    } catch {}
  };

  const handleFinish = async () => {
    for(const question of [2,3,4,5]){const error=profileStepError(question,{fullName,usn,classRollNumber,section});if(error){setStep(question);setSetupError(error);return;}}
    setSetupError('');
    setSaving(true);
    try {
      const avatarUrl = photoUri ? await uploadImageToCloudinary(photoUri) : '';
      const result = await studentService.saveProfile({
        fullName: fullName.trim(),
        rollNumber: usn.trim().toUpperCase(),
        classRollNumber,section,
        department: department.trim(),
        semester: `${semester} Semester`,
        avatarUrl,
      });
      if (!result.success) {
        setSetupError(result.error || 'Your profile could not be saved.');
        return;
      }
      if (Platform.OS === 'web') {
        onComplete();
      } else {
        Alert.alert('Profile Complete! 🎉', 'Your campus dashboard is configured.', [
          { text: 'Open Dashboard', onPress: onComplete },
        ]);
      }
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Your profile could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppBackground variant="dashboard">
      <View style={styles.setupContainer}>
        {/* Progress Bar */}
        <View style={styles.setupProgressRow}>
          <View style={styles.setupProgressTrack}>
            <View style={[styles.setupProgressFill, { width: `${(step / PROFILE_SETUP_STEPS) * 100}%` }]} />
          </View>
          <Text style={styles.setupProgressText}>{step} / {PROFILE_SETUP_STEPS}</Text>
        </View>

        {/* Step Header */}
        <View style={styles.setupHeaderBox}>
          <View style={styles.setupIconBox}>
            {step === 1 && <ImagePlus size={26} color="#9AB9EC" />}
            {step === 2 && <User size={26} color="#9AB9EC" />}
            {step === 3 && <GraduationCap size={26} color="#9AB9EC" />}
            {step === 4 && <User size={26} color="#9AB9EC" />}
            {step === 5 && <BookOpen size={26} color="#9AB9EC" />}
            {step === 6 && <BookOpen size={26} color="#9AB9EC" />}
            {step === 7 && <Calendar size={26} color="#9AB9EC" />}
          </View>
          <Text style={styles.setupTitle}>
            {step === 1 && 'Add a profile photo'}
            {step === 2 && "What's your full name?"}
            {step === 3 && 'Your university USN'}
            {step === 4 && 'Your class roll number'}
            {step === 5 && 'Which section are you in?'}
            {step === 6 && 'Which department?'}
            {step === 7 && 'Current semester'}
          </Text>
          <Text style={styles.setupSub}>
            {step === 1 && 'Appears on student ID & attendance records'}
            {step === 2 && 'As registered with university admissions'}
            {step === 3 && 'Your unique university student identifier'}
            {step === 4 && 'Your number on the class attendance register'}
            {step === 5 && 'Use the section assigned by your department, for example A or B'}
            {step === 6 && 'Select your branch of study'}
            {step === 7 && 'Select your active academic term'}
          </Text>
        </View>

        {!!initialEmail && <Text style={{ color: '#8EA5C2', fontSize: 12, marginBottom: 10 }}>Signed in as {initialEmail}</Text>}
        {onChangeAccount && <TouchableOpacity disabled={saving} onPress={onChangeAccount} style={{ paddingVertical: 8, marginBottom: 8 }}><Text style={{ color: '#9AB9EC', fontSize: 13 }}>Use another account</Text></TouchableOpacity>}
        {!!setupError && <View style={styles.errorBanner}><Text accessibilityRole="alert" style={styles.errorBannerText}>{setupError}</Text></View>}
        {/* Step Content */}
        <View style={styles.setupContent}>
          {step === 1 && (
            <View style={styles.photoCenterBox}>
              <TouchableOpacity style={styles.photoCircleWrap} onPress={handlePickPhoto}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoImg} />
                ) : (
                  <View style={styles.photoPlace}>
                    <Camera size={34} color="#5A7B9E" />
                    <Text style={styles.photoPlaceText}>Tap to choose</Text>
                  </View>
                )}
                <View style={styles.cameraIconBadge}>
                  <Camera size={13} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={styles.underlineGroup}>
              <Text style={styles.underlineLabel}>FULL NAME</Text>
              <TextInput
                style={styles.underlineInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. Aryan Sharma"
                placeholderTextColor="#3E5E7E"
                autoFocus
                returnKeyType="next"
                onSubmitEditing={goNext}
              />
              <View style={[styles.underlineBar, fullName.length > 0 && styles.underlineActive]} />
            </View>
          )}

          {step === 3 && (
            <View style={styles.underlineGroup}>
              <Text style={styles.underlineLabel}>UNIVERSITY USN</Text>
              <TextInput
                style={[styles.underlineInput, { letterSpacing: 1.5, color: '#B4CBF5' }]}
                value={usn}
                onChangeText={setUsn}
                placeholder="e.g. CS24123"
                placeholderTextColor="#3E5E7E"
                autoFocus
                autoCapitalize="characters"
                returnKeyType="next"
                onSubmitEditing={goNext}
              />
              <View style={[styles.underlineBar, usn.length > 0 && styles.underlineActive]} />

            </View>
          )}

          {step === 4 && <View style={styles.underlineGroup}><Text style={styles.underlineLabel}>CLASS ROLL NUMBER</Text><TextInput accessibilityLabel="Class roll number" style={styles.underlineInput} value={classRollNumber} onChangeText={setClassRollNumber} maxLength={20} placeholder="e.g. 12" placeholderTextColor="#3E5E7E" autoFocus returnKeyType="next" onSubmitEditing={goNext}/><View style={[styles.underlineBar,!!classRollNumber.trim() && styles.underlineActive]}/></View>}
          {step === 5 && <View style={styles.underlineGroup}><Text style={styles.underlineLabel}>SECTION</Text><TextInput accessibilityLabel="Section" style={styles.underlineInput} value={section} onChangeText={setSection} maxLength={30} autoCapitalize="characters" placeholder="e.g. A" placeholderTextColor="#3E5E7E" autoFocus returnKeyType="next" onSubmitEditing={goNext}/><View style={[styles.underlineBar,!!section.trim() && styles.underlineActive]}/></View>}

          {step === 6 && (
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {departments.map((dept) => {
                const selected = department === dept;
                return (
                  <TouchableOpacity
                    key={dept}
                    style={[styles.deptCard, selected && styles.deptCardActive]}
                    onPress={() => setDepartment(dept)}
                  >
                    <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
                      {selected && <View style={styles.radioInner} />}
                    </View>
                    <Text style={[styles.deptText, selected && styles.textWhite]}>{dept}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {step === 7 && (
            <View style={styles.semesterGridWrap}>
              {semesters.map((sem) => {
                const selected = semester === sem;
                return (
                  <TouchableOpacity
                    key={sem}
                    style={[styles.semTile, selected && styles.semTileActive]}
                    onPress={() => setSemester(sem)}
                  >
                    <Text style={[styles.semNumber, selected && styles.textWhite]}>{sem}</Text>
                    <Text style={[styles.semSub, selected && { color: '#9AB9EC' }]}>Sem</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Bottom Nav Bar */}
        <View style={styles.setupBottomNav}>
          {step > 1 ? (
            <TouchableOpacity style={styles.setupBackBtn} onPress={goBack}>
              <ArrowLeft size={16} color="#8EA5C2" style={{ marginRight: 4 }} />
              <Text style={styles.setupBackText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 70 }} />
          )}

          {step === 1 && (
            <TouchableOpacity onPress={goNext} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip for now</Text>
              <SkipForward size={14} color="#7F94B0" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}

          {/* NEXT / COMPLETE BUTTON: ALWAYS RESPONSIVE */}
          <TouchableOpacity
            style={[styles.setupNextBtn, step === 7 && styles.setupFinishBtn]}
            onPress={goNext}
            activeOpacity={0.8}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#061522" />
            ) : (
              <>
                <Text style={[styles.setupNextText, step === 7 && styles.setupFinishText]}>
                  {step === 7 ? 'Complete Setup' : 'Next'}
                </Text>
                <ArrowRight size={16} color={step === 7 ? '#061522' : '#FFFFFF'} style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </AppBackground>
  );
};

// E. HOME SCREEN (STUDENT DASHBOARD)
export const HomeScreen: React.FC<{ onLogout: () => void; onNavigateTab: (tab: TabName) => void }> = ({
  onLogout,
  onNavigateTab,
}) => {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [classes, setClasses] = useState<ClassScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassScheduleItem | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);

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
      setStudent(null);
      setClasses([]);
      setLoadError(err instanceof Error ? err.message : 'Unable to load your class dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Profile and class list rarely change; foreground (AppState) refresh keeps
    // them fresh on phone unlock, so a slow tick is enough for a classroom.
    const timer=setInterval(()=>{if(AppState.currentState==='active')void loadData();},120000);
    const listener=AppState.addEventListener('change',state=>{if(state==='active')void loadData();});
    return()=>{clearInterval(timer);listener.remove();};
  }, [loadData]);

  if (!student) {
    return (
      <AppBackground variant="dashboard">
        <View style={styles.screenPadding}>
          {loading ? (
            // Profile-card and class-row placeholders while the session restores.
            <View style={{ gap: 18, marginTop: 12 }} accessible={false} importantForAccessibility="no-hide-descendants">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <SkeletonBlock width={56} height={56} radius={28} />
                <View style={{ flex: 1, gap: 8 }}>
                  <SkeletonBlock width="55%" height={15} />
                  <SkeletonBlock width="35%" height={11} />
                </View>
              </View>
              <SkeletonBlock width="100%" height={150} radius={22} />
              {[0, 1, 2].map(i => <SkeletonBlock key={i} width="100%" height={74} radius={18} />)}
            </View>
          ) : (
            <View style={styles.centerContainer}>
              <Text style={{ color: Colors.textSecondary, textAlign: 'center', margin: 20 }}>
                {loadError}
              </Text>
              <TouchableOpacity style={styles.emptyJoinAction} onPress={onLogout}>
                <Text style={styles.emptyJoinText}>Return to Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </AppBackground>
    );
  }

  const activeStudent = student;
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <AppBackground variant="dashboard">
      <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <FadeSlide delay={0}>
          <View style={styles.dashHeaderRow}>
            <View>
              <Text style={styles.dashGreeting}>Hello,</Text>
              <View style={styles.dashNameRow}>
                <Text style={styles.dashName}>{activeStudent.firstName}</Text>
                <View style={styles.dashNameDot} />
              </View>
              <Text style={styles.dashSubtitle}>{dateLine} · Let's make it count</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.headerRoundBtn} accessibilityRole="button" accessibilityLabel="Scan QR code" onPress={() => setQrModalVisible(true)}>
                <QrCode size={19} color="#9AB9EC" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerRoundBtn} accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => Alert.alert('Notifications', 'No new announcements.')}>
                <Bell size={18} color="#D5E2F7" />
              </TouchableOpacity>
            </View>
          </View>
        </FadeSlide>

        {/* Profile Card */}
        <FadeSlide delay={80}>
          <StudentProfileCard
            student={activeStudent}
            enrolledClassesCount={classes.length}
            onPressScanQR={() => setQrModalVisible(true)}
            onPressProfile={() => onNavigateTab('profile')}
            onEditAvatar={() => onNavigateTab('profile')}
          />
        </FadeSlide>

        {/* Classes Section Header */}
        <FadeSlide delay={150}>
          <View style={styles.classesHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionHeaderTitle}>Enrolled Classes</Text>
              <View style={styles.sectionCountChip}><Text style={styles.sectionCountText}>{classes.length}</Text></View>
            </View>
            <TouchableOpacity style={styles.joinBtnAction} onPress={() => setJoinModalVisible(true)}>
              <Plus size={15} color="#061522" strokeWidth={3} style={{ marginRight: 4 }} />
              <Text style={styles.joinBtnText}>Join Class</Text>
            </TouchableOpacity>
          </View>
        </FadeSlide>

        {/* Classes List */}
        <FadeSlide delay={210}>
        {loading ? (
          <View style={{ gap: 12 }} accessible={false} importantForAccessibility="no-hide-descendants">
            {[0, 1, 2].map(i => <ClassCardSkeleton key={i} />)}
          </View>
        ) : classes.length === 0 ? (
          <View style={styles.emptyCard}>
            <BookOpen size={36} color="#9AB9EC" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No Classes Joined</Text>
            <Text style={styles.emptyDesc}>Enter a teacher class code to join your courses.</Text>
            <TouchableOpacity style={styles.emptyJoinAction} onPress={() => setJoinModalVisible(true)}>
              <Plus size={16} color="#061522" style={{ marginRight: 6 }} />
              <Text style={styles.emptyJoinText}>Join Your First Class</Text>
            </TouchableOpacity>
            <Text style={styles.testCodesNote}>Use an active class enrollment code provided by your instructor.</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {classes.map((cls) => (
              <ClassCard
                key={cls.id}
                item={cls}
                onPressCard={() => router.push(`/classes/${cls.id}`)}
                onPressAction={() => {
                  setSelectedClass(cls);
                  setDetailsModalVisible(true);
                }}
              />
            ))}
          </View>
        )}
        </FadeSlide>

        <View style={{ height: 90 }} />
      </ScrollView>

      <JoinClassModal
        visible={joinModalVisible}
        studentProfileId={activeStudent.id}
        onClose={() => setJoinModalVisible(false)}
        onClassJoined={loadData}
      />

      <ClassDetailsModal
        visible={detailsModalVisible}
        classItem={selectedClass}
        studentProfileId={activeStudent.id}
        onClose={() => {
          setDetailsModalVisible(false);
          setSelectedClass(null);
        }}
        onClassUpdated={loadData}
      />

      <QRScannerModal
        visible={qrModalVisible}
        studentProfileId={activeStudent.id}
        profileAvatarUri={optimizedAvatarUrl(activeStudent.avatarUrl)}
        onClose={() => setQrModalVisible(false)}
        onClassEnrolled={loadData}
      />
    </AppBackground>
  );
};

// F. MY CLASSES SCREEN
export const MyClassesScreen: React.FC = () => <AppBackground variant="dashboard"><StudentClassesView/></AppBackground>;

// G. ATTENDANCE SCREEN
export const AttendanceScreen: React.FC = () => {
  return <AppBackground variant="dashboard"><StudentAttendanceView/></AppBackground>;
};

// H. PROFILE SCREEN
export const ProfileScreen: React.FC<{ onLogout: () => void; onNavigateTab:(tab:TabName)=>void }> = ({ onLogout, onNavigateTab }) => {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingsSection,setSettingsSection]=useState<SettingsSection|null>(null);

  // Editable fields
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRoll, setEditRoll] = useState('');
  const [editClassRoll,setEditClassRoll]=useState(''),[editSection,setEditSection]=useState('');
  const [editDept, setEditDept] = useState('');
  const [editSem, setEditSem] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    studentService.getProfile().then((p) => {
      setStudent(p);
      if (p) {
        setEditName(p.name || '');
        setEditRoll(p.rollNumber || '');
        setEditClassRoll(p.classRollNumber || '');setEditSection(p.section || '');
        setEditDept(p.degree || '');
        setEditSem(p.semester || '');
      }
      setLoading(false);
    }).catch(error=>{setFeedback({type:'error',message:error instanceof Error?error.message:'Could not load profile.'});setLoading(false);});
  }, []);

  const handleUpdatePhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setFeedback({ type: 'error', message: 'Gallery permission is required to update photo.' });
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const localUri = res.assets[0].uri;
        setUpdatingPhoto(true);
        const secureUrl = await uploadImageToCloudinary(localUri);
        if (student) {
          const saved = await studentService.saveProfile({
            fullName: student.name,
            rollNumber: student.rollNumber,
            department: student.degree,
            semester: student.semester,
            avatarUrl: secureUrl,
          });
          if (!saved.success) throw new Error(saved.error || 'Could not save the photo to your profile.');
          const updated = await studentService.getProfile();
          setStudent(updated);
        }
        setUpdatingPhoto(false);
        setFeedback({ type: 'success', message: 'Profile photo updated.' });
      }
    } catch (err: any) {
      setUpdatingPhoto(false);
      setFeedback({ type: 'error', message: err.message || 'Could not update photo.' });
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setFeedback({ type: 'error', message: 'Name cannot be empty.' });
      return;
    }
    if (!editRoll.trim()) {
      setFeedback({ type: 'error', message: 'Roll number cannot be empty.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const result = await studentService.saveProfile({
        fullName: editName.trim(),
        rollNumber: editRoll.trim(),
        classRollNumber:editClassRoll,section:editSection,
        department: editDept.trim() || 'Computer Science',
        semester: editSem.trim() || '3rd',
        avatarUrl: student?.avatarUrl,
      });
      if (result.success && result.profile) {
        setStudent(result.profile);
        setEditName(result.profile.name);
        setEditRoll(result.profile.rollNumber);
        setEditClassRoll(result.profile.classRollNumber || '');setEditSection(result.profile.section || '');
        setEditDept(result.profile.degree);
        setEditSem(result.profile.semester);
        setFeedback({ type: 'success', message: 'Profile saved successfully!' });
        setEditMode(false);
      } else {
        setFeedback({ type: 'error', message: result.error || 'Failed to save profile.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error saving profile.' });
    }
    setSaving(false);
  };

  const handleCancelEdit = () => {
    if (student) {
      setEditName(student.name || '');
      setEditRoll(student.rollNumber || '');
      setEditClassRoll(student.classRollNumber || '');setEditSection(student.section || '');
      setEditDept(student.degree || '');
      setEditSem(student.semester || '');
    }
    setEditMode(false);
    setFeedback(null);
  };

  const profile = student;

  if (loading) {
    return (
      <AppBackground variant="dashboard">
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#9AB9EC" />
        </View>
      </AppBackground>
    );
  }

  if (!profile) return <AppBackground variant="dashboard"><View style={styles.screenPadding}><Text style={styles.screenHeading}>Profile unavailable</Text><Text style={styles.errorText}>{feedback?.message || 'Sign in again to restore your student profile.'}</Text><TouchableOpacity onPress={onLogout}><Text style={{color:'#b9d1f5',marginTop:20}}>Return to sign in</Text></TouchableOpacity></View></AppBackground>;

  return (
    <AppBackground variant="dashboard">
      <ScrollView contentContainerStyle={styles.screenPadding} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.screenHeading}>Student Profile</Text>
          {!editMode && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#12283D', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: '#1D3B5C' }}
              onPress={() => { setEditMode(true); setFeedback(null); }}
            >
              <Pencil size={13} color="#9AB9EC" style={{ marginRight: 5 }} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#9AB9EC' }}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Feedback Banner */}
        {feedback && (
          <View style={[styles.errorBanner, feedback.type === 'success' && { backgroundColor: 'rgba(52, 211, 153, 0.15)', borderColor: 'rgba(52, 211, 153, 0.4)' }]}>
            {feedback.type === 'error'
              ? <AlertCircle size={15} color="#F87171" style={{ marginRight: 8 }} />
              : <CheckCircle2 size={15} color="#34D399" style={{ marginRight: 8 }} />
            }
            <Text style={[styles.errorBannerText, feedback.type === 'success' && { color: '#6EE7B7' }]}>{feedback.message}</Text>
          </View>
        )}

        {/* Profile Card */}
        <View style={styles.profileBoxTop}>
          <View style={styles.avatarWrapper}>
            {profile.avatarUrl && profile.avatarUrl.startsWith('http') ? (
              <Image source={{ uri: optimizedAvatarUrl(profile.avatarUrl) }} style={styles.avatarImage} />
            ) : profile.avatarUrl === 'assets/aryan.jpg' ? (
              <Image source={require('./assets/aryan.jpg')} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                <User size={38} color="#5A7B9E" />
              </View>
            )}

            <TouchableOpacity
              style={styles.cameraBadge}
              onPress={handleUpdatePhoto}
              activeOpacity={0.8}
              disabled={updatingPhoto}
            >
              {updatingPhoto ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Camera size={13} color="#FFFFFF" strokeWidth={2.4} />
              )}
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.profileNameText}>{profile.name}</Text>
            <Text style={styles.profileRollText}>{profile.rollNumber} • {profile.degree}</Text><Text style={[styles.profileRollText,{marginTop:5,fontSize:11}]}>Roll {profile.classRollNumber || '—'} · Section {profile.section || '—'}</Text>
            <View style={styles.profileBadge}>
              <Text style={styles.profileBadgeText}>{profile.semester}</Text>
            </View>
          </View>
        </View>

        {/* Edit Form or Info Display */}
        {editMode ? (
          <View style={styles.profileMenuSection}>
            <Text style={styles.profileSectionTitle}>Edit Your Information</Text>
            <View style={styles.profileMenuBox}>
              {/* Name */}
              <View style={[styles.profileMenuItem, styles.profileMenuItemBorder, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#7F94B0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Full Name</Text>
                <TextInput
                  style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '500', width: '100%', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#1D3B5C' }}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your full name"
                  placeholderTextColor="#5A6F84"
                />
              </View>
              {/* Roll Number */}
              <View style={[styles.profileMenuItem, styles.profileMenuItemBorder, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#7F94B0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>USN / Roll Number</Text>
                <TextInput
                  style={{ fontSize: 14, color: '#B4CBF5', fontWeight: '600', width: '100%', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#1D3B5C', letterSpacing: 1 }}
                  value={editRoll}
                  onChangeText={setEditRoll}
                  placeholder="e.g. CS24123"
                  placeholderTextColor="#5A6F84"
                  autoCapitalize="characters"
                />
              </View>
              <View style={[styles.profileMenuItem,styles.profileMenuItemBorder,{gap:12}]}>
                <View style={{flex:1}}><Text style={{fontSize:11,color:'#7F94B0',marginBottom:6}}>CLASS ROLL NO.</Text><TextInput accessibilityLabel="Class roll number" value={editClassRoll} onChangeText={setEditClassRoll} maxLength={20} placeholder="e.g. 12" placeholderTextColor="#5A6F84" style={{color:'#fff',fontSize:14,paddingVertical:8}}/></View>
                <View style={{flex:1}}><Text style={{fontSize:11,color:'#7F94B0',marginBottom:6}}>SECTION</Text><TextInput accessibilityLabel="Section" value={editSection} onChangeText={setEditSection} maxLength={30} autoCapitalize="characters" placeholder="e.g. A" placeholderTextColor="#5A6F84" style={{color:'#fff',fontSize:14,paddingVertical:8}}/></View>
              </View>
              {/* Department */}
              <View style={[styles.profileMenuItem, styles.profileMenuItemBorder, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#7F94B0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Department / Degree</Text>
                <TextInput
                  style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '500', width: '100%', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#1D3B5C' }}
                  value={editDept}
                  onChangeText={setEditDept}
                  placeholder="e.g. B.Tech Computer Science"
                  placeholderTextColor="#5A6F84"
                />
              </View>
              {/* Semester */}
              <View style={[styles.profileMenuItem, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#7F94B0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Semester</Text>
                <TextInput
                  style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '500', width: '100%', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#1D3B5C' }}
                  value={editSem}
                  onChangeText={setEditSem}
                  placeholder="e.g. 3rd Semester"
                  placeholderTextColor="#5A6F84"
                />
              </View>
            </View>

            {/* Save / Cancel buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: '#F3F2EF', justifyContent: 'center', alignItems: 'center' }}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#061522" />
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#061522' }}>Save Changes</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#1D3B5C', justifyContent: 'center', alignItems: 'center' }}
                onPress={handleCancelEdit}
                disabled={saving}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#8EA5C2' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Academic Profile section — no CGPA */}
            <View style={styles.profileMenuSection}>
              <Text style={styles.profileSectionTitle}>Academic Profile</Text>
              <View style={styles.profileMenuBox}>
                <TouchableOpacity accessibilityRole="button" onPress={()=>onNavigateTab('classes')} style={[styles.profileMenuItem, styles.profileMenuItemBorder]}>
                  <View style={styles.profileMenuItemLeft}>
                    <GraduationCap size={20} color="#9AB9EC" strokeWidth={2} style={{ marginRight: 14 }} />
                    <Text style={styles.profileMenuItemLabel}>Course Enrollment • {profile.semester || '3rd Sem'}</Text>
                  </View>
                  <ChevronRight size={18} color="#7F94B0" strokeWidth={2.2} />
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={()=>setEditMode(true)} style={styles.profileMenuItem}>
                  <View style={styles.profileMenuItemLeft}>
                    <BookOpen size={20} color="#9AB9EC" strokeWidth={2} style={{ marginRight: 14 }} />
                    <Text style={styles.profileMenuItemLabel}>{profile.degree || 'Department'}</Text>
                  </View>
                  <ChevronRight size={18} color="#7F94B0" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Preferences & Security */}
            <View style={styles.profileMenuSection}>
              <Text style={styles.profileSectionTitle}>Preferences & Security</Text>
              <View style={styles.profileMenuBox}>
                <TouchableOpacity accessibilityRole="button" onPress={()=>setSettingsSection('security')} style={[styles.profileMenuItem, styles.profileMenuItemBorder]} activeOpacity={0.7}>
                  <View style={styles.profileMenuItemLeft}>
                    <Shield size={20} color="#9AB9EC" strokeWidth={2} style={{ marginRight: 14 }} />
                    <Text style={styles.profileMenuItemLabel}>Account & security</Text>
                  </View>
                  <ChevronRight size={18} color="#7F94B0" strokeWidth={2.2} />
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={()=>setSettingsSection('alerts')} style={[styles.profileMenuItem, styles.profileMenuItemBorder]} activeOpacity={0.7}>
                  <View style={styles.profileMenuItemLeft}>
                    <Bell size={20} color="#9AB9EC" strokeWidth={2} style={{ marginRight: 14 }} />
                    <Text style={styles.profileMenuItemLabel}>Attendance alerts</Text>
                  </View>
                  <ChevronRight size={18} color="#7F94B0" strokeWidth={2.2} />
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={()=>setSettingsSection('storage')} style={[styles.profileMenuItem,styles.profileMenuItemBorder]} activeOpacity={0.7}><View style={styles.profileMenuItemLeft}><RefreshCw size={20} color="#9AB9EC" style={{marginRight:14}}/><Text style={styles.profileMenuItemLabel}>Storage & cache</Text></View><ChevronRight size={18} color="#7F94B0"/></TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={()=>setSettingsSection('help')} style={styles.profileMenuItem} activeOpacity={0.7}>
                  <View style={styles.profileMenuItemLeft}>
                    <HelpCircle size={20} color="#9AB9EC" strokeWidth={2} style={{ marginRight: 14 }} />
                    <Text style={styles.profileMenuItemLabel}>Help Desk & Campus Admin</Text>
                  </View>
                  <ChevronRight size={18} color="#7F94B0" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            if (Platform.OS === 'web') {
              if (window.confirm('Sign out of your account?')) onLogout();
            } else {
              Alert.alert('Sign Out', 'Sign out of your account?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: onLogout },
              ]);
            }
          }}
        >
          <LogOut size={16} color="#FC8181" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Sign Out of Account</Text>
        </TouchableOpacity>
        <View style={{ height: 90 }} />
      </ScrollView>
      {settingsSection&&<ProfileSettingsModal section={settingsSection} onClose={()=>setSettingsSection(null)}/>}
    </AppBackground>
  );
};

// I. BOTTOM NAVIGATION
export const BottomNavigation: React.FC<{ currentTab: TabName; onSelectTab: (tab: TabName) => void }> = ({
  currentTab,
  onSelectTab,
}) => {
  return (
    <View style={styles.bottomNavContainer}>
      <TouchableOpacity
        style={[styles.navTab, currentTab === 'home' && styles.navTabActive]}
        onPress={() => onSelectTab('home')}
      >
        <HomeIcon size={20} color={currentTab === 'home' ? Colors.buttonPrimaryText : Colors.navInactive} />
        <Text style={[styles.navLabel, currentTab === 'home' && styles.navLabelActive]}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navTab, currentTab === 'classes' && styles.navTabActive]}
        onPress={() => onSelectTab('classes')}
      >
        <BookOpen size={20} color={currentTab === 'classes' ? Colors.buttonPrimaryText : Colors.navInactive} />
        <Text style={[styles.navLabel, currentTab === 'classes' && styles.navLabelActive]}>Classes</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navTab, currentTab === 'attendance' && styles.navTabActive]}
        onPress={() => onSelectTab('attendance')}
      >
        <Calendar size={20} color={currentTab === 'attendance' ? Colors.buttonPrimaryText : Colors.navInactive} />
        <Text style={[styles.navLabel, currentTab === 'attendance' && styles.navLabelActive]}>Attendance</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navTab, currentTab === 'profile' && styles.navTabActive]}
        onPress={() => onSelectTab('profile')}
      >
        <User size={20} color={currentTab === 'profile' ? Colors.buttonPrimaryText : Colors.navInactive} />
        <Text style={[styles.navLabel, currentTab === 'profile' && styles.navLabelActive]}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
};

// ============================================================================
// 7. ROOT APP CONTAINER WITH DIRECT SWITCHER BAR
// ============================================================================

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('login');
  const [currentTab, setCurrentTab] = useState<TabName>('home');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState('');
  const signingOut = useRef(false);

  useEffect(() => {
    let active = true;
    let revision = 0;
    let routedUser: string | undefined;
    const restoreSession = async () => {
      const request = ++revision;
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session?.user) {
          const entry=await getUnauthenticatedEntry();
          if(active && request===revision)setCurrentScreen(entry);
          return;
        }
        await markWelcomeSeen();
        if (routedUser === session.user.id) return;
        const profile = await studentService.getProfile();
        if (!active || request !== revision) return;
        routedUser = session.user.id;
        setRegisteredEmail(session.user.email || '');
        setCurrentScreen(profile ? 'main' : 'profile_setup');
      } catch (error) {
        if (active && request === revision) {
          setCurrentScreen('login');
          setAuthError(authErrorMessage(error));
        }
      } finally {
        if (active && request === revision) setCheckingAuth(false);
      }
    };
    // Never await Supabase calls inside its auth callback (the auth lock is held).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setAuthError(signingOut.current ? '' : 'Your session has expired. Please sign in again.');
        revision++;
        routedUser = undefined;
        setRegisteredEmail('');
        setCurrentTab('home');
        setCurrentScreen('login');
        setCheckingAuth(false);
        void AsyncStorage.multiRemove(['app_student_profile', 'app_enrolled_classes', 'class_attendance_student_profile', 'class_attendance_enrolled_classes']);
        void clearStudentCache();
      } else if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        setTimeout(() => { if (active) void restoreSession(); }, 0);
      }
    });
    void restoreSession();
    return () => { active = false; revision++; subscription.unsubscribe(); };
  }, []);

  const handleLogout = async () => {
    signingOut.current = true;
    const { error } = await supabase.auth.signOut();
    signingOut.current = false;
    if (error) {
      Alert.alert('Sign-Out Error', authErrorMessage(error));
      return;
    }
    setCurrentScreen('login');
  };

  const renderActiveScreen = () => {
    if (checkingAuth) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#9AB9EC" />
        </View>
      );
    }

    switch (currentScreen) {
      case 'onboarding':
        return <OnboardingScreen onGetStarted={() => {void markWelcomeSeen();setCurrentScreen('login');}} />;
      case 'login':
        return (
          <LoginScreen
            // Successful auth is routed by the shared auth-state subscription.
            onLoginSuccess={() => {}}
            initialError={authError}
            onClearError={() => setAuthError('')}
            onNavigateRegister={() => setCurrentScreen('register')}
          />
        );
      case 'register':
        return (
          <RegisterScreen
            onBack={() => setCurrentScreen('login')}
            onRegistered={(email) => {
              setRegisteredEmail(email);
              // The auth-state subscription verifies the session and profile.
            }}
          />
        );
      case 'profile_setup':
        return (
          <ProfileSetupScreen
            initialEmail={registeredEmail}
            onChangeAccount={handleLogout}
            onComplete={() => setCurrentScreen('main')}
          />
        );
      case 'main':
        return (
          <View style={{ flex: 1 }}>
            {currentTab === 'home' && <HomeScreen onLogout={handleLogout} onNavigateTab={setCurrentTab} />}
            {currentTab === 'classes' && <MyClassesScreen />}
            {currentTab === 'attendance' && <AttendanceScreen />}
            {currentTab === 'profile' && <ProfileScreen onLogout={handleLogout} onNavigateTab={setCurrentTab} />}
            <BottomNavigation currentTab={currentTab} onSelectTab={setCurrentTab} />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.rootWrapper}>
        {/* Mobile Viewport Container */}
        <View style={styles.mobileViewport}>
          {renderActiveScreen()}
          {currentScreen==='main'&&<AttendanceDecisionNotice/>}
        </View>
      </View>
    </SafeAreaProvider>
  );
}

// ============================================================================
// 8. UNIFIED STYLESHEET
// ============================================================================
const styles = StyleSheet.create({
  rootWrapper: {
    flex: 1,
    backgroundColor: '#030A12',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Platform.OS === 'web' ? 12 : 0,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topSwitcherBar: {
    marginBottom: 8,
    backgroundColor: 'rgba(12, 27, 43, 0.95)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1D3B5C',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  switcherScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switcherLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7F94B0',
    marginRight: 4,
  },
  switcherPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#12263C',
  },
  switcherPillActive: {
    backgroundColor: Colors.buttonPrimaryBg,
  },
  switcherPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8EA5C2',
  },
  switcherPillTextActive: {
    color: Colors.buttonPrimaryText,
    fontWeight: '700',
  },
  mobileViewport: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 430 : '100%',
    height: '100%',
    maxHeight: Platform.OS === 'web' ? 880 : '100%',
    backgroundColor: Colors.background,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? {
          borderRadius: 44,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        }
      : {}),
  },
  appBgContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  appBgInner: {
    flex: 1,
  },
  screenPadding: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  backArrow: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 10,
  },
  authTitle: {
    ...Typography.headlineMedium,
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  authSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#FCA5A5',
    lineHeight: 16,
  },
  formSection: {
    gap: 16,
  },
  authInputContainer: {
    gap: 6,
  },
  authInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8EA5C2',
  },
  authInputFieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A1C2C',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1D3B5C',
    paddingHorizontal: 14,
    height: 52,
  },
  authInputIcon: {
    marginRight: 10,
  },
  authTextInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  authPasswordToggle: {
    paddingHorizontal: 8,
  },
  authPasswordToggleText: {
    color: '#9AB9EC',
    fontSize: 12,
    fontWeight: '700',
  },
  primaryActionBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.buttonPrimaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.buttonPrimaryText,
  },
  googleAuthBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0F253B',
    borderWidth: 1.5,
    borderColor: '#294B73',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  googleAuthText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1D3B5C',
  },
  dividerText: {
    fontSize: 11,
    color: '#7F94B0',
    fontWeight: '700',
    paddingHorizontal: 12,
    letterSpacing: 0.5,
  },
  authFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  authFooterMuted: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  authFooterHighlight: {
    color: '#9AB9EC',
    fontWeight: '700',
    fontSize: 14,
  },
  onboardContainer: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'ios' ? 16 : 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 20,
    justifyContent: 'space-between',
  },
  onboardContainerCompact: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
  },
  onboardHeader: {
    marginBottom: 16,
  },
  onboardTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  onboardTitleCompact: {
    fontSize: 28,
    lineHeight: 32,
  },
  onboardSubtitle: {
    fontSize: 14,
    color: '#8EA5C2',
    marginTop: 6,
    fontWeight: '500',
  },
  onboardGraphic: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  phoneOutline: {
    width: 160,
    height: 185,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#264C72',
    backgroundColor: '#091A2A',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  phoneOutlineCompact: {
    width: 136,
    height: 155,
    borderRadius: 24,
  },
  qrCheckBubble: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#356899',
    borderWidth: 2.5,
    borderColor: '#061522',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrCheckBubbleCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
    bottom: -6,
    right: -6,
  },
  featuresList: {
    gap: 10,
    marginBottom: 14,
  },
  featuresListCompact: {
    gap: 8,
    marginBottom: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A1C2C',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#1D3B5C',
  },
  featureItemCompact: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#122D47',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureIconCompact: {
    width: 32,
    height: 32,
    borderRadius: 10,
    marginRight: 10,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  featureDesc: {
    fontSize: 12,
    color: '#8EA5C2',
    marginTop: 1,
  },
  onboardActionWrap: {
    marginTop: 'auto',
    paddingTop: 8,
  },
  getStartedBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.buttonPrimaryBg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  getStartedBtnCompact: {
    height: 46,
    borderRadius: 23,
  },
  getStartedText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.buttonPrimaryText,
  },
  setupContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  setupProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    gap: 12,
  },
  setupProgressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#152A40',
    overflow: 'hidden',
  },
  setupProgressFill: {
    height: '100%',
    backgroundColor: '#9AB9EC',
  },
  setupProgressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7F94B0',
  },
  setupHeaderBox: {
    marginBottom: 28,
  },
  setupIconBox: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: '#0F2338',
    borderWidth: 1.5,
    borderColor: '#1D3B5C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  setupTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  setupSub: {
    fontSize: 14,
    color: '#7F94B0',
  },
  setupContent: {
    flex: 1,
  },
  photoCenterBox: {
    alignItems: 'center',
    paddingTop: 16,
  },
  photoCircleWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#0C1F34',
    borderWidth: 2,
    borderColor: '#1D3B5C',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  photoImg: {
    width: 136,
    height: 136,
    borderRadius: 68,
  },
  photoPlace: {
    alignItems: 'center',
    gap: 6,
  },
  photoPlaceText: {
    fontSize: 12,
    color: '#5A7B9E',
    fontWeight: '600',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#204772',
    borderWidth: 2,
    borderColor: '#0C1F34',
    justifyContent: 'center',
    alignItems: 'center',
  },
  underlineGroup: {
    paddingTop: 10,
  },
  underlineLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#5A7B9E',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  underlineInput: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingVertical: 10,
  },
  underlineBar: {
    height: 2,
    backgroundColor: '#1D3B5C',
  },
  underlineActive: {
    backgroundColor: '#6A9CD8',
  },
  deptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#0C1F34',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#152A40',
    marginBottom: 8,
  },
  deptCardActive: {
    borderColor: '#3A6DA0',
    backgroundColor: '#112C48',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#2A4560',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterActive: {
    borderColor: '#9AB9EC',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9AB9EC',
  },
  deptText: {
    fontSize: 14,
    color: '#8EA5C2',
    fontWeight: '600',
  },
  semesterGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  semTile: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: '#0C1F34',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#152A40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  semTileActive: {
    borderColor: '#9AB9EC',
    backgroundColor: '#112C48',
  },
  semNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#5A7B9E',
  },
  semSub: {
    fontSize: 10,
    color: '#3E5E7E',
    fontWeight: '700',
  },
  setupBottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  setupBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#0F2338',
  },
  setupBackText: {
    color: '#8EA5C2',
    fontSize: 13,
    fontWeight: '600',
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skipText: {
    color: '#7F94B0',
    fontSize: 13,
  },
  setupNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 18,
    backgroundColor: '#1B4B78',
  },
  setupFinishBtn: {
    backgroundColor: Colors.buttonPrimaryBg,
  },
  setupNextText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  setupFinishText: {
    color: Colors.buttonPrimaryText,
  },
  dashHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  dashNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dashNameDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9AB9EC',
  },
  headerRoundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#12273F',
    borderWidth: 1,
    borderColor: '#1D3B5C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  sectionCountChip: {
    backgroundColor: '#1C3550',
    borderWidth: 1,
    borderColor: '#385677',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B4CBF5',
  },
  dashGreeting: {
    fontSize: 20,
    color: '#8EA5C2',
    fontWeight: '500',
  },
  dashName: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  dashSubtitle: {
    fontSize: 14,
    color: '#7F94B0',
  },
  headerSquareBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#12273F',
    borderWidth: 1,
    borderColor: '#1D3B5C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCardContainer: {
    backgroundColor: Colors.cardProfile,
    borderRadius: 28,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 22,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatarImage: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2,
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
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#162C44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoColumn: {
    flex: 1,
  },
  studentName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textDarkNavy,
  },
  degreeText: {
    fontSize: 13,
    color: Colors.textDarkMuted,
  },
  rollNumberText: {
    fontSize: 12,
    color: Colors.textDarkMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    marginTop: 2,
  },
  semesterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.badgeSemesterBg,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  semesterText: {
    fontSize: 11,
    color: Colors.badgeSemesterText,
    fontWeight: '700',
  },
  profileActionsCol: {
    gap: 8,
    marginLeft: 6,
  },
  qrScannerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2ECF8',
    borderWidth: 1,
    borderColor: '#9AB9EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDarkNavy,
    marginLeft: 5,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textDarkMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  verticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  classesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sectionHeaderSubtitle: {
    fontSize: 12,
    color: '#7F94B0',
  },
  joinBtnAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.buttonPrimaryBg,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 16,
  },
  joinBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.buttonPrimaryText,
  },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#263748',
  },
  highlightedCard: {
    backgroundColor: Colors.cardDataStructures,
    borderColor: '#305A87',
  },
  charcoalCard: {
    backgroundColor: Colors.cardCharcoal,
  },
  classIconTile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  iconTileSlate: {
    backgroundColor: '#2A4E75',
  },
  iconTileCharcoal: {
    backgroundColor: '#192530',
  },
  classInfoColumn: {
    flex: 1,
  },
  classHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  classSubject: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  textWhite: {
    color: '#FFFFFF',
  },
  textPrimary: {
    color: '#FFFFFF',
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeAvailable: {
    backgroundColor: '#385F8A',
  },
  badgeNotStarted: {
    backgroundColor: '#162330',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextAvailable: {
    color: '#B4CBF5',
  },
  badgeTextNotStarted: {
    color: '#8EA5C2',
  },
  classCourseCode: {
    fontSize: 12,
    color: '#8EA5C2',
    marginBottom: 6,
  },
  classMetaRow: {
    flexDirection: 'row',
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 11,
    color: '#8EA5C2',
  },
  emptyCard: {
    backgroundColor: '#0F2338',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#1D3B5C',
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#7F94B0',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyJoinAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.buttonPrimaryBg,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 18,
  },
  emptyJoinText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.buttonPrimaryText,
  },
  testCodesNote: {
    fontSize: 10,
    color: '#5C7A9D',
    marginTop: 14,
    fontWeight: '600',
  },
  screenHeading: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  screenSubheading: {
    fontSize: 13,
    color: '#7F94B0',
    marginTop: 2,
    marginBottom: 16,
  },
  charcoalClassBox: {
    backgroundColor: Colors.cardCharcoal,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#263748',
  },
  attendanceBanner: {
    backgroundColor: '#122B45',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#21466E',
    marginTop: 14,
  },
  attendanceBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  attendanceBannerText: {
    fontSize: 13,
    color: '#A8B9D0',
    lineHeight: 18,
  },
  profileBoxTop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12273D',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1D3B5C',
    marginTop: 12,
  },
  profileNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileRollText: {
    fontSize: 12,
    color: '#8EA5C2',
    marginTop: 2,
  },
  profileBadge: {
    backgroundColor: '#1B3754',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  profileBadgeText: {
    fontSize: 10,
    color: '#B4CBF5',
    fontWeight: '600',
  },
  avatarWrapper: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1B4B78',
    borderWidth: 2,
    borderColor: '#12273D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileMenuSection: {
    marginTop: 18,
  },
  profileSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7F94B0',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  profileMenuBox: {
    backgroundColor: Colors.cardCharcoal,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#263748',
    overflow: 'hidden',
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  profileMenuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#253545',
  },
  profileMenuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileMenuItemLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  logoutButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(252, 129, 129, 0.1)',
    borderWidth: 1.5,
    borderColor: '#FC8181',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  logoutText: {
    color: '#FC8181',
    fontWeight: '700',
    fontSize: 14,
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: '#0A1826',
    borderTopWidth: 1,
    borderTopColor: '#172E44',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  navTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  navTabActive: {
    backgroundColor: Colors.buttonPrimaryBg,
  },
  navLabel: {
    fontSize: 10,
    color: Colors.navInactive,
    marginTop: 2,
    fontWeight: '600',
  },
  navLabelActive: {
    color: Colors.buttonPrimaryText,
    fontWeight: '700',
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(3, 10, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalOverlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(3, 10, 18, 0.85)',
    justifyContent: 'flex-end',
  },
  joinModalBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0F2338',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#1D3B5C',
    padding: 22,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#183654',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#7F94B0',
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#142940',
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinInputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8EA5C2',
    letterSpacing: 1,
    marginBottom: 6,
  },
  joinInput: {
    height: 48,
    backgroundColor: '#071626',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1E3C60',
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 14,
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  resultSuccess: {
    backgroundColor: 'rgba(78, 204, 163, 0.15)',
    borderColor: '#4ECCA3',
    borderWidth: 1,
  },
  resultError: {
    backgroundColor: 'rgba(252, 129, 129, 0.15)',
    borderColor: '#FC8181',
    borderWidth: 1,
  },
  resultBannerText: {
    fontSize: 12,
    color: '#FFFFFF',
    flex: 1,
  },
  modalActionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#122538',
  },
  modalCancelText: {
    color: '#8EA5C2',
    fontSize: 13,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: Colors.buttonPrimaryBg,
  },
  modalConfirmText: {
    color: Colors.buttonPrimaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  detailsSheet: {
    backgroundColor: '#0E2135',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    borderTopWidth: 1.5,
    borderTopColor: '#1E3C60',
    // Scanner opens tall: the camera preview dominates the screen so aligning
    // a phone camera with the faculty QR is easy.
    height: '94%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetBadge: {
    backgroundColor: '#183654',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  sheetBadgeText: {
    fontSize: 11,
    color: '#9AB9EC',
    fontWeight: '700',
  },
  detailsTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  detailsBox: {
    backgroundColor: '#081726',
    borderRadius: 18,
    padding: 14,
    gap: 12,
    marginBottom: 18,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5C7A9D',
    textTransform: 'uppercase',
  },
  detailVal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  leaveBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(252, 129, 129, 0.1)',
    borderWidth: 1.5,
    borderColor: '#FC8181',
  },
  leaveBtnText: {
    color: '#FC8181',
    fontSize: 13,
    fontWeight: '700',
  },
  cameraPlaceholderBox: {
    flex: 1,
    backgroundColor: '#081726',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  permButton: {
    backgroundColor: '#1B4B78',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  permButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cameraViewWrap: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  scanTargetBox: {
    width: '68%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: '#9AB9EC',
    borderRadius: 24,
  },
  detectedClassCard: {
    backgroundColor: '#122D47',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  detectedClassTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4ECCA3',
  },
  detectedClassName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginVertical: 4,
  },
  confirmJoinBtn: {
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.buttonPrimaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  confirmJoinText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.buttonPrimaryText,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(154, 185, 236, 0.1)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  noticeText: {
    fontSize: 11,
    color: '#B4CBF5',
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(252, 129, 129, 0.1)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 11,
    color: '#FC8181',
    flex: 1,
  },
  testPayloadsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  testPill: {
    backgroundColor: '#12253A',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  testPillText: {
    fontSize: 11,
    color: '#9AB9EC',
  },
});
