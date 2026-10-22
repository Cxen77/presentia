import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  User,
  Shield,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
  Award,
  GraduationCap,
  Camera,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppBackground } from '../components/AppBackground';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { studentService } from '../services/studentService';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { uploadImageToCloudinary } from '../services/cloudinary';
import { StudentProfile } from '../types';

interface ProfileScreenProps {
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onLogout }) => {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [updatingPhoto, setUpdatingPhoto] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const profile = await studentService.getProfile();
    setStudent(profile);
  };

  const handleUpdatePhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Needed', 'Access to gallery is required to update photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const localUri = result.assets[0].uri;
        setUpdatingPhoto(true);

        const secureUrl = await uploadImageToCloudinary(localUri);

        if (student) {
          await studentService.saveProfile({
            fullName: student.name,
            rollNumber: student.rollNumber,
            department: student.degree,
            semester: student.semester,
            avatarUrl: secureUrl,
          });
          await loadProfile();
        }
        setUpdatingPhoto(false);
        Alert.alert('Updated', 'Profile photo updated successfully.');
      }
    } catch (err: any) {
      setUpdatingPhoto(false);
      Alert.alert('Error', err.message || 'Could not update photo.');
    }
  };

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to sign out of your student account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          if (isSupabaseConfigured()) {
            await supabase.auth.signOut();
          }
          onLogout();
        },
      },
    ]);
  };

  const currentStudent = student || {
    id: 'temp',
    name: 'Aryan Sharma',
    firstName: 'Aryan',
    degree: 'B.Tech Computer Science',
    rollNumber: 'CS24123',
    semester: '3rd Semester',
    avatarUrl: 'assets/aryan.jpg',
    attendancePercent: 0,
    totalClasses: 0,
    presentToday: 0,
  };

  const hasCustomAvatar = Boolean(
    currentStudent.avatarUrl && currentStudent.avatarUrl.startsWith('http')
  );

  const menuSections = [
    {
      title: 'Academic Profile',
      items: [
        { icon: Award, label: 'Grades & Transcript (CGPA 8.84)' },
        { icon: GraduationCap, label: `Course Enrollment • ${currentStudent.semester}` },
      ],
    },
    {
      title: 'Preferences & Security',
      items: [
        { icon: Shield, label: 'Security & Supabase Auth' },
        { icon: Bell, label: 'Push Notifications & Alerts' },
        { icon: HelpCircle, label: 'Help Desk & Campus Admin' },
      ],
    },
  ];

  return (
    <AppBackground variant="dashboard">
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Student Profile</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            {hasCustomAvatar ? (
              <Image source={{ uri: currentStudent.avatarUrl }} style={styles.avatar} />
            ) : currentStudent.avatarUrl === 'assets/aryan.jpg' ? (
              <Image source={require('../../assets/aryan.jpg')} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.placeholderAvatar]}>
                <User size={36} color="#5A7B9E" strokeWidth={1.8} />
              </View>
            )}

            <TouchableOpacity
              style={styles.cameraBadge}
              onPress={handleUpdatePhoto}
              activeOpacity={0.8}
              disabled={updatingPhoto}
            >
              {updatingPhoto ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Camera size={13} color="#FFFFFF" strokeWidth={2.4} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.name}>{currentStudent.name}</Text>
            <Text style={styles.roll}>
              {currentStudent.rollNumber} • {currentStudent.degree}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{currentStudent.semester}</Text>
            </View>
          </View>
        </View>

        {/* Menu Sections */}
        {menuSections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menuBox}>
              {section.items.map((item, itemIdx) => {
                const IconComponent = item.icon;
                return (
                  <TouchableOpacity
                    key={itemIdx}
                    style={[
                      styles.menuItem,
                      itemIdx < section.items.length - 1 && styles.menuItemBorder,
                    ]}
                    onPress={() =>
                      Alert.alert(item.label, 'Configuration saved in your student profile.')
                    }
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuItemLeft}>
                      <IconComponent
                        size={20}
                        color="#9AB9EC"
                        strokeWidth={2}
                        style={styles.menuIcon}
                      />
                      <Text style={styles.menuLabel}>{item.label}</Text>
                    </View>
                    <ChevronRight size={18} color="#7F94B0" strokeWidth={2.2} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Real Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <LogOut size={18} color="#FC8181" strokeWidth={2.2} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Log Out of Account</Text>
        </TouchableOpacity>

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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12273D',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1D3B5C',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#B4CBF5',
  },
  placeholderAvatar: {
    backgroundColor: '#0F2236',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1B4B78',
    borderWidth: 2,
    borderColor: '#12273D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    ...Typography.titleSmall,
    fontSize: 19,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  roll: {
    fontSize: 13,
    color: '#8EA5C2',
    marginBottom: 6,
  },
  badge: {
    backgroundColor: '#1B3754',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    color: '#B4CBF5',
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7F94B0',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingLeft: 4,
  },
  menuBox: {
    backgroundColor: Colors.cardCharcoal,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#263748',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#253545',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    marginRight: 14,
  },
  menuLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  logoutBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(252, 129, 129, 0.12)',
    borderWidth: 1,
    borderColor: '#E53E3E',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    color: '#FC8181',
    fontWeight: '700',
    fontSize: 14,
  },
});
