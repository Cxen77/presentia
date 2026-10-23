import type { CalendarSession } from './api';
export function summarizeDay(sessions: CalendarSession[]) {
  if (!sessions.length) return 'NONE';
  const statuses = new Set(sessions.map((s) => s.status));
  return statuses.size === 1 ? sessions[0].status : 'MIXED';
}
export function monthCells(year: number, month: number) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((offset + count) / 7) * 7;
  return Array.from({ length: total }, (_, i) =>
    i >= offset && i < offset + count ? i - offset + 1 : null,
  );
}
export function classCardStatus(item: {
  attendanceStatus?: string;
  sessionStatus?: string;
}) {
  return item.attendanceStatus === 'PRESENT'
    ? 'Present'
    : item.attendanceStatus === 'PENDING'
      ? 'Pending'
      : item.attendanceStatus === 'REJECTED'
        ? 'Rejected'
        : item.sessionStatus === 'ACTIVE'
          ? 'Available'
          : 'Not Started';
}
