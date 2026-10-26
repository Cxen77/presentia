import React, { useEffect, useRef } from "react";
import { Colors } from "../theme/colors";
import {
  Animated,
  Easing,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowRight,
  Camera,
  QrCode,
  Scan,
  ShieldCheck,
} from "lucide-react-native";

/** One-shot entrance: fade in and rise, like the portal's page motion. */
function Rise({
  delay = 0,
  children,
  style,
  scale = false,
}: {
  delay?: number;
  children: React.ReactNode;
  style?: any;
  scale?: boolean;
}) {
  const [progress] = React.useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 520,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
            ...(scale ? [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] : []),
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  const { height } = useWindowDimensions();
  const compact = height < 740;
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#2C4E86", "#17335C", "#081726"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft light blobs for depth, in the app's blue family. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[s.blob, s.blobAccent]} />
        <View style={[s.blob, s.blobWhite]} />
      </View>
      <SafeAreaView style={s.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.page, compact && s.compactPage]}
        >
          <Rise delay={0}>
            <View style={s.header}>
              <View style={s.brand}>
                <Scan size={23} color="#FFFFFF" strokeWidth={1.7} />
                <Text style={s.wordmark}>
                  Presentia<Text style={s.brandDot}>.</Text>
                </Text>
              </View>
              <Text style={s.edition}>STUDENT APP</Text>
            </View>
          </Rise>

          <View style={[s.hero, compact && { paddingTop: 18 }]}>
            <Rise delay={90} scale>
              <View
                style={[s.artwork, compact && { marginVertical: 16 }]}
                accessibilityLabel="Check-in illustration: scan a QR, take a selfie, and wait for teacher review"
              >
                <View style={s.ticketBehind} />
                <View style={s.ticket}>
                  <View style={s.ticketTop}>
                    <Text style={s.ticketEyebrow}>THE CLASS CHECK-IN</Text>
                    <View style={s.ticketMark}>
                      <View style={s.ticketMarkDot} />
                      <View style={s.ticketMarkDot} />
                      <View style={s.ticketMarkDot} />
                    </View>
                  </View>
                  <View style={s.ticketMain}>
                    <View style={s.qr}>
                      <QrCode size={62} color={Colors.textDarkNavy} strokeWidth={1.5} />
                    </View>
                    <View style={s.ticketCopy}>
                      <Text style={s.ticketHeading}>
                        Here starts{"\n"}your class.
                      </Text>
                      <Text style={s.ticketSmall}>
                        Your QR. Your selfie.{"\n"}Confirmed by your teacher.
                      </Text>
                    </View>
                  </View>
                  <View style={s.ticketRule} />
                  <View style={s.ticketFooter}>
                    <Text style={s.ticketFooterText}>SHOW UP AS YOU.</Text>
                    <ArrowRight size={17} color={Colors.textDarkMuted} />
                  </View>
                </View>
              </View>
            </Rise>

            <Rise delay={180}>
              <Text
                accessibilityRole="header"
                style={[s.title, compact && s.compactTitle]}
              >
                Your classes.{"\n"}
                <Text style={s.titleMuted}>One place.</Text>
              </Text>
              <Text style={s.description}>
                Check in to class, keep your records close, and get on with
                your day.
              </Text>
            </Rise>

            <Rise delay={260}>
              <View style={s.steps}>
                {[
                  { n: "01", label: "Scan QR", Icon: Scan },
                  { n: "02", label: "Take a selfie", Icon: Camera },
                  { n: "03", label: "Teacher review", Icon: ShieldCheck },
                ].map(({ n, label, Icon }) => (
                  <View key={n} style={s.step}>
                    <View style={s.stepTop}>
                      <Text style={s.stepNumber}>{n}</Text>
                      <Icon size={15} color="#E4E1FF" strokeWidth={1.5} />
                    </View>
                    <Text style={s.stepLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            </Rise>
          </View>

          <View style={s.bottom}>
            <Rise delay={340}>
              <View style={s.dots} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">
                <View style={[s.dotPill, s.dotActive]} />
                <View style={s.dotIdle} />
                <View style={s.dotIdle} />
              </View>
            </Rise>
            <Rise delay={400}>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={onContinue}
                activeOpacity={0.85}
                style={s.continue}
              >
                <Text style={s.continueText}>Start</Text>
                <View style={s.continueArrow}>
                  <ArrowRight size={18} color="#5B4BD6" strokeWidth={2.4} />
                </View>
              </TouchableOpacity>
              <Text style={s.note}>Sign in or create your student account.</Text>
            </Rise>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A1A33" },
  safe: { flex: 1 },
  page: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 20,
    justifyContent: "space-between",
  },
  compactPage: { paddingTop: 14, paddingBottom: 15 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: "#FFFFFF",
  },
  brandDot: { color: "#F2A0AC" },
  edition: {
    fontSize: 8,
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 1.6,
    fontWeight: "600",
  },
  blob: { position: "absolute", borderRadius: 999 },
  blobAccent: {
    width: 300,
    height: 300,
    right: -110,
    top: -90,
    backgroundColor: "rgba(154,185,236,0.20)",
  },
  blobWhite: {
    width: 260,
    height: 260,
    left: -100,
    bottom: -80,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  hero: { paddingTop: 26, paddingBottom: 20 },
  artwork: {
    marginTop: 18,
    marginBottom: 26,
    paddingHorizontal: 4,
    paddingVertical: 7,
  },
  ticketBehind: {
    position: "absolute",
    top: 9,
    bottom: 6,
    left: 7,
    right: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: 18,
    transform: [{ rotate: "4deg" }],
  },
  ticket: {
    backgroundColor: Colors.cardProfile,
    borderRadius: 17,
    padding: 19,
    transform: [{ rotate: "-3deg" }],
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  ticketTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ticketEyebrow: {
    fontSize: 8,
    color: Colors.textDarkMuted,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  ticketMark: { flexDirection: "row", gap: 3 },
  ticketMarkDot: {
    width: 3,
    height: 3,
    backgroundColor: Colors.textDarkMuted,
    borderRadius: 2,
  },
  ticketMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingTop: 22,
    paddingBottom: 21,
  },
  qr: { padding: 10, borderWidth: 1, borderColor: Colors.badgeSemesterBg, borderRadius: 13 },
  ticketCopy: { flex: 1 },
  ticketHeading: {
    fontSize: 23,
    lineHeight: 26,
    letterSpacing: -0.7,
    fontWeight: "600",
    color: Colors.textDarkNavy,
  },
  ticketSmall: { fontSize: 9, lineHeight: 14, color: Colors.textDarkMuted, marginTop: 8 },
  ticketRule: {
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.badgeSemesterBg,
  },
  ticketFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
  },
  ticketFooterText: {
    fontSize: 7,
    fontWeight: "600",
    letterSpacing: 1.7,
    color: Colors.textDarkMuted,
  },
  title: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "700",
    letterSpacing: -1.4,
    color: "#FFFFFF",
  },
  compactTitle: { fontSize: 31, lineHeight: 37 },
  titleMuted: { color: "#D9D4FF" },
  description: {
    fontSize: 13,
    lineHeight: 21,
    color: "rgba(255,255,255,0.82)",
    marginTop: 12,
    maxWidth: 300,
  },
  steps: { flexDirection: "row", gap: 10, marginTop: 20 },
  step: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.10)",
    paddingVertical: 10,
    paddingHorizontal: 11,
  },
  stepTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepNumber: {
    fontSize: 9,
    color: "rgba(255,255,255,0.7)",
    fontVariant: ["tabular-nums"],
  },
  stepLabel: { fontSize: 10, color: "#F0EEFF", marginTop: 8, fontWeight: "600" },
  bottom: { gap: 12 },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
    marginBottom: 4,
  },
  dotPill: { height: 6, borderRadius: 3 },
  dotActive: { width: 22, backgroundColor: "#F2A0AC" },
  dotIdle: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.35)" },
  continue: {
    minHeight: 54,
    paddingHorizontal: 20,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  continueText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1B1650",
    letterSpacing: 0.2,
  },
  continueArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EEEBFF",
    alignItems: "center",
    justifyContent: "center",
  },
  note: { fontSize: 10, textAlign: "center", color: "rgba(255,255,255,0.6)" },
});
