import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { createNotification } from '../../lib/notifications';

export default function Enquiries() {
  const { user } = useAuth();
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  // Replying state properties
  const [replyingEnquiryId, setReplyingEnquiryId] = useState(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    let active = true;

    async function loadEnquiries() {
      if (!user) return;

      try {
        setLoading(true);
        setError('');

        // 1. Fetch corresponding artisan profile
        const { data: artisan, error: artisanError } = await supabase
          .from('artisans')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (artisanError) throw artisanError;

        if (!artisan) {
          if (active) {
            setEnquiries([]);
            setLoading(false);
          }
          return;
        }

        // 2. Fetch enquiries addressed to this artisan with joined relations
        const { data: enquiriesData, error: enquiriesError } = await supabase
          .from('enquiries')
          .select(`
            id,
            message,
            quantity,
            preferred_delivery_date,
            budget,
            reference_image_url,
            artisan_response,
            status,
            customer_id,
            created_at,
            products (
              name
            ),
            profiles (
              full_name,
              email
            )
          `)
          .eq('artisan_id', artisan.id)
          .order('created_at', { ascending: false });

        if (enquiriesError) throw enquiriesError;

        if (active) {
          setEnquiries(enquiriesData || []);
        }
      } catch (err) {
        console.error('Error fetching enquiries:', err);
        if (active) {
          setError(err.message || 'Failed to load enquiries log.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadEnquiries();

    return () => {
      active = false;
    };
  }, [user]);

  const handleStatusUpdate = async (enquiryId, newStatus) => {
    try {
      setUpdatingId(enquiryId);
      const { error: updateError } = await supabase
        .from('enquiries')
        .update({ status: newStatus })
        .eq('id', enquiryId);

      if (updateError) throw updateError;

      setEnquiries((prev) =>
        prev.map((e) => (e.id === enquiryId ? { ...e, status: newStatus } : e))
      );
    } catch (err) {
      console.error('Error updating enquiry status:', err);
      alert('Failed to update status: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReplySubmit = async (enquiry, e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    try {
      setUpdatingId(enquiry.id);
      
      const { error: updateError } = await supabase
        .from('enquiries')
        .update({
          artisan_response: replyText.trim(),
          status: 'replied'
        })
        .eq('id', enquiry.id);

      if (updateError) throw updateError;

      // Send System Notification to customer
      await createNotification(
        enquiry.customer_id,
        'artisan_responded',
        'Enquiry Replied',
        `Artisan replied to your design enquiry for "${enquiry.products?.name}".`,
        enquiry.id,
        'enquiry'
      );

      setEnquiries((prev) =>
        prev.map((e) =>
          e.id === enquiry.id
            ? { ...e, artisan_response: replyText.trim(), status: 'replied' }
            : e
        )
      );

      setReplyingEnquiryId(null);
      setReplyText('');
    } catch (err) {
      console.error('Error submitting enquiry reply:', err);
      alert('Failed to save response: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'read':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'replied':
      case 'responded':
        return 'bg-green-55 text-green-800 border-green-200';
      case 'closed':
        return 'bg-slate-100 text-slate-600 border-slate-300';
      case 'pending':
      case 'submitted':
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-gov-navy m-0">Customer Enquiries</h2>
        <p className="text-sm text-slate-500 mt-1">Receive and respond to purchase enquiries directly from buyers.</p>
      </div>

      {error && (
        <div className="bg-red-55 border border-red-300 text-red-800 rounded p-4 text-sm font-semibold flex items-center gap-3 animate-fade-in">
          <span className="text-2xl">⚠️</span>
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-lg space-y-4">
          <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-500">Loading enquiries log...</p>
        </div>
      ) : enquiries.length === 0 ? (
        <div className="border border-dashed border-slate-350 bg-white rounded-lg p-12 text-center max-w-2xl mx-auto animate-fade-in">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-300">
            <span className="text-3xl" role="img" aria-label="Inbox mail drawer empty">✉️</span>
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No Buyer Enquiries</h3>
          <p className="text-slate-550 text-sm max-w-sm mx-auto leading-relaxed">
            Your customer message log is empty. Once your products are published, customers will be able to send you direct enquiries.
          </p>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          {enquiries.map((enquiry) => {
            const customerName = enquiry.profiles?.full_name || 'Unknown Buyer';
            const customerEmail = enquiry.profiles?.email || '';
            const productName = enquiry.products?.name || 'Unknown Product';
            const isPending = enquiry.status === 'pending' || enquiry.status === 'submitted';
            const isRead = enquiry.status === 'read';
            const isReplied = enquiry.status === 'replied' || enquiry.status === 'responded';

            return (
              <div 
                key={enquiry.id} 
                className={`bg-white border rounded-lg p-5 shadow-xs flex flex-col transition-all ${
                  isPending ? 'border-amber-300 ring-2 ring-amber-50' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Info Block */}
                  <div className="space-y-3 flex-grow max-w-3xl">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold border rounded-full uppercase tracking-wider ${getStatusBadge(enquiry.status)}`}>
                        {enquiry.status}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">
                        {new Date(enquiry.created_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-extrabold text-slate-800 text-sm m-0">
                        Product Context: <span className="text-gov-navy">{productName}</span>
                      </h4>
                      <div className="text-xs text-slate-550 font-semibold">
                        From: <strong>{customerName}</strong> {customerEmail && <span className="text-slate-400">({customerEmail})</span>}
                      </div>
                    </div>

                    {/* Metadata fields */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px] bg-slate-50 p-3 rounded border border-slate-150">
                      <div>
                        <span className="text-slate-400 block mb-0.5 font-bold uppercase text-[9px]">Quantity</span>
                        <span className="font-semibold text-slate-800">{enquiry.quantity || 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 font-bold uppercase text-[9px]">Budget Limit</span>
                        <span className="font-semibold text-slate-800">{enquiry.budget ? `₹${Number(enquiry.budget).toFixed(2)}` : 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 font-bold uppercase text-[9px]">Required Date</span>
                        <span className="font-semibold text-slate-800">
                          {enquiry.preferred_delivery_date ? new Date(enquiry.preferred_delivery_date).toLocaleDateString('en-IN') : 'Flexible'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 font-bold uppercase text-[9px]">Reference Image</span>
                        {enquiry.reference_image_url ? (
                          <a href={enquiry.reference_image_url} target="_blank" rel="noreferrer" className="text-gov-navy font-bold hover:underline">
                            View File ↗
                          </a>
                        ) : (
                          <span className="text-slate-500 font-semibold">None Provided</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-150 rounded p-3 text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-line">
                      "{enquiry.message}"
                    </div>

                    {enquiry.artisan_response && (
                      <div className="bg-amber-50 border border-amber-250 p-4 rounded text-xs space-y-1">
                        <span className="font-bold text-amber-800 block text-[9px] uppercase tracking-wider">Your Response:</span>
                        <p className="text-slate-700 font-semibold m-0 leading-relaxed font-sans">
                          {enquiry.artisan_response}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions Block */}
                  <div className="flex flex-row md:flex-col gap-2 min-w-[150px] shrink-0 pt-1">
                    {isPending && (
                      <button
                        type="button"
                        disabled={updatingId === enquiry.id}
                        onClick={() => handleStatusUpdate(enquiry.id, 'read')}
                        className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-350 text-slate-700 text-xs font-bold py-2 px-3 rounded text-center transition-colors cursor-pointer min-h-[34px] disabled:opacity-50"
                      >
                        Mark as Read
                      </button>
                    )}

                    {!isReplied && enquiry.status !== 'closed' && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingEnquiryId(enquiry.id);
                          setReplyText(enquiry.artisan_response || '');
                        }}
                        className="w-full bg-gov-saffron hover:bg-gov-saffron-light text-white text-xs font-bold py-2 px-3 rounded text-center transition-colors cursor-pointer min-h-[34px]"
                      >
                        ✍️ Respond / Quote
                      </button>
                    )}

                    {customerEmail && (
                      <a
                        href={`mailto:${customerEmail}?subject=Artisan Connect AI - Response regarding ${productName}&body=Hello ${customerName},%0D%0DThank you for your interest in the "${productName}".`}
                        onClick={() => {
                          if (isPending || isRead) {
                            handleStatusUpdate(enquiry.id, 'replied');
                          }
                        }}
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2 px-3 rounded text-center transition-colors cursor-pointer min-h-[34px] flex items-center justify-center"
                      >
                        ✉️ Mail Customer
                      </a>
                    )}

                    {!isReplied && enquiry.status !== 'closed' && (
                      <button
                        type="button"
                        disabled={updatingId === enquiry.id}
                        onClick={() => handleStatusUpdate(enquiry.id, 'closed')}
                        className="w-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-750 text-xs font-bold py-2 px-3 rounded text-center transition-colors cursor-pointer min-h-[34px] disabled:opacity-50"
                      >
                        Close Enquiry
                      </button>
                    )}
                  </div>
                </div>

                {/* Reply Form Panel */}
                {replyingEnquiryId === enquiry.id && (
                  <form onSubmit={(e) => handleReplySubmit(enquiry, e)} className="mt-4 bg-slate-50 border border-slate-250 rounded p-4 space-y-3.5 animate-fade-in">
                    <div className="space-y-1">
                      <label htmlFor={`reply-${enquiry.id}`} className="block text-[10px] font-bold text-slate-655 uppercase tracking-wider">
                        Response Message or Price Quote
                      </label>
                      <textarea
                        id={`reply-${enquiry.id}`}
                        rows="3"
                        required
                        placeholder="Provide details on custom materials, delivery estimate, price quotes, or availability..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-350 rounded text-xs focus:ring-1 focus:ring-gov-navy text-slate-800"
                      ></textarea>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={updatingId === enquiry.id}
                        className="bg-gov-navy hover:bg-gov-navy-light text-white text-xs font-bold py-1.5 px-4 rounded shadow min-h-[32px]"
                      >
                        {updatingId === enquiry.id ? 'Saving...' : 'Send Response'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingEnquiryId(null);
                          setReplyText('');
                        }}
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold py-1.5 px-4 rounded min-h-[32px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
