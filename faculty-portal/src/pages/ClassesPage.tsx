import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Search, 
  PlusCircle, 
  Users, 
  MapPin, 
  Clock, 
  QrCode, 
  Copy, 
  Check, 
  Filter,
  GraduationCap,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { attendanceDataService } from '../services/attendanceDataService';
import { ClassItem } from '../types';
import { ClassDetailsModal } from './ClassDetailsModal';

export const ClassesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [selectedClassForModal, setSelectedClassForModal] = useState<ClassItem | null>(null);

  const loadClasses = async () => {
    if (!user) return;
    const list = await attendanceDataService.getClasses(user.id);
    setClasses(list);
  };

  useEffect(() => {
    loadClasses();
    const unsubscribe = attendanceDataService.subscribe(() => {
      loadClasses();
    });
    return () => unsubscribe();
  }, [user]);

  const handleCopyCode = (e: React.MouseEvent, classItem: ClassItem) => {
    e.stopPropagation();
    navigator.clipboard.writeText(classItem.enrollmentCode);
    setCopiedCodeId(classItem.id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleStartAttendance = async (classId: string) => {
    if (!user) return;
    await attendanceDataService.startSession(classId, user.id, user.name);
    navigate('/live-attendance');
  };

  const filteredClasses = classes.filter((c) => {
    const matchesSearch = 
      c.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.enrollmentCode.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedType === 'ALL' || c.classType.toUpperCase() === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#293D53]/60">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F5F7] tracking-tight">Assigned Classes</h1>
          <p className="text-sm text-[#A8B9D0] mt-1">
            View course rosters, share Google Classroom-style enrollment codes, and initiate attendance sessions.
          </p>
        </div>

        <Link
          to="/create-class"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#F3F2EF] hover:bg-white text-[#101D2C] text-sm font-semibold transition-all shadow-md"
        >
          <PlusCircle size={17} />
          <span>Create New Class</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7F94B0]" />
          <input
            type="text"
            placeholder="Search by class name, course code (CS201), or enrollment code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-[#12283D] border border-[#293D53] text-sm text-[#F4F5F7] placeholder-[#7F94B0] focus:outline-none focus:border-[#9AB9EC] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'THEORY', 'PRACTICAL'].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                selectedType === type
                  ? 'bg-[#182D43] border-[#9AB9EC] text-[#9AB9EC] shadow-sm'
                  : 'bg-[#12283D] border-[#293D53] text-[#A8B9D0] hover:text-[#F4F5F7]'
              }`}
            >
              {type === 'ALL' ? 'All Types' : type.charAt(0) + type.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Classes Grid */}
      {filteredClasses.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#081B2A] border border-dashed border-[#293D53]">
          <BookOpen size={36} className="mx-auto text-[#7F94B0] mb-3" />
          <h3 className="text-base font-semibold text-[#F4F5F7]">No classes found</h3>
          <p className="text-xs text-[#A8B9D0] mt-1 max-w-sm mx-auto">
            {searchQuery ? 'Try adjusting your search query or filter.' : 'You have not created any classes yet. Click Create New Class to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredClasses.map((cls) => (
            <div
              key={cls.id}
              onClick={() => setSelectedClassForModal(cls)}
              className="group bg-[#12283D] hover:bg-[#182D43] border border-[#293D53] hover:border-[#9AB9EC]/50 rounded-2xl p-6 transition-all duration-200 cursor-pointer shadow-sm relative flex flex-col justify-between"
            >
              <div>
                {/* Top Badge Row */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-[#182D43] border border-[#293D53] text-[#9AB9EC] group-hover:border-[#9AB9EC]/40">
                      {cls.courseCode}
                    </span>
                    <span className="text-xs text-[#A8B9D0]">
                      {cls.classType} • {cls.credits} Credits
                    </span>
                  </div>

                  <span className="text-[11px] text-[#7F94B0] font-medium">
                    {cls.semester}
                  </span>
                </div>

                {/* Class Title */}
                <h3 className="text-lg font-bold text-[#F4F5F7] tracking-tight group-hover:text-white transition-colors">
                  {cls.className}
                </h3>
                <p className="text-xs text-[#A8B9D0] mt-1 line-clamp-1">
                  {cls.department}
                </p>

                {/* Meta details */}
                <div className="mt-4 pt-4 border-t border-[#293D53]/60 grid grid-cols-2 gap-3 text-xs text-[#A8B9D0]">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-[#9AB9EC] flex-shrink-0" />
                    <span className="truncate">{cls.scheduleInfo}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-[#9AB9EC] flex-shrink-0" />
                    <span className="truncate">{cls.room}</span>
                  </div>
                </div>

                {/* Enrollment Code Box */}
                <div className="mt-4 p-3 rounded-xl bg-[#081B2A] border border-[#293D53] flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-[#7F94B0] uppercase font-semibold">Class Enrollment Code</p>
                    <p className="text-sm font-mono font-bold tracking-wider text-[#9AB9EC]">
                      {cls.enrollmentCode}
                    </p>
                  </div>

                  <button
                    onClick={(e) => handleCopyCode(e, cls)}
                    className="p-2 rounded-lg bg-[#12283D] hover:bg-[#182D43] border border-[#293D53] text-[#A8B9D0] hover:text-[#F4F5F7] transition-all flex items-center gap-1.5 text-xs font-semibold"
                    title="Copy enrollment code"
                  >
                    {copiedCodeId === cls.id ? (
                      <>
                        <Check size={14} className="text-emerald-400" />
                        <span className="text-emerald-400 text-[11px]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span className="text-[11px]">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-5 pt-4 border-t border-[#293D53]/60 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-[#A8B9D0]">
                  <Users size={14} className="text-[#9AB9EC]" />
                  <span><strong>{cls.enrolledStudentsCount || 8}</strong> Enrolled Students</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartAttendance(cls.id);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#F3F2EF] hover:bg-white text-[#101D2C] text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <QrCode size={13} />
                    <span>Start Attendance</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Class Details & Roster Modal */}
      {selectedClassForModal && (
        <ClassDetailsModal
          classItem={selectedClassForModal}
          onClose={() => setSelectedClassForModal(null)}
          onStartAttendance={(classId) => handleStartAttendance(classId)}
        />
      )}
    </div>
  );
};
