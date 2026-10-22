import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { Home, BookOpen, Calendar, User } from 'lucide-react-native';
import { TabName } from '../types';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface BottomNavigationProps {
  currentTab: TabName;
  onSelectTab: (tab: TabName) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentTab,
  onSelectTab,
}) => {
  const tabs: { key: TabName; label: string; icon: any }[] = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'classes', label: 'My Classes', icon: BookOpen },
    { key: 'attendance', label: 'Attendance', icon: Calendar },
    { key: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        {tabs.map((tab) => {
          const isActive = currentTab === tab.key;
          const IconComponent = tab.icon;

          if (isActive) {
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.activePill}
                onPress={() => onSelectTab(tab.key)}
                activeOpacity={0.9}
              >
                <IconComponent
                  size={20}
                  color={Colors.navActiveText}
                  strokeWidth={2.5}
                />
                <Text style={styles.activeLabel}>{tab.label}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.inactiveTab}
              onPress={() => onSelectTab(tab.key)}
              activeOpacity={0.7}
            >
              <IconComponent
                size={22}
                color={Colors.navInactive}
                strokeWidth={1.8}
              />
              <Text style={styles.inactiveLabel}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navBar: {
    backgroundColor: Colors.navBackground,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#172C42',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navActiveBg,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  activeLabel: {
    ...Typography.bodyMedium,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.navActiveText,
    marginLeft: 8,
  },
  inactiveTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  inactiveLabel: {
    ...Typography.bodySmall,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.navInactive,
    marginTop: 4,
  },
});
