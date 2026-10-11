import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext({});

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState([]);

  // Load cart from localStorage when user changes
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`cart_${user.id}`);
      if (stored) {
        try {
          setCart(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse cart storage:', e);
          setCart([]);
        }
      } else {
        setCart([]);
      }
    } else {
      setCart([]);
    }
  }, [user]);

  // Save cart to localStorage
  const saveCart = (newCart) => {
    setCart(newCart);
    if (user) {
      localStorage.setItem(`cart_${user.id}`, JSON.stringify(newCart));
    }
  };

  const addToCart = (product, quantity = 1) => {
    if (!product || !product.id) return;
    
    // Check stock
    const maxQty = product.stock_quantity ?? 0;
    if (maxQty <= 0) return;

    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      const newQty = Math.min(existing.quantity + quantity, maxQty);
      const newCart = cart.map(item => 
        item.product.id === product.id ? { ...item, quantity: newQty } : item
      );
      saveCart(newCart);
    } else {
      const initialQty = Math.min(quantity, maxQty);
      const newCart = [...cart, { product, quantity: initialQty }];
      saveCart(newCart);
    }
  };

  const updateQuantity = (productId, newQty) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    const maxQty = item.product.stock_quantity ?? 0;
    const finalQty = Math.max(1, Math.min(newQty, maxQty));
    
    const newCart = cart.map(i => 
      i.product.id === productId ? { ...i, quantity: finalQty } : i
    );
    saveCart(newCart);
  };

  const removeFromCart = (productId) => {
    const newCart = cart.filter(item => item.product.id !== productId);
    saveCart(newCart);
  };

  const clearCart = () => {
    saveCart([]);
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const total = subtotal;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      subtotal,
      total,
      cartCount
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
