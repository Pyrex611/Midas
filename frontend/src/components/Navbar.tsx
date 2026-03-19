import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Helper to check if a route is active
  const isActive = (path: string) => location.pathname === path;

  // Nav items configuration for easy maintenance
  const navItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/campaigns', label: 'Campaigns', icon: '📊' },
    { path: '/leads', label: 'All Leads', icon: '📋' },
    { path: '/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <>
      {/* 1. TOP HEADER (Hamburger - Desktop/Mobile) */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center px-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg hover:bg-gray-50 focus:outline-none transition-colors"
          aria-label="Toggle Menu"
        >
          <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="ml-4 font-bold text-xl tracking-tight text-blue-600">MIDAS</div>
      </header>

      {/* 2. SIDEBAR OVERLAY */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 3. SLIDE-OUT SIDEBAR (Hidden by default, used for both) */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-2xl font-bold text-gray-800">Menu</h2>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="space-y-2 flex-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                  isActive(item.path)
                    ? 'bg-blue-50 text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-semibold">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="border-t border-gray-100 pt-6">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-4">System Status</p>
            <div className="flex items-center gap-2 text-xs text-green-500 font-medium bg-green-50 px-3 py-2 rounded-lg">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Queue Processor Active
            </div>
          </div>
        </div>
      </aside>

      {/* 4. MOBILE BOTTOM NAV (Visible only on < sm screens) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 px-2 py-3 flex justify-around items-center z-40 pb-safe">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center min-w-[64px] gap-1 transition-colors ${
              isActive(item.path) ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className={`text-[10px] font-bold tracking-tight ${isActive(item.path) ? 'opacity-100' : 'opacity-60'}`}>
              {item.label}
            </span>
            {isActive(item.path) && (
              <span className="w-1 h-1 bg-blue-600 rounded-full mt-0.5" />
            )}
          </Link>
        ))}
      </nav>

      {/* Spacer to prevent content from hiding under bottom nav on mobile */}
      <div className="sm:hidden h-20" />
    </>
  );
};