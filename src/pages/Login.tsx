import React, { useEffect, useState } from 'react';
import { SignIn } from '@clerk/clerk-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const Login: React.FC = () => {
  const { user, loading, providerMode, signIn, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password);
      toast.success('Welcome back to MIDAS', 'Signed In');
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err?.message || 'Sign in failed', 'Authentication Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-thistle-canvas py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full flex flex-col items-center space-y-6">
        <div className="text-center">
          <span className="text-3xl font-black bg-gradient-to-r from-royal-700 via-royal-600 to-gold-500 bg-clip-text text-transparent tracking-wider">
            MIDAS
          </span>
          <p className="text-xs text-thistle-500 font-semibold mt-1">Golden Email Infrastructure</p>
        </div>

        {providerMode === 'clerk' ? (
          <SignIn
            signUpUrl="/signup"
            afterSignInUrl="/"
            appearance={{
              elements: {
                formButtonPrimary: 'bg-[#4A2559] hover:bg-[#33183E] text-white border border-[#D4AF37]/50',
                card: 'shadow-xl rounded-2xl border border-[#D4AF37]/40 bg-white',
                footerActionLink: 'text-[#4A2559] hover:text-[#6D3B82]',
              },
            }}
          />
        ) : (
          <div className="w-full card-midas rounded-3xl p-8 space-y-5 shadow-xl">
            <div className="text-center pb-3 border-b border-gold-500/35">
              <h1 className="text-lg font-black text-royal-950">Sign in to Workspace</h1>
              <p className="text-xs text-thistle-500 mt-0.5">Access sequences, Town Crier &amp; deliverability controls.</p>
            </div>

            <button
              type="button"
              onClick={() => signInWithGoogle()}
              className="w-full py-2.5 px-4 bg-white hover:bg-thistle-50 border border-gold-500/40 rounded-xl text-xs font-bold text-royal-950 glow-gold-hover transition-all"
            >
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gold-500/35" />
              <span className="text-[10px] font-bold uppercase text-thistle-500">or email</span>
              <div className="flex-1 h-px bg-gold-500/35" />
            </div>

            <form onSubmit={handleSupabaseLogin} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="founder@company.com"
                  className="w-full px-3.5 py-2.5 bg-thistle-50 border border-gold-500/40 rounded-xl font-medium focus:outline-none focus:border-gold-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 bg-thistle-50 border border-gold-500/40 rounded-xl focus:outline-none focus:border-gold-500"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 btn-royal rounded-xl font-bold text-xs"
              >
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-xs text-thistle-500 pt-2 border-t border-gold-500/30">
              New to MIDAS?{' '}
              <Link to="/signup" className="font-bold text-royal-700 hover:underline">
                Create free Scout account
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};