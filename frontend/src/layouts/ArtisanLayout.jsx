import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function ArtisanLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const menuItems = [
    { to: '/artisan/dashboard', label: 'Dashboard', icon: '📊' },
    { to: '/artisan/products', label: 'My Products', icon: '📦' },
    { to: '/artisan/products/new', label: 'Add Product', icon: '➕' },
    { to: '/artisan/enquiries', label: 'Enquiries', icon: '✉️' },
    { to: '/artisan/profile', label: 'Shop Profile', icon: '👤' },
    { to: '/artisan/verification', label: 'Verification', icon: '🛡️' },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
      {/* Mobile Header / Navigation Toggle */}
      <header className="md:hidden bg-gov-navy text-white flex items-center justify-between px-4 py-3 sticky top-0 z-50">
        <Link to="/artisan/dashboard" className="font-bold text-lg">
          Artisan Portal
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

      {/* Sidebar for navigation */}
      <aside
        className={`bg-gov-navy text-slate-200 w-full md:w-64 flex flex-col flex-shrink-0 transition-all ${
          isSidebarOpen ? 'block' : 'hidden'
        } md:block border-r border-gov-navy-dark`}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-slate-800 hidden md:block">
          <Link to="/" className="flex flex-col">
            <span className="text-lg font-bold text-white tracking-tight">Artisan Connect AI</span>
            <span className="text-[10px] text-gov-saffron font-bold uppercase tracking-wider">
              Artisan Admin Panel
            </span>
          </Link>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-grow p-4 space-y-1.5" aria-label="Artisan Navigation">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 rounded text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-gov-saffron text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <span className="mr-3 text-lg" aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full bg-slate-800 hover:bg-red-900 hover:text-white text-slate-300 border border-slate-700 py-2.5 px-4 rounded text-sm font-semibold transition-colors cursor-pointer min-h-[44px]"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content pane */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Desktop Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 hidden md:flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gov-navy m-0">Artisan Workspace</h1>
            <span className="ml-3 bg-slate-100 text-slate-700 border border-slate-300 text-xs px-2.5 py-1 rounded font-semibold">
              Prototype Mode
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-slate-600 font-sans">
              Welcome, {profile?.full_name || 'Artisan'}
            </span>
            <div className="w-8 h-8 rounded-full bg-gov-saffron text-white flex items-center justify-center font-bold text-sm">
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'A'}
            </div>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
