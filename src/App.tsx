import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
import { AppShell } from './components/layout/AppShell';
import { Home } from './pages/Home';
import { Leads } from './pages/Leads';
import { Campaigns } from './pages/Campaigns';
import { CampaignDetail } from './pages/CampaignDetail';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';
import { Signup } from './pages/SignUp';
import { Domains } from './pages/Domains';
import { Inbox } from './pages/Inbox';
import { TownCrier } from './pages/TownCrier';
import { AdminDashboard } from './pages/AdminDashboard';
import { DeveloperDocs } from './pages/DeveloperDocs';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-center py-20 text-thistle-500 font-medium">Authenticating session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      {/* Standalone Enterprise Developer Docs Shell (Vercel / Claude pattern) */}
      <Route path="/docs" element={<DeveloperDocs />} />
      <Route path="/developers" element={<DeveloperDocs />} />

      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
      <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
      <Route path="/campaigns/:id" element={<ProtectedRoute><CampaignDetail /></ProtectedRoute>} />
      <Route path="/town-crier" element={<ProtectedRoute><TownCrier /></ProtectedRoute>} />
      <Route path="/domains" element={<ProtectedRoute><Domains /></ProtectedRoute>} />
      <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;