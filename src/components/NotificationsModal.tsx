import React from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { X, Bell, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react-native';
import { Typography } from '../theme/typography';
import { Colors } from '../theme/colors';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ visible, onClose }) => {
  const notifications = [
    {
      id: '1',
      title: 'Data Structures Attendance Active',
      message: 'Prof. Sengupta has initiated attendance for CS201 in Room A101.',
      time: 'Just now',
      type: 'attendance',
    },
    {
      id: '2',
      title: 'Attendance Alert: OS CS205',
      message: 'Your overall attendance in CS205 is 86%. Maintain ≥75% for exam eligibility.',
      time: '2 hours ago',
      type: 'warning',
    },
    {
      id: '3',
      title: 'Class Rescheduled: Computer Networks',
      message: 'CS207 lab session shifted to Room A104 at 02:00 PM.',
      time: 'Yesterday',
      type: 'schedule',
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Bell size={20} color="#B4CBF5" strokeWidth={2.4} style={{ marginRight: 8 }} />
              <Text style={styles.title}>Notifications</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#A8B9D0" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {notifications.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemTime}>{item.time}</Text>
                </View>
                <Text style={styles.itemMessage}>{item.message}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0C1E30',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 22,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderTopColor: '#1A3856',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    ...Typography.titleMedium,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#162F4A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemCard: {
    backgroundColor: '#12263C',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1C3754',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemTitle: {
    ...Typography.titleSmall,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  itemTime: {
    fontSize: 11,
    color: '#7F94B0',
    marginLeft: 8,
  },
  itemMessage: {
    fontSize: 13,
    color: '#8EA5C2',
    lineHeight: 18,
  },
});
