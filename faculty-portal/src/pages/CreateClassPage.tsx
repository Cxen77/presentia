import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlusCircle, 
  BookOpen, 
  Clock, 
  MapPin, 
  Sparkles, 
  AlertCircle, 
  Check, 
  ArrowLeft,
  Building,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { attendanceDataService } from '../services/attendanceDataService';

export const CreateClassPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    courseCode: 'CS209',
    className: 'Cloud Computing & Microservices Architecture',
    department: 'Computer Science & Engineering',
    semester: '4th Semester - Section A',
    room: 'Lab 2A • Room 305',
    days: 'Tue, Thu',
    startTime: '10:00 AM',
    endTime: '11:30 AM',
    classType: 'Theory' as 'Theory' | 'Practical' | 'Seminar',
    credits: 4,
    description: 'Comprehensive study of distributed cloud infrastructure, microservices design patterns, Kubernetes orchestration, and serverless compute.',
  });

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Computed preview of enrollment code
  const cleanCode = formData.courseCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const previewCode = `${cleanCode || 'CODE'}-XXXX`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.courseCode.trim()) {
      setError('Course code is required (e.g., CS201).');
      return;
    }
    if (!formData.className.trim()) {
      setError('Class / Subject name is required.');
      return;
    }
    if (!formData.room.trim()) {
      setError('Classroom or laboratory room number is required.');
      return;
    }

    // Time validation
    if (formData.startTime === formData.endTime) {
      setError('Class end time must be later than the start time.');
      return;
    }

    setSubmitting(true);
    try {
      await attendanceDataService.createClass({
        courseCode: formData.courseCode,
        className: formData.className,
        department: formData.department,
        semester: formData.semester,
        room: formData.room,
        startTime: formData.startTime,
        endTime: formData.endTime,
        classType: formData.classType,
        credits: Number(formData.credits),
        description: formData.description,
        facultyId: user?.id || 'fac-sengupta-01',
        facultyName: user?.name || 'Prof. R. Sengupta',
      });

      navigate('/classes');
    } catch (err: any) {
      setError(err.message || 'Failed to create class in Supabase');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button and page title */}
      <div>
        <button
          onClick={() => navigate('/classes')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9AB9EC] hover:text-[#B4CBF5] mb-2"
        >
          <ArrowLeft size={14} />
          <span>Back to Classes</span>
        </button>
        <h1 className="text-2xl font-bold text-[#F4F5F7] tracking-tight">Create New Class</h1>
        <p className="text-sm text-[#A8B9D0] mt-1">
          Configure a course cohort, establish scheduling metadata, and automatically generate a student enrollment code.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-200">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Course Core Details Box */}
        <div className="bg-[#12283D] border border-[#293D53] rounded-2xl p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#293D53]/60 pb-3">
            <BookOpen size={18} className="text-[#9AB9EC]" />
            <h2 className="text-sm font-bold text-[#F4F5F7] uppercase tracking-wider">
              Course Information
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider mb-2">
                Course Code <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.courseCode}
                onChange={(e) => setFormData({ ...formData, courseCode: e.target.value.toUpperCase() })}
                placeholder="e.g. CS201"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#081B2A] border border-[#293D53] text-sm text-[#F4F5F7] font-mono focus:outline-none focus:border-[#9AB9EC]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider mb-2">
                Class / Subject Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.className}
                onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                placeholder="e.g. Data Structures & Algorithms"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#081B2A] border border-[#293D53] text-sm text-[#F4F5F7] focus:outline-none focus:border-[#9AB9EC]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider mb-2">
                Department / Program <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g. Computer Science & Engineering"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#081B2A] border border-[#293D53] text-sm text-[#F4F5F7] focus:outline-none focus:border-[#9AB9EC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider mb-2">
                Semester / Academic Group <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                placeholder="e.g. 3rd Semester - Section A"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#081B2A] border border-[#293D53] text-sm text-[#F4F5F7] focus:outline-none focus:border-[#9AB9EC]"
              />
            </div>
          </div>
        </div>

        {/* Schedule & Location Box */}
        <div className="bg-[#12283D] border border-[#293D53] rounded-2xl p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#293D53]/60 pb-3">
            <Clock size={18} className="text-[#9AB9EC]" />
            <h2 className="text-sm font-bold text-[#F4F5F7] uppercase tracking-wider">
              Schedule & Venue
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider mb-2">
                Room / Venue <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                placeholder="e.g. Lab 3B • Room 402"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#081B2A] border border-[#293D53] text-sm text-[#F4F5F7] focus:outline-none focus:border-[#9AB9EC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider mb-2">
                Start Time <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                placeholder="10:00 AM"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#081B2A] border border-[#293D53] text-sm text-[#F4F5F7] focus:outline-none focus:border-[#9AB9EC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider mb-2">
                End Time <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                placeholder="11:30 AM"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#081B2A] border border-[#293D53] text-sm text-[#F4F5F7] focus:outline-none focus:border-[#9AB9EC]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider mb-2">
                Class Type
              </label>
              <select
                value={formData.classType}
                onChange={(e) => setFormData({ ...formData, classType: e.target.value as any })}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#081B2A] border border-[#293D53] text-sm text-[#F4F5F7] focus:outline-none focus:border-[#9AB9EC]"
              >
                <option value="Theory">Theory Lecture</option>
                <option value="Practical">Practical Laboratory</option>
                <option value="Seminar">Seminar / Tutorial</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider mb-2">
                Academic Credits
              </label>
              <input
                type="number"
                min={1}
                max={8}
                value={formData.credits}
                onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 4 })}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#081B2A] border border-[#293D53] text-sm text-[#F4F5F7] focus:outline-none focus:border-[#9AB9EC]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider mb-2">
              Class Description (Optional)
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Outline course objectives, prerequisites, or syllabus..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#081B2A] border border-[#293D53] text-sm text-[#F4F5F7] focus:outline-none focus:border-[#9AB9EC]"
            />
          </div>
        </div>

        {/* Enrollment Code Preview Box */}
        <div className="p-5 rounded-2xl bg-[#081B2A] border border-[#293D53] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#9AB9EC]" />
              Unique Student Enrollment Code Preview
            </span>
            <p className="text-xl font-mono font-bold tracking-widest text-[#9AB9EC] mt-1">
              {previewCode}
            </p>
            <p className="text-xs text-[#7F94B0] mt-0.5">
              A 4-digit unique numeric security suffix will be assigned upon creation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/classes')}
              className="px-4 py-2.5 rounded-lg bg-[#182D43] hover:bg-[#202D39] border border-[#293D53] text-xs font-semibold text-[#A8B9D0] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-lg bg-[#F3F2EF] hover:bg-white text-[#101D2C] text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <span>Registering Class...</span>
              ) : (
                <>
                  <Check size={16} />
                  <span>Create Class & Save</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
