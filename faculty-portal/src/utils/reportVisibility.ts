import type { SupabaseClient } from '@supabase/supabase-js';

type MetadataAuth = Pick<SupabaseClient['auth'], 'getUser' | 'updateUser'>;
const preference = 'presentia_ignored_report_sessions';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ignoredReportIds(metadata: Record<string, unknown> | undefined): Set<string> {
  const values = metadata?.[preference];
  return new Set(Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string' && uuid.test(value)) : []);
}

export async function loadIgnoredReports(auth: MetadataAuth): Promise<Set<string>> {
  const {data, error} = await auth.getUser();
  if (error || !data.user) throw new Error('Could not load your ignored reports. Please sign in again.');
  return ignoredReportIds(data.user.user_metadata);
}

/** This changes only the signed-in teacher's report visibility, never attendance. */
export async function setReportIgnored(auth: MetadataAuth, sessionId: string, ignored: boolean): Promise<Set<string>> {
  if (!uuid.test(sessionId)) throw new Error('Invalid report. Refresh the page.');
  const ids = await loadIgnoredReports(auth);
  if (ignored) ids.add(sessionId); else ids.delete(sessionId);
  const {error} = await auth.updateUser({data:{[preference]:[...ids]}});
  if (error) throw new Error('Could not save report visibility. Please retry.');
  return ids;
}
