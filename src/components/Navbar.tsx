import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const getLinkClass = (path: string) => 
    `block px-4 py-2 rounded-md transition-colors ${
      location.pathname === path ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className="fixed top-4 left-4 z-50 p-2 rounded-md bg-white shadow-md hover:bg-gray-50 focus:outline-none">
        <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Opacity Fix: Utilise native Tailwind v4 forward-slash alpha notation instead of separate bg-opacity */}
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsOpen(false)} />}

      <div className={`fixed top-0 left-0 h-full w-64 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-semibold text-gray-800">Menu</h2>
            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="space-y-2 flex-1">
            <Link to="/" onClick={() => setIsOpen(false)} className={getLinkClass('/')}>🏠 Home</Link>
            <Link to="/inbox" onClick={() => setIsOpen(false)} className={getLinkClass('/inbox')}>📥 Unified Inbox</Link>
            <Link to="/leads" onClick={() => setIsOpen(false)} className={getLinkClass('/leads')}>📋 All Leads</Link>
            <Link to="/campaigns" onClick={() => setIsOpen(false)} className={getLinkClass('/campaigns')}>📊 Campaigns</Link>
            <Link to="/domains" onClick={() => setIsOpen(false)} className={getLinkClass('/domains')}>🌐 Sending Domains</Link>
          </nav>
          <div className="border-t pt-4">
            <Link to="/profile" onClick={() => setIsOpen(false)} className={getLinkClass('/profile')}>👤 Profile</Link>
          </div>
        </div>
      </div>
    </>
  );
};