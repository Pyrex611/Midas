import React, { useEffect, useState } from 'react';
import { SignUp } from '@clerk/clerk-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const Signup: React.FC = () => {
  const { user, loading, providerMode, signUp, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSupabaseSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await signUp(email, password, name);
      if (res.needsConfirmation) {
        setAwaitingEmailConfirm(true);
        toast.info('Check your inbox to verify your email address', 'Verify Email');
      } else {
        toast.success('Account provisioned on Scout Free Tier', 'Welcome to MIDAS');
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Sign up failed', 'Registration Error');
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
          <SignUp
            signInUrl="/login"
            afterSignUpUrl="/"
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
              <h1 className="text-lg font-black text-royal-950">Create Your Workspace</h1>
              <p className="text-xs text-thistle-500 mt-0.5">Start free with 2,000 emails/mo, Sandbox &amp; AI SDR tools.</p>
            </div>

            {awaitingEmailConfirm ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-2 text-center">
                <p className="font-bold">Confirmation Link Sent</p>
                <p>Click the confirmation link sent to <strong>{email}</strong>, then return here to sign in.</p>
                <Link to="/login" className="inline-block mt-2 px-4 py-2 btn-royal rounded-xl font-bold text-white">
                  Go to Sign In
                </Link>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="w-full py-2.5 px-4 bg-white hover:bg-thistle-50 border border-gold-500/40 rounded-xl text-xs font-bold text-royal-950 glow-gold-hover transition-all"
                >
                  Sign up with Google
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gold-500/35" />
                  <span className="text-[10px] font-bold uppercase text-thistle-500">or email</span>
                  <div className="flex-1 h-px bg-gold-500/35" />
                </div>

                <form onSubmit={handleSupabaseSignUp} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Mercer"
                      className="w-full px-3.5 py-2.5 bg-thistle-50 border border-gold-500/40 rounded-xl font-medium focus:outline-none focus:border-gold-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Work Email</label>
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
                    <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Password (min 8 chars)</label>
                    <input
                      type="password"
                      required
                      minLength={8}
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
                    {submitting ? 'Creating Account...' : 'Create Free Account'}
                  </button>
                </form>
              </>
            )}

            <p className="text-center text-xs text-thistle-500 pt-2 border-t border-gold-500/30">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-royal-700 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};