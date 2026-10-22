import React, { useState, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  RefreshCw, 
  Users, 
  MapPin, 
  Clock, 
  QrCode, 
  Calendar,
  AlertTriangle,
  GraduationCap
} from 'lucide-react';
import { ClassItem, StudentProfile } from '../types';
import { attendanceDataService } from '../services/attendanceDataService';

interface ClassDetailsModalProps {
  classItem: ClassItem | null;
  onClose: () => void;
  onStartAttendance: (classId: string) => void;
}

export const ClassDetailsModal: React.FC<ClassDetailsModalProps> = ({
  classItem,
  onClose,
  onStartAttendance,
}) => {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [enrollmentCode, setEnrollmentCode] = useState(classItem?.enrollmentCode || '');
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  useEffect(() => {
    if (classItem) {
      setEnrollmentCode(classItem.enrollmentCode);
      const fetchStudents = async () => {
        setLoadingStudents(true);
        const roster = await attendanceDataService.getEnrolledStudents(classItem.id);
        setStudents(roster);
        setLoadingStudents(false);
      };
      fetchStudents();
    }
  }, [classItem]);

  if (!classItem) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(enrollmentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateCode = async () => {
    if (!window.confirm('Are you sure you want to regenerate this class enrollment code? Existing joined students will remain enrolled, but students using the old code will need the new one.')) {
      return;
    }
    setRegenerating(true);
    try {
      const newCode = await attendanceDataService.regenerateEnrollmentCode(classItem.id);
      setEnrollmentCode(newCode);
    } catch (e) {
      alert('Failed to regenerate code');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#081B2A] border border-[#293D53] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-6 border-b border-[#293D53] flex items-start justify-between bg-[#12283D]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-[#182D43] border border-[#293D53] text-[#9AB9EC]">
                {classItem.courseCode}
              </span>
              <span className="text-xs text-[#A8B9D0]">
                {classItem.department} • {classItem.semester}
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#F4F5F7]">{classItem.className}</h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#A8B9D0] hover:text-[#F4F5F7] hover:bg-[#182D43] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Enrollment Code Highlight Box */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-[#12283D] to-[#182D43] border border-[#293D53] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider">
                  Student Enrollment Code
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  Google Classroom Style
                </span>
              </div>
              <p className="text-2xl font-mono font-bold tracking-widest text-[#F4F5F7]">
                {enrollmentCode}
              </p>
              <p className="text-xs text-[#7F94B0]">
                Share this code with students to join this class in the student mobile app.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleCopyCode}
                className="px-4 py-2.5 rounded-lg bg-[#F3F2EF] hover:bg-white text-[#101D2C] font-semibold text-xs transition-all shadow flex items-center gap-2"
              >
                {copied ? <Check size={15} className="text-emerald-700" /> : <Copy size={15} />}
                <span>{copied ? 'Code Copied!' : 'Copy Code'}</span>
              </button>

              <button
                onClick={handleRegenerateCode}
                disabled={regenerating}
                className="p-2.5 rounded-lg bg-[#12283D] hover:bg-[#202D39] border border-[#293D53] text-[#A8B9D0] hover:text-[#F4F5F7] transition-colors"
                title="Regenerate new enrollment code"
              >
                <RefreshCw size={15} className={regenerating ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Class Information Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#12283D] border border-[#293D53]">
            <div>
              <p className="text-[11px] text-[#7F94B0] uppercase font-semibold">Classroom</p>
              <p className="text-xs font-semibold text-[#F4F5F7] mt-0.5 flex items-center gap-1">
                <MapPin size={12} className="text-[#9AB9EC]" />
                {classItem.room}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#7F94B0] uppercase font-semibold">Schedule</p>
              <p className="text-xs font-semibold text-[#F4F5F7] mt-0.5 flex items-center gap-1">
                <Clock size={12} className="text-[#9AB9EC]" />
                {classItem.scheduleInfo}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#7F94B0] uppercase font-semibold">Type & Credits</p>
              <p className="text-xs font-semibold text-[#F4F5F7] mt-0.5">
                {classItem.classType} • {classItem.credits} Credits
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#7F94B0] uppercase font-semibold">Enrolled Students</p>
              <p className="text-xs font-semibold text-[#9AB9EC] mt-0.5 flex items-center gap-1">
                <Users size={12} />
                {students.length} Students
              </p>
            </div>
          </div>

          {classItem.description && (
            <div>
              <h4 className="text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider mb-1.5">
                Course Description
              </h4>
              <p className="text-xs text-[#F4F5F7] bg-[#12283D] p-3 rounded-lg border border-[#293D53] leading-relaxed">
                {classItem.description}
              </p>
            </div>
          )}

          {/* Enrolled Students Roster */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#F4F5F7] flex items-center gap-2">
                <Users size={16} className="text-[#9AB9EC]" />
                <span>Class Enrollment Roster ({students.length})</span>
              </h4>
              <span className="text-xs text-[#7F94B0]">Verified Student Accounts</span>
            </div>

            {loadingStudents ? (
              <div className="py-8 text-center text-xs text-[#A8B9D0]">Loading roster from database...</div>
            ) : students.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-[#12283D] border border-dashed border-[#293D53]">
                <Users size={28} className="mx-auto text-[#7F94B0] mb-2" />
                <p className="text-xs text-[#A8B9D0]">No students have enrolled in this class yet.</p>
                <p className="text-[11px] text-[#7F94B0] mt-1">Share the code {enrollmentCode} with students to join.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-[#293D53] overflow-hidden bg-[#12283D]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#182D43] text-[#A8B9D0] border-b border-[#293D53] uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Student</th>
                      <th className="py-2.5 px-4">Roll No / USN</th>
                      <th className="py-2.5 px-4">Degree & Sem</th>
                      <th className="py-2.5 px-4 text-center">Avg Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#293D53]/60 text-[#F4F5F7]">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-[#182D43]/50 transition-colors">
                        <td className="py-2.5 px-4 flex items-center gap-3">
                          <img
                            src={student.avatarUrl}
                            alt={student.fullName}
                            className="w-7 h-7 rounded-full object-cover border border-[#293D53]"
                          />
                          <div>
                            <p className="font-semibold">{student.fullName}</p>
                            <p className="text-[10px] text-[#7F94B0]">{student.email}</p>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-mono font-medium text-[#9AB9EC]">
                          {student.rollNumber}
                        </td>
                        <td className="py-2.5 px-4 text-[#A8B9D0]">
                          {student.degree}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {student.overallAttendanceRate || 85}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#293D53] bg-[#12283D] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#182D43] hover:bg-[#202D39] border border-[#293D53] text-xs font-semibold text-[#A8B9D0] transition-colors"
          >
            Close
          </button>

          <button
            onClick={() => {
              onClose();
              onStartAttendance(classItem.id);
            }}
            className="px-5 py-2 rounded-lg bg-[#F3F2EF] hover:bg-white text-[#101D2C] text-xs font-bold transition-all shadow flex items-center gap-2"
          >
            <QrCode size={16} />
            <span>Start Live Attendance</span>
          </button>
        </div>
      </div>
    </div>
  );
};
