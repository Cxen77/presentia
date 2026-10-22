import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  Monitor,
  BookOpen,
  Users,
  BarChart3,
  Clock,
  MapPin,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react-native';
import { ClassScheduleItem } from '../types';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface ClassCardProps {
  item: ClassScheduleItem;
  onPressAction?: () => void;
  onPressCard?: () => void;
}

export const ClassCard: React.FC<ClassCardProps> = ({
  item,
  onPressAction,
  onPressCard,
}) => {
  const isDataStructures = item.isHighlighted;

  const renderIcon = () => {
    const size = 26;
    const color = '#FFFFFF';
    const strokeWidth = 2;

    switch (item.iconName) {
      case 'monitor':
        return <Monitor size={size} color={color} strokeWidth={strokeWidth} />;
      case 'book':
        return <BookOpen size={size} color={color} strokeWidth={strokeWidth} />;
      case 'users':
        return <Users size={size} color={color} strokeWidth={strokeWidth} />;
      case 'chart':
        return <BarChart3 size={size} color={color} strokeWidth={strokeWidth} />;
      default:
        return <BookOpen size={size} color={color} strokeWidth={strokeWidth} />;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPressCard}
      style={[
        styles.card,
        isDataStructures ? styles.highlightedCard : styles.charcoalCard,
      ]}
    >
      {/* Subtle curved background overlay on highlighted Data Structures card */}
      {isDataStructures && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 350 120" preserveAspectRatio="none">
            <Path
              d="M0 40 C60 10, 120 70, 180 50 C240 30, 290 80, 350 60 L350 120 L0 120 Z"
              fill="#26476B"
              fillOpacity={0.4}
            />
          </Svg>
        </View>
      )}

      {/* Left Icon Tile */}
      <View
        style={[
          styles.iconTile,
          isDataStructures ? styles.highlightedIconTile : styles.charcoalIconTile,
        ]}
      >
        {renderIcon()}
      </View>

      {/* Middle Class Details */}
      <View style={styles.detailsColumn}>
        <Text style={styles.subjectText} numberOfLines={1}>
          {item.subject}
        </Text>
        <Text style={styles.courseMetaText}>
          {item.courseCode}  •  {item.classType}
        </Text>

        <View style={styles.metaRow}>
          <Clock size={13} color={Colors.textMuted} strokeWidth={2} style={styles.metaIcon} />
          <Text style={styles.metaText}>{item.timeSlot}</Text>

          <MapPin size={13} color={Colors.textMuted} strokeWidth={2} style={[styles.metaIcon, { marginLeft: 8 }]} />
          <Text style={styles.metaText}>{item.room}</Text>
        </View>
      </View>

      {/* Right Action / Status Badge */}
      <View style={styles.actionColumn}>
        {item.status === 'Available' ? (
          <TouchableOpacity
            style={styles.markAttendanceButton}
            onPress={onPressAction}
            activeOpacity={0.85}
          >
            <Text style={styles.markAttendanceText}>Mark Attendance</Text>
          </TouchableOpacity>
        ) : item.status === 'Present' ? (
          <View style={styles.presentBadge}>
            <CheckCircle2 size={13} color={Colors.badgePresentText} strokeWidth={2.4} style={{ marginRight: 4 }} />
            <Text style={styles.presentText}>Present</Text>
          </View>
        ) : (
          <View style={styles.notStartedBadge}>
            <Text style={styles.notStartedText}>Not Started</Text>
          </View>
        )}

        <ChevronRight size={18} color="#8EA5C2" strokeWidth={2.2} style={styles.chevron} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  highlightedCard: {
    backgroundColor: Colors.cardDataStructures,
    borderWidth: 1,
    borderColor: '#2E5077',
  },
  charcoalCard: {
    backgroundColor: Colors.cardCharcoal,
    borderWidth: 1,
    borderColor: '#283846',
  },
  iconTile: {
    width: 58,
    height: 58,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  highlightedIconTile: {
    backgroundColor: Colors.cardIconSlate,
    borderWidth: 1,
    borderColor: '#3D628B',
  },
  charcoalIconTile: {
    backgroundColor: Colors.cardIconCharcoal,
    borderWidth: 1,
    borderColor: '#354859',
  },
  detailsColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  subjectText: {
    ...Typography.titleMedium,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  courseMetaText: {
    ...Typography.bodySmall,
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  metaIcon: {
    marginRight: 4,
  },
  metaText: {
    ...Typography.bodySmall,
    fontSize: 11,
    color: Colors.textMuted,
  },
  actionColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  markAttendanceButton: {
    backgroundColor: Colors.buttonPrimaryBg,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  markAttendanceText: {
    ...Typography.badge,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.buttonPrimaryText,
  },
  notStartedBadge: {
    backgroundColor: Colors.badgeNotStartedBg,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  notStartedText: {
    ...Typography.badge,
    fontSize: 12,
    color: Colors.badgeNotStartedText,
  },
  presentBadge: {
    backgroundColor: Colors.badgePresentBg,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  presentText: {
    ...Typography.badge,
    fontSize: 12,
    color: Colors.badgePresentText,
    fontWeight: '700',
  },
  chevron: {
    marginLeft: 6,
  },
});
