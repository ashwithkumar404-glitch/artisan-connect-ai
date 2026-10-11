import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { testSupabaseConnection } from './lib/supabaseTest'

testSupabaseConnection()

import { AuthProvider } from './lib/AuthContext'
import { CartProvider } from './lib/CartContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </AuthProvider>
  </StrictMode>,
)
