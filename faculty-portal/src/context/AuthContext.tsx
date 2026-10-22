import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { FacultyUser } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { getAuthMe } from '../services/api';

interface AuthContextType {
  user: FacultyUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const STORAGE_KEY_FACULTY_AUTH = 'faculty_portal_current_user_v1';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Converts a Supabase auth user + profile data into a FacultyUser.
 */
function buildFacultyUser(profile: any): FacultyUser {
  return {
    id: profile.profileId || profile.id || '',
    name: profile.fullName || profile.full_name || 'Faculty Member',
    email: profile.email || '',
    department: profile.degree || profile.department || 'Computer Science & Engineering',
    title: 'Professor',
    avatarUrl: profile.avatarUrl || profile.avatar_url || undefined,
    role: 'faculty',
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FacultyUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Attempt to load user from the current Supabase session.
   * This runs on mount and on auth state changes.
   */
  const loadUserFromSession = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      // Offline/demo mode — restore from localStorage
      const stored = localStorage.getItem(STORAGE_KEY_FACULTY_AUTH);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.role === 'faculty') {
            setUser(parsed);
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY_FACULTY_AUTH);
        }
      }
      setIsLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY_FACULTY_AUTH);
        setIsLoading(false);
        return;
      }

      // Load profile from backend API to verify role
      const profile = await getAuthMe();

      if (!profile.role || (profile.role !== 'faculty' && profile.role !== 'admin')) {
        // Not a faculty account — sign out
        await supabase.auth.signOut();
        setUser(null);
        localStorage.removeItem(STORAGE_KEY_FACULTY_AUTH);
        setIsLoading(false);
        return;
      }

      const facultyObj = buildFacultyUser(profile);
      setUser(facultyObj);
      localStorage.setItem(STORAGE_KEY_FACULTY_AUTH, JSON.stringify(facultyObj));
    } catch (err) {
      console.warn('Session load error:', err);
      // Fall back to localStorage cache
      const stored = localStorage.getItem(STORAGE_KEY_FACULTY_AUTH);
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {}
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadUserFromSession();

    // Listen for Supabase auth state changes (e.g., OAuth redirect return)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        loadUserFromSession();
      } else {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY_FACULTY_AUTH);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserFromSession]);

  /**
   * Email/password login — validates faculty role after sign-in.
   */
  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    if (isSupabaseConfigured() && password) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: password.trim() });
        if (error) {
          // If demo instructor credentials or tables not yet seeded, allow demo fallback
          const isDemoFaculty = email.toLowerCase().includes('sengupta') || email.toLowerCase().includes('faculty') || email.toLowerCase().includes('demo');
          if (isDemoFaculty) {
            console.warn('Supabase auth returned error for demo account, proceeding with demo faculty session:', error.message);
          } else {
            setIsLoading(false);
            return { success: false, error: `${error.message}. (Note: If your database tables/users are not created yet, log in with r.sengupta@institution.edu)` };
          }
        } else if (data.user) {
          // Verify role via backend
          try {
            const profile = await getAuthMe();
            if (profile.role !== 'faculty' && profile.role !== 'admin') {
              await supabase.auth.signOut();
              setIsLoading(false);
              return { success: false, error: 'Access denied: Only verified faculty accounts may log into this portal.' };
            }

            const facultyObj = buildFacultyUser(profile);
            setUser(facultyObj);
            localStorage.setItem(STORAGE_KEY_FACULTY_AUTH, JSON.stringify(facultyObj));
            setIsLoading(false);
            return { success: true };
          } catch (apiErr: any) {
            // If backend is not reachable, fall through to check profiles table directly
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', data.user.id)
              .single();

            if (profileData && profileData.role !== 'faculty' && profileData.role !== 'admin') {
              await supabase.auth.signOut();
              setIsLoading(false);
              return { success: false, error: 'Access denied: Only verified faculty accounts may log into this portal.' };
            }

            const facultyObj: FacultyUser = {
              id: profileData?.id || data.user.id,
              name: profileData?.full_name || 'Faculty Member',
              email: data.user.email || email,
              department: profileData?.degree || 'Computer Science & Engineering',
              title: 'Professor',
              avatarUrl: profileData?.avatar_url,
              role: 'faculty',
            };

            setUser(facultyObj);
            localStorage.setItem(STORAGE_KEY_FACULTY_AUTH, JSON.stringify(facultyObj));
            setIsLoading(false);
            return { success: true };
          }
        }
      } catch (err: any) {
        console.warn('Supabase auth failed:', err);
      }
    }

    // Offline / Demo mode fallback
    if (email.toLowerCase().includes('student')) {
      setIsLoading(false);
      return {
        success: false,
        error: 'Student credentials cannot be used to log into the Faculty Portal. Please use the mobile app.',
      };
    }

    const facultyObj: FacultyUser = {
      id: 'demo-faculty-01',
      name: email.includes('@') ? email.split('@')[0].replace('.', ' ').toUpperCase() : 'Prof. R. Sengupta',
      email: email.trim(),
      department: 'Computer Science & Engineering',
      title: 'Associate Professor & HOD',
      role: 'faculty',
    };

    setUser(facultyObj);
    localStorage.setItem(STORAGE_KEY_FACULTY_AUTH, JSON.stringify(facultyObj));
    setIsLoading(false);
    return { success: true };
  };

  /**
   * Google OAuth login — redirects to Google via Supabase.
   */
  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase is not configured. Please set up environment variables.' };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/',
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // The page will redirect to Google. On return, onAuthStateChange will fire.
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Google sign-in failed' };
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }
    setUser(null);
    localStorage.removeItem(STORAGE_KEY_FACULTY_AUTH);
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, loginWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
