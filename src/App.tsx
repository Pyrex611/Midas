import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Leads } from './pages/Leads';
import { Campaigns } from './pages/Campaigns';
import { CampaignDetail } from './pages/CampaignDetail';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';
import { Signup } from './pages/SignUp';
import { Domains } from './pages/Domains';
import { Inbox } from './pages/Inbox';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

function AppRoutes() {
  const { user } = useAuth();
  return (
    <>
      {user && <Navbar />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
        <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
        <Route path="/campaigns/:id" element={<ProtectedRoute><CampaignDetail /></ProtectedRoute>} />
        <Route path="/domains" element={<ProtectedRoute><Domains /></ProtectedRoute>} />
        <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <div className="min-h-screen bg-gray-100">
            <AppRoutes />
          </div>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;