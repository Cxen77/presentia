import { Router } from 'express';
import ExcelJS from 'exceljs';
import {compareRoster} from '../services/roster';
import { requireAuth, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/reports/session/:sessionId/excel
 * Generates and downloads a formatted .xlsx attendance report.
 * - The session should be CLOSED or AWAITING_VERIFICATION.
 * - Faculty must own the session.
 * - Includes all enrolled students; those without a submission are marked ABSENT.
 */
router.get('/session/:sessionId/excel', requireAuth, requireRole('faculty', 'admin'), async (req, res) => {
  const user = req.user!;
  const { sessionId } = req.params;

  // 1. Load session
  const { data: session } = await supabaseAdmin
    .from('attendance_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (session.faculty_id !== user.profileId && user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized for this session' });
  }

  if (session.status !== 'CLOSED') return res.status(409).json({error:'Confirm the class photo-verification list before downloading the final sheet.'});

  // 2. Load class
  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('*')
    .eq('id', session.class_id)
    .single();

  if (!cls) {
    return res.status(404).json({ error: 'Class not found' });
  }

  // 3. Load enrolled students
  const { data: enrollments, error: enrollmentError } = await supabaseAdmin
    .from('class_enrollments')
    .select(`
      enrolled_at, ended_at, status,
      student:student_id (
        id, full_name, roll_number, class_roll_number, section, email, degree, semester, avatar_url
      )
    `)
    .eq('class_id', session.class_id)
    .lte('enrolled_at',session.created_at)
    .or(`ended_at.is.null,ended_at.gte.${session.created_at}`);
  if (enrollmentError) return res.status(500).json({error:'Could not load the class roster. Please retry.'});

  const students = (enrollments || [])
    .filter((e: any) => e.student)
    .map((e: any) => e.student).sort(compareRoster);

  // 4. Load attendance records for this session
  const { data: records, error: recordError } = await supabaseAdmin
    .from('attendance_records')
    .select('*, verifier:verified_by(full_name)')
    .eq('session_id', sessionId);
  if (recordError) return res.status(500).json({error:'Could not load attendance decisions. Please retry.'});

  const recordMap = new Map((records || []).map((r: any) => [r.student_id, r]));

  // 5. Build roster
  const fullRoster = students.map((stud: any, idx: number) => {
    const rec = recordMap.get(stud.id) as any;
    let finalStatus: 'PRESENT' | 'ABSENT' | 'PENDING' | 'REJECTED' = 'ABSENT';
    if (rec) {
      finalStatus = rec.status === 'REJECTED' ? 'ABSENT' : rec.status;
    }
    return { serialNo: idx + 1, student: stud, status: finalStatus, record: rec || null };
  });

  // ?filter=present|absent limits the sheet to one group; serial numbers are
  // renumbered after filtering so each sheet stands alone.
  const filter = String(req.query.filter || 'all').toLowerCase();
  const roster = filter === 'present'
    ? fullRoster.filter(item => item.status === 'PRESENT').map((item, idx) => ({ ...item, serialNo: idx + 1 }))
    : filter === 'absent'
      ? fullRoster.filter(item => item.status !== 'PRESENT').map((item, idx) => ({ ...item, serialNo: idx + 1 }))
      : fullRoster;
  const filterLabel = filter === 'present' ? 'PRESENT STUDENTS ONLY' : filter === 'absent' ? 'ABSENT STUDENTS ONLY' : 'ALL STUDENTS';

  // 6. Generate Excel
  const workbook = new ExcelJS.Workbook();
  workbook.creator = user.fullName;
  workbook.created = new Date();

  const sheetName = `${cls.course_code}_${session.date}`.replace(/[:\\/\\\\?*\\[\\]]/g, '-').slice(0, 31);
  const worksheet = workbook.addWorksheet(sheetName, {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
  });

  worksheet.columns = [
    { key: 'colA', width: 8 },
    { key: 'colB', width: 28 },
    { key: 'colC', width: 18 },
    { key: 'colD', width: 26 },
    { key: 'colE', width: 16 },
    { key: 'colF', width: 20 },
    { key: 'colG', width: 24 },
  ];

  // Header
  const titleRow = worksheet.addRow([cls.department?.toUpperCase() || 'DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING']);
  worksheet.mergeCells('A1:G1');
  titleRow.height = 30;
  titleRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
  titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF061522' } };

  const subRow = worksheet.addRow([`OFFICIAL CLASS ATTENDANCE REPORT & VERIFICATION LOG — ${filterLabel}`]);
  worksheet.mergeCells('A2:G2');
  subRow.height = 24;
  subRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF9AB9EC' } };
  subRow.alignment = { vertical: 'middle', horizontal: 'center' };
  subRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF081B2A' } };

  worksheet.addRow([]);

  // Metadata
  const metaRows = [
    ['Course / Subject:', `${cls.class_name} (${cls.course_code})`, '', 'Session Date:', session.date],
    ['Department:', cls.department || '', '', 'Timing:', `${session.start_time || ''} - ${session.end_time || ''}`],
    ['Semester:', cls.semester || '', '', 'Classroom:', cls.room || ''],
    ['Faculty:', user.fullName, '', 'Generated At:', new Date().toLocaleString()],
    ['Class Type:', `${cls.class_type || 'Theory'} • ${cls.credits || 4} Credits`, '', 'Session Status:', session.status],
  ];

  metaRows.forEach((rowValues) => {
    const row = worksheet.addRow(rowValues);
    row.height = 20;
    row.getCell(1).font = { bold: true, color: { argb: 'FF24374B' } };
    row.getCell(4).font = { bold: true, color: { argb: 'FF24374B' } };
    row.getCell(2).font = { color: { argb: 'FF101D2C' } };
    row.getCell(5).font = { color: { argb: 'FF101D2C' } };
  });

  worksheet.addRow([]);

  // Table header
  const headerRow = worksheet.addRow([
    'Sl. No', 'Student Name', 'USN / Roll Number', 'Degree / Semester / Section / Roll',
    'Attendance Status', 'Verification Time', 'Verifier / Remarks',
  ]);
  headerRow.height = 26;
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12283D' } };

  // Data rows
  let presentCount = 0;
  let absentCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;

  roster.forEach((item, index) => {
    if (item.status === 'PRESENT') presentCount++;
    else if (item.status === 'PENDING') pendingCount++;
    else if (item.status === 'REJECTED') rejectedCount++;
    else absentCount++;

    const formattedTime = item.record?.verified_at
      ? new Date(item.record.verified_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '—';

    const remarks = item.status === 'PRESENT'
      ? (item.record?.verifier?.full_name ? `Confirmed by ${item.record.verifier.full_name}` : 'Confirmed')
      : item.status === 'REJECTED'
        ? `Rejected: ${item.record?.rejection_reason || 'Photo mismatch'}`
        : item.status === 'PENDING' ? 'Awaiting faculty review' : item.record?.rejection_reason || 'Absent / No submission';

    const row = worksheet.addRow([
      index + 1,
      item.student.full_name,
      item.student.roll_number,
      `${item.student.degree || ''} (${(item.student.semester || '').split(' ')[0]})${item.student.section ? ' · Sec '+item.student.section : ''}${item.student.class_roll_number ? ' · Roll '+item.student.class_roll_number : ''}`,
      item.status,
      formattedTime,
      remarks,
    ]);

    row.height = 22;
    row.alignment = { vertical: 'middle' };
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };

    const bgArgb = index % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
    for (let c = 1; c <= 7; c++) {
      row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      row.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }

    if (item.status === 'PRESENT') {
      row.getCell(5).font = { bold: true, color: { argb: 'FF15803D' } };
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    } else if (item.status === 'REJECTED') {
      row.getCell(5).font = { bold: true, color: { argb: 'FFB91C1C' } };
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
    } else {
      row.getCell(5).font = { bold: true, color: { argb: 'FFDC2626' } };
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    }
  });

  // Summary
  worksheet.addRow([]);
  const totalEnrolled = roster.length;
  const attendancePercent = totalEnrolled > 0 ? Math.round((presentCount / totalEnrolled) * 100) : 0;

  const summaryRow = worksheet.addRow([
    'TOTAL:', `${totalEnrolled} Students`,
    'PRESENT:', `${presentCount} (${attendancePercent}%)`,
    'ABSENT:', `${absentCount} Students`,
    `PENDING: ${pendingCount} · REJECTED: ${rejectedCount}`,
  ]);
  summaryRow.height = 26;
  summaryRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  summaryRow.alignment = { vertical: 'middle', horizontal: 'center' };
  summaryRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF182D43' } };

  // 7. Send the file
  const safeClassName = cls.class_name.replace(/[^a-zA-Z0-9]/g, '_');
  const safeCourseCode = cls.course_code.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filterSuffix = filter === 'present' ? '_Present' : filter === 'absent' ? '_Absent' : '';
  const filename = `${safeCourseCode}_${safeClassName}_${session.date}_Attendance${filterSuffix}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
});

export default router;
