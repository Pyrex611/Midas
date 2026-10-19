import React, { useEffect } from 'react';
import { SignIn } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, redirect away from the login page instantly
  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full flex flex-col items-center">
        <SignIn 
          signUpUrl="/signup" 
          afterSignInUrl="/" 
          appearance={{
            elements: {
              formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
              card: 'shadow-xl rounded-2xl border border-gray-100 bg-white'
            }
          }}
        />
      </div>
    </div>
  );
};