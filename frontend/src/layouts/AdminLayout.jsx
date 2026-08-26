import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const menuItems = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: '🏛️' },
    { to: '/admin/verification', label: 'Verification Queue', icon: '🛡️' },
    { to: '/admin/artisans', label: 'Artisans Directory', icon: '👥' },
    { to: '/admin/products', label: 'Moderate Products', icon: '📦' },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-100">
      {/* Mobile Admin Header */}
      <header className="md:hidden bg-slate-900 text-white flex items-center justify-between px-4 py-3 sticky top-0 z-50">
        <Link to="/admin/dashboard" className="font-bold text-lg">
          Gov Admin Console
        </Link>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-1 rounded focus:outline-none focus:ring-2 focus:ring-slate-300 min-h-[44px] min-w-[44px]"
          aria-expanded={isSidebarOpen}
          aria-label="Toggle navigation menu"
        >
          {isSidebarOpen ? (
            <span className="text-xl">✕</span>
          ) : (
            <span className="text-xl">☰</span>
          )}
        </button>
      </header>

      {/* Sidebar Panel */}
      <aside
        className={`bg-slate-900 text-slate-200 w-full md:w-64 flex flex-col flex-shrink-0 transition-all ${
          isSidebarOpen ? 'block' : 'hidden'
        } md:block border-r border-slate-950`}
      >
        {/* Logo/Admin Portal Title */}
        <div className="p-5 border-b border-slate-800 hidden md:block">
          <Link to="/" className="flex flex-col">
            <span className="text-lg font-bold text-white tracking-tight">Artisan Connect AI</span>
            <span className="text-[10px] text-gov-saffron-light font-bold uppercase tracking-wider">
              Gov Admin Console
            </span>
          </Link>
        </div>

        {/* Sidebar Links */}
        <nav className="flex-grow p-4 space-y-1.5" aria-label="Admin Navigation">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 rounded text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-gov-navy-light text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <span className="mr-3 text-lg" aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer / Sign Out */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full bg-slate-850 hover:bg-red-900 hover:text-white text-slate-400 border border-slate-700 py-2.5 px-4 rounded text-sm font-semibold transition-colors cursor-pointer min-h-[44px]"
          >
            Sign Out (Admin)
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Desktop Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 hidden md:flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-slate-800 m-0">Admin Management Portal</h1>
            <span className="ml-3 bg-red-100 text-red-800 border border-red-200 text-xs px-2.5 py-1 rounded font-semibold">
              Admin Mode
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-slate-600 font-sans">
              Welcome, {profile?.full_name || 'Department Officer'}
            </span>
            <div className="w-8 h-8 rounded-full bg-gov-navy text-white flex items-center justify-center font-bold text-sm">
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'GO'}
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
