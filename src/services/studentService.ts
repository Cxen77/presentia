import { supabase, isSupabaseConfigured } from './supabase';
import { DatabaseClass, ClassEnrollment, StudentProfile, ClassScheduleItem } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_STORAGE_KEY_PROFILE = 'class_attendance_student_profile';
const LOCAL_STORAGE_KEY_ENROLLMENTS = 'class_attendance_enrolled_classes';

// Seed classes for development / offline fallback
export const SEED_CLASSES: DatabaseClass[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    course_code: 'CS201',
    class_name: 'Data Structures',
    department: 'Computer Science',
    enrollment_code: 'CS201-DS',
    teacher_name: 'Prof. R. Sengupta',
    schedule_info: 'Today • 10:00 - 11:30 AM',
    room: 'Lab 3B • Room 402',
    class_type: 'Theory',
    credits: 4,
    is_active: true,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    course_code: 'CS203',
    class_name: 'Database Management Systems',
    department: 'Computer Science',
    enrollment_code: 'CS203-DB',
    teacher_name: 'Dr. Ananya Roy',
    schedule_info: 'Today • 11:45 - 01:15 PM',
    room: 'Hall A • Room 204',
    class_type: 'Theory',
    credits: 4,
    is_active: true,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    course_code: 'CS205',
    class_name: 'Operating Systems',
    department: 'Computer Science',
    enrollment_code: 'CS205-OS',
    teacher_name: 'Prof. Vikram Mehta',
    schedule_info: 'Today • 02:00 - 03:30 PM',
    room: 'Seminar 1 • Room 102',
    class_type: 'Theory',
    credits: 4,
    is_active: true,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    course_code: 'CS207',
    class_name: 'Computer Networks',
    department: 'Computer Science',
    enrollment_code: 'CS207-CN',
    teacher_name: 'Dr. Priya Sharma',
    schedule_info: 'Today • 03:45 - 05:15 PM',
    room: 'Lab 1A • Room 301',
    class_type: 'Practical',
    credits: 4,
    is_active: true,
  },
];

class StudentService {
  /**
   * Get the current authenticated student profile from Supabase
   */
  async getProfile(): Promise<StudentProfile | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching student profile from Supabase:', error.message);
          return null;
        }

        if (data) {
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
          // Cache locally
          await AsyncStorage.setItem(LOCAL_STORAGE_KEY_PROFILE, JSON.stringify(profile));
          return profile;
        }
      } catch (err) {
        console.error('getProfile Supabase error:', err);
      }
    }

    // Local storage fallback for development / offline
    try {
      const cached = await AsyncStorage.getItem(LOCAL_STORAGE_KEY_PROFILE);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}

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

    if (isSupabaseConfigured()) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return { success: false, error: 'User not authenticated' };
        }

        // Upsert into Supabase profiles table
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
          return { success: false, error: error.message };
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
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to save profile' };
      }
    }

    // Local fallback for offline/development
    const mockProfile: StudentProfile = {
      id: 'local-student-id',
      email: 'student@univ.edu',
      name: profileData.fullName.trim(),
      firstName,
      degree: profileData.department.trim(),
      rollNumber: profileData.rollNumber.trim().toUpperCase(),
      semester: profileData.semester.trim(),
      avatarUrl: profileData.avatarUrl || '',
      attendancePercent: 0,
      totalClasses: 0,
      presentToday: 0,
    };
    await AsyncStorage.setItem(LOCAL_STORAGE_KEY_PROFILE, JSON.stringify(mockProfile));
    return { success: true, profile: mockProfile };
  }

  /**
   * Fetch all classes the student is enrolled in
   */
  async getEnrolledClasses(studentProfileId?: string): Promise<ClassScheduleItem[]> {
    if (isSupabaseConfigured() && studentProfileId) {
      try {
        const { data, error } = await supabase
          .from('class_enrollments')
          .select(`
            id,
            status,
            classes:class_id (
              id,
              course_code,
              class_name,
              department,
              enrollment_code,
              teacher_name,
              schedule_info,
              room,
              class_type,
              credits
            )
          `)
          .eq('student_id', studentProfileId)
          .eq('status', 'active');

        if (error) {
          console.error('Error fetching enrolled classes:', error.message);
        } else if (data) {
          const formatted: ClassScheduleItem[] = data
            .filter((item: any) => item.classes)
            .map((item: any) => {
              const cls = item.classes as DatabaseClass;
              const isDS = cls.course_code === 'CS201' || cls.class_name.toLowerCase().includes('data structure');
              return {
                id: cls.id,
                enrollmentId: item.id,
                subject: cls.class_name,
                courseCode: cls.course_code,
                classType: cls.class_type || 'Theory',
                timeSlot: cls.schedule_info || '10:00 - 11:30 AM',
                room: cls.room || 'Room 402',
                iconName: isDS ? 'chart' : 'book',
                isHighlighted: isDS,
                status: 'Not Started',
                teacherName: cls.teacher_name,
                department: cls.department,
                enrollmentCode: cls.enrollment_code,
              };
            });

          // Cache locally
          await AsyncStorage.setItem(LOCAL_STORAGE_KEY_ENROLLMENTS, JSON.stringify(formatted));
          return formatted;
        }
      } catch (err) {
        console.error('getEnrolledClasses Supabase error:', err);
      }
    }

    // Local storage fallback for development / offline
    try {
      const cached = await AsyncStorage.getItem(LOCAL_STORAGE_KEY_ENROLLMENTS);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}

    return [];
  }

  /**
   * Validate and join a class using a teacher-provided class code
   */
  async joinClassByCode(
    studentProfileId: string,
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

    if (isSupabaseConfigured()) {
      try {
        // 1. Check if class exists and is active
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .select('*')
          .eq('enrollment_code', cleanedCode)
          .eq('is_active', true)
          .maybeSingle();

        if (classError) {
          return { success: false, error: classError.message };
        }

        if (!classData) {
          return {
            success: false,
            error: `No active class found with code "${cleanedCode}". Please verify with your professor.`,
          };
        }

        // 2. Check if student is already enrolled
        const { data: existingEnrollment } = await supabase
          .from('class_enrollments')
          .select('id, status')
          .eq('student_id', studentProfileId)
          .eq('class_id', classData.id)
          .maybeSingle();

        if (existingEnrollment) {
          if (existingEnrollment.status === 'active') {
            return {
              success: false,
              error: `You are already enrolled in ${classData.class_name} (${classData.course_code}).`,
              classData,
            };
          }
          // If previously dropped, re-activate enrollment
          await supabase
            .from('class_enrollments')
            .update({ status: 'active' })
            .eq('id', existingEnrollment.id);

          return { success: true, classData };
        }

        // 3. Create enrollment in Supabase
        const { error: enrollError } = await supabase
          .from('class_enrollments')
          .insert({
            student_id: studentProfileId,
            class_id: classData.id,
            status: 'active',
          });

        if (enrollError) {
          return { success: false, error: enrollError.message };
        }

        return { success: true, classData };
      } catch (err: any) {
        return { success: false, error: err.message || 'Unexpected error joining class' };
      }
    }

    // Local fallback for offline/development: match against seed classes
    const foundSeed = SEED_CLASSES.find(
      (c) => c.enrollment_code.toUpperCase() === cleanedCode
    );

    if (!foundSeed) {
      return {
        success: false,
        error: `Invalid class code "${cleanedCode}". Available test codes: CS201-DS, CS203-DB, CS205-OS, CS207-CN`,
      };
    }

    // Check local duplicate
    const currentList = await this.getEnrolledClasses();
    if (currentList.some((c) => c.id === foundSeed.id)) {
      return {
        success: false,
        error: `You are already enrolled in ${foundSeed.class_name} (${foundSeed.course_code}).`,
        classData: foundSeed,
      };
    }

    const isDS = foundSeed.course_code === 'CS201';
    const newItem: ClassScheduleItem = {
      id: foundSeed.id,
      subject: foundSeed.class_name,
      courseCode: foundSeed.course_code,
      classType: foundSeed.class_type || 'Theory',
      timeSlot: foundSeed.schedule_info || '10:00 - 11:30 AM',
      room: foundSeed.room || 'Room 402',
      iconName: isDS ? 'chart' : 'book',
      isHighlighted: isDS,
      status: 'Not Started',
      teacherName: foundSeed.teacher_name,
      department: foundSeed.department,
      enrollmentCode: foundSeed.enrollment_code,
    };

    const updated = [...currentList, newItem];
    await AsyncStorage.setItem(LOCAL_STORAGE_KEY_ENROLLMENTS, JSON.stringify(updated));

    return { success: true, classData: foundSeed };
  }

  /**
   * Leave / drop an enrolled class
   */
  async leaveClass(
    studentProfileId: string,
    classId: string,
    enrollmentId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured()) {
      try {
        let query = supabase.from('class_enrollments').delete();
        if (enrollmentId) {
          query = query.eq('id', enrollmentId);
        } else {
          query = query.eq('student_id', studentProfileId).eq('class_id', classId);
        }

        const { error } = await query;
        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    // Local fallback
    const current = await this.getEnrolledClasses();
    const filtered = current.filter((c) => c.id !== classId);
    await AsyncStorage.setItem(LOCAL_STORAGE_KEY_ENROLLMENTS, JSON.stringify(filtered));
    return { success: true };
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

    // 2. Check if it's a class invitation code
    if (isSupabaseConfigured()) {
      try {
        // Query class_invitations table
        const { data: invite } = await supabase
          .from('class_invitations')
          .select(`
            id,
            is_revoked,
            expires_at,
            classes:class_id (*)
          `)
          .eq('invitation_code', trimmed)
          .maybeSingle();

        if (invite) {
          if (invite.is_revoked) {
            return {
              type: 'invalid',
              message: 'This class invitation QR has been revoked by the instructor.',
            };
          }
          if (new Date(invite.expires_at).getTime() < Date.now()) {
            return {
              type: 'invalid',
              message: 'This class invitation QR has expired.',
            };
          }
          return {
            type: 'class_invite',
            classData: invite.classes as unknown as DatabaseClass,
          };
        }

        // Also check if raw payload matches a class enrollment code
        const { data: directClass } = await supabase
          .from('classes')
          .select('*')
          .eq('enrollment_code', trimmed.toUpperCase())
          .eq('is_active', true)
          .maybeSingle();

        if (directClass) {
          return {
            type: 'class_invite',
            classData: directClass,
          };
        }
      } catch (err) {
        console.error('QR validate error:', err);
      }
    }

    // Local / offline seed matching
    if (trimmed.startsWith('INVITE-') || trimmed.includes('-DS') || trimmed.includes('-DB') || trimmed.includes('-OS') || trimmed.includes('-CN')) {
      const codePart = trimmed.replace('INVITE-', '').replace('-FALL', '');
      const seed = SEED_CLASSES.find(
        (c) =>
          c.enrollment_code.toUpperCase() === trimmed.toUpperCase() ||
          c.enrollment_code.startsWith(codePart) ||
          c.course_code === codePart
      );

      if (seed) {
        return {
          type: 'class_invite',
          classData: seed,
        };
      }
    }

    return {
      type: 'invalid',
      message: 'Unrecognized QR code. Please scan a valid teacher class invitation QR code.',
    };
  }
}

export const studentService = new StudentService();
