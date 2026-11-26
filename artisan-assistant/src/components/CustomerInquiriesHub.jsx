import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import {
  translateCustomerMessageToKannada,
  isKannadaText
} from '../lib/kannadaTranslator';

export default function CustomerInquiriesHub({ specificEnquiryId, onClose }) {
  const { user, profile, artisan } = useAuth();
  const [enquiries, setEnquiries] = useState([]);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [counterBudget, setCounterBudget] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const messagesEndRef = useRef(null);

  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem('artisan_language') || 'kn';
    } catch {
      return 'kn';
    }
  });

  const isKn = language === 'kn';

  // Speech synthesis for Kannada audio listening
  const [speakingId, setSpeakingId] = useState(null);

  const handleSpeakText = (id, textToSpeak) => {
    if (!('speechSynthesis' in window)) {
      alert(isKn ? 'ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಸೌಲಭ್ಯ ಲಭ್ಯವಿಲ್ಲ.' : 'Speech synthesis not supported in this browser.');
      return;
    }
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const voices = window.speechSynthesis.getVoices() || [];
    const knVoice = voices.find(v => v.lang.startsWith('kn') || v.lang.includes('kn-IN') || v.name.toLowerCase().includes('kannada'));
    if (knVoice) {
      utterance.voice = knVoice;
      utterance.lang = 'kn-IN';
    } else if (isKannadaText(textToSpeak)) {
      utterance.lang = 'kn-IN';
    } else {
      utterance.lang = isKn ? 'kn-IN' : 'en-IN';
    }
    utterance.rate = 0.9;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load enquiries
  useEffect(() => {
    let isMounted = true;
    if (!artisan?.id) return;

    async function fetchEnquiries() {
      try {
        setLoading(true);
        setErrorMsg('');

        let query = supabase
          .from('enquiries')
          .select(`
            id,
            product_id,
            customer_id,
            artisan_id,
            message,
            quantity,
            preferred_delivery_date,
            budget,
            reference_image_url,
            artisan_response,
            counteroffer_amount,
            expected_ready_date,
            customer_accepted_at,
            artisan_confirmed_at,
            production_notes,
            order_id,
            status,
            created_at,
            products (
              id,
              name,
              price,
              product_images (
                image_url
              )
            ),
            profiles:customer_id (
              id,
              full_name,
              email,
              phone
            )
          `)
          .eq('artisan_id', artisan.id)
          .order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        if (isMounted) {
          const list = data || [];
          setEnquiries(list);
          if (specificEnquiryId) {
            const found = list.find((e) => e.id === specificEnquiryId);
            if (found) setSelectedEnquiry(found);
          } else if (list.length > 0 && !selectedEnquiry) {
            setSelectedEnquiry(list[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching enquiries for hub:', err);
        if (isMounted) setErrorMsg(err.message || 'Failed to load enquiries');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchEnquiries();
    return () => {
      isMounted = false;
    };
  }, [artisan?.id, specificEnquiryId]);

  // Load messages for selected enquiry & set up Realtime subscription
  useEffect(() => {
    let isMounted = true;
    if (!selectedEnquiry?.id) {
      setMessages([]);
      return;
    }

    async function loadThread() {
      try {
        setLoadingMessages(true);
        const { data, error } = await supabase
          .from('enquiry_messages')
          .select('*')
          .eq('enquiry_id', selectedEnquiry.id)
          .order('created_at', { ascending: true });

        if (error) throw error;
        if (isMounted) setMessages(data || []);
      } catch (err) {
        console.warn('Load messages error:', err);
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    }

    loadThread();

    // Realtime subscription for conversation updates
    const channel = supabase
      .channel(`enquiry_thread_${selectedEnquiry.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'enquiry_messages',
          filter: `enquiry_id=eq.${selectedEnquiry.id}`
        },
        (payload) => {
          if (isMounted && payload.new) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [selectedEnquiry?.id]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!replyText.trim() && !counterBudget) return;
    if (!selectedEnquiry) return;

    try {
      setSending(true);
      const isCounter = Boolean(counterBudget && Number(counterBudget) > 0);
      const proposedAmount = isCounter ? Number(counterBudget) : null;
      const unitEquivalent = isCounter
        ? Math.round(Number(counterBudget) / (selectedEnquiry.quantity || 1))
        : null;

      const messagePayload = {
        enquiry_id: selectedEnquiry.id,
        sender_id: profile?.id || user?.id,
        sender_role: 'artisan',
        message: replyText.trim() || `Proposed new counter-budget: ₹${proposedAmount}`,
        message_type: isCounter ? 'counteroffer' : 'text',
        proposed_amount: proposedAmount,
        unit_price_equivalent: unitEquivalent,
        kannada_translation: replyText.trim()
      };

      const { data: insertedMsg, error: insertErr } = await supabase
        .from('enquiry_messages')
        .insert(messagePayload)
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Update parent enquiry status if counteroffer
      if (isCounter) {
        await supabase
          .from('enquiries')
          .update({
            artisan_response: replyText.trim() || `Counteroffer: ₹${proposedAmount}`,
            counteroffer_amount: proposedAmount,
            status: 'offer_awaiting_response'
          })
          .eq('id', selectedEnquiry.id);

        setSelectedEnquiry((prev) => ({
          ...prev,
          counteroffer_amount: proposedAmount,
          status: 'offer_awaiting_response'
        }));
      }

      // Add to local state optimistically if not already caught by realtime
      if (insertedMsg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === insertedMsg.id)) return prev;
          return [...prev, insertedMsg];
        });
      }

      setReplyText('');
      setCounterBudget('');
    } catch (err) {
      console.error('Error sending message:', err);
      alert(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const filteredEnquiries = enquiries.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const customerName = e.profiles?.full_name?.toLowerCase() || '';
    const productName = e.products?.name?.toLowerCase() || '';
    const msg = e.message?.toLowerCase() || '';
    return customerName.includes(q) || productName.includes(q) || msg.includes(q);
  });

  return (
    <div
      className="customer-inquiries-hub"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '520px',
        backgroundColor: 'var(--card-bg, #ffffff)',
        color: 'var(--text)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        overflow: 'hidden'
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>📩</span>
          <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
            {isKn ? 'ಗ್ರಾಹಕರ ವಿಚಾರಣೆಗಳು & ಸಂವಹನ ಹಬ್' : 'Customer Inquiries & Messaging Hub'}
          </h2>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.15rem 0.45rem',
              borderRadius: '10px',
              backgroundColor: 'var(--primary-green)',
              color: '#ffffff'
            }}
          >
            {enquiries.length}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.1rem',
              color: 'var(--secondary-text)'
            }}
            aria-label="Close inquiries hub"
          >
            ✕
          </button>
        )}
      </div>

      {/* Main split view */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left pane: Conversation List */}
        <div
          style={{
            width: '320px',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg)'
          }}
        >
          {/* Search bar */}
          <div style={{ padding: '0.5rem' }}>
            <input
              type="text"
              placeholder={isKn ? 'ಗ್ರಾಹಕರು ಅಥವಾ ಉತ್ಪನ್ನ ಹುಡುಕಿ...' : 'Search customer or craft...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.6rem',
                fontSize: '0.78rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--input-bg)',
                color: 'var(--text)'
              }}
            />
          </div>

          {/* List items */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--secondary-text)' }}>
                {isKn ? 'ವಿಚಾರಣೆಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...' : 'Loading inquiries...'}
              </div>
            ) : filteredEnquiries.length === 0 ? (
              <div style={{ padding: '1.5rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--secondary-text)' }}>
                {isKn ? 'ಯಾವುದೇ ವಿಚಾರಣೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ.' : 'No customer inquiries found.'}
              </div>
            ) : (
              filteredEnquiries.map((enq) => {
                const isSelected = selectedEnquiry?.id === enq.id;
                const customerName = enq.profiles?.full_name || (isKn ? 'ಗ್ರಾಹಕರು' : 'Customer');
                const productName = enq.products?.name || 'Handicraft Item';
                const createdTime = new Date(enq.created_at).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric'
                });

                return (
                  <div
                    key={enq.id}
                    onClick={() => setSelectedEnquiry(enq)}
                    style={{
                      padding: '0.65rem 0.8rem',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--card-bg)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--primary-green)' : '3px solid transparent',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.82rem', color: 'var(--text)' }}>
                        👤 {customerName}
                      </strong>
                      <span style={{ fontSize: '0.68rem', color: 'var(--secondary-text)' }}>
                        {createdTime}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--primary-green)', fontWeight: 600, marginTop: '0.15rem' }}>
                      🏺 {productName} (×{enq.quantity})
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--secondary-text)', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {enq.message || 'Project inquiry'}
                    </div>
                    <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '4px',
                          backgroundColor:
                            enq.status === 'confirmed'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : enq.status === 'offer_accepted'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : 'rgba(234, 88, 12, 0.15)',
                          color:
                            enq.status === 'confirmed'
                              ? '#047857'
                              : enq.status === 'offer_accepted'
                              ? '#1d4ed8'
                              : '#c2410c',
                          fontWeight: 700
                        }}
                      >
                        {enq.status}
                      </span>
                      {enq.budget && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text)' }}>
                          ₹{Number(enq.budget).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right pane: Active Thread and Message Composer */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--card-bg)' }}>
          {selectedEnquiry ? (
            <>
              {/* Thread header */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid var(--border)',
                  backgroundColor: 'var(--bg)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>
                    👤 {selectedEnquiry.profiles?.full_name || 'Customer'}
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--secondary-text)' }}>
                    📦 {selectedEnquiry.products?.name} • Qty: {selectedEnquiry.quantity} • Budget: ₹{selectedEnquiry.budget || 'N/A'}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                      backgroundColor: 'var(--light-green)',
                      color: 'var(--primary-green)'
                    }}
                  >
                    Status: {selectedEnquiry.status}
                  </span>
                </div>
              </div>

              {/* Message history */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                {/* Initial inquiry box */}
                <div
                  style={{
                    backgroundColor: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    fontSize: '0.8rem'
                  }}
                >
                  <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '0.25rem' }}>
                    📌 {isKn ? 'ಪ್ರಾರಂಭಿಕ ವಿಚಾರಣೆ ವಿವರ' : 'Initial Inquiry Details'}
                  </strong>
                  <div style={{ marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--secondary-text)', fontWeight: 600, display: 'block' }}>
                      {isKn ? 'ಮೂಲ ಗ್ರಾಹಕರ ಸಂದೇಶ:' : 'Original customer message:'}
                    </span>
                    <p style={{ margin: '0.15rem 0 0.35rem', color: 'var(--text)', lineHeight: 1.4, fontStyle: 'italic' }}>
                      "{selectedEnquiry.message}"
                    </p>
                  </div>
                  {(() => {
                    const trans = translateCustomerMessageToKannada(selectedEnquiry.message);
                    if (!trans.isAlreadyKannada && trans.translation) {
                      return (
                        <div style={{ margin: '0.25rem 0', padding: '0.4rem 0.6rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div>
                            <span style={{ fontSize: '0.68rem', color: '#1d4ed8', fontWeight: 700, display: 'block' }}>
                              {isKn ? 'ಕನ್ನಡ ಅನುವಾದ:' : 'Kannada translation:'}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: '#1e3a8a', fontWeight: 600 }}>
                              {trans.translation}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSpeakText('init-enq-' + selectedEnquiry.id, trans.translation)}
                            style={{
                              background: speakingId === 'init-enq-' + selectedEnquiry.id ? '#dc2626' : '#2563EB',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.2rem 0.45rem',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}
                          >
                            {speakingId === 'init-enq-' + selectedEnquiry.id ? (isKn ? '⏹ ನಿಲ್ಲಿಸಿ' : '⏹ Stop') : (isKn ? '🔊 ಆಲಿಸಿ' : '🔊 Listen')}
                          </button>
                        </div>
                      );
                    }
                    if (trans.isAlreadyKannada) {
                      return (
                        <div style={{ textAlign: 'right', marginTop: '0.2rem' }}>
                          <button
                            type="button"
                            onClick={() => handleSpeakText('init-enq-' + selectedEnquiry.id, selectedEnquiry.message)}
                            style={{
                              background: speakingId === 'init-enq-' + selectedEnquiry.id ? '#dc2626' : '#2563EB',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.2rem 0.45rem',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {speakingId === 'init-enq-' + selectedEnquiry.id ? (isKn ? '⏹ ನಿಲ್ಲಿಸಿ' : '⏹ Stop') : (isKn ? '🔊 ಆಲಿಸಿ' : '🔊 Listen')}
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {selectedEnquiry.preferred_delivery_date && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--secondary-text)' }}>
                      📅 {isKn ? 'ಅಪೇಕ್ಷಿತ ದಿನಾಂಕ:' : 'Target Date:'} {new Date(selectedEnquiry.preferred_delivery_date).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {/* Conversation messages */}
                {loadingMessages ? (
                  <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--secondary-text)', padding: '1rem' }}>
                    {isKn ? 'ಸಂದೇಶಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...' : 'Loading messages...'}
                  </div>
                ) : (
                  messages.map((m) => {
                    const isArtisan = m.sender_role === 'artisan';
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isArtisan ? 'flex-end' : 'flex-start',
                          width: '100%'
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '85%',
                            padding: '0.55rem 0.75rem',
                            borderRadius: isArtisan ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                            backgroundColor: isArtisan ? 'var(--wa-user-bubble, #d9fdd3)' : 'var(--bg)',
                            color: 'var(--text)',
                            border: isArtisan ? 'none' : '1px solid var(--border)',
                            fontSize: '0.82rem',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '0.7rem', color: 'var(--primary-green)', marginBottom: '0.2rem' }}>
                            {isArtisan ? (isKn ? 'ನೀವು (ಕುಶಲಕರ್ಮಿ)' : 'You (Artisan)') : (selectedEnquiry.profiles?.full_name || 'Customer')}
                          </div>
                          <div>
                            {!isArtisan && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--secondary-text)', display: 'block' }}>
                                {isKn ? 'ಮೂಲ ಸಂದೇಶ:' : 'Original message:'}
                              </span>
                            )}
                            <div style={{ fontStyle: isArtisan ? 'normal' : 'italic', marginBottom: '0.25rem' }}>
                              {isArtisan ? m.message : `"${m.message}"`}
                            </div>
                          </div>
                          {(() => {
                            if (isArtisan) return null;
                            const trans = translateCustomerMessageToKannada(m.message);
                            if (!trans.isAlreadyKannada && trans.translation) {
                              return (
                                <div style={{ margin: '0.25rem 0', padding: '0.35rem 0.5rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                  <div>
                                    <span style={{ fontSize: '0.65rem', color: '#1d4ed8', fontWeight: 700, display: 'block' }}>
                                      {isKn ? 'ಕನ್ನಡ ಅನುವಾದ:' : 'Kannada translation:'}
                                    </span>
                                    <span style={{ fontSize: '0.76rem', color: '#1e3a8a', fontWeight: 600 }}>
                                      {trans.translation}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSpeakText('msg-' + m.id, trans.translation)}
                                    style={{
                                      background: speakingId === 'msg-' + m.id ? '#dc2626' : '#2563EB',
                                      color: '#ffffff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      padding: '0.2rem 0.4rem',
                                      fontSize: '0.68rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0
                                    }}
                                  >
                                    {speakingId === 'msg-' + m.id ? (isKn ? '⏹ ನಿಲ್ಲಿಸಿ' : '⏹ Stop') : (isKn ? '🔊 ಆಲಿಸಿ' : '🔊 Listen')}
                                  </button>
                                </div>
                              );
                            }
                            if (trans.isAlreadyKannada) {
                              return (
                                <div style={{ textAlign: 'right', marginTop: '0.2rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleSpeakText('msg-' + m.id, m.message)}
                                    style={{
                                      background: speakingId === 'msg-' + m.id ? '#dc2626' : '#2563EB',
                                      color: '#ffffff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      padding: '0.2rem 0.4rem',
                                      fontSize: '0.68rem',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {speakingId === 'msg-' + m.id ? (isKn ? '⏹ ನಿಲ್ಲಿಸಿ' : '⏹ Stop') : (isKn ? '🔊 ಆಲಿಸಿ' : '🔊 Listen')}
                                  </button>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          {m.proposed_amount && (
                            <div style={{ marginTop: '0.3rem', fontWeight: 700, color: '#047857', fontSize: '0.75rem' }}>
                              💰 Counteroffer: ₹{Number(m.proposed_amount).toLocaleString('en-IN')} (₹{m.unit_price_equivalent}/unit)
                            </div>
                          )}
                          <div style={{ textAlign: 'right', fontSize: '0.62rem', color: 'var(--secondary-text)', marginTop: '0.25rem' }}>
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <form
                onSubmit={handleSendMessage}
                style={{
                  padding: '0.75rem',
                  borderTop: '1px solid var(--border)',
                  backgroundColor: 'var(--bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="number"
                    placeholder={isKn ? 'ಪ್ರತಿ-ಕೊಡುಗೆ ₹ (ಐಚ್ಛಿಕ)' : 'Counteroffer ₹ (optional)'}
                    value={counterBudget}
                    onChange={(e) => setCounterBudget(e.target.value)}
                    style={{
                      width: '160px',
                      padding: '0.45rem 0.6rem',
                      fontSize: '0.78rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text)'
                    }}
                  />
                  <input
                    type="text"
                    placeholder={isKn ? 'ಸಂದೇಶ ಟೈಪ್ ಮಾಡಿ...' : 'Type your reply message...'}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.6rem',
                      fontSize: '0.78rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text)'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={sending || (!replyText.trim() && !counterBudget)}
                    style={{
                      padding: '0.45rem 1rem',
                      borderRadius: '6px',
                      backgroundColor: 'var(--primary-green)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      opacity: sending || (!replyText.trim() && !counterBudget) ? 0.6 : 1
                    }}
                  >
                    {sending ? '...' : (isKn ? 'ಕಳುಹಿಸಿ' : 'Send')}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--secondary-text)', fontSize: '0.85rem' }}>
              {isKn ? 'ಸಂಭಾಷಣೆಯನ್ನು ನೋಡಲು ಎಡಭಾಗದಿಂದ ವಿಚಾರಣೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.' : 'Select an inquiry from the left to view the conversation.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
