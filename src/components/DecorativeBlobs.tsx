import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DecorativeBlobsProps {
  variant?: 'onboarding' | 'login' | 'dashboard';
}

export const DecorativeBlobs: React.FC<DecorativeBlobsProps> = ({ variant = 'onboarding' }) => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="none">
        <Defs>
          {/* Subtle blue ambient gradients matching the screenshots */}
          <LinearGradient id="topBlobGrad" x1="0.5" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#1C3D61" stopOpacity="0.55" />
            <Stop offset="100%" stopColor="#0B1E32" stopOpacity="0.1" />
          </LinearGradient>

          <LinearGradient id="midBlobGrad" x1="0" y1="0.3" x2="1" y2="0.8">
            <Stop offset="0%" stopColor="#142B44" stopOpacity="0.65" />
            <Stop offset="100%" stopColor="#081827" stopOpacity="0.2" />
          </LinearGradient>

          <LinearGradient id="accentCurveGrad" x1="1" y1="0" x2="0.2" y2="1">
            <Stop offset="0%" stopColor="#224A75" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#0D2034" stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        {/* Top-right large organic flowing wave visible in all screens */}
        <Path
          d="M210 0 C260 40, 275 80, 260 140 C240 210, 310 240, 360 210 C390 190, 410 180, 420 200 L420 0 Z"
          fill="url(#topBlobGrad)"
        />

        {/* Secondary softer wave behind top area */}
        <Path
          d="M290 0 C320 60, 340 100, 390 120 L390 0 Z"
          fill="#1E3E63"
          fillOpacity="0.35"
        />

        {variant === 'onboarding' && (
          <>
            {/* Mid-left organic shape behind phone illustration */}
            <Path
              d="M-50 280 C30 260, 80 300, 90 350 C100 400, 50 450, -40 460 Z"
              fill="url(#midBlobGrad)"
            />
            {/* Center-right layered curve */}
            <Path
              d="M260 300 C340 310, 380 370, 350 430 C320 480, 270 470, 260 520 L400 520 L400 300 Z"
              fill="url(#accentCurveGrad)"
            />
          </>
        )}

        {variant === 'login' && (
          <>
            {/* Soft right-side contour around login card */}
            <Path
              d="M300 120 C360 140, 390 200, 370 270 C350 330, 390 370, 400 400 L400 120 Z"
              fill="url(#topBlobGrad)"
            />
          </>
        )}

        {variant === 'dashboard' && (
          <>
            {/* Floating contour behind profile card and active class card */}
            <Path
              d="M-40 160 C40 150, 90 190, 80 250 C70 310, -20 340, -50 330 Z"
              fill="url(#midBlobGrad)"
            />
            <Path
              d="M260 400 C330 420, 370 480, 340 540 C310 600, 260 590, 250 630 L400 630 L400 400 Z"
              fill="url(#accentCurveGrad)"
            />
          </>
        )}
      </Svg>
    </View>
  );
};
