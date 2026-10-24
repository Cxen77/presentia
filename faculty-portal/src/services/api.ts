/**
 * Centralized API client for the faculty portal.
 * All protected operations go through the Render backend API.
 * Supabase client is only used directly for auth operations and Realtime subscriptions.
 */
import { supabase } from './supabase';
import { authenticatedRequest } from './sessionRecovery';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

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
  const headers: Record<string, string> = {};

  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await authenticatedRequest(supabase.auth, token => fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {...headers,Authorization:`Bearer ${token}`},
      body: body ? JSON.stringify(body) : undefined,
      signal: controller ? controller.signal : undefined,
    }));

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

export async function getEnrolledStudents(classId: string,sessionId?:string) {
  return apiRequest(`/api/classes/${classId}/students${sessionId ? '?sessionId='+encodeURIComponent(sessionId) : ''}`);
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
export async function updateClass(id:string,data:Record<string,unknown>){return apiRequest(`/api/classes/${id}`,{method:'PUT',body:data});}
export async function saveClassGeofence(id:string,policy:import('../types').GeofencePolicy){return apiRequest(`/api/classes/${id}/geofence`,{method:'PUT',body:policy});}

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
  const res = await authenticatedRequest(supabase.auth,token => fetch(`${API_BASE_URL}/api/reports/session/${sessionId}/excel`, {
    headers: { Authorization: `Bearer ${token}` },
  }));

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

export async function staffSignIn(identifier:string,password:string){const response=await fetch(API_BASE_URL+'/api/auth/staff-sign-in',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier,password})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Sign-in failed.');return data as {access_token:string;refresh_token:string};}
export interface ManagedPerson{id:string;userId:string;name:string;email:string;loginId:string;department:string;semester:string;classRollNumber?:string;section?:string;archivedAt?:string|null;classes?:{id:string;name:string;code:string;semester:string}[];role:'admin'|'faculty'|'student';avatarUrl?:string;createdAt:string}
export interface FacultyCredentials{email:string;loginId:string;temporaryPassword:string;confirmationSent?:boolean;requiresPasswordChange:boolean}
export const getManagedPeople=()=>apiRequest<ManagedPerson[]>('/api/management/people');
export const getManagedStudents=()=>apiRequest<ManagedPerson[]>('/api/management/students');
export const saveStaffProfile=(data:{fullName:string;department:string})=>apiRequest('/api/management/me',{method:'PUT',body:data});
export const saveManagedStudent=(id:string,data:{fullName:string;department:string;rollNumber:string;semester:string;classRollNumber?:string;section?:string})=>apiRequest(`/api/management/students/${id}`,{method:'PUT',body:data});
export const saveManagedFaculty=(id:string,data:{fullName:string;department:string})=>apiRequest(`/api/management/faculty/${id}`,{method:'PUT',body:data});
export const createFacultyAccount=(data:{fullName:string;department:string;email:string})=>apiRequest<FacultyCredentials>('/api/management/faculty',{method:'POST',body:data});
export const resetFacultyPassword=(id:string)=>apiRequest<FacultyCredentials>(`/api/management/faculty/${id}/reset-password`,{method:'POST'});
export const changeInitialPassword=(password:string)=>apiRequest('/api/auth/initial-password',{method:'POST',body:{password}});

export const deleteClass=(id:string)=>apiRequest(`/api/classes/${id}`,{method:'DELETE'});
export const removeEnrollment=(classId:string,studentId:string)=>apiRequest(`/api/classes/${classId}/students/${studentId}`,{method:'DELETE'});
export const deleteFaculty=(id:string)=>apiRequest(`/api/management/faculty/${id}`,{method:'DELETE'});
export const restoreFaculty=(id:string)=>apiRequest(`/api/management/faculty/${id}/restore`,{method:'POST'});
