import React, { useEffect } from 'react';
import { SignUp } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthExperience } from '../components/auth/AuthExperience';

export const Signup: React.FC = () => {
  const { user, loading, providerMode } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  if (providerMode === 'clerk') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-thistle-canvas py-12 px-4 sm:px-6 lg:px-8">
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
      </div>
    );
  }

  return <AuthExperience initialMode="signup" />;
};