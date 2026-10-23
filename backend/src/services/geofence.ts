import { z } from 'zod';

export const locationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().min(0).max(10000),
  capturedAt: z.number().finite(),
  platform: z.enum(['android', 'ios', 'web']),
  mocked: z.boolean().nullable(),
  developerOptions: z.literal('unavailable'),
});
export type CheckInLocation = z.infer<typeof locationSchema>;
export const geofenceSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    radiusM: z.number().int().min(25).max(5000),
  }),
]);
export type Geofence = z.infer<typeof geofenceSchema>;
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = radians(b.latitude - a.latitude),
    deltaLng = radians(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(deltaLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function checkLocation(
  location: CheckInLocation,
  policy: Geofence,
  now = Date.now(),
) {
  if (now - location.capturedAt > 60000 || location.capturedAt > now + 15000)
    return {
      error: 'Your location is out of date. Get a fresh GPS fix and retry.',
    };
  if (location.mocked === true)
    return {
      error:
        'Mock location detected. Turn off your mock-location app and Developer Options, then retry with real GPS.',
    };
  if (!policy.enabled) return { distanceM: null };
  if (location.platform === 'web')
    return {
      error:
        'This class requires campus check-in from the installed mobile app. Browser location cannot be checked for mock GPS.',
    };
  if (location.mocked !== false)
    return {
      error:
        'Your device could not report the mock-location check. Use an updated mobile app to check in.',
    };
  if (location.accuracy > Math.min(100, policy.radiusM / 2))
    return {
      error:
        'GPS accuracy is too low. Enable precise location and move to an open area on campus.',
    };
  const distance = distanceMeters(location, policy),
    distanceM = Math.round(distance);
  if (distance > policy.radiusM)
    return {
      error: `You are outside the campus check-in area (${distanceM} m from its centre).`,
      distanceM,
    };
  if (distance + location.accuracy > policy.radiusM)
    return {
      error:
        'Your GPS uncertainty crosses the campus boundary. Move farther inside campus and retry.',
      distanceM,
    };
  return { distanceM };
}
export async function loadClassGeofence(
  client: any,
  classId: string,
): Promise<Geofence> {
  const { data, error } = await client
    .from('classes')
    .select('geofence')
    .eq('id', classId)
    .single();
  if (error || !data)
    throw new Error('Could not load campus check-in rules. Please retry.');
  const parsed = geofenceSchema.safeParse(data.geofence || { enabled: false });
  if (!parsed.success)
    throw new Error(
      'The campus check-in rules need to be corrected by your teacher.',
    );
  return parsed.data;
}
