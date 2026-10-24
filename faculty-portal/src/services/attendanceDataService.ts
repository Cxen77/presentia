import * as api from './api';
import type { AttendanceRecord, AttendanceSession, ClassItem, StudentProfile } from '../types';

// All attendance decisions come from the authenticated backend. Never fabricate
// a session, QR, roster or successful verification when a request fails.
class AttendanceDataService {
  private listeners = new Set<() => void>();
  subscribe(callback: () => void) { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; }
  private notify() { this.listeners.forEach(callback => callback()); }
  async getClasses(_facultyId?: string): Promise<ClassItem[]> { return api.getClasses(); }
  async getClassById(id: string) { return (await this.getClasses()).find(item => item.id === id) || null; }
  async createClass(params: Parameters<typeof api.createClass>[0] & { facultyId:string; facultyName:string }): Promise<ClassItem> {
    const created = await api.createClass(params); this.notify(); return created;
  }
  async regenerateEnrollmentCode(id: string): Promise<string> { const result=await api.regenerateEnrollmentCode(id); this.notify(); return result.enrollmentCode; }
  async getEnrolledStudents(id: string,sessionId?:string): Promise<StudentProfile[]> { return api.getEnrolledStudents(id,sessionId); }
  async getActiveSession(_facultyId: string): Promise<AttendanceSession | null> { return api.getActiveSession(); }
  async getAllSessions(): Promise<AttendanceSession[]> { return api.getSessions(); }
  async startSession(classId: string, _facultyId:string, _facultyName:string): Promise<AttendanceSession> { const session=await api.startSession(classId); this.notify(); return session; }
  async rotateQRToken(id: string): Promise<Partial<AttendanceSession>> { return api.rotateQRToken(id); }
  async endSession(id: string) { const session=await api.endSession(id); this.notify(); return session; }
  async finalizeSession(id: string, review: api.BatchReview) { const session=await api.finalizeSession(id,review); this.notify(); return session; }
  async getSessionRecords(id: string): Promise<AttendanceRecord[]> { return api.getSessionRecords(id); }
  async verifySubmission(id:string, status:'PRESENT'|'REJECTED', _facultyId:string, _facultyName:string, reason?:string) {
    const updated=await api.verifyAttendance(id,{status,rejectionReason:reason}); this.notify(); return updated;
  }
  async getSessionFullRoster(id: string) {
    const session=await api.getSession(id);
    if (!session) return null;
    const [classItem, students, records]=await Promise.all([this.getClassById(session.classId),this.getEnrolledStudents(session.classId,session.id),this.getSessionRecords(id)]);
    if (!classItem) return null;
    const roster=students.map((student,index)=>{ const record=records.find(item=>item.studentId===student.id); return {serialNo:index+1,student,status:record?.status === 'REJECTED' ? 'ABSENT' as const : record?.status || 'ABSENT' as const,record}; });
    const count=(status:string)=>roster.filter(item=>item.status===status).length;
    return {session,classItem,roster,metrics:{totalEnrolled:students.length,present:count('PRESENT'),absent:count('ABSENT'),pending:count('PENDING'),rejected:count('REJECTED'),attendancePercentage:students.length?Math.round(count('PRESENT')/students.length*100):0}};
  }
}
export const attendanceDataService = new AttendanceDataService();
