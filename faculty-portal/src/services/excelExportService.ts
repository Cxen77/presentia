import ExcelJS from 'exceljs';
import { AttendanceSession, ClassItem, StudentProfile, AttendanceRecord } from '../types';

export interface ExportRosterItem {
  serialNo: number;
  student: StudentProfile;
  status: 'PRESENT' | 'ABSENT' | 'PENDING' | 'REJECTED';
  record?: AttendanceRecord;
}

export const exportSessionAttendanceToExcel = async (params: {
  session: AttendanceSession;
  classItem: ClassItem;
  roster: ExportRosterItem[];
  institutionName?: string;
}) => {
  const { session, classItem, roster, institutionName = 'DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING' } = params;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = session.facultyName;
  workbook.lastModifiedBy = session.facultyName;
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheetName = `${session.courseCode}_${session.date}`.replace(/[:\/\\?*\[\]]/g, '-').slice(0, 31);
  const worksheet = workbook.addWorksheet(sheetName, {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
    views: [{ showGridLines: true }]
  });

  // Set Column Widths
  worksheet.columns = [
    { key: 'colA', width: 8 },   // Sl. No
    { key: 'colB', width: 28 },  // Student Name
    { key: 'colC', width: 18 },  // Roll Number / USN
    { key: 'colD', width: 26 },  // Degree & Semester
    { key: 'colE', width: 16 },  // Attendance Status
    { key: 'colF', width: 20 },  // Verification Time
    { key: 'colG', width: 24 },  // Verified By / Remarks
  ];

  // 1. Institution Header Banner
  const titleRow = worksheet.addRow([institutionName.toUpperCase()]);
  worksheet.mergeCells('A1:G1');
  titleRow.height = 30;
  titleRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
  titleRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF061522' } // Deep Navy Theme
  };

  // 2. Sub-banner: Class Attendance Record
  const subTitleRow = worksheet.addRow(['OFFICIAL CLASS ATTENDANCE REPORT & VERIFICATION LOG']);
  worksheet.mergeCells('A2:G2');
  subTitleRow.height = 24;
  subTitleRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF9AB9EC' } };
  subTitleRow.alignment = { vertical: 'middle', horizontal: 'center' };
  subTitleRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF081B2A' }
  };

  // Blank spacer
  worksheet.addRow([]);

  // 3. Metadata Key-Value Grid
  const metaRows = [
    ['Course / Subject:', `${classItem.className} (${classItem.courseCode})`, '', 'Class Session Date:', session.date],
    ['Department:', classItem.department, '', 'Scheduled Timing:', `${session.startTime} - ${session.endTime}`],
    ['Academic Group:', classItem.semester, '', 'Classroom / Venue:', session.room],
    ['Faculty In-Charge:', session.facultyName, '', 'Generated At:', new Date().toLocaleString()],
    ['Class Type & Credits:', `${classItem.classType} • ${classItem.credits} Credits`, '', 'Session Status:', session.status],
  ];

  metaRows.forEach(rowValues => {
    const row = worksheet.addRow(rowValues);
    row.height = 20;
    
    // Key styling
    row.getCell(1).font = { bold: true, color: { argb: 'FF24374B' } };
    row.getCell(4).font = { bold: true, color: { argb: 'FF24374B' } };
    
    // Value styling
    row.getCell(2).font = { bold: false, color: { argb: 'FF101D2C' } };
    row.getCell(5).font = { bold: false, color: { argb: 'FF101D2C' } };
  });

  // Blank spacer
  worksheet.addRow([]);

  // 4. Attendance Table Column Headers
  const tableHeaderRow = worksheet.addRow([
    'Sl. No',
    'Student Name',
    'USN / Roll Number',
    'Degree & Semester',
    'Attendance Status',
    'Verification Time',
    'Verifier / Remarks'
  ]);
  tableHeaderRow.height = 26;
  tableHeaderRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  tableHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
  tableHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF12283D' } // Main Surface Navy
  };

  // 5. Data Rows
  let presentCount = 0;
  let absentCount = 0;

  roster.forEach((item, index) => {
    const isPresent = item.status === 'PRESENT';
    if (isPresent) presentCount++;
    else absentCount++;

    const formattedTime = item.record?.submittedAt 
      ? new Date(item.record.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : (isPresent ? 'Confirmed' : '—');

    const remarks = item.status === 'PRESENT'
      ? (item.record?.verifiedByName ? `Confirmed by ${item.record.verifiedByName}` : 'Confirmed via Live Verification')
      : item.status === 'REJECTED'
      ? `Rejected: ${item.record?.rejectionReason || 'Visual photo mismatch'}`
      : 'Absent / No submission';

    const row = worksheet.addRow([
      index + 1,
      item.student.fullName,
      item.student.rollNumber,
      `${item.student.degree} (${item.student.semester.split(' ')[0]})`,
      item.status,
      formattedTime,
      remarks
    ]);

    row.height = 22;
    row.alignment = { vertical: 'middle' };
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };

    // Row alternating background
    const isEven = index % 2 === 0;
    const bgArgb = isEven ? 'FFF8FAFC' : 'FFFFFFFF';
    for (let c = 1; c <= 7; c++) {
      row.getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgArgb }
      };
      row.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }

    // Status Column Color Indicator
    if (item.status === 'PRESENT') {
      row.getCell(5).font = { bold: true, color: { argb: 'FF15803D' } }; // Forest Green
      row.getCell(5).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDCFCE7' } // Light green pill
      };
    } else if (item.status === 'ABSENT') {
      row.getCell(5).font = { bold: true, color: { argb: 'FFDC2626' } }; // Red
      row.getCell(5).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEE2E2' } // Light red pill
      };
    } else if (item.status === 'REJECTED') {
      row.getCell(5).font = { bold: true, color: { argb: 'FFB91C1C' } };
      row.getCell(5).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFECACA' }
      };
    } else {
      row.getCell(5).font = { bold: true, color: { argb: 'FFD97706' } };
      row.getCell(5).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEF3C7' }
      };
    }
  });

  // 6. Summary Footer Row
  worksheet.addRow([]);
  const totalEnrolled = roster.length;
  const attendancePercent = totalEnrolled > 0 ? Math.round((presentCount / totalEnrolled) * 100) : 0;

  const summaryRow = worksheet.addRow([
    'TOTAL ENROLLED:',
    `${totalEnrolled} Students`,
    'PRESENT:',
    `${presentCount} (${attendancePercent}%)`,
    'ABSENT:',
    `${absentCount} Students`,
    'OFFICIALLY VERIFIED'
  ]);
  summaryRow.height = 26;
  summaryRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  summaryRow.alignment = { vertical: 'middle', horizontal: 'center' };
  summaryRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF182D43' }
  };

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  // Sanitize filename: CS201_Data_Structures_2026-10-22_Attendance.xlsx
  const safeClassName = classItem.className.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${classItem.courseCode}_${safeClassName}_${session.date}_Attendance.xlsx`;

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
};
