import React from 'react';
import { StyleSheet, View, Text, ScrollView, Platform } from 'react-native';
import { Scan, BarChart2, Calendar } from 'lucide-react-native';
import { AppBackground } from '../components/AppBackground';
import { QRIllustration } from '../components/QRIllustration';
import { FeatureRow } from '../components/FeatureRow';
import { PrimaryButton } from '../components/PrimaryButton';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface OnboardingScreenProps {
  onGetStarted: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onGetStarted }) => {
  return (
    <AppBackground variant="onboarding">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top Header Row: Headline on Left, QR Phone Graphic on Top Right */}
        <View style={styles.topHeaderRow}>
          <View style={styles.headlineLeft}>
            <Text style={styles.headlineWhite}>Class</Text>
            <Text style={styles.headlineWhite}>Attendance</Text>
            <Text style={styles.headlineAccent}>Simplified.</Text>
            <Text style={styles.tagline}>Scan  •  Attend  •  Stay in Track</Text>
          </View>

          {/* QR Phone Graphic positioned at Top Right */}
          <View style={styles.topRightGraphic}>
            <QRIllustration variant="onboarding" scale={0.72} />
          </View>
        </View>

        {/* Features placed in the main body where the image previously sat */}
        <View style={styles.featureListSection}>
          <FeatureRow
            icon={<Scan size={24} color="#B4CBF5" strokeWidth={2.2} />}
            title="Quick Attendance"
            description="Scan QR and mark instantly"
          />

          <FeatureRow
            icon={<BarChart2 size={24} color="#B4CBF5" strokeWidth={2.2} />}
            title="Track Progress"
            description="Stay updated with your classes"
          />

          <FeatureRow
            icon={<Calendar size={24} color="#B4CBF5" strokeWidth={2.2} />}
            title="Your Academic Companion"
            description="Simple. Fast. Reliable."
          />
        </View>

        {/* Bottom Primary Button */}
        <View style={styles.bottomActionContainer}>
          <PrimaryButton
            title="Get Started"
            onPress={onGetStarted}
            showArrow
          />
        </View>
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'ios' ? 14 : 22,
    paddingBottom: 30,
    justifyContent: 'space-between',
  },
  topHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 6,
    marginBottom: 20,
    minHeight: 180,
  },
  headlineLeft: {
    flex: 1,
    paddingRight: 6,
    justifyContent: 'center',
    paddingTop: 8,
  },
  headlineWhite: {
    ...Typography.headlineLarge,
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 40,
    letterSpacing: -0.8,
  },
  headlineAccent: {
    ...Typography.headlineLarge,
    fontSize: 34,
    fontWeight: '800',
    color: Colors.textAccentBlue,
    lineHeight: 40,
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  tagline: {
    ...Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  topRightGraphic: {
    width: 140,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    marginTop: -10,
    marginRight: -10,
  },
  featureListSection: {
    marginVertical: 12,
    paddingVertical: 10,
    gap: 8,
  },
  bottomActionContainer: {
    marginTop: 'auto',
    paddingTop: 10,
  },
});
