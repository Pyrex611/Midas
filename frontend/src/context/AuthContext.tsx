import React, { createContext, useState, useEffect, useContext } from 'react';
import { authAPI, userAPI, userSettingsAPI } from '../services/api';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface UserSettings {
  emailFrom?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  imapUser?: string;
  imapPass?: string;
}

interface AuthContextType {
  user: User | null;
  settings: UserSettings | null;
  session: any;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  updateSettings: (newSettings: UserSettings) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  token: 'supabase.auth.token',
  settings: 'user.settings',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const restoreSession = async () => {
    const token = localStorage.getItem(STORAGE_KEYS.token);
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await authAPI.getSession();
      if (res.data.session) {
        setSession(res.data.session);
        const profileRes = await userAPI.getProfile();
        setUser(profileRes.data.user);

        // Load settings from localStorage first, then fetch from server
        const cachedSettings = localStorage.getItem(STORAGE_KEYS.settings);
        if (cachedSettings) {
          setSettings(JSON.parse(cachedSettings));
        }
        // Fetch fresh settings from server (background)
        userSettingsAPI.get().then(settingsRes => {
          setSettings(settingsRes.data);
          localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settingsRes.data));
        }).catch(err => console.error('Failed to fetch settings', err));
      } else {
        localStorage.removeItem(STORAGE_KEYS.token);
        localStorage.removeItem(STORAGE_KEYS.settings);
      }
    } catch (error) {
      console.error('Failed to restore session', error);
      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.settings);
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
      localStorage.setItem(STORAGE_KEYS.token, res.data.session.access_token);
      setSession(res.data.session);
      const profileRes = await userAPI.getProfile();
      setUser(profileRes.data.user);

      const settingsRes = await userSettingsAPI.get();
      setSettings(settingsRes.data);
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settingsRes.data));
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const res = await authAPI.signUp(email, password, name);
    if (res.data.session) {
      localStorage.setItem(STORAGE_KEYS.token, res.data.session.access_token);
      setSession(res.data.session);
      const profileRes = await userAPI.getProfile();
      setUser(profileRes.data.user);

      const settingsRes = await userSettingsAPI.get();
      setSettings(settingsRes.data);
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settingsRes.data));
    } else {
      alert('Signup successful. Please check your email to confirm.');
    }
  };

  const signOut = async () => {
    await authAPI.signOut();
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.settings);
    setSession(null);
    setUser(null);
    setSettings(null);
  };

  const updateUser = (data: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...data } : null);
  };

  const updateSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(newSettings));
  };

  return (
    <AuthContext.Provider value={{ user, settings, session, loading, signIn, signUp, signOut, updateUser, updateSettings }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};