import { StudentProfile, ClassScheduleItem, AttendanceSession } from '../types';

export const initialStudentProfile: StudentProfile = {
  id: 'std_cs24123',
  name: 'Aryan Sharma',
  firstName: 'Aryan',
  degree: 'B.Tech Computer Science',
  rollNumber: 'CS24123',
  semester: '3rd Semester',
  avatarUrl: 'assets/aryan.jpg',
  attendancePercent: 86,
  totalClasses: 12,
  presentToday: 10,
};

export const initialClasses: ClassScheduleItem[] = [
  {
    id: 'class_1',
    subject: 'Data Structures',
    courseCode: 'CS201',
    classType: 'Theory',
    timeSlot: '09:00 AM – 10:00 AM',
    room: 'Room A101',
    iconName: 'monitor',
    isHighlighted: true,
    status: 'Available', // Active class ready to mark attendance
  },
  {
    id: 'class_2',
    subject: 'Database Management',
    courseCode: 'CS203',
    classType: 'Theory',
    timeSlot: '10:15 AM – 11:15 AM',
    room: 'Room A102',
    iconName: 'book',
    isHighlighted: false,
    status: 'Not Started',
  },
  {
    id: 'class_3',
    subject: 'Operating Systems',
    courseCode: 'CS205',
    classType: 'Theory',
    timeSlot: '11:30 AM – 12:30 PM',
    room: 'Room A103',
    iconName: 'users',
    isHighlighted: false,
    status: 'Not Started',
  },
  {
    id: 'class_4',
    subject: 'Computer Networks',
    courseCode: 'CS207',
    classType: 'Theory',
    timeSlot: '02:00 PM – 03:00 PM',
    room: 'Room A104',
    iconName: 'chart',
    isHighlighted: false,
    status: 'Not Started',
  },
];

export const initialFacultySession: AttendanceSession = {
  id: 'sess_ds_today',
  classId: 'class_1',
  courseCode: 'CS201',
  subjectName: 'Data Structures',
  facultyName: 'Prof. R. Sengupta',
  room: 'Room A101',
  sessionToken: 'DS-2026-TOKEN-CS201',
  expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  isActive: true,
  attendeesCount: 42,
};
