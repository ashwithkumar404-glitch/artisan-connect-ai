import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import ArtisanLayout from './layouts/ArtisanLayout';
import AdminLayout from './layouts/AdminLayout';

// Public Pages
import Home from './pages/Home';
import Explore from './pages/Explore';
import About from './pages/About';
import Login from './pages/Login';
import Register from './pages/Register';

// Artisan Pages
import ArtisanDashboard from './pages/artisan/Dashboard';
import Products from './pages/artisan/Products';
import NewProduct from './pages/artisan/NewProduct';
import Enquiries from './pages/artisan/Enquiries';
import Profile from './pages/artisan/Profile';
import Verification from './pages/artisan/Verification';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import VerificationQueue from './pages/admin/VerificationQueue';
import ArtisansList from './pages/admin/ArtisansList';
import ProductsModeration from './pages/admin/ProductsModeration';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="explore" element={<Explore />} />
          <Route path="about" element={<About />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>

        {/* Artisan Routes */}
        <Route path="/artisan" element={<ArtisanLayout />}>
          <Route index element={<Navigate to="/artisan/dashboard" replace />} />
          <Route path="dashboard" element={<ArtisanDashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<NewProduct />} />
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
