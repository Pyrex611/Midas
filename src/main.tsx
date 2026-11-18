import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const useClerk = import.meta.env.VITE_AUTH_PROVIDER === 'clerk' && Boolean(publishableKey);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {useClerk ? (
      <ClerkProvider publishableKey={publishableKey}>
        <App />
      </ClerkProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>
);