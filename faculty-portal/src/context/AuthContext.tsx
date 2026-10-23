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
      setUser(null);
      localStorage.removeItem(STORAGE_KEY_FACULTY_AUTH);
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
        await supabase.auth.signOut({ scope: 'local' });
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
      setUser(null);
      localStorage.removeItem(STORAGE_KEY_FACULTY_AUTH);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadUserFromSession();

    // Listen for Supabase auth state changes (e.g., OAuth redirect return)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // Auth listeners run while the client processes its session lock.
        setTimeout(() => { void loadUserFromSession(); }, 0);
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
    setUser(null);
    localStorage.removeItem(STORAGE_KEY_FACULTY_AUTH);
    try {
      if (!isSupabaseConfigured()) {
        return { success: false, error: 'Supabase is not configured.' };
      }
      if (!email.trim() || !password) {
        return { success: false, error: 'Enter your email and app password.' };
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return { success: false, error: error.message };
      if (!data.session || !data.user) {
        return { success: false, error: 'No authenticated session was returned. Please sign in again.' };
      }
      const profile = await getAuthMe();
      if (profile.role !== 'faculty' && profile.role !== 'admin') {
        await supabase.auth.signOut({ scope: 'local' });
        return { success: false, error: 'Access denied: Only verified faculty accounts may log into this portal.' };
      }
      const facultyObj = buildFacultyUser(profile);
      setUser(facultyObj);
      localStorage.setItem(STORAGE_KEY_FACULTY_AUTH, JSON.stringify(facultyObj));
      return { success: true };
    } catch (err: any) {
      setUser(null);
      localStorage.removeItem(STORAGE_KEY_FACULTY_AUTH);
      return { success: false, error: err.message || 'Unable to verify faculty access. Please try again.' };
    } finally {
      setIsLoading(false);
    }
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
        await supabase.auth.signOut({ scope: 'local' });
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
