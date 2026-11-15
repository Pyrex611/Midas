import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const useSupabaseOnly = import.meta.env.VITE_AUTH_PROVIDER === 'supabase' || !publishableKey;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {useSupabaseOnly ? (
      <App />
    ) : (
      <ClerkProvider publishableKey={publishableKey}>
        <App />
      </ClerkProvider>
    )}
  </React.StrictMode>
);