import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Leads } from './pages/Leads';
import { Campaigns } from './pages/Campaigns';
import { CampaignDetail } from './pages/CampaignDetail';

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-100">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/campaigns/:id" element={<CampaignDetail />} />
          </Routes>
        </div>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;