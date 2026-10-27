import { Platform, Linking } from 'react-native';
import * as Location from 'expo-location';
import type { CheckInLocation } from './api';

let latest: CheckInLocation | null = null;
let pending: Promise<CheckInLocation> | null = null;
async function readPosition(): Promise<CheckInLocation> {
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled)
    throw new Error('Turn on location services to submit attendance.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        mayShowUserSettingsDialog: true,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'Could not get a fresh GPS fix. Move to an open area and retry.',
              ),
            ),
          15000,
        );
      }),
    ]);
    if (fix.coords.accuracy === null)
      throw new Error(
        'GPS accuracy is unavailable. Enable precise location and retry.',
      );
    const result: CheckInLocation = {
      latitude: fix.coords.latitude,
      longitude: fix.coords.longitude,
      accuracy: fix.coords.accuracy,
      capturedAt: fix.timestamp,
      platform:
        Platform.OS === 'android'
          ? 'android'
          : Platform.OS === 'ios'
            ? 'ios'
            : 'web',
      mocked: typeof fix.mocked === 'boolean' ? fix.mocked : null,
      developerOptions: 'unavailable',
    };
    latest = result;
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export async function getAttendanceLocation(
  forceFresh = false,
): Promise<CheckInLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      'Allow precise location access for attendance. You can still browse your classes without it.',
    );
  const result =
    !forceFresh && latest && Date.now() - latest.capturedAt < 10000
      ? latest
      : await (pending ||
          (pending = readPosition().finally(() => {
            pending = null;
          })));
  if (result.mocked === true)
    throw new Error(
      'Mock location detected. Turn off mock-location apps and Developer Options, then retry with real GPS.',
    );
  return result;
}
export async function inspectGrantedLocation() {
  if (Platform.OS === 'web') return null;
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return null;
  return readPosition();
}
export async function warmGrantedLocation() {
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.granted) await getAttendanceLocation();
}

// --- In-app permission flow -------------------------------------------------
// The OS dialog should only ever appear from a user gesture, with the reason
// explained first; after a denial, the only fix is the app's settings page.

export type LocationGate = 'granted' | 'primer' | 'settings';

/** Where the check-in flow stands: granted, explainer needed, or settings needed. */
export async function attendancePermissionStatus(): Promise<LocationGate> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.granted) return 'granted';
  return permission.canAskAgain ? 'primer' : 'settings';
}

/** Call from the in-app explainer's button (a user gesture). */
export async function requestAttendancePermission(): Promise<LocationGate> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.granted) return 'granted';
  return permission.canAskAgain ? 'primer' : 'settings';
}

/** After a hard denial, the student must flip the switch in OS settings. */
export function openAppSettings() {
  void Linking.openSettings();
}
