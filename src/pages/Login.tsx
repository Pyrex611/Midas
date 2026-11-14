import React, { useEffect } from 'react';
import { SignIn } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-thistle-canvas py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full flex flex-col items-center space-y-6">
        <div className="text-center">
          <span className="text-3xl font-black bg-gradient-to-r from-royal-700 via-royal-600 to-gold-500 bg-clip-text text-transparent tracking-wider">
            MIDAS
          </span>
          <p className="text-xs text-thistle-500 font-semibold mt-1">Golden Email Infrastructure</p>
        </div>
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
      </div>
    </div>
  );
};