import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import api from '../services/api';
import { supabaseAuth } from '../lib/supabaseAuth';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  providerMode: 'clerk' | 'supabase';
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<{ needsConfirmation: boolean }>;
  sendEmailOtp: (email: string, name?: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string, preferredType?: 'email' | 'signup') => Promise<void>;
  resetPasswordWithOtp: (email: string, otpToken: string, newPassword: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_FRONTEND_AUTH: 'clerk' | 'supabase' =
  import.meta.env.VITE_AUTH_PROVIDER === 'clerk' && Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
    ? 'clerk'
    : 'supabase';

const ClerkAuthProviderInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded, isSignedIn, signOut: clerkSignOut, getToken } = useClerkAuth();
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    const interceptor = api.interceptors.request.use(async (config) => {
      try {
        const token = await getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {}
      return config;
    });

    return () => {
      api.interceptors.request.eject(interceptor);
    };
  }, [isLoaded, getToken]);

  useEffect(() => {
    if (isLoaded && isSignedIn && clerkUser) {
      setUser({
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || '',
        name: clerkUser.fullName || clerkUser.primaryEmailAddress?.emailAddress.split('@')[0],
      });
    } else {
      setUser(null);
    }
  }, [isLoaded, isSignedIn, clerkUser]);

  const loading = !isLoaded || (isSignedIn && (!isUserLoaded || !user));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        providerMode: 'clerk',
        signIn: async () => { throw new Error('Use Clerk UI component'); },
        signUp: async () => { throw new Error('Use Clerk UI component'); },
        sendEmailOtp: async () => { throw new Error('Use Clerk UI component'); },
        verifyEmailOtp: async () => { throw new Error('Use Clerk UI component'); },
        resetPasswordWithOtp: async () => { throw new Error('Use Clerk UI component'); },
        signInWithGoogle: async () => { throw new Error('Use Clerk UI component'); },
        signOut: async () => { await clerkSignOut(); },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

const SupabaseAuthProviderInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const interceptor = api.interceptors.request.use(async (config) => {
      try {
        const token = await supabaseAuth.getValidAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {}
      return config;
    });

    (async () => {
      try {
        const oauthUser = await supabaseAuth.consumeOAuthHashCallback();
        if (oauthUser) {
          setUser(oauthUser);
          return;
        }
        const token = await supabaseAuth.getValidAccessToken();
        const stored = supabaseAuth.getStoredSession();
        if (token && stored?.user) {
          setUser(stored.user);
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      api.interceptors.request.eject(interceptor);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const u = await supabaseAuth.signIn(email, password);
    setUser(u);
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const result = await supabaseAuth.signUp(email, password, name);
    if (!result.needsConfirmation && result.user) {
      setUser(result.user);
    }
    return { needsConfirmation: result.needsConfirmation };
  };

  const sendEmailOtp = async (email: string, name?: string) => {
    await supabaseAuth.sendEmailOtp(email, name);
  };

  const verifyEmailOtp = async (email: string, token: string, preferredType: 'email' | 'signup' = 'email') => {
    const u = await supabaseAuth.verifyEmailOtp(email, token, preferredType);
    setUser(u);
  };

  const resetPasswordWithOtp = async (email: string, otpToken: string, newPassword: string) => {
    const u = await supabaseAuth.resetPasswordWithOtp(email, otpToken, newPassword);
    setUser(u);
  };

  const signInWithGoogle = async () => {
    await supabaseAuth.signInWithGoogle();
  };

  const signOut = async () => {
    await supabaseAuth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        providerMode: 'supabase',
        signIn,
        signUp,
        sendEmailOtp,
        verifyEmailOtp,
        resetPasswordWithOtp,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (ACTIVE_FRONTEND_AUTH === 'clerk') {
    return <ClerkAuthProviderInner>{children}</ClerkAuthProviderInner>;
  }
  return <SupabaseAuthProviderInner>{children}</SupabaseAuthProviderInner>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};