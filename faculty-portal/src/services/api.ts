/**
 * Centralized API client for the faculty portal.
 * All protected operations go through the Render backend API.
 * Supabase client is only used directly for auth operations and Realtime subscriptions.
 */
import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

/**
 * Gets the current Supabase access token.
 */
async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Makes an authenticated API request to the Render backend.
 */
async function apiRequest<T = any>(
  path: string,
  options: {
    method?: string;
    body?: any;
    responseType?: 'json' | 'blob';
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const { method = 'GET', body, responseType = 'json', timeoutMs = 30000 } = options;
  const token = await getAccessToken();

  if (!token) {
    throw new Error('Not authenticated. Please sign in.');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller ? controller.signal : undefined,
    });

    if (!res.ok) {
      let errorMessage = `Request failed (${res.status})`;
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorMessage;
      } catch {}
      throw new Error(errorMessage);
    }

    if (responseType === 'blob') {
      return (await res.blob()) as any;
    }

    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Backend request timed out. Render may be waking up from a cold start, please retry.');
    }
    if (err.message && err.message.includes('Failed to fetch')) {
      throw new Error(`Unable to reach backend server at ${API_BASE_URL}. Ensure it is running and CORS allows this origin.`);
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// =============================================================================
// AUTH
// =============================================================================

export async function getAuthMe() {
  return apiRequest('/api/auth/me');
}

// =============================================================================
// CLASSES
// =============================================================================

export async function getClasses() {
  return apiRequest('/api/classes');
}

export async function getClassById(classId: string) {
  return apiRequest(`/api/classes/${classId}`);
}

export async function createClass(data: {
  courseCode: string;
  className: string;
  department: string;
  semester: string;
  room: string;
  startTime: string;
  endTime: string;
  classType: 'Theory' | 'Practical' | 'Seminar';
  credits: number;
  description?: string;
}) {
  return apiRequest('/api/classes', { method: 'POST', body: data });
}

export async function getEnrolledStudents(classId: string) {
  return apiRequest(`/api/classes/${classId}/students`);
}

export async function regenerateEnrollmentCode(classId: string) {
  return apiRequest(`/api/classes/${classId}/regenerate-code`, { method: 'POST' });
}

// =============================================================================
// SESSIONS
// =============================================================================

export async function startSession(classId: string) {
  return apiRequest('/api/sessions', { method: 'POST', body: { classId } });
}

export async function getActiveSession() {
  return apiRequest('/api/sessions/active');
}

export async function getSessions() { return apiRequest('/api/sessions'); }

export async function rotateQRToken(sessionId: string) {
  return apiRequest(`/api/sessions/${sessionId}/rotate-token`, { method: 'POST' });
}

export async function endSession(sessionId: string) {
  return apiRequest(`/api/sessions/${sessionId}/end`, { method: 'PUT' });
}

export async function finalizeSession(sessionId: string) {
  return apiRequest(`/api/sessions/${sessionId}/finalize`, { method: 'PUT' });
}

export async function getSessionRecords(sessionId: string) {
  return apiRequest(`/api/sessions/${sessionId}/records`);
}

// =============================================================================
// ATTENDANCE VERIFICATION
// =============================================================================

export async function verifyAttendance(
  recordId: string,
  data: { status: 'PRESENT' | 'REJECTED'; rejectionReason?: string }
) {
  return apiRequest(`/api/attendance/${recordId}/verify`, { method: 'PUT', body: data });
}

// =============================================================================
// REPORTS
// =============================================================================

export async function downloadSessionReport(sessionId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE_URL}/api/reports/session/${sessionId}/excel`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    let msg = 'Failed to generate report';
    try { const d = await res.json(); msg = d.error || msg; } catch {}
    throw new Error(msg);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const disposition = res.headers.get('content-disposition');
  const filenameMatch = disposition?.match(/filename="(.+)"/);
  anchor.href = url;
  anchor.download = filenameMatch?.[1] || 'attendance_report.xlsx';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

// =============================================================================
// CLOUDINARY
// =============================================================================

export async function getCloudinarySignature(folder: string, publicId?: string) {
  return apiRequest('/api/cloudinary/signature', {
    method: 'POST',
    body: { folder, publicId },
  });
}

// =============================================================================
// CONFIG
// =============================================================================

export function isApiConfigured(): boolean {
  return (
    !!import.meta.env.VITE_API_BASE_URL &&
    import.meta.env.VITE_API_BASE_URL !== 'http://localhost:4000'
  );
}

export { API_BASE_URL };
