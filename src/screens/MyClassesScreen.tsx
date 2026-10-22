import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { BookOpen, Clock, MapPin, User, ChevronRight } from 'lucide-react-native';
import { AppBackground } from '../components/AppBackground';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { initialClasses } from '../services/mockData';

export const MyClassesScreen: React.FC = () => {
  const [selectedDay, setSelectedDay] = useState('Thu');
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  return (
    <AppBackground variant="dashboard">
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>My Classes</Text>
          <Text style={styles.subtitle}>Fall 2026 • 3rd Semester Timetable</Text>
        </View>

        {/* Day Selector Pills */}
        <View style={styles.daySelector}>
          {days.map((day) => {
            const isSelected = selectedDay === day;
            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayPill, isSelected && styles.dayPillActive]}
                onPress={() => setSelectedDay(day)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Schedule List */}
        <View style={styles.classList}>
          {initialClasses.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.subject}>{item.subject}</Text>
                  <Text style={styles.code}>{item.courseCode} • 4 Credits</Text>
                </View>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{item.classType}</Text>
                </View>
              </View>

              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <Clock size={13} color="#8EA5C2" strokeWidth={2} style={{ marginRight: 4 }} />
                  <Text style={styles.metaText}>{item.timeSlot}</Text>
                </View>
                <View style={styles.metaItem}>
                  <MapPin size={13} color="#8EA5C2" strokeWidth={2} style={{ marginRight: 4 }} />
                  <Text style={styles.metaText}>{item.room}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    ...Typography.headlineMedium,
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  daySelector: {
    flexDirection: 'row',
    backgroundColor: '#0F2338',
    borderRadius: 20,
    padding: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1B3654',
  },
  dayPill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 14,
  },
  dayPillActive: {
    backgroundColor: Colors.buttonPrimaryBg,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8EA5C2',
  },
  dayTextActive: {
    color: Colors.buttonPrimaryText,
    fontWeight: '700',
  },
  classList: {
    gap: 12,
  },
  card: {
    backgroundColor: Colors.cardCharcoal,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#263748',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  subject: {
    ...Typography.titleSmall,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  code: {
    fontSize: 13,
    color: '#8EA5C2',
    marginTop: 2,
  },
  typeBadge: {
    backgroundColor: '#162C42',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  typeBadgeText: {
    fontSize: 11,
    color: '#9AB9EC',
    fontWeight: '600',
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#8EA5C2',
  },
});
