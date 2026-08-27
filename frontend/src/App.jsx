import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import ArtisanLayout from './layouts/ArtisanLayout';
import AdminLayout from './layouts/AdminLayout';

// Public Pages
import Home from './pages/Home';
import Explore from './pages/Explore';
import ProductDetails from './pages/ProductDetails';
import About from './pages/About';
import Login from './pages/Login';
import Register from './pages/Register';
import BuyerProfile from './pages/BuyerProfile';

// Artisan Pages
import ArtisanDashboard from './pages/artisan/Dashboard';
import Products from './pages/artisan/Products';
import NewProduct from './pages/artisan/NewProduct';
import EditProduct from './pages/artisan/EditProduct';
import Enquiries from './pages/artisan/Enquiries';
import Profile from './pages/artisan/Profile';
import Verification from './pages/artisan/Verification';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import VerificationQueue from './pages/admin/VerificationQueue';
import ArtisansList from './pages/admin/ArtisansList';
import ProductsModeration from './pages/admin/ProductsModeration';

import { useAuth } from './lib/AuthContext';

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-655">Loading secure session...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="explore" element={<Explore />} />
          <Route path="product/:id" element={<ProductDetails />} />
          <Route path="about" element={<About />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="profile" element={<BuyerProfile />} />
        </Route>

        {/* Artisan Routes */}
        <Route path="/artisan" element={<ArtisanLayout />}>
          <Route index element={<Navigate to="/artisan/dashboard" replace />} />
          <Route path="dashboard" element={<ArtisanDashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<NewProduct />} />
          <Route path="products/edit/:id" element={<EditProduct />} />
          <Route path="enquiries" element={<Enquiries />} />
          <Route path="profile" element={<Profile />} />
          <Route path="verification" element={<Verification />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="verification" element={<VerificationQueue />} />
          <Route path="artisans" element={<ArtisansList />} />
          <Route path="products" element={<ProductsModeration />} />
        </Route>

        {/* Fallback to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
