import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../lib/CartContext';
import Button from '../components/Button';

export default function Cart() {
  const { cart, updateQuantity, removeFromCart, subtotal, total } = useCart();
  const navigate = useNavigate();

  const handleCheckout = () => {
    navigate('/checkout');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-gov-navy m-0">Shopping Cart</h2>
        <p className="text-sm text-slate-500 mt-1">Review your selected items before checkout.</p>
      </div>

      {cart.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm space-y-4">
          <div className="text-5xl">🛒</div>
          <h3 className="font-bold text-gov-navy text-lg m-0">Your Cart is Empty</h3>
          <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
            You haven't added any products to your shopping cart yet. Browse our marketplace of verified traditional crafts.
          </p>
          <Link
            to="/explore"
            className="inline-block bg-gov-navy hover:bg-gov-navy-light text-white font-semibold text-sm px-6 py-2.5 rounded transition-colors shadow"
          >
            Explore Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items List */}
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item) => {
              const product = item.product;
              const imageUrl = product.product_images?.[0]?.image_url || 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600';
              const maxStock = product.stock_quantity ?? 0;

              return (
                <div
                  key={product.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between"
                >
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className="w-20 h-20 object-cover rounded border border-slate-100 flex-shrink-0"
                    />
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm m-0 line-clamp-1">{product.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">By {product.artisans?.business_name || 'Verified Artisan'}</p>
                      <p className="text-sm font-bold text-gov-navy mt-1">₹{Number(product.price).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0">
                    {/* Quantity Selector */}
                    <div className="flex items-center border border-slate-300 rounded overflow-hidden bg-slate-50">
                      <button
                        onClick={() => updateQuantity(product.id, item.quantity - 1)}
                        className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 transition-colors font-bold text-sm min-h-[36px]"
                        aria-label="Decrease quantity"
                      >
                        －
                      </button>
                      <span className="px-3 text-sm font-semibold text-slate-700 bg-white min-w-[32px] text-center py-1">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(product.id, item.quantity + 1)}
                        disabled={item.quantity >= maxStock}
                        className={`px-2.5 py-1 text-slate-600 hover:bg-slate-200 transition-colors font-bold text-sm min-h-[36px] ${
                          item.quantity >= maxStock ? 'opacity-40 cursor-not-allowed' : ''
                        }`}
                        aria-label="Increase quantity"
                      >
                        ＋
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-800">
                        ₹{(product.price * item.quantity).toFixed(2)}
                      </p>
                      <button
                        onClick={() => removeFromCart(product.id)}
                        className="text-xs font-semibold text-red-600 hover:underline mt-0.5 cursor-pointer block text-right"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="pt-2">
              <Link
                to="/explore"
                className="text-sm font-bold text-gov-navy hover:underline flex items-center gap-1.5"
              >
                ← Continue Shopping
              </Link>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm h-fit space-y-4">
            <h3 className="font-bold text-gov-navy text-lg border-b border-slate-100 pb-2 m-0">
              Order Summary
            </h3>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
                <span className="font-semibold text-slate-800">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery charges</span>
                <span className="text-green-600 font-semibold">FREE</span>
              </div>
              <div className="border-t border-slate-100 pt-3 flex justify-between text-base font-bold text-slate-800">
                <span>Total Amount</span>
                <span className="text-gov-navy">₹{total.toFixed(2)}</span>
              </div>
            </div>

            <Button
              onClick={handleCheckout}
              variant="primary"
              className="w-full font-bold min-h-[44px] mt-2 shadow-sm"
            >
              Proceed to Checkout
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
