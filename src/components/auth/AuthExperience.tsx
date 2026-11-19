import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabaseAuth } from '../../lib/supabaseAuth';
import { Icons } from '../../lib/icons';

interface AuthExperienceProps {
  initialMode?: 'signin' | 'signup';
}

type AuthStage = 'email' | 'credentials' | 'verify' | 'reset_verify';

export const AuthExperience: React.FC<AuthExperienceProps> = ({ initialMode = 'signin' }) => {
  const {
    user,
    loading,
    magicLinkError,
    needsPasswordSetup,
    signIn,
    signUp,
    sendAuthChallenge,
    verifyEmailOtp,
    resetPasswordWithOtp,
    completePasswordSetup,
    dismissPasswordSetup,
    signInWithGoogle,
  } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Left Showcase Card Page: 0 = Town Crier (Static Default), 1 = Outbound Campaigns
  const [bannerPage, setBannerPage] = useState<0 | 1>(0);

  // Auth Flow State
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(initialMode);
  const [stage, setStage] = useState<AuthStage>('email');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loginHint, setLoginHint] = useState<string | null>(null);
  const [signupConflict, setSignupConflict] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [sendingAction, setSendingAction] = useState<'signin_mail' | 'reset' | 'password' | 'signup' | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const otpInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const urlError = supabaseAuth.consumeUrlAuthError();
    if (urlError) {
      toast.error(urlError, 'Authentication Redirect Error');
    }
  }, [toast]);

  useEffect(() => {
    if (magicLinkError) {
      toast.error(magicLinkError, 'Sign-In Link Error');
    }
  }, [magicLinkError, toast]);

  useEffect(() => {
    if (!loading && user && !needsPasswordSetup) {
      navigate('/', { replace: true });
    }
  }, [user, loading, needsPasswordSetup, navigate]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      toast.error(err?.message || 'Google Sign-In failed to start', 'Google OAuth Error');
      setGoogleLoading(false);
    }
  };

  const switchMode = (nextMode: 'signin' | 'signup') => {
    setAuthMode(nextMode);
    setStage('email');
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setOtpCode('');
    setLoginHint(null);
    setSignupConflict(false);
  };

  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return toast.warning('Enter a valid work email address', 'Validation');
    }
    setEmail(cleanEmail);
    setLoginHint(null);
    setSignupConflict(false);
    setStage('credentials');
    setTimeout(() => passwordInputRef.current?.focus(), 60);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setStage('email');

    if (authMode === 'signup' && password.length < 8) {
      return toast.warning('Password must be at least 8 characters long', 'Validation');
    }

    setSubmitting(true);
    setSendingAction(authMode === 'signup' ? 'signup' : 'password');
    setLoginHint(null);
    setSignupConflict(false);

    try {
      if (authMode === 'signin') {
        await signIn(cleanEmail, password);
        toast.success('Welcome back to MIDAS', 'Signed In');
        navigate('/', { replace: true });
      } else {
        const res = await signUp(cleanEmail, password, name);
        if (res.needsConfirmation) {
          setOtpCode('');
          setStage('verify');
          toast.success(
            `Sign-Up mail sent to ${cleanEmail} with your verification code and Magic Sign-In button.`,
            'Check Your Inbox'
          );
          setTimeout(() => otpInputRef.current?.focus(), 80);
        } else {
          toast.success('Account provisioned on Scout Free Tier', 'Welcome to MIDAS');
          navigate('/', { replace: true });
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed';
      if (authMode === 'signin') {
        setLoginHint(
          'Password did not match or your account was created prior to our auth upgrade. Use "Request Sign-In Mail" or "Reset Password" below.'
        );
      } else if (msg.toLowerCase().includes('already exists')) {
        setSignupConflict(true);
      }
      toast.error(msg, 'Auth Error');
    } finally {
      setSubmitting(false);
      setSendingAction(null);
    }
  };

  const handleRequestSignInMail = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setStage('email');

    setSubmitting(true);
    setSendingAction('signin_mail');
    setLoginHint(null);

    try {
      await sendAuthChallenge(cleanEmail, 'both', undefined, 'signin');
      setOtpCode('');
      setStage('verify');
      toast.success(
        `Sign-In mail sent to ${cleanEmail} with a verification code and direct Magic Sign-In button.`,
        'Check Your Inbox'
      );
      setTimeout(() => otpInputRef.current?.focus(), 80);
    } catch (err: any) {
      toast.error(err?.message || 'Could not send sign-in mail', 'Auth Error');
    } finally {
      setSubmitting(false);
      setSendingAction(null);
    }
  };

  const handleRequestResetPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setStage('email');

    setSubmitting(true);
    setSendingAction('reset');
    setLoginHint(null);

    try {
      await sendAuthChallenge(cleanEmail, 'both', undefined, 'reset');
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
      setStage('reset_verify');
      toast.success(
        `Password reset mail sent to ${cleanEmail} with a verification code and direct reset button.`,
        'Check Your Inbox'
      );
      setTimeout(() => otpInputRef.current?.focus(), 80);
    } catch (err: any) {
      toast.error(err?.message || 'Could not send password reset mail', 'Auth Error');
    } finally {
      setSubmitting(false);
      setSendingAction(null);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = otpCode.replace(/\D/g, '').trim();
    if (code.length < 6 || code.length > 10) {
      return toast.warning('Enter the complete 6–8 digit verification code from your email', 'Code Required');
    }

    if (stage === 'reset_verify') {
      if (newPassword.length < 8) {
        return toast.warning('New password must be at least 8 characters long', 'Password Required');
      }
      if (newPassword !== confirmPassword) {
        return toast.warning('Passwords do not match', 'Validation');
      }
    }

    setSubmitting(true);
    try {
      if (stage === 'reset_verify') {
        await resetPasswordWithOtp(email, code, newPassword);
        toast.success('Password saved and workspace unlocked', 'Password Set');
      } else {
        await verifyEmailOtp(email, code);
        toast.success('Workspace verified and unlocked', 'Welcome to MIDAS');
      }
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err?.message || 'Invalid or expired verification code', 'Verification Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteLinkPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      return toast.warning('New password must be at least 8 characters long', 'Password Required');
    }
    if (newPassword !== confirmPassword) {
      return toast.warning('Passwords do not match', 'Validation');
    }

    setSubmitting(true);
    try {
      await completePasswordSetup(newPassword);
      toast.success('Password updated and workspace unlocked', 'Password Saved');
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err?.message || 'Could not save new password', 'Update Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendChallenge = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const intent = stage === 'reset_verify' ? 'reset' : authMode === 'signup' ? 'signup' : 'signin';
    setSubmitting(true);
    try {
      await sendAuthChallenge(cleanEmail, 'both', authMode === 'signup' ? name : undefined, intent);
      toast.success(`Fresh verification mail dispatched to ${cleanEmail}`, 'Mail Resent');
    } catch (err: any) {
      toast.error(err?.message || 'Could not resend mail', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const cleanOtpDigits = otpCode.replace(/\D/g, '');

  return (
    <div className="min-h-screen bg-thistle-canvas text-royal-950 flex flex-col">
      {/* Top Bar */}
      <header className="max-w-7xl w-full mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/login" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-royal-700 border border-gold-500/60 flex items-center justify-center shadow-sm">
            <span className="text-gold-300 font-black text-base">M</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black bg-gradient-to-r from-royal-700 via-royal-600 to-gold-500 bg-clip-text text-transparent tracking-wider">
              MIDAS
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white border border-gold-500/40 text-royal-800">
              v3.3
            </span>
          </div>
        </Link>

        <nav className="hidden sm:flex items-center gap-6 text-xs font-bold text-royal-800">
          <a href="#architecture" className="hover:text-royal-600 transition-colors">Architecture</a>
          <a href="#pricing" className="hover:text-royal-600 transition-colors">Pricing</a>
          <Link
            to="/docs"
            className="px-3.5 py-1.5 rounded-xl bg-white border border-gold-500/40 hover:bg-thistle-100 transition-colors glow-gold-hover"
          >
            Developer Docs &rarr;
          </Link>
        </nav>
      </header>

      {/* Split-Screen Above the Fold */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 pb-16 pt-2 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch min-h-[630px]">

          {/* LEFT (7 COLS): MINIMALIST FLOATING SHOWCASE CARD */}
          <section className="lg:col-span-7 bg-royal-950 rounded-[28px] border border-gold-500/45 p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden shadow-2xl">
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-royal-600/35 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-gold-500/15 blur-3xl pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-royal-800/90 border border-gold-500/40 text-[11px] font-bold text-gold-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{bannerPage === 0 ? 'Town Crier · Audience & Newsletter Engine' : 'MIDAS Sequences · Deliverability-First Outbound'}</span>
              </div>

              <div className="flex items-center gap-4 text-thistle-300">
                <button
                  type="button"
                  onClick={() => setBannerPage(bannerPage === 0 ? 1 : 0)}
                  aria-label="Previous showcase slide"
                  className="text-thistle-300 hover:text-gold-300 transition-colors p-1 focus:outline-none"
                >
                  <Icons.ChevronLeft className="text-lg" />
                </button>
                <span className="text-[10px] font-mono text-thistle-300/70">{bannerPage + 1} / 2</span>
                <button
                  type="button"
                  onClick={() => setBannerPage(bannerPage === 0 ? 1 : 0)}
                  aria-label="Next showcase slide"
                  className="text-thistle-300 hover:text-gold-300 transition-colors p-1 focus:outline-none"
                >
                  <Icons.ChevronLeft className="text-lg rotate-180" />
                </button>
              </div>
            </div>

            {bannerPage === 0 ? (
              <div className="relative z-10 my-auto py-8 space-y-8">
                <div className="space-y-4">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-normal tracking-tight leading-[1.12] text-white">
                    Publish newsletters.<br />
                    <span className="text-gold-300 italic">Capture leads effortlessly.</span>
                  </h1>
                  <p className="text-sm text-thistle-300/90 max-w-xl leading-relaxed">
                    Launch slug-addressed Gong publication channels with 1-line Shadow-DOM modals, progressive profiling, and sub-60s welcome lead-magnet delivery on isolated brand mailboxes.
                  </p>
                </div>

                <div className="bg-royal-800/55 backdrop-blur-md border border-gold-500/35 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-gold-500/25 pb-3 text-xs">
                    <span className="font-bold text-white flex items-center gap-2">
                      <Icons.TownCrier className="text-gold-300" />
                      <span>Gong Channel · /weekly-alpha</span>
                    </span>
                    <span className="font-mono text-[10px] text-emerald-300">community@brand.io</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-royal-950/75 border border-gold-500/25 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-thistle-300">Embed</span>
                      <p className="font-mono font-bold text-gold-300 text-[11px]">&lt;MidasModal /&gt;</p>
                      <p className="text-[11px] text-thistle-300/80">Zero-CSS Shadow DOM</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-royal-950/75 border border-gold-500/25 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-thistle-300">Autoresponder</span>
                      <p className="font-bold text-white">&lt; 60s Delivery</p>
                      <p className="text-[11px] text-thistle-300/80">Smart links &amp; attachments</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-royal-950/75 border border-gold-500/25 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-thistle-300">Envelopes</span>
                      <p className="font-bold text-white">4 Editorial Layouts</p>
                      <p className="text-[11px] text-thistle-300/80">Card, Editorial, Minimal</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative z-10 my-auto py-8 space-y-8">
                <div className="space-y-4">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-normal tracking-tight leading-[1.12] text-white">
                    Cold outbound that lands.<br />
                    <span className="text-gold-300 italic">Protected by architecture.</span>
                  </h1>
                  <p className="text-sm text-thistle-300/90 max-w-xl leading-relaxed">
                    Rotate across warmed burner inboxes with bounded 5-send sweeps, Knowledge Base grounded AI drafting, and State-Graph reply agents that pause automatically on Out-of-Office.
                  </p>
                </div>

                <div className="bg-royal-800/55 backdrop-blur-md border border-gold-500/35 rounded-2xl p-6 space-y-4 text-xs">
                  <div className="flex items-center justify-between border-b border-gold-500/25 pb-3 text-thistle-200">
                    <span>Bounded Sweep: <strong className="text-white font-mono">5 sends/tick · 20s cooldown</strong></span>
                    <span className="text-emerald-400 font-bold font-mono">Circuit Breakers Armed</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl bg-royal-950/75 border border-gold-500/25 space-y-1">
                      <span className="text-[10px] font-mono text-thistle-300">alex@outreach-1.io</span>
                      <p className="text-sm font-black text-white">18 / 30 sent</p>
                      <div className="w-full h-1 bg-royal-700 rounded-full"><div className="w-3/5 h-full bg-gold-400 rounded-full" /></div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-royal-950/75 border border-gold-500/25 space-y-1">
                      <span className="text-[10px] font-mono text-thistle-300">sarah@outreach-2.io</span>
                      <p className="text-sm font-black text-white">14 / 30 sent</p>
                      <div className="w-full h-1 bg-royal-700 rounded-full"><div className="w-1/2 h-full bg-emerald-400 rounded-full" /></div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-royal-950/75 border border-gold-500/25 space-y-1">
                      <span className="text-[10px] font-mono text-gold-300">AI State-Graph</span>
                      <p className="text-sm font-black text-white">OOO &amp; Objections</p>
                      <p className="text-[11px] text-thistle-300/80">KB &amp; Artifact Grounded</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="relative z-10 grid grid-cols-3 gap-4 pt-4 border-t border-gold-500/25 text-xs">
              <div>
                <p className="text-lg font-black text-white">5 / tick</p>
                <p className="text-[11px] text-thistle-300/80">Anti-burst pacing</p>
              </div>
              <div>
                <p className="text-lg font-black text-gold-300">Multi-ESP</p>
                <p className="text-[11px] text-thistle-300/80">Mailgun, Resend &amp; SMTP</p>
              </div>
              <div>
                <p className="text-lg font-black text-white">Scout Free</p>
                <p className="text-[11px] text-thistle-300/80">2,000 emails/mo included</p>
              </div>
            </div>
          </section>

          {/* RIGHT (5 COLS): CLEAN AUTH CARD */}
          <section className="lg:col-span-5 flex items-center justify-center">
            <div className="w-full max-w-md bg-white rounded-[28px] border border-gold-500/45 p-8 sm:p-10 shadow-xl space-y-6">

              {needsPasswordSetup && user ? (
                <form onSubmit={handleCompleteLinkPasswordReset} className="space-y-4 text-xs animate-in fade-in duration-150">
                  <div>
                    <h2 className="text-2xl font-black text-royal-950 tracking-tight">Set Your New Password</h2>
                    <p className="text-xs text-thistle-500 mt-1">
                      Email verified for <strong className="text-royal-800">{user.email}</strong>. Choose a new password to finish unlocking your workspace.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">
                      New Password (min 8 chars)
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-4 py-2.5 bg-thistle-50 border border-gold-500/40 rounded-xl focus:outline-none focus:border-gold-500"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-4 py-2.5 bg-thistle-50 border border-gold-500/40 rounded-xl focus:outline-none focus:border-gold-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 btn-royal rounded-xl font-bold text-xs"
                  >
                    {submitting ? 'Saving Password...' : 'Save Password & Enter Workspace'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      dismissPasswordSetup();
                      navigate('/', { replace: true });
                    }}
                    className="w-full text-center text-[11px] font-bold text-thistle-500 hover:text-royal-800"
                  >
                    Skip for now &rarr;
                  </button>
                </form>
              ) : (
                <>
                  {/* Mode Switcher */}
                  <div className="space-y-3">
                    <div className="flex p-1 bg-thistle-100 rounded-xl border border-gold-500/30 text-xs">
                      <button
                        type="button"
                        onClick={() => switchMode('signin')}
                        className={`flex-1 py-2 font-bold rounded-lg transition-all ${
                          authMode === 'signin'
                            ? 'bg-royal-700 text-white shadow-xs'
                            : 'text-royal-800 hover:bg-white/60'
                        }`}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => switchMode('signup')}
                        className={`flex-1 py-2 font-bold rounded-lg transition-all ${
                          authMode === 'signup'
                            ? 'bg-royal-700 text-white shadow-xs'
                            : 'text-royal-800 hover:bg-white/60'
                        }`}
                      >
                        Create Account
                      </button>
                    </div>

                    <div>
                      <h2 className="text-2xl font-black text-royal-950 tracking-tight">
                        {authMode === 'signup' ? 'Create your workspace' : 'Welcome back'}
                      </h2>
                      <p className="text-xs text-thistle-500 mt-0.5">
                        {authMode === 'signup'
                          ? 'Start free with 2,000 emails/mo, Zero-Setup Sandbox & Town Crier.'
                          : 'Sign in to access Town Crier, sequences & deliverability telemetry.'}
                      </p>
                    </div>
                  </div>

                  {/* OAuth Row: Google Active, Apple Frosted Inactive ("Soon") */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={googleLoading}
                      onClick={handleGoogleSignIn}
                      className="flex items-center justify-center gap-2 py-2.5 px-3 bg-white hover:bg-thistle-50 border border-gold-500/40 rounded-xl text-xs font-bold text-royal-950 transition-all shadow-2xs glow-gold-hover disabled:opacity-60"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-8.97z" />
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z" />
                        <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z" />
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z" />
                      </svg>
                      <span>{googleLoading ? 'Connecting...' : 'Google'}</span>
                    </button>

                    <button
                      type="button"
                      disabled
                      title="Apple Sign-In coming soon"
                      className="relative flex items-center justify-center gap-2 py-2.5 px-3 bg-royal-950/60 border border-gold-500/25 rounded-xl text-xs font-bold text-white/70 opacity-55 blur-[0.4px] cursor-not-allowed select-none"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                      </svg>
                      <span>Apple</span>
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-white/15 text-gold-300">Soon</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gold-500/35" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-thistle-500">or continue with email</span>
                    <div className="flex-1 h-px bg-gold-500/35" />
                  </div>

                  {magicLinkError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] font-semibold text-rose-800">
                      {magicLinkError}
                    </div>
                  )}

                  {stage === 'email' && (
                    <form onSubmit={handleEmailContinue} className="space-y-4 text-xs animate-in fade-in duration-150">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">Work Email</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="founder@company.com"
                          className="w-full px-4 py-2.5 bg-thistle-50 border border-gold-500/40 rounded-xl font-medium focus:outline-none focus:border-gold-500"
                          autoFocus
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 btn-royal rounded-xl font-bold text-xs tracking-wide"
                      >
                        Continue &rarr;
                      </button>
                    </form>
                  )}

                  {stage === 'credentials' && (
                    <div className="space-y-4 text-xs animate-in fade-in duration-150">
                      <div className="flex items-center justify-between px-3.5 py-2 bg-thistle-50 border border-gold-500/35 rounded-xl">
                        <span className="font-mono font-bold text-royal-950 truncate">{email}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setStage('email');
                            setPassword('');
                            setLoginHint(null);
                            setSignupConflict(false);
                          }}
                          className="text-[11px] font-bold text-royal-700 hover:underline ml-2 shrink-0"
                        >
                          Change
                        </button>
                      </div>

                      <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
                        {authMode === 'signup' && (
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">
                              Full Name (Optional)
                            </label>
                            <input
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="Alex Mercer"
                              className="w-full px-4 py-2.5 bg-thistle-50 border border-gold-500/40 rounded-xl font-medium focus:outline-none focus:border-gold-500"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">
                            {authMode === 'signup' ? 'Set Password (min 8 chars)' : 'Password'}
                          </label>
                          <input
                            ref={passwordInputRef}
                            type="password"
                            required
                            minLength={authMode === 'signup' ? 8 : 1}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full px-4 py-2.5 bg-thistle-50 border border-gold-500/40 rounded-xl focus:outline-none focus:border-gold-500"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full py-3 btn-royal rounded-xl font-bold text-xs tracking-wide"
                        >
                          {sendingAction === 'password'
                            ? 'Signing In...'
                            : sendingAction === 'signup'
                            ? 'Creating Account & Sending Mail...'
                            : authMode === 'signup'
                            ? 'Create Account & Send Sign-Up Mail'
                            : 'Sign In'}
                        </button>
                      </form>

                      {loginHint && authMode === 'signin' && (
                        <div className="p-3 bg-amber-50 border border-gold-500/45 rounded-xl text-[11px] text-amber-950 font-medium leading-relaxed">
                          {loginHint}
                        </div>
                      )}

                      {signupConflict && authMode === 'signup' && (
                        <div className="p-3 bg-thistle-50 border border-gold-500/45 rounded-xl flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-royal-950 font-medium">Account already exists for this email.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode('signin');
                              setSignupConflict(false);
                              setStage('credentials');
                            }}
                            className="font-bold text-royal-700 hover:underline whitespace-nowrap"
                          >
                            Switch to Sign In &rarr;
                          </button>
                        </div>
                      )}

                      {authMode === 'signin' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-gold-500/25">
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={handleRequestSignInMail}
                            className="py-2.5 px-3 bg-thistle-50 hover:bg-thistle-100 border border-gold-500/40 rounded-xl text-[11px] font-bold text-royal-950 transition-colors disabled:opacity-50"
                          >
                            {sendingAction === 'signin_mail' ? 'Sending...' : 'Request Sign-In Mail'}
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={handleRequestResetPassword}
                            className="py-2.5 px-3 bg-white hover:bg-thistle-50 border border-gold-500/35 rounded-xl text-[11px] font-bold text-royal-800 transition-colors disabled:opacity-50"
                          >
                            {sendingAction === 'reset' ? 'Sending...' : 'Reset Password'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {(stage === 'verify' || stage === 'reset_verify') && (
                    <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs animate-in fade-in duration-150">
                      <div className="p-3.5 bg-thistle-50 border border-gold-500/40 rounded-2xl text-center space-y-1">
                        <p className="font-bold text-royal-950">
                          {stage === 'reset_verify'
                            ? 'Verify code & set your new password'
                            : authMode === 'signup'
                            ? 'Confirm your new workspace'
                            : 'Check your inbox'}
                        </p>
                        <p className="text-[11px] text-thistle-500 leading-relaxed">
                          We sent a verification code and a direct Magic Sign-In button to{' '}
                          <strong className="text-royal-800">{email}</strong>. Enter the 6–8 digit code below or click the button in the email.
                        </p>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">
                          Verification Code (6 or 8 digits)
                        </label>
                        <input
                          ref={otpInputRef}
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={10}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="••••••••"
                          aria-label="Verification code"
                          className="w-full h-12 px-4 text-center text-xl font-mono font-black tracking-[0.35em] bg-thistle-50 border border-gold-500/50 rounded-xl focus:outline-none focus:border-royal-700"
                        />
                      </div>

                      {stage === 'reset_verify' && (
                        <div className="space-y-3 pt-1">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">
                              New Password (min 8 chars)
                            </label>
                            <input
                              type="password"
                              required
                              minLength={8}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="••••••••••••"
                              className="w-full px-4 py-2.5 bg-thistle-50 border border-gold-500/40 rounded-xl focus:outline-none focus:border-gold-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-thistle-500 mb-1">
                              Confirm New Password
                            </label>
                            <input
                              type="password"
                              required
                              minLength={8}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="••••••••••••"
                              className="w-full px-4 py-2.5 bg-thistle-50 border border-gold-500/40 rounded-xl focus:outline-none focus:border-gold-500"
                            />
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={submitting || cleanOtpDigits.length < 6}
                        className="w-full py-3 btn-royal rounded-xl font-bold text-xs"
                      >
                        {submitting
                          ? 'Verifying...'
                          : stage === 'reset_verify'
                          ? 'Verify Code, Save Password & Enter Workspace'
                          : 'Verify & Enter Workspace'}
                      </button>

                      <div className="flex justify-between text-[11px] font-bold text-thistle-500 pt-1">
                        <button
                          type="button"
                          onClick={() => setStage('credentials')}
                          className="hover:text-royal-800"
                        >
                          &larr; Back
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={handleResendChallenge}
                          className="text-royal-700 hover:underline disabled:opacity-50"
                        >
                          Resend mail
                        </button>
                      </div>
                    </form>
                  )}

                  <p className="text-[10px] text-center text-thistle-500 leading-relaxed pt-2 border-t border-gold-500/25">
                    By continuing, you agree to MIDAS&apos;s Anti-Spam &amp; Deliverability Standards.
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* BELOW THE FOLD PRODUCT SHOWCASE */}
      <section id="architecture" className="border-t border-gold-500/35 bg-white/80 py-16 px-6">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="max-w-2xl space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-royal-700">Why Engineering &amp; Growth Teams Choose MIDAS</span>
            <h2 className="text-3xl font-serif text-royal-950 tracking-tight">Built around deliverability invariants, not blast volume.</h2>
            <p className="text-sm text-thistle-500">Every outbound dispatch passes through strict domain isolation, Spintax entropy, and CAN-SPAM compliance checks.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-thistle-50 border border-gold-500/35 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-royal-700 text-gold-300 flex items-center justify-center font-black">01</div>
              <h3 className="text-base font-bold text-royal-950">Town Crier &amp; Gong Channels</h3>
              <p className="text-xs text-royal-950/75 leading-relaxed">
                Embed 1-line Shadow-DOM modals with progressive profiling and sub-60s lead-magnet autoresponders isolated onto dedicated brand senders.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-thistle-50 border border-gold-500/35 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-royal-700 text-gold-300 flex items-center justify-center font-black">02</div>
              <h3 className="text-base font-bold text-royal-950">Bounded Sweep Pacing</h3>
              <p className="text-xs text-royal-950/75 leading-relaxed">
                Strict 5-send sweep ceilings with 20-second per-sender cooldowns prevent Gmail and Microsoft 365 spam bursts across concurrent cron runners.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-thistle-50 border border-gold-500/35 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-royal-700 text-gold-300 flex items-center justify-center font-black">03</div>
              <h3 className="text-base font-bold text-royal-950">Grounded AI State-Graph</h3>
              <p className="text-xs text-royal-950/75 leading-relaxed">
                Auto-freezes cadence on Out-of-Office replies, synthesizes Knowledge-Base grounded objection responses, and injects tracked <code className="font-mono text-royal-700">{'{{artifact:slug}}'}</code> links.
              </p>
            </div>
          </div>

          <div id="pricing" className="p-8 rounded-3xl bg-royal-950 text-white border border-gold-500/45 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-gold-300">Founding Operator Pricing</span>
              <h3 className="text-2xl font-serif">
                Start free on <span className="text-gold-300">Scout</span>, or lock in Chief at <span className="line-through text-thistle-300/70">$50</span> <span className="text-gold-300">$35/mo</span>.
              </h3>
              <p className="text-xs text-thistle-300/85">Scout includes 2,000 emails/mo forever, Zero-Setup Sandbox, 1 Domain, 2 Mailboxes, 2 Gongs, and 1 Knowledge Base.</p>
            </div>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-6 py-3 btn-royal rounded-xl text-xs font-bold whitespace-nowrap"
            >
              Get Started Free &uarr;
            </button>
          </div>
        </div>
      </section>

      <footer className="max-w-7xl w-full mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-thistle-500">
        <span>&copy; 2026 MIDAS Golden Email Infrastructure, By Pyrexx.</span>
        <div className="flex gap-5 font-bold">
          <Link to="/docs" className="hover:text-royal-800">API Docs</Link>
        </div>
      </footer>
    </div>
  );
};