import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Rect, Path, G, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Check } from 'lucide-react-native';
import { Colors } from '../theme/colors';

interface QRIllustrationProps {
  variant?: 'onboarding' | 'qr_login';
  scale?: number;
}

export const QRIllustration: React.FC<QRIllustrationProps> = ({
  variant = 'onboarding',
  scale = 1,
}) => {
  if (variant === 'qr_login') {
    return (
      <View style={styles.qrLoginWrapper}>
        {/* Ambient background glow inside panel */}
        <View style={styles.panelGlow} />

        <Svg width={260 * scale} height={290 * scale} viewBox="0 0 260 290">
          <Defs>
            <LinearGradient id="phoneBorderGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#2A4B70" />
              <Stop offset="50%" stopColor="#142C44" />
              <Stop offset="100%" stopColor="#0B1A28" />
            </LinearGradient>
            <LinearGradient id="screenGrad" x1="0.2" y1="0" x2="0.8" y2="1">
              <Stop offset="0%" stopColor="#071524" />
              <Stop offset="100%" stopColor="#020912" />
            </LinearGradient>
            <LinearGradient id="scanBracketGlow" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#B4CBF5" />
              <Stop offset="100%" stopColor="#7E9ECE" />
            </LinearGradient>
          </Defs>

          {/* Background curved shape behind phone */}
          <Path
            d="M20 180 C10 100, 60 50, 140 40 C200 30, 240 80, 250 140 C260 200, 220 260, 150 270 Z"
            fill="#12273D"
            opacity={0.65}
          />

          {/* Tilted Phone Body */}
          <G transform="rotate(-6 130 150)">
            {/* Phone Shadow */}
            <Rect
              x="52"
              y="22"
              width="156"
              height="250"
              rx="28"
              fill="#000000"
              opacity={0.4}
            />

            {/* Phone Rim / Outer Frame */}
            <Rect
              x="48"
              y="16"
              width="160"
              height="254"
              rx="30"
              fill="url(#phoneBorderGrad)"
              stroke="#2B496D"
              strokeWidth="2"
            />

            {/* Phone Screen */}
            <Rect
              x="54"
              y="22"
              width="148"
              height="242"
              rx="24"
              fill="url(#screenGrad)"
            />

            {/* Top Phone Speaker / Notch */}
            <Rect
              x="108"
              y="28"
              width="40"
              height="4"
              rx="2"
              fill="#1C3857"
            />

            {/* Four Corner Scanning Brackets framing the QR */}
            {/* Top-Left */}
            <Path
              d="M74 96 L74 82 C74 77, 77 74, 82 74 L96 74"
              fill="none"
              stroke="url(#scanBracketGlow)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Top-Right */}
            <Path
              d="M160 74 L174 74 C179 74, 182 77, 182 82 L182 96"
              fill="none"
              stroke="url(#scanBracketGlow)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Bottom-Left */}
            <Path
              d="M74 154 L74 168 C74 173, 77 176, 82 176 L96 176"
              fill="none"
              stroke="url(#scanBracketGlow)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Bottom-Right */}
            <Path
              d="M160 176 L174 176 C179 176, 182 173, 182 168 L182 154"
              fill="none"
              stroke="url(#scanBracketGlow)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />

            {/* Center QR Code Matrix */}
            <G transform="translate(86, 86)">
              {/* Top-Left Position Square */}
              <Rect x="0" y="0" width="26" height="26" rx="5" fill="#FFFFFF" />
              <Rect x="5" y="5" width="16" height="16" rx="3" fill="#040C16" />
              <Rect x="8" y="8" width="10" height="10" rx="2" fill="#FFFFFF" />

              {/* Top-Right Position Square */}
              <Rect x="56" y="0" width="26" height="26" rx="5" fill="#FFFFFF" />
              <Rect x="61" y="5" width="16" height="16" rx="3" fill="#040C16" />
              <Rect x="64" y="8" width="10" height="10" rx="2" fill="#FFFFFF" />

              {/* Bottom-Left Position Square */}
              <Rect x="0" y="54" width="26" height="26" rx="5" fill="#FFFFFF" />
              <Rect x="5" y="59" width="16" height="16" rx="3" fill="#040C16" />
              <Rect x="8" y="62" width="10" height="10" rx="2" fill="#FFFFFF" />

              {/* Data Blocks & Dots */}
              <Rect x="32" y="4" width="8" height="8" rx="2" fill="#FFFFFF" />
              <Rect x="44" y="12" width="6" height="6" rx="1.5" fill="#FFFFFF" />
              <Rect x="34" y="24" width="14" height="6" rx="2" fill="#FFFFFF" />
              <Rect x="32" y="36" width="6" height="14" rx="2" fill="#FFFFFF" />
              <Rect x="44" y="44" width="8" height="8" rx="2" fill="#FFFFFF" />
              <Rect x="58" y="34" width="8" height="8" rx="2" fill="#FFFFFF" />
              <Rect x="70" y="46" width="10" height="6" rx="1.5" fill="#FFFFFF" />
              <Rect x="36" y="58" width="16" height="6" rx="2" fill="#FFFFFF" />
              <Rect x="60" y="62" width="18" height="14" rx="3" fill="#FFFFFF" />
            </G>
          </G>
        </Svg>
      </View>
    );
  }

  // Onboarding Screen 1 Variant (tilted phone with layered slab behind + checkmark badge)
  return (
    <View style={styles.onboardingWrapper}>
      {/* Soft ambient back-glow */}
      <View style={styles.onboardingGlow} />

      <Svg width={300 * scale} height={265 * scale} viewBox="0 0 300 265">
        <Defs>
          <LinearGradient id="slabGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#224569" />
            <Stop offset="50%" stopColor="#142C44" />
            <Stop offset="100%" stopColor="#0B1A28" />
          </LinearGradient>
          <LinearGradient id="phoneGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#2C4E75" />
            <Stop offset="50%" stopColor="#18334E" />
            <Stop offset="100%" stopColor="#0D1E30" />
          </LinearGradient>
          <LinearGradient id="phoneScreenGrad" x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0%" stopColor="#071728" />
            <Stop offset="100%" stopColor="#020810" />
          </LinearGradient>
          <LinearGradient id="glassGlare" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.12" />
            <Stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.04" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="badgeGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#A8C7F7" />
            <Stop offset="100%" stopColor="#7E9ECE" />
          </LinearGradient>
        </Defs>

        {/* Layered Slabs Behind the Phone (angled) */}
        <G transform="rotate(-15 150 135)">
          {/* Backmost shadow slab */}
          <Rect
            x="110"
            y="35"
            width="135"
            height="185"
            rx="28"
            fill="#081524"
            opacity={0.8}
          />

          {/* Middle elevated slate slab */}
          <Rect
            x="86"
            y="22"
            width="136"
            height="192"
            rx="28"
            fill="url(#slabGrad)"
            stroke="#2E5582"
            strokeWidth="1.8"
          />

          {/* Front Tilted Phone Frame */}
          <Rect
            x="54"
            y="14"
            width="132"
            height="202"
            rx="28"
            fill="url(#phoneGrad)"
            stroke="#3B6699"
            strokeWidth="2.2"
          />

          {/* Front Phone Screen */}
          <Rect
            x="60"
            y="20"
            width="120"
            height="190"
            rx="24"
            fill="url(#phoneScreenGrad)"
          />

          {/* Diagonal Glass Glare Reflection */}
          <Path
            d="M60 20 L130 20 L60 160 Z"
            fill="url(#glassGlare)"
          />

          {/* Top Notch / Dynamic Island */}
          <Rect x="100" y="26" width="40" height="4" rx="2" fill="#1C3550" />

          {/* QR Code on Phone Display */}
          <G transform="translate(77, 66)">
            {/* Top-Left */}
            <Rect x="0" y="0" width="24" height="24" rx="5" fill="#FFFFFF" />
            <Rect x="4.5" y="4.5" width="15" height="15" rx="3" fill="#040C16" />
            <Rect x="7.5" y="7.5" width="9" height="9" rx="2" fill="#FFFFFF" />

            {/* Top-Right */}
            <Rect x="52" y="0" width="24" height="24" rx="5" fill="#FFFFFF" />
            <Rect x="56.5" y="4.5" width="15" height="15" rx="3" fill="#040C16" />
            <Rect x="59.5" y="7.5" width="9" height="9" rx="2" fill="#FFFFFF" />

            {/* Bottom-Left */}
            <Rect x="0" y="50" width="24" height="24" rx="5" fill="#FFFFFF" />
            <Rect x="4.5" y="54.5" width="15" height="15" rx="3" fill="#040C16" />
            <Rect x="7.5" y="57.5" width="9" height="9" rx="2" fill="#FFFFFF" />

            {/* Inner Bits */}
            <Rect x="28" y="4" width="8" height="8" rx="2" fill="#FFFFFF" />
            <Rect x="40" y="10" width="6" height="6" rx="1.5" fill="#FFFFFF" />
            <Rect x="30" y="24" width="14" height="6" rx="2" fill="#FFFFFF" />
            <Rect x="28" y="34" width="6" height="14" rx="2" fill="#FFFFFF" />
            <Rect x="40" y="40" width="8" height="8" rx="2" fill="#FFFFFF" />
            <Rect x="52" y="30" width="8" height="8" rx="2" fill="#FFFFFF" />
            <Rect x="64" y="40" width="12" height="6" rx="2" fill="#FFFFFF" />
            <Rect x="32" y="54" width="16" height="6" rx="2" fill="#FFFFFF" />
            <Rect x="54" y="56" width="18" height="16" rx="3" fill="#FFFFFF" />
          </G>
        </G>

        {/* Floating Circular Checkmark Badge at Lower-Right of Phone */}
        <Circle cx="195" cy="188" r="23" fill="#071524" opacity={0.5} />
        <Circle cx="192" cy="184" r="21" fill="url(#badgeGrad)" stroke="#FFFFFF" strokeWidth="1.5" />
        <Path
          d="M184 184 L189 189 L202 177"
          fill="none"
          stroke="#061522"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  onboardingWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    position: 'relative',
  },
  onboardingGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#1E436B',
    opacity: 0.28,
  },
  qrLoginWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#1E436B',
    opacity: 0.25,
  },
});
