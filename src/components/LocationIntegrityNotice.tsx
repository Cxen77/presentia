import React, { useEffect, useState } from 'react';
import {
  AppState,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MapPin, ShieldAlert } from 'lucide-react-native';
import { inspectGrantedLocation } from '../services/checkInLocation';
export function LocationIntegrityNotice() {
  const [mocked, setMocked] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const inspect = () => {
      void inspectGrantedLocation()
        .then((fix) => {
          if (active && fix?.mocked) setMocked(true);
        })
        .catch(() => {});
    };
    inspect();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') inspect();
    });
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  if (!mocked) return null;
  const retry = async () => {
    setBusy(true);
    setError(null);
    try {
      const fix = await inspectGrantedLocation();
      if (fix?.mocked === false) setMocked(false);
      else
        setError(
          'Mock location is still reported, or GPS could not be checked.',
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check location.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => setMocked(false)}
    >
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.icon}>
            <ShieldAlert size={25} color="#e7bd83" />
          </View>
          <Text style={s.title}>Use your real location</Text>
          <Text style={s.body}>
            Your device is reporting a simulated location. Attendance check-in
            is blocked until you turn off mock-location tools.
          </Text>
          <View style={s.guide}>
            <Text style={s.step}>1. Stop any GPS or mock-location app.</Text>
            <Text style={s.step}>
              {Platform.OS === 'android'
                ? '2. In Developer Options, set “Select mock location app” to None and turn Developer Options off.'
                : '2. Disconnect location simulation tools and restart your device if needed.'}
            </Text>
            <Text style={s.step}>
              3. Turn on precise location, then check again.
            </Text>
          </View>
          {error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void retry()}
            disabled={busy}
            style={s.primary}
          >
            <MapPin size={15} color="#122538" />
            <Text style={s.primaryText}>
              {busy ? 'Checking…' : 'Check location again'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              void (
                Platform.OS === 'android'
                  ? Linking.sendIntent(
                      'android.settings.APPLICATION_DEVELOPMENT_SETTINGS',
                    )
                  : Linking.openSettings()
              ).catch(() => setError('Open your device Settings manually.'));
            }}
            style={s.secondary}
          >
            <Text style={s.secondaryText}>Open device settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setMocked(false)}
            style={{ padding: 12 }}
          >
            <Text style={s.note}>
              Continue browsing · check-in stays blocked
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#02070dcc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 370,
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#102235',
    borderWidth: 1,
    borderColor: '#2c435b',
  },
  icon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: '#433827',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { color: '#edf3ff', fontSize: 22, fontWeight: '600' },
  body: { fontSize: 13, color: '#9fb2cb', lineHeight: 21, marginTop: 12 },
  guide: {
    gap: 10,
    padding: 15,
    backgroundColor: '#0b1b2c',
    borderRadius: 14,
    marginTop: 19,
  },
  step: { color: '#b3c5dc', fontSize: 12, lineHeight: 19 },
  primary: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: '#bdd1ee',
    borderRadius: 13,
    marginTop: 20,
  },
  primaryText: { color: '#122538', fontSize: 12, fontWeight: '700' },
  secondary: { padding: 13, alignItems: 'center' },
  secondaryText: { color: '#b1c6e5', fontSize: 12 },
  note: { color: '#8197b2', fontSize: 10, textAlign: 'center' },
  error: { color: '#f3acad', fontSize: 12, lineHeight: 18, marginTop: 13 },
});
