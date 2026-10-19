import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded, isSignedIn, signOut: clerkSignOut, getToken } = useClerkAuth();
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const [user, setUser] = useState<User | null>(null);

  // Register the Clerk JWT token interceptor dynamically onto our custom API Axios instance
  useEffect(() => {
    if (!isLoaded) return;

    const interceptor = api.interceptors.request.use(async (config) => {
      try {
        const token = await getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (err) {
        console.error('Error attaching Clerk session token:', err);
      }
      return config;
    });

    return () => {
      api.interceptors.request.eject(interceptor);
    };
  }, [isLoaded, getToken]);

  // Map Clerk's reactive user model directly to the existing User interface to prevent any refactoring regressions
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

  const signIn = async () => {
    throw new Error('Use Clerk UI components directly to sign in.');
  };

  const signUp = async () => {
    throw new Error('Use Clerk UI components directly to sign up.');
  };

  const signOut = async () => {
    await clerkSignOut();
  };

  // Crucial Fix: We are only "done loading" when BOTH Clerk's auth AND user details are fully populated and mapped.
  // This prevents the split-second session propagation delay from prematurely triggering a redirect to "/login".
  const loading = !isLoaded || (isSignedIn && (!isUserLoaded || !user));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};