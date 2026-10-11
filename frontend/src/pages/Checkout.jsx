import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useCart } from '../lib/CartContext';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabaseClient';
import Button from '../components/Button';
import { createNotification } from '../lib/notifications';

export default function Checkout() {
  const { cart, subtotal, total, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingPincode, setShippingPincode] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [placedOrder, setPlacedOrder] = useState(null);

  // If no user is authenticated, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If cart is empty and no order is placed, redirect to cart page
  if (cart.length === 0 && !placedOrder) {
    return <Navigate to="/cart" replace />;
  }

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // 1. Create order row in public.orders
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id,
          total_amount: total,
          shipping_name: shippingName.trim(),
          shipping_phone: shippingPhone.trim(),
          shipping_address: shippingAddress.trim(),
          shipping_city: shippingCity.trim(),
          shipping_state: shippingState.trim(),
          shipping_pincode: shippingPincode.trim(),
          status: 'placed'
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 2. Prepare and insert order_items rows
      const itemsToInsert = cart.map(item => ({
        order_id: order.id,
        product_id: item.product.id,
        artisan_id: item.product.artisan_id,
        quantity: item.quantity,
        unit_price: item.product.price,
        subtotal: item.product.price * item.quantity
      }));

      const { error: itemsErr } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsErr) throw itemsErr;

      // 3. Create Admin Notifications
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const promises = admins.map(admin =>
          createNotification(
            admin.id,
            'order_placed',
            'New Order',
            `Order #${order.id.slice(0, 8).toUpperCase()} has been placed.`,
            order.id,
            'order'
          )
        );
        await Promise.all(promises);
      }

      // 4. Create Customer Notification
      await createNotification(
        user.id,
        'order_placed',
        'Order Placed',
        `Your order #${order.id.slice(0, 8).toUpperCase()} has been placed successfully.`,
        order.id,
        'order'
      );

      // 5. Clear Cart and Save Order State
      clearCart();
      setPlacedOrder(order);
    } catch (err) {
      console.error('Error placing order:', err);
      setError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (placedOrder) {
    const displayId = placedOrder.id.slice(0, 8).toUpperCase();
    return (
      <div className="max-w-md mx-auto my-16 bg-white border border-slate-200 rounded-xl p-8 text-center shadow-lg space-y-6 animate-fade-in text-slate-800">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto border border-emerald-100 shadow-sm animate-bounce">
          ✓
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gov-navy m-0">Order placed successfully!</h2>
          <p className="text-sm text-slate-500">
            Your order <strong className="text-slate-800 font-bold font-mono">#{displayId}</strong> has been placed.
          </p>
        </div>
        <div className="border-t border-slate-100 pt-6">
          <Button 
            onClick={() => navigate('/profile?tab=orders')} 
            variant="primary" 
            className="w-full shadow-sm font-bold text-xs py-2.5"
          >
            View My Orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-gov-navy m-0">Checkout</h2>
        <p className="text-sm text-slate-500 mt-1">Provide your delivery details to place the order.</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-800 text-sm font-semibold rounded border border-red-100">
          {error}
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Delivery Details Form */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-gov-navy text-base border-b border-slate-100 pb-2 m-0">
            Delivery Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="shippingName" className="block text-xs font-bold text-slate-700">
                FullName
              </label>
              <input
                id="shippingName"
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={shippingName}
                onChange={(e) => setShippingName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy text-slate-800 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="shippingPhone" className="block text-xs font-bold text-slate-700">
                Contact Number
              </label>
              <input
                id="shippingPhone"
                type="tel"
                required
                placeholder="e.g. +91 9876543210"
                value={shippingPhone}
                onChange={(e) => setShippingPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy text-slate-800 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="shippingAddress" className="block text-xs font-bold text-slate-700">
              Address (House No, Building, Street)
            </label>
            <input
              id="shippingAddress"
              type="text"
              required
              placeholder="e.g. Flat 302, Green Meadows Apartment, Sector 15"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy text-slate-800 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label htmlFor="shippingCity" className="block text-xs font-bold text-slate-700">
                City
              </label>
              <input
                id="shippingCity"
                type="text"
                required
                placeholder="e.g. Noida"
                value={shippingCity}
                onChange={(e) => setShippingCity(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy text-slate-800 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="shippingState" className="block text-xs font-bold text-slate-700">
                State
              </label>
              <input
                id="shippingState"
                type="text"
                required
                placeholder="e.g. Uttar Pradesh"
                value={shippingState}
                onChange={(e) => setShippingState(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy text-slate-800 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="shippingPincode" className="block text-xs font-bold text-slate-700">
                PIN Code
              </label>
              <input
                id="shippingPincode"
                type="text"
                required
                pattern="^[0-9]{6}$"
                placeholder="e.g. 201301"
                value={shippingPincode}
                onChange={(e) => setShippingPincode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy text-slate-800 text-sm"
              />
            </div>
          </div>

          {/* Demo Order Flow Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded p-4 text-amber-900 space-y-1">
            <h4 className="font-bold text-xs m-0 flex items-center gap-1.5">
              <span>💡</span> Demo Checkout Mode
            </h4>
            <p className="text-[11px] leading-relaxed m-0 text-amber-800">
              For this MVP prototype, payment validation is bypassed. Clicking <strong>Place Order</strong> will immediately write your order to the database.
            </p>
          </div>
        </div>

        {/* Order Details Column */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm h-fit space-y-4">
          <h3 className="font-bold text-gov-navy text-base border-b border-slate-100 pb-2 m-0">
            Order Items
          </h3>

          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
            {cart.map((item) => (
              <div key={item.product.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 block line-clamp-1">{item.product.name}</span>
                  <span className="text-slate-500 block mt-0.5">Qty: {item.quantity} × ₹{Number(item.product.price).toFixed(2)}</span>
                </div>
                <span className="font-bold text-slate-800">
                  ₹{(item.product.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-150 pt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-semibold text-slate-850">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Delivery</span>
              <span className="text-green-600 font-semibold">FREE</span>
            </div>
            <div className="border-t border-slate-100 pt-2 flex justify-between text-base font-bold text-slate-800">
              <span>Total</span>
              <span className="text-gov-navy">₹{total.toFixed(2)}</span>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="w-full font-bold min-h-[44px] shadow-sm mt-2"
          >
            {isSubmitting ? 'Creating Order...' : 'Place Order'}
          </Button>
        </div>
      </form>
    </div>
  );
}
