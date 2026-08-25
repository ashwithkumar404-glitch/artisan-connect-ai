import React, { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

export default function PublicLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/explore', label: 'Explore' },
    { to: '/about', label: 'About' },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Indian Tricolor Accent Strip */}
      <div className="h-1.5 w-full flex" aria-hidden="true">
        <div className="bg-[#FF9933] flex-1"></div>
        <div className="bg-[#FFFFFF] flex-1"></div>
        <div className="bg-[#138808] flex-1"></div>
      </div>

      {/* Top Government Disclaimer / Meta Header */}
      <div className="bg-slate-100 border-b border-slate-200 text-xs py-1.5 px-4 text-slate-600 text-center font-medium">
        <span>🇮🇳 An Initiative for National Artisan Development (Mockup Portal for SIH 2026)</span>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="flex flex-col focus-visible:outline-2 focus-visible:outline-gov-ashoka p-1">
                <span className="text-xl font-bold text-gov-navy tracking-tight leading-tight">
                  Artisan Connect AI
                </span>
                <span className="text-[10px] text-gov-saffron font-semibold tracking-wider uppercase">
                  Digital Market Linkage
                </span>
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex space-x-8 items-center" aria-label="Main Navigation">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `text-base font-semibold px-2 py-1 border-b-2 transition-colors ${
                      isActive
                        ? 'border-gov-navy text-gov-navy'
                        : 'border-transparent text-slate-600 hover:text-gov-navy hover:border-slate-300'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}

              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `text-base font-semibold px-4 py-2 rounded transition-colors ${
                    isActive
                      ? 'bg-slate-200 text-gov-navy'
                      : 'text-gov-navy border border-gov-navy hover:bg-slate-50'
                  }`
                }
              >
                Login
              </NavLink>

              <Link
                to="/register"
                className="bg-gov-saffron hover:bg-gov-saffron-light text-white font-semibold px-4 py-2 rounded transition-colors min-h-[44px] inline-flex items-center"
              >
                Join as Artisan
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <div className="flex md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-slate-600 hover:text-gov-navy hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gov-navy min-h-[44px] min-w-[44px]"
                aria-controls="mobile-menu"
                aria-expanded={isMenuOpen}
              >
                <span className="sr-only">Open main menu</span>
                {isMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-slate-50" id="mobile-menu">
            <div className="px-2 pt-2 pb-4 space-y-1 sm:px-3">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-3 py-3 rounded-md text-base font-semibold transition-colors ${
                      isActive
                        ? 'bg-gov-navy text-white'
                        : 'text-slate-700 hover:bg-slate-200 hover:text-gov-navy'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <div className="border-t border-slate-200 my-2"></div>
              <NavLink
                to="/login"
                onClick={() => setIsMenuOpen(false)}
                className="block px-3 py-3 rounded-md text-base font-semibold text-gov-navy hover:bg-slate-200"
              >
                Login
              </NavLink>
              <Link
                to="/register"
                onClick={() => setIsMenuOpen(false)}
                className="block px-3 py-3 rounded-md text-base font-semibold bg-gov-saffron text-white text-center hover:bg-gov-saffron-light"
              >
                Join as Artisan
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gov-navy text-slate-200 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h2 className="text-white text-lg font-bold tracking-wider uppercase mb-4">Artisan Connect AI</h2>
              <p className="text-sm text-slate-300 max-w-ch leading-relaxed">
                Empowering marginalized artisans across India through AI-driven cataloguing and direct market linkage.
              </p>
            </div>
            <div>
              <h2 className="text-white text-base font-bold tracking-wider uppercase mb-4 font-sans">Quick Links</h2>
              <ul className="space-y-2">
                <li><Link to="/explore" className="text-sm text-slate-300 hover:text-white transition-colors">Explore Handicrafts</Link></li>
                <li><Link to="/about" className="text-sm text-slate-300 hover:text-white transition-colors">About the Initiative</Link></li>
                <li><Link to="/register" className="text-sm text-slate-300 hover:text-white transition-colors">Artisan Registration</Link></li>
                <li><Link to="/login" className="text-sm text-slate-300 hover:text-white transition-colors">Portal Login</Link></li>
              </ul>
            </div>
            <div>
              <h2 className="text-white text-base font-bold tracking-wider uppercase mb-4">Official Disclaimer</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                This website is an MVP prototype developed for the Smart India Hackathon (SIH 2026) under Problem Statement SIH26090. All data, catalogs, and authentication mechanisms are mockups for evaluation purposes.
              </p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} Artisan Connect AI. Ministry of Textiles (Mock Project).
            </p>
            <p className="text-xs text-slate-400 mt-2 md:mt-0">
              Designed for Accessibility (WCAG 2.1 AA Compliant Style)
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
