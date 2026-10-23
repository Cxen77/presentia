import { supabase, isSupabaseConfigured } from './supabase';
import { DatabaseClass, StudentProfile, ClassScheduleItem } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from './api';

const LOCAL_STORAGE_KEY_PROFILE = 'class_attendance_student_profile';
const LOCAL_STORAGE_KEY_ENROLLMENTS = 'class_attendance_enrolled_classes';

class StudentService {
  /**
   * Get the current authenticated student profile from Supabase
   */
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

    if (data && data.full_name?.trim() && data.roll_number?.trim() && data.degree?.trim() && data.semester?.trim()) {
      const profile: StudentProfile = {
        id: data.id,
        userId: data.user_id,
        email: data.email || user.email || '',
        name: data.full_name,
        firstName: data.first_name || data.full_name.split(' ')[0],
        degree: data.degree || 'Computer Science',
        rollNumber: data.roll_number,
        semester: data.semester || '3rd Semester',
        avatarUrl: data.avatar_url || '',
        attendancePercent: 0,
        totalClasses: 0,
        presentToday: 0,
      };
      await AsyncStorage.setItem(LOCAL_STORAGE_KEY_PROFILE, JSON.stringify(profile));
      return profile;
    }

    return null;
  }

  /**
   * Upsert the student profile in Supabase
   */
  async saveProfile(profileData: {
    fullName: string;
    rollNumber: string;
    department: string;
    semester: string;
    avatarUrl?: string;
  }): Promise<{ success: boolean; profile?: StudentProfile; error?: string }> {
    const firstName = profileData.fullName.trim().split(' ')[0];

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
            first_name: firstName,
            roll_number: profileData.rollNumber.trim().toUpperCase(),
            degree: profileData.department.trim(),
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
        semester: data.semester,
        avatarUrl: data.avatar_url || '',
        attendancePercent: 0,
        totalClasses: 0,
        presentToday: 0,
      };

      await AsyncStorage.setItem(LOCAL_STORAGE_KEY_PROFILE, JSON.stringify(profile));
      return { success: true, profile };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to save profile' };
    }
  }

  /**
   * Fetch all classes the student is enrolled in
   */
  async getEnrolledClasses(studentProfileId?: string): Promise<ClassScheduleItem[]> {
    void studentProfileId;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw new Error(`Could not verify Supabase sign-in: ${error.message}`);
    if (!user) {
      throw new Error('Sign in with a valid Supabase account to view enrolled classes.');
    }

    const response = await api.getMyEnrolledClasses();
    const formatted: ClassScheduleItem[] = response.map((item) => ({
      id: item.id,
      enrollmentId: item.enrollmentId,
      subject: item.subject,
      courseCode: item.courseCode,
      classType: item.classType || 'Theory',
      timeSlot: item.timeSlot || '',
      room: item.room || '',
      iconName: item.courseCode === 'CS201' ? 'chart' : 'book',
      isHighlighted: item.courseCode === 'CS201',
      status: 'Not Started',
      teacherName: item.teacherName,
      department: item.department,
      enrollmentCode: item.enrollmentCode,
    }));
    await AsyncStorage.setItem(LOCAL_STORAGE_KEY_ENROLLMENTS, JSON.stringify(formatted));
    return formatted;
  }

  /**
   * Validate and join a class using a teacher-provided class code
   */
  async joinClassByCode(
    _studentProfileId: string,
    enrollmentCode: string
  ): Promise<{
    success: boolean;
    classData?: DatabaseClass;
    error?: string;
  }> {
    const cleanedCode = enrollmentCode.trim().toUpperCase();

    if (!cleanedCode) {
      return { success: false, error: 'Please enter a valid class code.' };
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      return { success: false, error: `Could not verify Supabase sign-in: ${error.message}` };
    }
    if (!user) {
      return { success: false, error: 'Sign in with a valid Supabase account before joining a class.' };
    }

    try {
      const response = await api.joinClassByCode(cleanedCode);
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

  /**
   * Leave / drop an enrolled class
   */
  async leaveClass(
    studentProfileId: string,
    classId: string,
    enrollmentId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return { success: false, error: 'Sign in with a valid Supabase account before leaving a class.' };
    }
    if (!enrollmentId) {
      return { success: false, error: 'Enrollment details are missing. Refresh your class list and try again.' };
    }
    try {
      await api.leaveClass(enrollmentId);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unable to leave this class.',
      };
    }
  }

  /**
   * Validate a QR code payload
   * Supports:
   * - Class invitation codes (e.g. INVITE-CS201-FALL)
   * - Raw class enrollment codes (e.g. CS201-DS)
   * - Attendance session tokens (e.g. contains TOKEN or ATT-)
   */
  async validateQRPayload(payload: string): Promise<{
    type: 'class_invite' | 'attendance_session' | 'invalid';
    classData?: DatabaseClass;
    message?: string;
  }> {
    const trimmed = payload.trim();

    // 1. Check if it's an attendance session code
    if (
      trimmed.startsWith('ATT-') ||
      trimmed.includes('TOKEN') ||
      trimmed.toLowerCase().includes('session')
    ) {
      return {
        type: 'attendance_session',
        message:
          'Attendance Session QR Detected: Live attendance verification will be enabled in a future release. To join a class, scan a teacher-issued class invitation QR code.',
      };
    }

    // 2. Check the authenticated Supabase project's invitations and classes.
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

    return {
      type: 'invalid',
      message: 'Unrecognized QR code. Please scan a valid teacher class invitation QR code.',
    };
  }
}

export const studentService = new StudentService();
