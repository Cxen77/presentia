import { 
  ClassItem, 
  AttendanceSession, 
  AttendanceRecord, 
  StudentProfile, 
  QRTokenPayload 
} from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import * as api from './api';

const STORAGE_KEY_CLASSES = 'faculty_portal_classes_v1';
const STORAGE_KEY_SESSIONS = 'faculty_portal_sessions_v1';
const STORAGE_KEY_RECORDS = 'faculty_portal_records_v1';
const STORAGE_KEY_STUDENTS = 'faculty_portal_students_v1';

// Seed Students with authentic photos
const INITIAL_STUDENTS: StudentProfile[] = [
  {
    id: 'stud-101',
    fullName: 'Aryan K. Sharma',
    rollNumber: '1MS21CS042',
    email: 'aryan.sharma@institution.edu',
    degree: 'B.Tech Computer Science',
    semester: '3rd Semester - Section A',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
    enrolledAt: '2026-08-15T09:00:00Z',
    overallAttendanceRate: 88,
  },
  {
    id: 'stud-102',
    fullName: 'Ananya Deshmukh',
    rollNumber: '1MS21CS019',
    email: 'ananya.d@institution.edu',
    degree: 'B.Tech Computer Science',
    semester: '3rd Semester - Section A',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=300',
    enrolledAt: '2026-08-15T09:12:00Z',
    overallAttendanceRate: 94,
  },
  {
    id: 'stud-103',
    fullName: 'Rohan V. Nair',
    rollNumber: '1MS21CS088',
    email: 'rohan.nair@institution.edu',
    degree: 'B.Tech Computer Science',
    semester: '3rd Semester - Section A',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300',
    enrolledAt: '2026-08-16T10:00:00Z',
    overallAttendanceRate: 76,
  },
  {
    id: 'stud-104',
    fullName: 'Sneha Patel',
    rollNumber: '1MS21CS112',
    email: 'sneha.patel@institution.edu',
    degree: 'B.Tech Computer Science',
    semester: '3rd Semester - Section A',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=300',
    enrolledAt: '2026-08-16T11:20:00Z',
    overallAttendanceRate: 92,
  },
  {
    id: 'stud-105',
    fullName: 'Vikramaditya Rao',
    rollNumber: '1MS21CS134',
    email: 'vikram.rao@institution.edu',
    degree: 'B.Tech Computer Science',
    semester: '3rd Semester - Section A',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=300',
    enrolledAt: '2026-08-17T08:45:00Z',
    overallAttendanceRate: 85,
  },
  {
    id: 'stud-106',
    fullName: 'Pooja Hegde',
    rollNumber: '1MS21CS075',
    email: 'pooja.h@institution.edu',
    degree: 'B.Tech Computer Science',
    semester: '3rd Semester - Section A',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=300',
    enrolledAt: '2026-08-17T14:10:00Z',
    overallAttendanceRate: 90,
  },
  {
    id: 'stud-107',
    fullName: 'Devansh Kulkarni',
    rollNumber: '1MS21CS038',
    email: 'devansh.k@institution.edu',
    degree: 'B.Tech Computer Science',
    semester: '3rd Semester - Section A',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=300',
    enrolledAt: '2026-08-18T09:30:00Z',
    overallAttendanceRate: 82,
  },
  {
    id: 'stud-108',
    fullName: 'Meera Nambiar',
    rollNumber: '1MS21CS062',
    email: 'meera.n@institution.edu',
    degree: 'B.Tech Computer Science',
    semester: '3rd Semester - Section A',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
    enrolledAt: '2026-08-18T10:15:00Z',
    overallAttendanceRate: 95,
  }
];

// Initial Classes matching student app classes
const INITIAL_CLASSES: ClassItem[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    courseCode: 'CS201',
    className: 'Data Structures & Algorithms',
    department: 'Computer Science & Engineering',
    semester: '3rd Semester - Section A',
    room: 'Lab 3B • Room 402',
    scheduleInfo: 'Mon, Wed, Fri • 10:00 - 11:30 AM',
    startTime: '10:00 AM',
    endTime: '11:30 AM',
    classType: 'Theory',
    credits: 4,
    enrollmentCode: 'CS201-DS',
    facultyId: 'fac-sengupta-01',
    facultyName: 'Prof. R. Sengupta',
    description: 'Fundamental linear and non-linear data structures, trees, graphs, hashing, and algorithmic complexity.',
    enrolledStudentsCount: 8,
    isActive: true,
    createdAt: '2026-08-01T08:00:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    courseCode: 'CS203',
    className: 'Database Management Systems',
    department: 'Computer Science & Engineering',
    semester: '3rd Semester - Section A',
    room: 'Hall A • Room 204',
    scheduleInfo: 'Tue, Thu • 11:45 - 01:15 PM',
    startTime: '11:45 AM',
    endTime: '01:15 PM',
    classType: 'Theory',
    credits: 4,
    enrollmentCode: 'CS203-DB',
    facultyId: 'fac-sengupta-01',
    facultyName: 'Prof. R. Sengupta',
    description: 'Relational data models, SQL queries, transactions, normalization, and ACID properties.',
    enrolledStudentsCount: 8,
    isActive: true,
    createdAt: '2026-08-01T08:30:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    courseCode: 'CS205',
    className: 'Operating Systems Architecture',
    department: 'Computer Science & Engineering',
    semester: '3rd Semester - Section B',
    room: 'Seminar 1 • Room 102',
    scheduleInfo: 'Mon, Thu • 02:00 - 03:30 PM',
    startTime: '02:00 PM',
    endTime: '03:30 PM',
    classType: 'Theory',
    credits: 4,
    enrollmentCode: 'CS205-OS',
    facultyId: 'fac-sengupta-01',
    facultyName: 'Prof. R. Sengupta',
    description: 'Process management, concurrency, memory virtualisation, and file systems.',
    enrolledStudentsCount: 7,
    isActive: true,
    createdAt: '2026-08-02T09:00:00Z',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    courseCode: 'CS207',
    className: 'Computer Networks Laboratory',
    department: 'Computer Science & Engineering',
    semester: '3rd Semester - Lab Group 1',
    room: 'Lab 1A • Room 301',
    scheduleInfo: 'Wed • 03:45 - 05:15 PM',
    startTime: '03:45 PM',
    endTime: '05:15 PM',
    classType: 'Practical',
    credits: 2,
    enrollmentCode: 'CS207-CN',
    facultyId: 'fac-sengupta-01',
    facultyName: 'Prof. R. Sengupta',
    description: 'Packet analysis with Wireshark, socket programming, routing protocols, and subnetting.',
    enrolledStudentsCount: 8,
    isActive: true,
    createdAt: '2026-08-02T10:00:00Z',
  }
];

class AttendanceDataService {
  private listeners: (() => void)[] = [];

  constructor() {
    this.initLocalStorage();
  }

  private initLocalStorage() {
    if (typeof window === 'undefined') return;

    if (!localStorage.getItem(STORAGE_KEY_CLASSES)) {
      localStorage.setItem(STORAGE_KEY_CLASSES, JSON.stringify(INITIAL_CLASSES));
    }
    if (!localStorage.getItem(STORAGE_KEY_STUDENTS)) {
      localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(INITIAL_STUDENTS));
    }
    if (!localStorage.getItem(STORAGE_KEY_SESSIONS)) {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_RECORDS)) {
      localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify([]));
    }
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch (e) {
        console.error('Subscriber callback error:', e);
      }
    });
  }

  // --- CLASSES ---
  public async getClasses(facultyId?: string): Promise<ClassItem[]> {
    // Try Render backend API first
    try {
      const serverClasses = await api.getClasses();
      if (serverClasses && Array.isArray(serverClasses) && serverClasses.length > 0) {
        localStorage.setItem(STORAGE_KEY_CLASSES, JSON.stringify(serverClasses));
        return serverClasses;
      }
    } catch (apiErr) {
      // Backend unreachable or unauthenticated — try direct Supabase or local cache
    }

    if (isSupabaseConfigured()) {
      try {
        const query = supabase.from('classes').select('*').eq('is_active', true);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
          const mapped = data.map((d: any) => ({
            id: d.id,
            courseCode: d.course_code,
            className: d.class_name,
            department: d.department,
            semester: d.semester || '3rd Semester',
            room: d.room || 'Room 101',
            scheduleInfo: d.schedule_info || '10:00 - 11:30 AM',
            startTime: d.start_time || '10:00 AM',
            endTime: d.end_time || '11:30 AM',
            classType: d.class_type || 'Theory',
            credits: d.credits || 4,
            enrollmentCode: d.enrollment_code,
            facultyId: d.faculty_id || facultyId || 'fac-sengupta-01',
            facultyName: d.teacher_name || 'Prof. R. Sengupta',
            description: d.description || '',
            enrolledStudentsCount: 8,
            isActive: d.is_active ?? true,
            createdAt: d.created_at || new Date().toISOString(),
          }));
          localStorage.setItem(STORAGE_KEY_CLASSES, JSON.stringify(mapped));
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase getClasses error, using local fallback:', err);
      }
    }

    const stored = localStorage.getItem(STORAGE_KEY_CLASSES);
    return stored ? JSON.parse(stored) : INITIAL_CLASSES;
  }

  public async getClassById(classId: string): Promise<ClassItem | null> {
    const classes = await this.getClasses();
    return classes.find(c => c.id === classId) || null;
  }

  public async createClass(params: {
    courseCode: string;
    className: string;
    department: string;
    semester: string;
    room: string;
    startTime: string;
    endTime: string;
    classType: 'Theory' | 'Practical' | 'Seminar';
    credits: number;
    description?: string;
    facultyId: string;
    facultyName: string;
  }): Promise<ClassItem> {
    // Try Render backend API first
    try {
      const created = await api.createClass({
        courseCode: params.courseCode,
        className: params.className,
        department: params.department,
        semester: params.semester,
        room: params.room,
        startTime: params.startTime,
        endTime: params.endTime,
        classType: params.classType,
        credits: params.credits,
        description: params.description,
      });
      if (created) {
        const classes = await this.getClasses();
        classes.unshift(created);
        localStorage.setItem(STORAGE_KEY_CLASSES, JSON.stringify(classes));
        this.notify();
        return created;
      }
    } catch (apiErr) {
      console.warn('API createClass error, falling back to local mode:', apiErr);
    }

    // Generate clean enrollment code, e.g. CS201-7294
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const cleanPrefix = params.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const enrollmentCode = `${cleanPrefix}-${randomSuffix}`;

    const newClass: ClassItem = {
      id: `class-${Date.now()}-${randomSuffix}`,
      courseCode: params.courseCode.toUpperCase(),
      className: params.className,
      department: params.department,
      semester: params.semester,
      room: params.room,
      scheduleInfo: `${params.startTime} - ${params.endTime}`,
      startTime: params.startTime,
      endTime: params.endTime,
      classType: params.classType,
      credits: params.credits,
      enrollmentCode: enrollmentCode,
      facultyId: params.facultyId,
      facultyName: params.facultyName,
      description: params.description,
      enrolledStudentsCount: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const { data: savedClass, error } = await supabase
        .from('classes')
        .insert({
          course_code: newClass.courseCode,
          class_name: newClass.className,
          department: newClass.department,
          enrollment_code: newClass.enrollmentCode,
          teacher_name: newClass.facultyName,
          schedule_info: newClass.scheduleInfo,
          room: newClass.room,
          class_type: newClass.classType,
          credits: newClass.credits,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST205') {
          throw new Error(
            'Supabase database tables are missing. Run supabase/full_setup.sql in the Supabase SQL Editor, then try again.'
          );
        }
        throw new Error(`Failed to save class to Supabase: ${error.message}`);
      }

      newClass.id = savedClass.id;
      newClass.enrollmentCode = savedClass.enrollment_code;
      newClass.createdAt = savedClass.created_at;
    }

    const classes = await this.getClasses();
    classes.unshift(newClass);
    localStorage.setItem(STORAGE_KEY_CLASSES, JSON.stringify(classes));
    this.notify();
    return newClass;
  }

  public async regenerateEnrollmentCode(classId: string): Promise<string> {
    try {
      const res = await api.regenerateEnrollmentCode(classId);
      if (res && res.enrollmentCode) {
        const classes = await this.getClasses();
        const target = classes.find(c => c.id === classId);
        if (target) {
          target.enrollmentCode = res.enrollmentCode;
          localStorage.setItem(STORAGE_KEY_CLASSES, JSON.stringify(classes));
          this.notify();
        }
        return res.enrollmentCode;
      }
    } catch (err) {
      console.warn('API regenerateEnrollmentCode error, using local fallback:', err);
    }

    const classes = await this.getClasses();
    const target = classes.find(c => c.id === classId);
    if (!target) throw new Error('Class not found');

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const cleanPrefix = target.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const newCode = `${cleanPrefix}-${randomSuffix}`;

    target.enrollmentCode = newCode;
    localStorage.setItem(STORAGE_KEY_CLASSES, JSON.stringify(classes));

    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('classes')
          .update({ enrollment_code: newCode })
          .eq('id', classId);
      } catch (err) {
        console.warn('Supabase code update error:', err);
      }
    }

    this.notify();
    return newCode;
  }

  // --- ENROLLED STUDENTS ---
  public async getEnrolledStudents(classId: string): Promise<StudentProfile[]> {
    try {
      const serverStudents = await api.getEnrolledStudents(classId);
      if (serverStudents && Array.isArray(serverStudents) && serverStudents.length > 0) {
        return serverStudents;
      }
    } catch (err) {
      // Fallback to local
    }

    const raw = localStorage.getItem(STORAGE_KEY_STUDENTS);
    const students: StudentProfile[] = raw ? JSON.parse(raw) : INITIAL_STUDENTS;
    return students;
  }

  // --- SESSIONS ---
  public async getActiveSession(facultyId: string): Promise<AttendanceSession | null> {
    try {
      const serverSession = await api.getActiveSession();
      if (serverSession) {
        const allSessions = await this.getAllSessions();
        const existingIdx = allSessions.findIndex(s => s.id === serverSession.id);
        if (existingIdx >= 0) {
          allSessions[existingIdx] = serverSession;
        } else {
          allSessions.unshift(serverSession);
        }
        localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(allSessions));
        return serverSession;
      }
    } catch (err) {
      // fallback to local
    }

    const sessions = await this.getAllSessions();
    const active = sessions.find(s => s.status === 'ACTIVE' || s.status === 'AWAITING_VERIFICATION');
    return active || null;
  }

  public async getAllSessions(): Promise<AttendanceSession[]> {
    const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
    return raw ? JSON.parse(raw) : [];
  }

  public async startSession(classId: string, facultyId: string, facultyName: string): Promise<AttendanceSession> {
    try {
      const serverSession = await api.startSession(classId);
      if (serverSession) {
        const allSessions = await this.getAllSessions();
        allSessions.forEach(s => {
          if (s.status === 'ACTIVE') s.status = 'CLOSED';
        });
        allSessions.unshift(serverSession);
        localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(allSessions));
        this.notify();
        return serverSession;
      }
    } catch (err) {
      console.warn('API startSession error, falling back to local session:', err);
    }

    const targetClass = await this.getClassById(classId);
    if (!targetClass) throw new Error('Class not found');

    // Close any previous active sessions first to prevent conflicts
    const allSessions = await this.getAllSessions();
    allSessions.forEach(s => {
      if (s.status === 'ACTIVE') s.status = 'CLOSED';
    });

    const now = Date.now();
    const token = this.generateTokenString(targetClass.courseCode, 1);
    const todayStr = new Date().toISOString().split('T')[0];

    const newSession: AttendanceSession = {
      id: `sess-${Date.now()}`,
      classId: targetClass.id,
      courseCode: targetClass.courseCode,
      className: targetClass.className,
      room: targetClass.room,
      facultyId,
      facultyName,
      date: todayStr,
      startTime: targetClass.startTime,
      endTime: targetClass.endTime,
      status: 'ACTIVE',
      currentToken: token,
      tokenExpiresAt: now + 25 * 1000, // 25 seconds validity
      tokenRotationCount: 1,
      createdAt: new Date().toISOString(),
    };

    allSessions.unshift(newSession);
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(allSessions));

    // Seed 2 initial pending student submissions for realistic live demonstration
    this.seedDemoSubmissions(newSession.id, targetClass.id);

    this.notify();
    return newSession;
  }

  public async rotateQRToken(sessionId: string): Promise<AttendanceSession | null> {
    try {
      const serverSession = await api.rotateQRToken(sessionId);
      if (serverSession) {
        const sessions = await this.getAllSessions();
        const idx = sessions.findIndex(s => s.id === sessionId);
        if (idx >= 0) {
          sessions[idx] = { ...sessions[idx], ...serverSession };
          localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
        }
        this.notify();
        return sessions[idx] || (serverSession as any);
      }
    } catch (err) {
      console.warn('API rotateQRToken error, falling back to local rotation:', err);
    }

    const sessions = await this.getAllSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session || session.status !== 'ACTIVE') return null;

    const nextCount = session.tokenRotationCount + 1;
    const newToken = this.generateTokenString(session.courseCode, nextCount);

    session.currentToken = newToken;
    session.tokenExpiresAt = Date.now() + 25 * 1000;
    session.tokenRotationCount = nextCount;

    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    this.notify();
    return session;
  }

  public async endSession(sessionId: string): Promise<AttendanceSession | null> {
    try {
      const serverSession = await api.endSession(sessionId);
      if (serverSession) {
        const sessions = await this.getAllSessions();
        const idx = sessions.findIndex(s => s.id === sessionId);
        if (idx >= 0) {
          sessions[idx] = { ...sessions[idx], ...serverSession };
          localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
        }
        this.notify();
        return sessions[idx] || (serverSession as any);
      }
    } catch (err) {
      console.warn('API endSession error, using local fallback:', err);
    }

    const sessions = await this.getAllSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return null;

    // Check if there are still pending submissions
    const records = await this.getSessionRecords(sessionId);
    const hasPending = records.some(r => r.status === 'PENDING');

    session.status = hasPending ? 'AWAITING_VERIFICATION' : 'CLOSED';
    session.closedAt = new Date().toISOString();
    session.tokenExpiresAt = Date.now(); // expired immediately

    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    this.notify();
    return session;
  }

  public async finalizeSession(sessionId: string): Promise<AttendanceSession | null> {
    try {
      const serverSession = await api.finalizeSession(sessionId);
      if (serverSession) {
        const sessions = await this.getAllSessions();
        const idx = sessions.findIndex(s => s.id === sessionId);
        if (idx >= 0) {
          sessions[idx] = { ...sessions[idx], ...serverSession };
          localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
        }
        this.notify();
        return sessions[idx] || (serverSession as any);
      }
    } catch (err) {
      console.warn('API finalizeSession error, using local fallback:', err);
    }

    const sessions = await this.getAllSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return null;

    session.status = 'CLOSED';
    session.closedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    this.notify();
    return session;
  }

  // --- ATTENDANCE RECORDS & VERIFICATION ---
  public async getSessionRecords(sessionId: string): Promise<AttendanceRecord[]> {
    try {
      const serverRecords = await api.getSessionRecords(sessionId);
      if (serverRecords && Array.isArray(serverRecords)) {
        return serverRecords;
      }
    } catch (err) {
      // fallback
    }

    const raw = localStorage.getItem(STORAGE_KEY_RECORDS);
    const records: AttendanceRecord[] = raw ? JSON.parse(raw) : [];
    return records.filter(r => r.sessionId === sessionId);
  }

  public async verifySubmission(
    recordId: string, 
    status: 'PRESENT' | 'REJECTED', 
    facultyId: string, 
    facultyName: string,
    reason?: string
  ): Promise<AttendanceRecord | null> {
    try {
      const updated = await api.verifyAttendance(recordId, {
        status,
        rejectionReason: reason,
      });
      if (updated) {
        const raw = localStorage.getItem(STORAGE_KEY_RECORDS);
        const records: AttendanceRecord[] = raw ? JSON.parse(raw) : [];
        const idx = records.findIndex(r => r.id === recordId);
        if (idx >= 0) {
          records[idx] = { ...records[idx], ...updated };
          localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
        }
        this.notify();
        return updated;
      }
    } catch (err) {
      console.warn('API verifyAttendance error, falling back to local mode:', err);
    }

    const raw = localStorage.getItem(STORAGE_KEY_RECORDS);
    const records: AttendanceRecord[] = raw ? JSON.parse(raw) : [];
    const target = records.find(r => r.id === recordId);
    if (!target) return null;

    target.status = status;
    target.verifiedBy = facultyId;
    target.verifiedByName = facultyName;
    target.verifiedAt = new Date().toISOString();
    if (reason) target.rejectionReason = reason;

    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
    this.notify();
    return target;
  }

  public async submitStudentAttendance(params: {
    sessionId: string;
    classId: string;
    studentId: string;
    tokenScanned: string;
    photoUrl?: string;
  }): Promise<{ success: boolean; message: string; record?: AttendanceRecord }> {
    const sessions = await this.getAllSessions();
    const session = sessions.find(s => s.id === params.sessionId);
    if (!session || session.status === 'CLOSED') {
      return { success: false, message: 'Attendance session is closed or invalid.' };
    }

    if (Date.now() > session.tokenExpiresAt + 5000) { // 5s clock skew grace
      return { success: false, message: 'QR token has expired. Please scan the newly refreshed QR.' };
    }

    const students = await this.getEnrolledStudents(params.classId);
    const student = students.find(s => s.id === params.studentId);
    if (!student) {
      return { success: false, message: 'Student is not enrolled in this class.' };
    }

    // Check duplicate
    const records = await this.getSessionRecords(params.sessionId);
    const existing = records.find(r => r.studentId === params.studentId);
    if (existing) {
      return { success: false, message: 'Attendance already submitted for this session.' };
    }

    const newRecord: AttendanceRecord = {
      id: `rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sessionId: params.sessionId,
      classId: params.classId,
      studentId: student.id,
      studentName: student.fullName,
      studentRollNumber: student.rollNumber,
      studentAvatarUrl: student.avatarUrl,
      verificationPhotoUrl: params.photoUrl || student.avatarUrl,
      submittedAt: new Date().toISOString(),
      status: 'PENDING', // Awaiting faculty visual confirmation
    };

    const allRecords: AttendanceRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY_RECORDS) || '[]');
    allRecords.unshift(newRecord);
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(allRecords));

    this.notify();
    return { success: true, message: 'Attendance submitted for verification!', record: newRecord };
  }

  // Helper: Generates a full roster for a session, computing ABSENT for students who didn't submit
  public async getSessionFullRoster(sessionId: string): Promise<{
    session: AttendanceSession;
    classItem: ClassItem;
    roster: {
      serialNo: number;
      student: StudentProfile;
      status: 'PRESENT' | 'ABSENT' | 'PENDING' | 'REJECTED';
      record?: AttendanceRecord;
    }[];
    metrics: {
      totalEnrolled: number;
      present: number;
      absent: number;
      pending: number;
      rejected: number;
      attendancePercentage: number;
    };
  } | null> {
    const sessions = await this.getAllSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return null;

    const classItem = await this.getClassById(session.classId);
    if (!classItem) return null;

    const enrolledStudents = await this.getEnrolledStudents(session.classId);
    const records = await this.getSessionRecords(sessionId);

    // Map each enrolled student
    const roster = enrolledStudents.map((stud, idx) => {
      const match = records.find(r => r.studentId === stud.id);
      let status: 'PRESENT' | 'ABSENT' | 'PENDING' | 'REJECTED' = 'ABSENT';
      if (match) {
        status = match.status;
      }
      return {
        serialNo: idx + 1,
        student: stud,
        status,
        record: match,
      };
    });

    const present = roster.filter(r => r.status === 'PRESENT').length;
    const pending = roster.filter(r => r.status === 'PENDING').length;
    const rejected = roster.filter(r => r.status === 'REJECTED').length;
    const absent = roster.filter(r => r.status === 'ABSENT').length;
    const totalEnrolled = enrolledStudents.length;
    const attendancePercentage = totalEnrolled > 0 ? Math.round((present / totalEnrolled) * 100) : 0;

    return {
      session,
      classItem,
      roster,
      metrics: {
        totalEnrolled,
        present,
        absent,
        pending,
        rejected,
        attendancePercentage,
      },
    };
  }

  // Simulate an incoming student scan for interactive live testing
  public async triggerSimulatedStudentScan(sessionId: string): Promise<void> {
    const session = (await this.getAllSessions()).find(s => s.id === sessionId);
    if (!session) return;

    const students = await this.getEnrolledStudents(session.classId);
    const records = await this.getSessionRecords(sessionId);
    const unsubmitted = students.filter(s => !records.some(r => r.studentId === s.id));

    if (unsubmitted.length === 0) return;

    const studentToScan = unsubmitted[0];
    // Live camera selfie snapshot simulation
    const liveVerificationSelfie = studentToScan.avatarUrl;

    await this.submitStudentAttendance({
      sessionId,
      classId: session.classId,
      studentId: studentToScan.id,
      tokenScanned: session.currentToken,
      photoUrl: liveVerificationSelfie,
    });
  }

  // --- SEED DEMO SUBMISSIONS ---
  private seedDemoSubmissions(sessionId: string, classId: string) {
    const raw = localStorage.getItem(STORAGE_KEY_RECORDS);
    const existing: AttendanceRecord[] = raw ? JSON.parse(raw) : [];

    // Check if session already has records
    if (existing.some(r => r.sessionId === sessionId)) return;

    // Seed 2 real students who scanned the dynamic QR code:
    // 1. Aryan K. Sharma (needs faculty verification)
    // 2. Ananya Deshmukh (needs faculty verification)
    const newDemoRecords: AttendanceRecord[] = [
      {
        id: `rec-demo-1-${Date.now()}`,
        sessionId,
        classId,
        studentId: 'stud-101',
        studentName: 'Aryan K. Sharma',
        studentRollNumber: '1MS21CS042',
        studentAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
        verificationPhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
        submittedAt: new Date(Date.now() - 45000).toISOString(),
        status: 'PENDING',
      },
      {
        id: `rec-demo-2-${Date.now()}`,
        sessionId,
        classId,
        studentId: 'stud-102',
        studentName: 'Ananya Deshmukh',
        studentRollNumber: '1MS21CS019',
        studentAvatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=300',
        verificationPhotoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=300',
        submittedAt: new Date(Date.now() - 15000).toISOString(),
        status: 'PENDING',
      }
    ];

    existing.unshift(...newDemoRecords);
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(existing));
  }

  private generateTokenString(courseCode: string, sequence: number): string {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ATTEND-${courseCode}-${sequence}-${randomHex}-${Date.now().toString().slice(-4)}`;
  }
}

export const attendanceDataService = new AttendanceDataService();
