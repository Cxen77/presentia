import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BookOpen,
  CheckCircle2,
  RefreshCw,
  X,
  XCircle,
} from 'lucide-react-native';
import { getMyAttendanceRecords, getMyEnrolledClasses } from '../services/api';
import { useStudentQuery } from '../hooks/useStudentQuery';
import { router } from 'expo-router';
import { StudentClassCard } from './StudentClassCard';
import { classCardStatus } from '../services/attendanceCalendar';
import { getAttendanceAlerts } from '../services/studentCache';
const statusText = (status?: string) =>
  status === 'PRESENT'
    ? 'Confirmed present'
    : status === 'PENDING'
      ? 'Awaiting review'
      : status === 'REJECTED'
        ? 'Rejected'
        : 'Not submitted';
const statusColor = (status?: string) =>
  status === 'PRESENT'
    ? '#82d8ad'
    : status === 'PENDING'
      ? '#e6c77b'
      : status === 'REJECTED'
        ? '#f5a6aa'
        : '#a5b5cc';
function RefreshButton({
  onPress,
  busy,
}: {
  onPress: () => void;
  busy: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Refresh data"
      onPress={onPress}
      disabled={busy}
      style={s.refresh}
    >
      {busy ? (
        <ActivityIndicator size="small" color="#a4bceb" />
      ) : (
        <RefreshCw size={17} color="#a4bceb" />
      )}
    </TouchableOpacity>
  );
}
function QueryMessage({
  error,
  loading,
  updatedAt,
}: {
  error: string | null;
  loading: boolean;
  updatedAt: number | null;
}) {
  return loading ? (
    <ActivityIndicator color="#a4bceb" style={{ marginTop: 24 }} />
  ) : error ? (
    <Text accessibilityRole="alert" style={s.error}>
      {updatedAt ? 'Showing saved data. ' : ''}
      {error}
    </Text>
  ) : updatedAt ? (
    <Text style={s.updated}>
      Updated{' '}
      {new Date(updatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}{' '}
      · refreshes automatically
    </Text>
  ) : null;
}
export function StudentClassesView() {
  const query = useStudentQuery('classes', getMyEnrolledClasses, [], 30000);
  return (
    <ScrollView
      contentContainerStyle={s.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={query.refreshing}
          onRefresh={query.refresh}
          tintColor="#a4bceb"
        />
      }
    >
      <View style={s.headingRow}>
        <View>
          <Text style={s.heading}>My Classes</Text>
          <Text style={s.subtitle}>Your courses, all in one place.</Text>
        </View>
        <RefreshButton onPress={query.refresh} busy={query.refreshing} />
      </View>
      <QueryMessage {...query} />
      {!query.loading && !query.data.length && !query.error && (
        <View style={s.empty}>
          <BookOpen size={25} color="#839ebc" />
          <Text style={s.title}>No classes yet</Text>
          <Text style={s.body}>
            Join a class from Home using your teacher’s code or QR.
          </Text>
        </View>
      )}
      <View style={{ gap: 12, marginTop: 18 }}>
        {query.data.map((item) => (
          <StudentClassCard
            key={item.id}
            item={{ ...item, status: classCardStatus(item) }}
            onPress={() => router.push(`/classes/${item.id}`)}
          />
        ))}
      </View>
    </ScrollView>
  );
}
export function StudentAttendanceView() {
  const query = useStudentQuery('attendance', getMyAttendanceRecords, []);
  const present = query.data.filter((item) => item.status === 'PRESENT').length;
  const pending = query.data.filter((item) => item.status === 'PENDING').length;
  return (
    <ScrollView
      contentContainerStyle={s.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={query.refreshing}
          onRefresh={query.refresh}
          tintColor="#a4bceb"
        />
      }
    >
      <View style={s.headingRow}>
        <View>
          <Text style={s.heading}>Attendance</Text>
          <Text style={s.subtitle}>Your check-ins and faculty decisions.</Text>
        </View>
        <RefreshButton onPress={query.refresh} busy={query.refreshing} />
      </View>
      <QueryMessage {...query} />
      <View style={s.stats}>
        <View style={s.stat}>
          <Text style={s.statNumber}>{present}</Text>
          <Text style={s.body}>Confirmed</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statNumber}>{pending}</Text>
          <Text style={s.body}>Awaiting review</Text>
        </View>
      </View>
      {!query.loading && !query.data.length && !query.error && (
        <View style={s.empty}>
          <CheckCircle2 size={28} color="#839ebc" />
          <Text style={s.title}>Your first check-in starts here</Text>
          <Text style={s.body}>
            Scan your teacher’s attendance QR and send a selfie. Their decision
            appears here.
          </Text>
        </View>
      )}
      <View style={{ gap: 12 }}>
        {query.data.map((item) => (
          <View key={item.id} style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.courseCode}>{item.courseCode}</Text>
              <Text style={[s.status, { color: statusColor(item.status) }]}>
                {statusText(item.status)}
              </Text>
            </View>
            <Text style={s.courseTitle}>{item.className}</Text>
            <Text style={s.body}>
              {item.date} · submitted{' '}
              {new Date(item.submittedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {item.status === 'PENDING' && (
              <Text style={s.note}>
                Your selfie was sent. Your teacher still needs to review it.
              </Text>
            )}
            {item.verifiedAt && (
              <Text style={s.note}>
                Reviewed {new Date(item.verifiedAt).toLocaleString()}
              </Text>
            )}
            {item.rejectionReason && (
              <Text style={s.error}>{item.rejectionReason}</Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
export function AttendanceDecisionNotice() {
  const query = useStudentQuery('attendance', getMyAttendanceRecords, []);
  const previous = useRef<Map<string, string> | null>(null);
  const [notice, setNotice] = useState<{
    course: string;
    status: string;
  } | null>(null);
  useEffect(() => {
    if (!query.updatedAt || query.error) return;
    const current = new Map(query.data.map((item) => [item.id, item.status]));
    const old = previous.current;
    previous.current = current;
    if (!old) return;
    const changed = query.data.find(
      (item) =>
        ['PRESENT', 'REJECTED'].includes(item.status) &&
        old.has(item.id) &&
        old.get(item.id) !== item.status,
    );
    if (changed)
      void getAttendanceAlerts().then((enabled) => {
        if (enabled && AppState.currentState === 'active')
          setNotice({ course: changed.courseCode, status: changed.status });
      });
  }, [query.data, query.updatedAt, query.error]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  const confirmed = notice.status === 'PRESENT';
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={s.toast}
    >
      <View
        style={[
          s.toastIcon,
          { backgroundColor: confirmed ? '#244737' : '#4c3038' },
        ]}
      >
        {confirmed ? (
          <CheckCircle2 size={20} color="#a4dfbf" />
        ) : (
          <XCircle size={20} color="#efb0b9" />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.toastText}>
          {confirmed ? 'Attendance confirmed' : 'Check-in not approved'}
        </Text>
        <Text style={s.toastSubtitle}>
          {notice.course} ·{' '}
          {confirmed
            ? 'Marked present by your teacher'
            : 'Open Attendance to see the reason'}
        </Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Dismiss attendance alert"
        onPress={() => setNotice(null)}
        style={s.toastClose}
      >
        <X size={15} color="#8fa5bc" />
      </TouchableOpacity>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { padding: 22, paddingTop: 25, paddingBottom: 110 },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    fontSize: 25,
    fontWeight: '700',
    color: '#f0f4fc',
    letterSpacing: -0.6,
  },
  subtitle: { fontSize: 12, color: '#8da2bd', marginTop: 5 },
  refresh: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#29405b',
    borderRadius: 12,
  },
  updated: { fontSize: 10, color: '#7f96b2', marginTop: 14 },
  error: { fontSize: 12, color: '#f5a6aa', lineHeight: 18, marginTop: 10 },
  card: {
    backgroundColor: '#112033',
    borderWidth: 1,
    borderColor: '#263c55',
    borderRadius: 18,
    padding: 17,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  courseBadge: {
    backgroundColor: '#20314b',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  courseCode: { color: '#bed1f6', fontSize: 11, fontWeight: '700' },
  type: { fontSize: 10, color: '#8198b6' },
  courseTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    color: '#eef4fd',
    marginBottom: 6,
  },
  faculty: { fontSize: 12, color: '#a1b4cd', marginBottom: 15 },
  meta: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-start',
    marginTop: 7,
  },
  metaText: { color: '#92a9c5', fontSize: 11, lineHeight: 15, flex: 1 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#26394f',
    paddingTop: 12,
    marginTop: 16,
  },
  status: { fontSize: 10, fontWeight: '600' },
  detailsButton: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    padding: 6,
  },
  detailsLabel: { color: '#b5c7e3', fontSize: 11 },
  expanded: { paddingTop: 12, gap: 6 },
  body: { color: '#92a9c5', fontSize: 12, lineHeight: 18 },
  note: { color: '#b1c3db', fontSize: 11, lineHeight: 17, marginTop: 10 },
  scanButton: {
    backgroundColor: '#c0d2f4',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  scanLabel: { color: '#112338', fontSize: 12, fontWeight: '700' },
  empty: {
    padding: 25,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#263c55',
    alignItems: 'center',
    gap: 12,
    marginTop: 25,
  },
  title: { color: '#dce8fa', fontSize: 15, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 18 },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#263c55',
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#112033',
  },
  statNumber: {
    color: '#deebff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  toast: {
    position: 'absolute',
    bottom: 94,
    left: 16,
    right: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#38516a',
    backgroundColor: '#192d40',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  toastIcon: {
    width: 37,
    height: 37,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: { color: '#e5edf9', fontSize: 12, fontWeight: '600' },
  toastSubtitle: {
    color: '#91a9c3',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 3,
  },
  toastClose: { padding: 6 },
});
