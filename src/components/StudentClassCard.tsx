import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  BookOpen,
  BarChart2,
  Clock,
  MapPin,
  ChevronRight,
} from "lucide-react-native";
export interface StudentClassCardItem {
  id: string;
  subject: string;
  courseCode: string;
  classType: string;
  timeSlot: string;
  room: string;
  status: string;
  isHighlighted?: boolean;
}
export function StudentClassCard({
  item,
  onPress,
  expanded = false,
}: {
  item: StudentClassCardItem;
  onPress?: () => void;
  expanded?: boolean;
}) {
  const title = !expanded && item.subject.length > 35
    ? item.subject.slice(0, 35).replace(/\s+\S*$/, '') + '…'
    : item.subject;
  const active = item.status === "Available",
    present = item.status === "Present",
    pending = item.status === "Pending",
    absent = item.status === "Absent" || item.status === "Rejected";
  const badgeColor = present
    ? "#95d5b7"
    : pending
      ? "#e3c585"
      : absent
        ? "#eea2ab"
        : active
          ? "#b4cbf5"
          : "#8ea5c2";
  return (
    <TouchableOpacity
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={
        onPress ? `Open ${item.courseCode}: ${item.subject}` : undefined
      }
      disabled={!onPress}
      activeOpacity={0.88}
      onPress={onPress}
      style={[s.card, item.isHighlighted && s.highlight]}
    >
      <View
        style={[s.icon, item.isHighlighted && { backgroundColor: "#2a4e75" }]}
      >
        {item.isHighlighted ? (
          <BarChart2 size={24} color="#b4cbf5" />
        ) : (
          <BookOpen size={24} color="#8ea5c2" />
        )}
      </View>
      <View style={s.info}>
        <View style={s.header}>
          <Text
            style={s.subject}
            numberOfLines={expanded ? undefined : 1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          {onPress && <ChevronRight size={16} color="#7891ad" />}
        </View>
        <View style={s.middle}>
          <Text style={s.code}>
            {item.courseCode} · {item.classType}
          </Text>
          <View style={s.badge}>
            <Text style={[s.badgeText, { color: badgeColor }]}>
              {active ? "Check-in open" : item.status}
            </Text>
          </View>
        </View>
        <View style={s.meta}>
          <Clock size={11} color="#8ea5c2" />
          <Text style={s.metaText}>{item.timeSlot || "Schedule not set"}</Text>
        </View>
        <View style={s.meta}>
          <MapPin size={11} color="#8ea5c2" />
          <Text style={s.metaText} numberOfLines={1}>
            {item.room || "Room not set"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#263748",
    backgroundColor: "#202d39",
  },
  highlight: { backgroundColor: "#203954", borderColor: "#305a87" },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    backgroundColor: "#192530",
  },
  info: { flex: 1, minWidth: 0 },
  header: { flexDirection: "row", alignItems: "center", gap: 9 },
  subject: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
    lineHeight: 18,
  },
  middle: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 4,
    marginBottom: 2,
  },
  code: { fontSize: 11, color: "#8ea5c2" },
  badge: {
    backgroundColor: "#162330",
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 7,
  },
  badgeText: { fontSize: 9, fontWeight: "600" },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  metaText: { fontSize: 10, color: "#8ea5c2", flexShrink: 1 },
});
