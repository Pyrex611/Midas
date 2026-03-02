import React, { createContext, useState, useEffect, useContext } from 'react';
import { authAPI, userAPI } from '../services/api';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  session: any;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const restoreSession = async () => {
    const token = localStorage.getItem('supabase.auth.token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      // Validate token by fetching session from backend
      const res = await authAPI.getSession();
      if (res.data.session) {
        setSession(res.data.session);
        // Fetch user profile
        const profileRes = await userAPI.getProfile();
        setUser(profileRes.data.user);
      } else {
        // Token invalid, clear storage
        localStorage.removeItem('supabase.auth.token');
      }
    } catch (error) {
      console.error('Failed to restore session', error);
      localStorage.removeItem('supabase.auth.token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    restoreSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await authAPI.signIn(email, password);
    if (res.data.session) {
      localStorage.setItem('supabase.auth.token', res.data.session.access_token);
      setSession(res.data.session);
      const profileRes = await userAPI.getProfile();
      setUser(profileRes.data.user);
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const res = await authAPI.signUp(email, password, name);
    if (res.data.session) {
      localStorage.setItem('supabase.auth.token', res.data.session.access_token);
      setSession(res.data.session);
      const profileRes = await userAPI.getProfile();
      setUser(profileRes.data.user);
    } else {
      // If email confirmation required
      alert('Signup successful. Please check your email to confirm.');
    }
  };

  const signOut = async () => {
    await authAPI.signOut();
    localStorage.removeItem('supabase.auth.token');
    setSession(null);
    setUser(null);
  };

  const updateUser = (data: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...data } : null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};