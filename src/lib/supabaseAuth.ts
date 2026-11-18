export interface SupabaseUser {
  id: string;
  email: string;
  name?: string;
}

interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: SupabaseUser;
}

const STORAGE_KEY = 'midas_sb_session';

let cachedConfig: { url: string; anonKey: string } | null = null;

async function getSupabaseConfig(): Promise<{ url: string; anonKey: string }> {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (envUrl && envKey) {
    return { url: envUrl.replace(/\/$/, ''), anonKey: envKey };
  }
  if (cachedConfig) return cachedConfig;

  const res = await fetch('/api/config');
  const data = await res.json().catch(() => ({}));
  if (!data?.auth?.supabaseUrl || !data?.auth?.supabaseAnonKey) {
    throw new Error(
      'Supabase Auth URL and Anon Key are not configured in Vercel Environment Variables (SUPABASE_URL and SUPABASE_ANON_KEY).'
    );
  }
  cachedConfig = {
    url: String(data.auth.supabaseUrl).replace(/\/$/, ''),
    anonKey: String(data.auth.supabaseAnonKey),
  };
  return cachedConfig;
}

function mapUser(raw: any): SupabaseUser {
  return {
    id: raw.id,
    email: raw.email || '',
    name: raw.user_metadata?.full_name || raw.user_metadata?.name || raw.email?.split('@')[0],
  };
}

function saveSession(data: any): StoredSession {
  const session: StoredSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + ((Number(data.expires_in) || 3600) - 60) * 1000,
    user: mapUser(data.user),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export const supabaseAuth = {
  getStoredSession(): StoredSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as StoredSession;
    } catch {
      return null;
    }
  },

  consumeUrlAuthError(): string | null {
    if (typeof window === 'undefined') return null;

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const rawErr =
      searchParams.get('error_description') ||
      hashParams.get('error_description') ||
      searchParams.get('error') ||
      hashParams.get('error');

    if (rawErr) {
      window.history.replaceState(null, '', window.location.pathname);
      return rawErr;
    }
    return null;
  },

  async getValidAccessToken(): Promise<string | null> {
    const current = this.getStoredSession();
    if (!current) return null;
    if (current.expires_at > Date.now()) {
      return current.access_token;
    }
    if (!current.refresh_token) return null;

    try {
      const cfg = await getSupabaseConfig();
      const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.anonKey,
        },
        body: JSON.stringify({ refresh_token: current.refresh_token }),
      });
      if (!res.ok) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      const data = await res.json();
      const updated = saveSession(data);
      return updated.access_token;
    } catch {
      return null;
    }
  },

  async sendEmailOtp(email: string, name?: string): Promise<void> {
    const cfg = await getSupabaseConfig();
    const res = await fetch(`${cfg.url}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.anonKey,
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        create_user: true,
        data: name?.trim() ? { full_name: name.trim(), name: name.trim() } : undefined,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error_description || data.msg || data.message || 'Could not dispatch OTP code');
    }
  },

  async verifyEmailOtp(
    email: string,
    token: string,
    preferredType: 'email' | 'signup' | 'recovery' = 'email'
  ): Promise<SupabaseUser> {
    const cfg = await getSupabaseConfig();
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();

    const tryVerify = async (type: 'email' | 'signup' | 'recovery') => {
      const res = await fetch(`${cfg.url}/auth/v1/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.anonKey,
        },
        body: JSON.stringify({
          email: cleanEmail,
          token: cleanToken,
          type,
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    };

    let attempt = await tryVerify(preferredType);
    if (!attempt.ok && (attempt.status === 400 || attempt.status === 401 || attempt.status === 403)) {
      const fallbackType = preferredType === 'email' ? 'signup' : 'email';
      attempt = await tryVerify(fallbackType);
    }

    if (!attempt.ok || !attempt.data?.access_token) {
      throw new Error(
        attempt.data?.error_description ||
        attempt.data?.msg ||
        attempt.data?.message ||
        'Invalid or expired verification code'
      );
    }

    return saveSession(attempt.data).user;
  },

  async updatePassword(newPassword: string, explicitAccessToken?: string): Promise<SupabaseUser> {
    const cfg = await getSupabaseConfig();
    const token = explicitAccessToken || (await this.getValidAccessToken());
    if (!token) {
      throw new Error('Active verification session missing. Please request a fresh 6-digit code.');
    }

    const res = await fetch(`${cfg.url}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: cfg.anonKey,
      },
      body: JSON.stringify({ password: newPassword }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error_description || data.msg || data.message || 'Could not update password');
    }

    const current = this.getStoredSession();
    const mapped = mapUser(data);
    if (current) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, user: mapped }));
    }
    return mapped;
  },

  /**
   * Verifies a 6-digit OTP (creating the auth.users entry via /otp if this
   * email previously signed in via Clerk), sets the new password via PUT /user,
   * and returns the authenticated user session.
   */
  async resetPasswordWithOtp(email: string, otpToken: string, newPassword: string): Promise<SupabaseUser> {
    await this.verifyEmailOtp(email, otpToken, 'email');
    return this.updatePassword(newPassword);
  },

  async signIn(email: string, password: string): Promise<SupabaseUser> {
    const cfg = await getSupabaseConfig();
    const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.anonKey,
      },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error_description || data.msg || 'Invalid email or password');
    }
    return saveSession(data).user;
  },

  async signUp(email: string, password: string, name?: string): Promise<{ user: SupabaseUser | null; needsConfirmation: boolean }> {
    const cfg = await getSupabaseConfig();
    const res = await fetch(`${cfg.url}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.anonKey,
      },
      body: JSON.stringify({
        email: email.trim(),
        password,
        data: name?.trim() ? { full_name: name.trim(), name: name.trim() } : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error_description || data.msg || 'Sign up failed');
    }
    if (data.access_token) {
      return { user: saveSession(data).user, needsConfirmation: false };
    }
    return { user: data.user ? mapUser(data.user) : null, needsConfirmation: true };
  },

  async signInWithGoogle(): Promise<void> {
    const cfg = await getSupabaseConfig();
    const redirectTo = encodeURIComponent(window.location.origin + '/login');
    const scopes = encodeURIComponent('https://www.googleapis.com/auth/userinfo.email');
    window.location.href = `${cfg.url}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}&scopes=${scopes}`;
  },

  async consumeOAuthHashCallback(): Promise<SupabaseUser | null> {
    if (typeof window === 'undefined' || !window.location.hash.includes('access_token=')) {
      return null;
    }
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token') || '';
    const expiresIn = Number(params.get('expires_in') || 3600);
    if (!accessToken) return null;

    const cfg = await getSupabaseConfig();
    const res = await fetch(`${cfg.url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: cfg.anonKey },
    });
    if (!res.ok) return null;
    const rawUser = await res.json();
    const session = saveSession({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      user: rawUser,
    });
    window.history.replaceState(null, '', window.location.pathname);
    return session.user;
  },

  async signOut(): Promise<void> {
    const token = this.getStoredSession()?.access_token;
    localStorage.removeItem(STORAGE_KEY);
    if (token) {
      try {
        const cfg = await getSupabaseConfig();
        await fetch(`${cfg.url}/auth/v1/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, apikey: cfg.anonKey },
        });
      } catch {}
    }
  },
};