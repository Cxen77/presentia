/**
 * Centralized API client for the student mobile app.
 * All protected operations go through the Render backend API.
 * Supabase client is only used directly for auth operations (login/signup/session).
 */
import { supabase } from './supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export interface EnrolledClassResponse {
  id: string;
  enrollmentId: string;
  subject: string;
  courseCode: string;
  classType: string;
  timeSlot: string;
  room: string;
  teacherName?: string;
  department: string;
  enrollmentCode: string;
  credits: number;
}

export interface JoinedClassResponse {
  id: string;
  courseCode: string;
  className: string;
  department: string;
  enrollmentCode: string;
  teacherName?: string;
  scheduleInfo?: string;
  room?: string;
  classType?: string;
  credits?: number;
  isActive?: boolean;
}

/**
 * Gets the current Supabase access token for authenticated API calls.
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

    // Handle empty responses (204 No Content)
    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Backend request timed out. Render may be waking from a cold start, please retry.');
    }
    if (
      err instanceof Error &&
      (err.message.includes('Network request failed') || err.message.includes('Failed to fetch'))
    ) {
      throw new Error(`Unable to reach backend server at ${API_BASE_URL}. Check your internet connection.`);
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
// PROFILES
// =============================================================================

export async function getMyProfile() {
  return apiRequest('/api/profiles/me');
}

export async function updateMyProfile(data: {
  fullName: string;
  rollNumber: string;
  department: string;
  semester: string;
  avatarUrl?: string | null;
}) {
  return apiRequest('/api/profiles/me', { method: 'PUT', body: data });
}

// =============================================================================
// ENROLLMENT
// =============================================================================

export async function getMyEnrolledClasses() {
  return apiRequest<EnrolledClassResponse[]>('/api/enrollment/my-classes');
}

export async function joinClassByCode(enrollmentCode: string) {
  return apiRequest<{ message: string; classData: JoinedClassResponse }>('/api/enrollment/join', {
    method: 'POST',
    body: { enrollmentCode },
  });
}

export async function leaveClass(enrollmentId: string) {
  return apiRequest(`/api/enrollment/${enrollmentId}`, { method: 'DELETE' });
}

// =============================================================================
// ATTENDANCE
// =============================================================================

export async function submitAttendance(data: {
  qrToken: string;
  verificationPhotoUrl?: string;
}) {
  return apiRequest('/api/attendance/submit', { method: 'POST', body: data });
}

export async function getMyAttendanceRecords() {
  return apiRequest('/api/attendance/my-records');
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
// API Configuration Check
// =============================================================================

export function isApiConfigured(): boolean {
  return (
    !!process.env.EXPO_PUBLIC_API_BASE_URL &&
    process.env.EXPO_PUBLIC_API_BASE_URL !== 'http://localhost:4000'
  );
}

export { API_BASE_URL };
