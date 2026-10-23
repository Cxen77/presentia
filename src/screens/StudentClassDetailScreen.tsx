import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  QrCode,
} from 'lucide-react-native';
import { getClassCalendar, getMyEnrolledClasses } from '../services/api';
import { useStudentQuery } from '../hooks/useStudentQuery';
import {
  classCardStatus,
  monthCells,
  summarizeDay,
} from '../services/attendanceCalendar';
import { StudentClassCard } from '../components/StudentClassCard';
import { QRScannerModal, studentService, type StudentProfile } from '../../App';
const colors: Record<string, string> = {
  PRESENT: '#89c9a8',
  ABSENT: '#e69ba3',
  PENDING: '#dcc186',
  OPEN: '#9cb9df',
  MIXED: '#bfaff0',
  NONE: '#5d728b',
};
const labels: Record<string, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  PENDING: 'Awaiting review',
  OPEN: 'Not submitted',
  MIXED: 'Multiple outcomes',
  NONE: 'No class session',
};
const dateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
export default function StudentClassDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selected, setSelected] = useState(() => new Date().getDate());
  const [profile, setProfile] = useState<StudentProfile | null>(null),
    [scanner, setScanner] = useState(false),
    [scanError, setScanError] = useState<string | null>(null);
  const classes = useStudentQuery('classes', getMyEnrolledClasses, [], 30000);
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const loadCalendar = useCallback(
    () => getClassCalendar(id, monthKey),
    [id, monthKey],
  );
  const calendar = useStudentQuery(
    `calendar:${id}:${monthKey}`,
    loadCalendar,
    [],
  );
  const item = classes.data.find((c) => c.id === id);
  const selectedKey = dateKey(month.getFullYear(), month.getMonth(), selected);
  const selectedSessions = calendar.data.filter((s) => s.date === selectedKey);
  const present = calendar.data.filter((s) => s.status === 'PRESENT').length,
    absent = calendar.data.filter((s) => s.status === 'ABSENT').length;
  const today = new Date();
  const changeMonth = (delta: number) => {
    setMonth(
      (previous) =>
        new Date(previous.getFullYear(), previous.getMonth() + delta, 1),
    );
    setSelected(1);
  };
  const scan = async () => {
    setScanError(null);
    try {
      const p = await studentService.getProfile();
      if (!p) throw new Error('Complete your student profile first.');
      setProfile(p);
      setScanner(true);
    } catch (error) {
      setScanError(
        error instanceof Error ? error.message : 'Could not open scanner.',
      );
    }
  };
  const refresh = () => {
    void classes.refresh();
    void calendar.refresh();
  };
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.background}>
        <View style={s.viewport}>
          <View style={s.topbar}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Back to classes"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/')
              }
              style={s.back}
            >
              <ArrowLeft size={20} color="#d5e3f7" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>MY CLASS</Text>
              <Text style={s.topTitle}>
                {item?.courseCode || 'Class details'}
              </Text>
            </View>
            <View style={s.miniIcon}>
              <BookOpen size={17} color="#a5bad8" />
            </View>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.content}
            refreshControl={
              <RefreshControl
                refreshing={calendar.refreshing}
                onRefresh={refresh}
                tintColor="#a7c2e8"
              />
            }
          >
            {classes.loading && !item ? (
              <ActivityIndicator color="#a7c2e8" />
            ) : item ? (
              <>
                <StudentClassCard
                  item={{ ...item, status: classCardStatus(item) }}
                />
                <View style={s.classInfo}>
                  <Text style={s.infoText}>
                    {item.teacherName || 'Faculty'} · {item.department}
                  </Text>
                  <Text style={s.infoText}>
                    {item.credits} credits · {item.classType}
                  </Text>
                </View>
              </>
            ) : (
              <Text accessibilityRole="alert" style={s.error}>
                {classes.error ||
                  'This class is unavailable or you are not enrolled.'}
              </Text>
            )}
            {item && (
              <>
                <View style={s.sectionHeading}>
                  <View>
                    <Text style={s.sectionTitle}>Attendance calendar</Text>
                    <Text style={s.subtitle}>Your month, at a glance.</Text>
                  </View>
                  <View style={s.percent}>
                    <Text style={s.percentText}>
                      {present + absent
                        ? Math.round((present / (present + absent)) * 100) + '%'
                        : '—'}
                    </Text>
                  </View>
                </View>
                <View style={s.calendar}>
                  <View style={s.monthBar}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Previous month"
                      onPress={() => changeMonth(-1)}
                      style={s.monthArrow}
                    >
                      <ChevronLeft size={18} color="#b4c8e5" />
                    </TouchableOpacity>
                    <Text style={s.monthTitle}>
                      {month.toLocaleDateString(undefined, {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Next month"
                      onPress={() => changeMonth(1)}
                      style={s.monthArrow}
                    >
                      <ChevronRight size={18} color="#b4c8e5" />
                    </TouchableOpacity>
                  </View>
                  <View style={s.weekRow}>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                      <Text key={i} style={s.weekday}>
                        {day}
                      </Text>
                    ))}
                  </View>
                  <View style={s.days}>
                    {monthCells(month.getFullYear(), month.getMonth()).map(
                      (day, index) => {
                        const sessions = day
                          ? calendar.data.filter(
                              (entry) =>
                                entry.date ===
                                dateKey(
                                  month.getFullYear(),
                                  month.getMonth(),
                                  day,
                                ),
                            )
                          : [];
                        const status = summarizeDay(sessions);
                        const isToday =
                          day === today.getDate() &&
                          month.getMonth() === today.getMonth() &&
                          month.getFullYear() === today.getFullYear();
                        return (
                          <View key={index} style={s.dayCell}>
                            {day !== null && (
                              <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel={`${dateKey(month.getFullYear(), month.getMonth(), day)}, ${labels[status]}`}
                                accessibilityState={{
                                  selected: selected === day,
                                }}
                                onPress={() => setSelected(day)}
                                style={[
                                  s.day,
                                  isToday && s.today,
                                  selected === day && s.selected,
                                  status !== 'NONE' && {
                                    backgroundColor: colors[status] + '20',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    s.dayNumber,
                                    status !== 'NONE' && {
                                      color: colors[status],
                                    },
                                    selected === day && { fontWeight: '700' },
                                  ]}
                                >
                                  {day}
                                </Text>
                                <View
                                  style={[
                                    s.dayDot,
                                    {
                                      backgroundColor:
                                        status === 'NONE'
                                          ? 'transparent'
                                          : colors[status],
                                    },
                                  ]}
                                />
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      },
                    )}
                  </View>
                  <View style={s.legend}>
                    {[
                      ['PRESENT', 'Present'],
                      ['ABSENT', 'Absent'],
                      ['PENDING', 'Pending'],
                    ].map(([status, label]) => (
                      <View key={status} style={s.legendItem}>
                        <View
                          style={[
                            s.legendDot,
                            { backgroundColor: colors[status] },
                          ]}
                        />
                        <Text style={s.legendText}>{label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                {calendar.error && (
                  <Text accessibilityRole="alert" style={s.error}>
                    {calendar.updatedAt ? 'Saved calendar · ' : ''}
                    {calendar.error}
                  </Text>
                )}
                <View style={s.summary}>
                  <View style={s.summaryItem}>
                    <Text style={[s.summaryNumber, { color: colors.PRESENT }]}>
                      {present}
                    </Text>
                    <Text style={s.summaryLabel}>Present</Text>
                  </View>
                  <View style={s.summaryDivider} />
                  <View style={s.summaryItem}>
                    <Text style={[s.summaryNumber, { color: colors.ABSENT }]}>
                      {absent}
                    </Text>
                    <Text style={s.summaryLabel}>Absent</Text>
                  </View>
                  <View style={s.summaryDivider} />
                  <View style={s.summaryItem}>
                    <Text style={s.summaryNumber}>
                      {
                        calendar.data.filter((e) => e.status === 'PENDING')
                          .length
                      }
                    </Text>
                    <Text style={s.summaryLabel}>To review</Text>
                  </View>
                </View>
                <View style={s.dayDetail}>
                  <Text style={s.detailDate}>
                    {new Date(
                      month.getFullYear(),
                      month.getMonth(),
                      selected,
                    ).toLocaleDateString(undefined, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                  {calendar.loading ? (
                    <ActivityIndicator color="#a7c2e8" />
                  ) : selectedSessions.length ? (
                    selectedSessions.map((session) => (
                      <View key={session.sessionId} style={s.session}>
                        <View style={s.sessionHeader}>
                          <View style={s.sessionTime}>
                            <Clock size={12} color="#93a9c7" />
                            <Text style={s.sessionTimeText}>
                              {session.startTime || 'Class session'}
                              {session.endTime ? ' – ' + session.endTime : ''}
                            </Text>
                          </View>
                          <Text
                            style={[
                              s.sessionStatus,
                              { color: colors[session.status] },
                            ]}
                          >
                            {labels[session.status]}
                          </Text>
                        </View>
                        {session.reason && (
                          <Text style={s.reason}>{session.reason}</Text>
                        )}
                      </View>
                    ))
                  ) : (
                    <Text style={s.empty}>
                      No class session recorded for this day.
                    </Text>
                  )}
                </View>
                <Text style={s.footnote}>
                  Only held sessions count. Pending reviews and days without a
                  session are excluded from the percentage.
                </Text>
                {item.sessionStatus === 'ACTIVE' && !item.attendanceStatus && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => void scan()}
                    style={s.scan}
                  >
                    <QrCode size={17} color="#102438" />
                    <Text style={s.scanText}>Scan attendance QR</Text>
                  </TouchableOpacity>
                )}
                {scanError && (
                  <Text accessibilityRole="alert" style={s.error}>
                    {scanError}
                  </Text>
                )}
              </>
            )}
          </ScrollView>
          {profile && (
            <QRScannerModal
              visible={scanner}
              studentProfileId={profile.id}
              profileAvatarUri={profile.avatarUrl}
              onClose={() => setScanner(false)}
              onClassEnrolled={() => {
                setScanner(false);
                refresh();
              }}
            />
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#040d16', alignItems: 'center' },
  viewport: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#061522',
  },
  topbar: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#13283d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 8,
    color: '#768fae',
    letterSpacing: 1.8,
    fontWeight: '700',
  },
  topTitle: { fontSize: 15, color: '#e4edfb', fontWeight: '600', marginTop: 3 },
  miniIcon: {
    width: 33,
    height: 33,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#274059',
  },
  content: { padding: 22, paddingTop: 4, paddingBottom: 40 },
  classInfo: { padding: 4, gap: 5, marginTop: 12 },
  infoText: { fontSize: 11, color: '#8ea5c2', lineHeight: 17 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 27,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5edfa',
    letterSpacing: -0.4,
  },
  subtitle: { fontSize: 11, color: '#7e97b6', marginTop: 4 },
  percent: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#29475a',
    borderRadius: 12,
    backgroundColor: '#112d35',
  },
  percentText: { color: '#98cdb5', fontSize: 13, fontWeight: '600' },
  calendar: {
    backgroundColor: '#102235',
    borderWidth: 1,
    borderColor: '#253d55',
    borderRadius: 21,
    padding: 15,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 17,
  },
  monthArrow: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#1a3048',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: { color: '#dbe7f8', fontSize: 14, fontWeight: '600' },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekday: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '600',
    color: '#6f87a5',
  },
  days: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: '89%',
    height: '89%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  today: { borderColor: '#436480' },
  selected: { borderColor: '#9db5d5' },
  dayNumber: { fontSize: 12, color: '#9fb1cb' },
  dayDot: { width: 3, height: 3, borderRadius: 2, marginTop: 4 },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingTop: 15,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#22394f',
  },
  legendItem: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  legendDot: { width: 5, height: 5, borderRadius: 3 },
  legendText: { fontSize: 9, color: '#8fa6c4' },
  summary: {
    flexDirection: 'row',
    paddingVertical: 17,
    marginTop: 12,
    alignItems: 'center',
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryNumber: { fontSize: 21, fontWeight: '600', color: '#d9c38e' },
  summaryLabel: { fontSize: 10, color: '#7f98b6' },
  summaryDivider: { width: 1, height: 26, backgroundColor: '#263d54' },
  dayDetail: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#102235',
    borderWidth: 1,
    borderColor: '#263c54',
  },
  detailDate: {
    fontSize: 12,
    color: '#bed0e9',
    fontWeight: '600',
    marginBottom: 10,
  },
  session: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#243b52',
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sessionTime: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  sessionTimeText: { fontSize: 10, color: '#91a8c5', flexShrink: 1 },
  sessionStatus: { fontSize: 10, fontWeight: '600' },
  reason: { fontSize: 11, color: '#cf9ea7', lineHeight: 17, marginTop: 9 },
  empty: { fontSize: 11, color: '#7991af', lineHeight: 18 },
  footnote: { fontSize: 9, lineHeight: 15, color: '#657f9e', marginTop: 13 },
  scan: {
    backgroundColor: '#bfd1eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    padding: 14,
    borderRadius: 13,
    marginTop: 20,
  },
  scanText: { fontSize: 12, fontWeight: '700', color: '#102438' },
  error: { fontSize: 12, color: '#efadb3', lineHeight: 19, marginTop: 12 },
});
