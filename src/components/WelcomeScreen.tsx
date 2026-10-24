import React from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowRight,
  Camera,
  QrCode,
  Scan,
  ShieldCheck,
} from "lucide-react-native";

export function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  const { height } = useWindowDimensions();
  const compact = height < 740;
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.page, compact && s.compactPage]}
      >
        <View style={s.header}>
          <View style={s.brand}>
            <Scan size={23} color="#d6e5d7" strokeWidth={1.7} />
            <Text style={s.wordmark}>
              Presentia<Text style={s.brandDot}>.</Text>
            </Text>
          </View>
          <Text style={s.edition}>STUDENT APP</Text>
        </View>

        <View style={[s.hero, compact && { paddingTop: 26 }]}>
          <View style={s.kicker}>
            <View style={s.dot} />
            <Text style={s.kickerText}>
              READY FOR CLASS
            </Text>
          </View>
          <Text
            accessibilityRole="header"
            style={[s.title, compact && s.compactTitle]}
          >
            Your classes.{"\n"}
            <Text style={s.titleMuted}>One place.</Text>
          </Text>
          <Text style={s.description}>
            Check in to class, keep your records close, and get on with your
            day.
          </Text>

          <View
            style={[s.artwork, compact && { marginVertical: 22 }]}
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
                  <QrCode size={62} color="#182b27" strokeWidth={1.5} />
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
                <ArrowRight size={17} color="#53685a" />
              </View>
            </View>
          </View>

          <View style={s.steps}>
            {[
              { n: "01", label: "Scan QR", Icon: Scan },
              { n: "02", label: "Take a selfie", Icon: Camera },
              { n: "03", label: "Teacher review", Icon: ShieldCheck },
            ].map(({ n, label, Icon }) => (
              <View key={n} style={s.step}>
                <View style={s.stepTop}>
                  <Text style={s.stepNumber}>{n}</Text>
                  <Icon size={15} color="#93aaa5" strokeWidth={1.5} />
                </View>
                <Text style={s.stepLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.bottom}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onContinue}
            activeOpacity={0.85}
            style={s.continue}
          >
            <Text style={s.continueText}>Get started</Text>
            <ArrowRight size={19} color="#14251f" />
          </TouchableOpacity>
          <Text style={s.note}>Sign in or create your student account.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#101b23" },
  page: {
    flexGrow: 1,
    paddingHorizontal: 27,
    paddingTop: 24,
    paddingBottom: 20,
    justifyContent: "space-between",
  },
  compactPage: { paddingTop: 16, paddingBottom: 15 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.8,
    color: "#f1f0e9",
  },
  brandDot: { color: "#acc6ad" },
  edition: {
    fontSize: 8,
    color: "#8a9c9f",
    letterSpacing: 1.6,
    fontWeight: "600",
  },
  hero: { paddingTop: 40, paddingBottom: 26 },
  kicker: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginBottom: 20,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#b8cbb3" },
  kickerText: {
    fontSize: 7,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: "#92a6a6",
  },
  title: {
    fontSize: 49,
    lineHeight: 54,
    fontWeight: "500",
    letterSpacing: -2.3,
    color: "#eeeee6",
  },
  compactTitle: { fontSize: 43, lineHeight: 48 },
  titleMuted: { color: "#9eafa9" },
  description: {
    fontSize: 13,
    lineHeight: 21,
    color: "#9badb1",
    marginTop: 16,
    maxWidth: 285,
  },
  artwork: {
    marginTop: 32,
    marginBottom: 32,
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
    borderColor: "#465853",
    borderRadius: 18,
    transform: [{ rotate: "4deg" }],
  },
  ticket: {
    backgroundColor: "#e8eadc",
    borderRadius: 17,
    padding: 19,
    transform: [{ rotate: "-3deg" }],
  },
  ticketTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ticketEyebrow: {
    fontSize: 8,
    color: "#536454",
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  ticketMark: { flexDirection: "row", gap: 3 },
  ticketMarkDot: {
    width: 3,
    height: 3,
    backgroundColor: "#849381",
    borderRadius: 2,
  },
  ticketMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingTop: 22,
    paddingBottom: 21,
  },
  qr: { padding: 10, borderWidth: 1, borderColor: "#b9c5b2", borderRadius: 13 },
  ticketCopy: { flex: 1 },
  ticketHeading: {
    fontSize: 23,
    lineHeight: 26,
    letterSpacing: -0.7,
    fontWeight: "600",
    color: "#24372c",
  },
  ticketSmall: { fontSize: 9, lineHeight: 14, color: "#6d7d6d", marginTop: 8 },
  ticketRule: {
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: "#b7c1af",
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
    color: "#657562",
  },
  steps: { flexDirection: "row", gap: 15 },
  step: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: "#34444b",
    paddingTop: 10,
  },
  stepTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepNumber: { fontSize: 9, color: "#788f91", fontVariant: ["tabular-nums"] },
  stepLabel: { fontSize: 10, color: "#bdc8c7", marginTop: 8 },
  bottom: { gap: 12 },
  continue: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 15,
    backgroundColor: "#e7eadc",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  continueText: { fontSize: 14, fontWeight: "600", color: "#14251f" },
  note: { fontSize: 10, textAlign: "center", color: "#7d9398" },
});
