import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, Clock } from 'lucide-react-native';
export function SelfieSubmissionCard({
  photoUri,
  courseCode,
  preview,
  onDone,
}: {
  photoUri: string | null;
  courseCode?: string;
  preview: boolean;
  onDone: () => void;
}) {
  return (
    <View style={s.card}>
      <View style={s.top}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={s.photo} />
        ) : (
          <View style={s.check}>
            <Check size={24} color="#b5ddc5" />
          </View>
        )}
        <View style={s.receipt}>
          <Text style={s.eyebrow}>{courseCode || 'ATTENDANCE CHECK-IN'}</Text>
          <View style={s.status}>
            <View style={s.dot} />
            <Text style={s.statusText}>
              {preview ? 'Preview complete' : 'Selfie received'}
            </Text>
          </View>
        </View>
      </View>
      <Text style={s.title}>
        {preview ? 'That’s the flow.' : 'Sent. You’re done for now.'}
      </Text>
      <Text style={s.body}>
        {preview
          ? 'No photo was uploaded and no attendance was marked.'
          : 'Your teacher will compare this selfie with your profile photo before marking attendance.'}
      </Text>
      {!preview && (
        <View style={s.pending}>
          <Clock size={14} color="#d8c08c" />
          <View style={{ flex: 1 }}>
            <Text style={s.pendingTitle}>Awaiting faculty review</Text>
            <Text style={s.pendingBody}>The result appears in Attendance.</Text>
          </View>
        </View>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onDone}
        style={s.button}
      >
        <Text style={s.buttonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    width: '84%',
    padding: 23,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#2c3e52',
    backgroundColor: '#142332',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 23,
  },
  photo: {
    width: 57,
    height: 66,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#42556c',
  },
  check: {
    width: 52,
    height: 52,
    borderRadius: 19,
    backgroundColor: '#284334',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receipt: { flex: 1, gap: 7 },
  eyebrow: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: '#8ca4c2',
    fontWeight: '600',
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#93c9ab' },
  statusText: { color: '#b1d5bf', fontSize: 11, fontWeight: '600' },
  title: {
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.5,
    color: '#ecf2fb',
    fontWeight: '600',
  },
  body: { color: '#94a9c2', fontSize: 12, lineHeight: 20, marginTop: 11 },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#21303b',
    borderRadius: 13,
    padding: 12,
    marginTop: 20,
  },
  pendingTitle: { color: '#d8c08c', fontSize: 11, fontWeight: '600' },
  pendingBody: { color: '#91a2b7', fontSize: 10, marginTop: 4 },
  button: {
    backgroundColor: '#dce5f0',
    borderRadius: 13,
    padding: 13,
    alignItems: 'center',
    marginTop: 23,
  },
  buttonText: { color: '#14283b', fontSize: 12, fontWeight: '700' },
});
