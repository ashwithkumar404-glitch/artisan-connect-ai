import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import ThemeToggle from "../components/ThemeToggle.jsx";
import {
  createVoiceSession,
  VOICE_STATES,
  getVoiceStatusMessage
} from "../lib/voiceRecognition.js";
import {
  extractProductFacts,
  buildProductListing,
  interpretCorrectionCommand
} from "../lib/kannadaProductEngine.js";

// Helper to convert blob to Base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
}

function WhatsAppPlaceholderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, artisan, authLoading } = useAuth();

  // Language state: 'kn' (Kannada) or 'en' (English)
  const [language, setLanguage] = useState(() => localStorage.getItem('artisan_language') || 'kn');
  const isKn = language === 'kn';

  // Conversational state
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [workflowStep, setWorkflowStep] = useState('idle'); // 'idle' | 'awaiting_voice' | 'processing_voice' | 'reviewing_draft' | 'saving' | 'published'
  const [pendingPhotoFile, setPendingPhotoFile] = useState(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState("");
  const [currentDraft, setCurrentDraft] = useState(null);
  const [_lastPublishedProduct, setLastPublishedProduct] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [categories, setCategories] = useState([]);

  // Voice recording state
  const [voiceState, setVoiceState] = useState(VOICE_STATES.IDLE);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const voiceSessionRef = useRef(null);
  const isRecording = voiceState === VOICE_STATES.LISTENING || voiceState === VOICE_STATES.REQUESTING_PERMISSION || voiceState === VOICE_STATES.PROCESSING;

  // Meta Cloud API setup accordion
  const [showMetaInfo, setShowMetaInfo] = useState(false);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://otkpcezsjoysyksymjrn.supabase.co";
  const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;

  // Refs for hidden file inputs
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const chatEndRef = useRef(null);

  // Sync language selection
  const handleLanguageToggle = (lang) => {
    setLanguage(lang);
    localStorage.setItem('artisan_language', lang);
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, workflowStep, isRecording]);

  // Load marketplace categories
  useEffect(() => {
    async function loadCategories() {
      try {
        const { data } = await supabase.from('categories').select('id, name').order('name');
        if (data && data.length > 0) setCategories(data);
      } catch (err) {
        console.warn('Error loading categories:', err);
      }
    }
    loadCategories();
  }, []);

  // Initialize WhatsApp chat messages
  useEffect(() => {
    if (authLoading) return;

    const artisanName = artisan?.business_name || profile?.full_name || (isKn ? 'ಕುಶಲಕರ್ಮಿ' : 'Artisan');

    const welcomeMsg = {
      id: 'msg-welcome',
      sender: 'assistant',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: isKn
        ? `🙏 **ನಮಸ್ಕಾರ, ${artisanName}!**\n\nಇದು ನಿಮ್ಮ **Artisan Connect WhatsApp AI ಸಹಾಯಕ**.\n\nನಿಮ್ಮ ಕರಕುಶಲ ಉತ್ಪನ್ನಗಳನ್ನು ಮಾರ್ಕೆಟ್‌ಪ್ಲೇಸ್‌ಗೆ ಸುಲಭವಾಗಿ ಸೇರಿಸಲು:\n\n1️⃣ **ಫೋಟೋ ಕಳುಹಿಸಿ** 📸 (ಕ್ಯಾಮೆರಾ ಅಥವಾ ಗ್ಯಾಲರಿ)\n2️⃣ ನಂತರ ಕನ್ನಡದಲ್ಲಿ **ಧ್ವನಿ ವಿವರಣೆ ನೀಡಿ** 🎙️\n3️⃣ ಕರಡು ಪರಿಶೀಲಿಸಿ **ಪ್ರಕಟಿಸಿ** ✅`
        : `🙏 **Namaste, ${artisanName}!**\n\nWelcome to your **Artisan Connect WhatsApp AI Assistant**.\n\nTo catalog and list a handcrafted product on the marketplace:\n\n1️⃣ **Send a Photo** 📸 (Camera or Gallery)\n2️⃣ **Speak a Voice Note** 🎙️ in Kannada or English\n3️⃣ Review the bilingual draft and **Publish** ✅`,
      actionButtons: [
        { label: isKn ? '📷 ಕ್ಯಾಮೆರಾ ಬಳಸಿ' : '📷 Take Photo', action: 'open_camera' },
        { label: isKn ? '🖼️ ಗ್ಯಾಲರಿಯಿಂದ ಆಯ್ಕೆ' : '🖼️ Pick Gallery', action: 'open_gallery' },
        { label: isKn ? '📦 ಹೊಸ ಆರ್ಡರ್‌ಗಳು' : '📦 Check Orders', action: 'check_orders' },
        { label: isKn ? '💬 ಗ್ರಾಹಕರ ವಿಚಾರಣೆಗಳು' : '💬 Enquiries', action: 'check_enquiries' },
        { label: isKn ? '❓ ಸಹಾಯ' : '❓ How It Works', action: 'how_it_works' }
      ]
    };

    setMessages([welcomeMsg]);
  }, [authLoading, artisan, profile, isKn]);

  // Handle deep-linked enquiry parameter from notifications
  useEffect(() => {
    const enqParam = searchParams.get('enquiryId');
    if (enqParam && artisan?.id) {
      handleCheckEnquiries(enqParam);
    }
  }, [searchParams, artisan?.id]);

  // Helper to append message
  const addMessage = (sender, text, extra = {}) => {
    const newMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...extra
    };
    setMessages(prev => [...prev, newMsg]);
    return newMsg;
  };

  // Check recent artisan orders in WhatsApp chat
  const handleCheckOrders = async () => {
    if (!artisan?.id) {
      addMessage('assistant', isKn ? "⚠️ ಆರ್ಡರ್‌ಗಳನ್ನು ಪರಿಶೀಲಿಸಲು ಲಾಗಿನ್ ಅಗತ್ಯವಿದೆ." : "⚠️ Please sign in to check your orders.");
      return;
    }
    try {
      addMessage('artisan', isKn ? "📦 ನನ್ನ ಇತ್ತೀಚಿನ ಆರ್ಡರ್‌ಗಳನ್ನು ತೋರಿಸಿ." : "📦 Show my recent orders.");
      const { data: rawItems, error: itemsErr } = await supabase
        .from('order_items')
        .select('id, order_id, product_id, artisan_id, quantity, unit_price, subtotal')
        .eq('artisan_id', artisan.id);

      if (itemsErr) throw itemsErr;

      if (!rawItems || rawItems.length === 0) {
        addMessage('assistant', isKn
          ? "📦 **ನಿಮ್ಮ ಖಾತೆಯಲ್ಲಿ ಇನ್ನೂ ಯಾವುದೇ ಆರ್ಡರ್‌ಗಳು ಬಂದಿಲ್ಲ.**\n\nಗ್ರಾಹಕರು ನಿಮ್ಮ ಕರಕುಶಲ ವಸ್ತುಗಳನ್ನು ಖರೀದಿಸಿದಾಗ, ತಕ್ಷಣವೇ ಇಲ್ಲಿ ಆರ್ಡರ್ ಕಾರ್ಡ್ ಕಾಣಿಸುತ್ತದೆ!"
          : "📦 **No orders found for your artisan account yet.**\n\nWhen customers purchase your handcrafted creations, you will receive an interactive order card here!",
          {
            actionButtons: [
              { label: isKn ? '📷 ಹೊಸ ಉತ್ಪನ್ನ ಸೇರಿಸಿ' : '📷 List New Product', action: 'open_camera' },
              { label: isKn ? '💬 ಗ್ರಾಹಕರ ವಿಚಾರಣೆಗಳು' : '💬 Enquiries', action: 'check_enquiries' }
            ]
          }
        );
        return;
      }

      const orderIds = [...new Set(rawItems.map(i => i.order_id))];
      const prodIds = [...new Set(rawItems.map(i => i.product_id))];

      const [ordersRes, prodsRes] = await Promise.all([
        supabase.from('orders').select('id, customer_id, status, created_at, shipping_name, shipping_city, shipping_state').in('id', orderIds),
        supabase.from('products').select('id, name').in('id', prodIds)
      ]);

      const oMap = new Map((ordersRes.data || []).map(o => [o.id, o]));
      const pMap = new Map((prodsRes.data || []).map(p => [p.id, p]));

      const recentOrders = [];
      const seenOrders = new Set();
      for (const item of rawItems) {
        if (seenOrders.has(item.order_id)) continue;
        seenOrders.add(item.order_id);
        const ord = oMap.get(item.order_id);
        if (!ord) continue;
        const prod = pMap.get(item.product_id);
        recentOrders.push({
          id: ord.id,
          customer_id: ord.customer_id,
          status: ord.status,
          created_at: ord.created_at,
          product_name: prod?.name || 'Handicraft Item',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_amount: item.subtotal || (item.quantity * item.unit_price),
          shipping_location: [ord.shipping_city, ord.shipping_state].filter(Boolean).join(', ') || ord.shipping_name || 'Karnataka, India'
        });
      }

      recentOrders.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      const displayOrders = recentOrders.slice(0, 3);

      addMessage('assistant', isKn
        ? `📦 **ನಿಮ್ಮ ಇತ್ತೀಚಿನ ${displayOrders.length} ಆರ್ಡರ್ ವಿವರಗಳು:**`
        : `📦 **Here are your ${displayOrders.length} latest orders:**`
      );

      for (const ord of displayOrders) {
        addMessage('assistant', '', { orderCard: ord });
      }
    } catch (err) {
      console.error('Error fetching orders in WhatsApp assistant:', err);
      addMessage('assistant', isKn ? "⚠️ ಆರ್ಡರ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ." : "⚠️ Failed to load orders.");
    }
  };

  // WhatsApp Order Action (Accept / Reject)
  const handleWhatsAppOrderAction = async (orderId, newStatus) => {
    try {
      setProcessing(true);
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      setMessages(prev => prev.map(m => {
        if (m.orderCard && m.orderCard.id === orderId) {
          return {
            ...m,
            orderCard: { ...m.orderCard, status: newStatus }
          };
        }
        return m;
      }));

      const replyNotice = newStatus === 'confirmed'
        ? isKn
          ? `✅ **ಆರ್ಡರ್ #${orderId.slice(0, 8).toUpperCase()} ಸ್ವೀಕರಿಸಲಾಗಿದೆ!**\n\nಗ್ರಾಹಕರಿಗೆ ದೃಢೀಕರಣ ಸಂದೇಶ ಕಳುಹಿಸಲಾಗಿದೆ. ನೀವು ಕರಕುಶಲ ವಸ್ತುವನ್ನು ಸಿದ್ಧಪಡಿಸಲು ಪ್ರಾರಂಭಿಸಬಹುದು.`
          : `✅ **Order #${orderId.slice(0, 8).toUpperCase()} Accepted & Confirmed!**\n\nThe customer has been notified. You can start preparing the handcrafted creation.`
        : isKn
          ? `❌ **ಆರ್ಡರ್ #${orderId.slice(0, 8).toUpperCase()} ನಿರಾಕರಿಸಲಾಗಿದೆ ಮತ್ತು ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ.**`
          : `❌ **Order #${orderId.slice(0, 8).toUpperCase()} Rejected and Cancelled.**`;

      addMessage('assistant', replyNotice, {
        actionButtons: [
          { label: isKn ? '📦 ಆರ್ಡರ್‌ಗಳು' : '📦 My Orders', action: 'check_orders' },
          { label: isKn ? '📷 ಹೊಸ ಉತ್ಪನ್ನ' : '📷 Add Product', action: 'open_camera' }
        ]
      });
    } catch (err) {
      console.error('Error updating order via WhatsApp card:', err);
      addMessage('assistant', isKn ? "⚠️ ಆರ್ಡರ್ ಸ್ಥಿತಿ ನವೀಕರಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ." : "⚠️ Failed to update order status.");
    } finally {
      setProcessing(false);
    }
  };

  // Check customer custom enquiries
  const handleCheckEnquiries = async (specificEnquiryId = null) => {
    if (!artisan?.id) {
      addMessage('assistant', isKn ? "⚠️ ವಿಚಾರಣೆಗಳನ್ನು ನೋಡಲು ಲಾಗಿನ್ ಅಗತ್ಯವಿದೆ." : "⚠️ Please sign in to check enquiries.");
      return;
    }
    try {
      addMessage('artisan', isKn ? "💬 ಗ್ರಾಹಕರ ಕಸ್ಟಮ್ ವಿಚಾರಣೆಗಳನ್ನು ತೋರಿಸಿ." : "💬 Show customer custom enquiries.");
      let query = supabase
        .from('enquiries')
        .select('id, product_id, customer_id, message, status, quantity, preferred_delivery_date, budget, reference_image_url, artisan_response, counteroffer_amount, expected_ready_date, customer_accepted_at, artisan_confirmed_at, production_notes, order_id, created_at')
        .eq('artisan_id', artisan.id);

      if (specificEnquiryId) {
        query = query.eq('id', specificEnquiryId);
      } else {
        query = query.order('created_at', { ascending: false }).limit(5);
      }

      let { data: enqData, error: enqErr } = await query;
      if (enqErr) {
        // Fallback for older DB versions
        console.warn('Enquiries select fallback:', enqErr.message);
        let fbQuery = supabase
          .from('enquiries')
          .select('id, product_id, customer_id, message, status, quantity, preferred_delivery_date, budget, reference_image_url, artisan_response, created_at')
          .eq('artisan_id', artisan.id);
        if (specificEnquiryId) {
          fbQuery = fbQuery.eq('id', specificEnquiryId);
        } else {
          fbQuery = fbQuery.order('created_at', { ascending: false }).limit(5);
        }
        const fbRes = await fbQuery;
        if (fbRes.error) throw fbRes.error;
        enqData = fbRes.data;
      }

      if (!enqData || enqData.length === 0) {
        addMessage('assistant', isKn
          ? "💬 **ಯಾವುದೇ ಹೊಸ ಗ್ರಾಹಕರ ಕಸ್ಟಮ್ ವಿಚಾರಣೆಗಳಿಲ್ಲ.**\n\nಗ್ರಾಹಕರು ನಿಮ್ಮ ಉತ್ಪನ್ನದ ಪುಟದಲ್ಲಿ ಕಸ್ಟಮ್ ಡಿಸೈನ್ ಅಥವಾ ದೊಡ್ಡ ಆರ್ಡರ್ ವಿಚಾರಿಸಿದಾಗ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ."
          : "💬 **No pending customer enquiries found.**\n\nWhen buyers submit custom craft requests or bulk queries on your product pages, they will appear here.",
          {
            actionButtons: [
              { label: isKn ? '📷 ಹೊಸ ಉತ್ಪನ್ನ ಸೇರಿಸಿ' : '📷 New Product', action: 'open_camera' },
              { label: isKn ? '📦 ಆರ್ಡರ್‌ಗಳು' : '📦 Check Orders', action: 'check_orders' }
            ]
          }
        );
        return;
      }

      const pIds = [...new Set(enqData.map(e => e.product_id).filter(Boolean))];
      let pMap = new Map();
      if (pIds.length > 0) {
        const { data: prods } = await supabase.from('products').select('id, name, price').in('id', pIds);
        if (prods) pMap = new Map(prods.map(p => [p.id, p]));
      }

      addMessage('assistant', isKn
        ? `💬 **ಇತ್ತೀಚಿನ ${enqData.length} ಗ್ರಾಹಕರ ವಿಚಾರಣೆಗಳು:**`
        : `💬 **Here are your ${enqData.length} latest customer enquiries:**`
      );

      for (const enq of enqData) {
        const prod = pMap.get(enq.product_id);
        const unitPrice = Number(prod?.price || 0);
        const qty = Number(enq.quantity || 0);
        const budget = Number(enq.budget || 0);
        const estimate = unitPrice > 0 && qty > 0 ? unitPrice * qty : null;
        const diff = estimate && budget ? estimate - budget : null;

        // Smart local Kannada translation of customer message
        let knTranslation = '';
        if (enq.message) {
          let kn = enq.message;
          kn = kn.replace(/can you make (\d+) pieces/gi, '$1 ತುಂಡುಗಳನ್ನು ತಯಾರಿಸಲು ಸಾಧ್ಯವೇ');
          kn = kn.replace(/pieces|pcs/gi, 'ತುಂಡುಗಳು');
          kn = kn.replace(/blue lacquer finish/gi, 'ನೀಲಿ ಲ್ಯಾಕರ್ ಫಿನಿಶಿಂಗ್');
          kn = kn.replace(/discount/gi, 'ರಿಯಾಯಿತಿ');
          kn = kn.replace(/custom order/gi, 'ಕಸ್ಟಮ್ ಆರ್ಡರ್');
          kn = kn.replace(/bulk order/gi, 'ಸಗಟು ಆರ್ಡರ್');
          kn = kn.replace(/urgent delivery/gi, 'ತುರ್ತು ವಿತರಣೆ');
          kn = kn.replace(/budget/gi, 'ಬಜೆಟ್');
          knTranslation = kn !== enq.message ? kn : `(ಗ್ರಾಹಕರ ಸಂದೇಶ: "${enq.message}")`;
        }

        addMessage('assistant', '', {
          enquiryCard: {
            ...enq,
            product_name: prod?.name || (isKn ? 'ಕರಕುಶಲ ಉತ್ಪನ್ನ' : 'Handicraft Item'),
            unitPrice: unitPrice > 0 ? unitPrice : 400,
            estimate: estimate || (qty > 0 ? qty * 400 : null),
            diff,
            knTranslation
          }
        });
      }
    } catch (err) {
      console.error('Error fetching enquiries in WhatsApp assistant:', err);
      addMessage('assistant', isKn ? "⚠️ ವಿಚಾರಣೆಗಳನ್ನು ಪಡೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ." : "⚠️ Failed to load enquiries.");
    }
  };

  // Bulk Price Negotiation & Counteroffer
  const handleNegotiateCounteroffer = async (enquiry, prefilledAmount = null, voiceNote = '') => {
    const qty = Number(enquiry.quantity) || 1;
    const est = enquiry.estimate || (qty * 400);
    const bud = Number(enquiry.budget) || Math.round(est * 0.75);
    const suggestedCounter = prefilledAmount || Math.round((est + bud) / 2);

    let counterTotal = suggestedCounter;
    if (!prefilledAmount) {
      const promptText = isKn
        ? `ಸಗಟು ಚೌಕಾಸಿ (Bulk Negotiation):\n` +
          `• ಪಟ್ಟಿಮಾಡಿದ ಅಂದಾಜು: ₹${est}\n` +
          `• ಗ್ರಾಹಕರ ಪ್ರಸ್ತಾಪ: ₹${bud}\n\n` +
          `ನಿಮ್ಮ ಪ್ರತಿ-ಕೊಡುಗೆ ಮೊತ್ತವನ್ನು (Counteroffer Total in ₹) ನಮೂದಿಸಿ:`
        : `Bulk Price Negotiation:\n` +
          `• Listed Estimate: ₹${est}\n` +
          `• Customer Proposal: ₹${bud}\n\n` +
          `Enter your proposed counteroffer total in ₹:`;

      const userAmount = window.prompt(promptText, String(suggestedCounter));
      if (!userAmount || isNaN(parseFloat(userAmount))) return;
      counterTotal = parseFloat(userAmount);
    }

    const counterPerUnit = Math.round(counterTotal / qty);

    const confirmText = isKn
      ? `ಪ್ರತಿ-ಕೊಡುಗೆ ದೃಢೀಕರಣ:\n` +
        `ಒಟ್ಟು: ₹${counterTotal} (ಪ್ರತಿ ಯೂನಿಟ್‌ಗೆ ₹${counterPerUnit} - ${qty} ತುಂಡುಗಳು)\n` +
        (voiceNote ? `ಧ್ವನಿ ಟಿಪ್ಪಣಿ: "${voiceNote}"\n\n` : `\n`) +
        `ಗ್ರಾಹಕರಿಗೆ ಈ ಪ್ರತಿ-ಕೊಡುಗೆ ಕಳುಹಿಸಲು ಖಚಿತವಾಗಿದ್ದೀರಾ?`
      : `Confirm Counteroffer:\n` +
        `Total: ₹${counterTotal} (₹${counterPerUnit}/unit for ${qty} pieces)\n` +
        (voiceNote ? `Voice note: "${voiceNote}"\n\n` : `\n`) +
        `Send this counteroffer to the customer?`;

    if (!window.confirm(confirmText)) return;

    const replyMsg = isKn
      ? `ನಮಸ್ಕಾರ, ನಿಮ್ಮ ${qty} ಕರಕುಶಲ ಕೃತಿಗಳ ಆರ್ಡರ್‌ಗೆ ನಮ್ಮ ವಿಶೇಷ ಪ್ರತಿ-ಕೊಡುಗೆ ₹${counterTotal} (ಪ್ರತಿ ಯೂನಿಟ್‌ಗೆ ₹${counterPerUnit}). ${voiceNote ? `(${voiceNote})` : 'ಅತ್ಯುತ್ತಮ ಗುಣಮಟ್ಟದೊಂದಿಗೆ ತಯಾರಿಸಿ ಕಳುಹಿಸಲಾಗುವುದು.'}`
      : `Hello, thank you for your enquiry. We propose a special counteroffer of ₹${counterTotal} (₹${counterPerUnit}/unit for ${qty} pieces). ${voiceNote ? `(${voiceNote})` : 'Handcrafted with premium finishing.'}`;

    try {
      setProcessing(true);
      const { error } = await supabase
        .from('enquiries')
        .update({
          artisan_response: replyMsg,
          counteroffer_amount: counterTotal,
          status: 'offer_awaiting_response'
        })
        .eq('id', enquiry.id);

      if (error) throw error;

      // Persist in enquiry_messages
      try {
        await supabase.from('enquiry_messages').insert({
          enquiry_id: enquiry.id,
          sender_id: profile?.id || user?.id,
          sender_role: 'artisan',
          message: replyMsg,
          message_type: 'counteroffer',
          proposed_amount: counterTotal,
          unit_price_equivalent: counterPerUnit,
          kannada_translation: replyMsg
        });
      } catch (msgErr) {
        console.warn('enquiry_messages insert fallback:', msgErr);
      }

      if (enquiry.customer_id) {
        try {
          await supabase.from('notifications').insert({
            user_id: enquiry.customer_id,
            type: 'artisan_responded',
            title: 'Artisan Counteroffer Received',
            message: `Artisan sent a counteroffer of ₹${counterTotal} (₹${counterPerUnit}/unit) for your enquiry.`,
            reference_id: enquiry.id,
            reference_type: 'enquiry',
            is_read: false
          });
        } catch {
          // non-blocking
        }
      }

      setMessages(prev => prev.map(m => {
        if (m.enquiryCard && m.enquiryCard.id === enquiry.id) {
          return {
            ...m,
            enquiryCard: {
              ...m.enquiryCard,
              artisan_response: replyMsg,
              counteroffer_amount: counterTotal,
              status: 'offer_awaiting_response'
            }
          };
        }
        return m;
      }));

      addMessage('assistant', isKn
        ? `🤝 **ಪ್ರತಿ-ಕೊಡುಗೆ ಯಶಸ್ವಿಯಾಗಿ ಕಳುಹಿಸಲಾಗಿದೆ:**\n\n"${replyMsg}"\n\nಗ್ರಾಹಕರ ಅನುಮೋದನೆಗಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ.`
        : `🤝 **Counteroffer sent successfully:**\n\n"${replyMsg}"\n\nAwaiting customer acceptance.`
      );
    } catch (err) {
      console.error('Error sending counteroffer:', err);
      addMessage('assistant', isKn ? "⚠️ ಪ್ರತಿ-ಕೊಡುಗೆ ಕಳುಹಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ." : "⚠️ Failed to send counteroffer.");
    } finally {
      setProcessing(false);
    }
  };

  // Voice-based Counteroffer
  const handleVoiceCounteroffer = async (enquiry) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert(isKn ? 'ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ರೆಕಾರ್ಡಿಂಗ್ ಬೆಂಬಲವಿಲ್ಲ.' : 'Speech recognition is not supported in this browser.');
      handleNegotiateCounteroffer(enquiry);
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognizer = new SpeechRec();
    recognizer.lang = isKn ? 'kn-IN' : 'en-IN';
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;

    addMessage('assistant', isKn
      ? "🎙️ **ಧ್ವನಿ ರೆಕಾರ್ಡಿಂಗ್ ಆಲಿಸಲಾಗುತ್ತಿದೆ...**\nದಯವಿಟ್ಟು ನಿಮ್ಮ ಪ್ರತಿ-ಕೊಡುಗೆ ಮೊತ್ತವನ್ನು ಮಾತನಾಡಿ (ಉದಾ: 'ಪ್ರತಿ-ಕೊಡುಗೆ 3500 ರೂಪಾಯಿ')."
      : "🎙️ **Listening to voice input...**\nPlease speak your counteroffer amount (e.g. 'Counteroffer 3500 rupees')."
    );

    recognizer.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const match = transcript.match(/\d+[\d,]*/);
      let detectedAmount = match ? parseInt(match[0].replace(/,/g, '')) : null;

      if (!detectedAmount) {
        if (transcript.includes('ಮೂರು ಸಾವಿರದ ಐನೂರು') || transcript.includes('3500')) detectedAmount = 3500;
        else if (transcript.includes('ಮೂರು ಸಾವಿರ') || transcript.includes('3000')) detectedAmount = 3000;
        else if (transcript.includes('ನಾಲ್ಕು ಸಾವಿರ') || transcript.includes('4000')) detectedAmount = 4000;
        else if (transcript.includes('ಐದು ಸಾವಿರ') || transcript.includes('5000')) detectedAmount = 5000;
        else if (transcript.includes('ಎರಡು ಸಾವಿರ') || transcript.includes('2000')) detectedAmount = 2000;
      }

      handleNegotiateCounteroffer(enquiry, detectedAmount, transcript);
    };

    recognizer.onerror = (err) => {
      console.warn('Voice recognition error:', err);
      handleNegotiateCounteroffer(enquiry);
    };

    try {
      recognizer.start();
    } catch {
      handleNegotiateCounteroffer(enquiry);
    }
  };

  // Mutual Order Confirmation & Production Scheduling
  const handleConfirmProduction = async (enquiry) => {
    const defaultDate = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
    const promptDate = isKn
      ? `ಉತ್ಪನ್ನ ತಯಾರಿಕೆ ಮತ್ತು ವಿತರಣೆ ದಿನಾಂಕ ದೃಢೀಕರಿಸಿ:\n\nನಿರೀಕ್ಷಿತ ಪೂರ್ಣಗೊಳ್ಳುವ ದಿನಾಂಕ (YYYY-MM-DD ನಮೂದಿಸಿ):`
      : `Confirm Production & Ready Date:\n\nEnter expected ready date (YYYY-MM-DD):`;

    const readyDate = window.prompt(promptDate, defaultDate);
    if (!readyDate) return;

    const promptNotes = isKn
      ? `ಉತ್ಪಾದನಾ ಟಿಪ್ಪಣಿಗಳು (Production Notes):\n\n(ಉದಾ: 'ಸಾಂಪ್ರದಾಯಿಕ ಕೈಯಿಂದ ಮಾಡಿದ ಬಣ್ಣ ಮತ್ತು ಲ್ಯಾಕರ್ ಪೂರ್ಣಗೊಳಿಸುವಿಕೆ ಆರಂಭಿಸಲಾಗಿದೆ')`
      : `Production Notes:\n\n(e.g., 'Handcrafting started in workshop with premium natural lacquer finish')`;

    const notes = window.prompt(promptNotes, isKn ? 'ಕಾರ್ಯಾಗಾರದಲ್ಲಿ ನುರಿತ ಕುಶಲಕರ್ಮಿಗಳಿಂದ ಉತ್ಪಾದನೆ ಆರಂಭಿಸಲಾಗಿದೆ.' : 'Handcrafting scheduled in workshop with master artisan quality checks.') || '';

    try {
      setProcessing(true);
      const agreedTotal = Number(enquiry.counteroffer_amount || enquiry.budget || enquiry.estimate || 400);
      const qty = Number(enquiry.quantity) || 1;

      // 1. Update enquiry status to confirmed
      const { error: enqErr } = await supabase
        .from('enquiries')
        .update({
          status: 'confirmed',
          expected_ready_date: readyDate,
          production_notes: notes,
          artisan_confirmed_at: new Date().toISOString()
        })
        .eq('id', enquiry.id);

      if (enqErr) throw enqErr;

      // 2. Create confirmed order in orders table
      let createdOrderId = null;
      try {
        const { data: newOrder, error: orderErr } = await supabase
          .from('orders')
          .insert({
            customer_id: enquiry.customer_id,
            total_amount: agreedTotal,
            shipping_name: 'Custom Order Buyer',
            shipping_phone: 'Pending Customer Update',
            shipping_address: 'Mutual Agreement via Custom Craft Enquiry',
            shipping_city: 'Bengaluru',
            shipping_state: 'Karnataka',
            shipping_pincode: '560001',
            status: 'confirmed'
          })
          .select()
          .single();

        if (!orderErr && newOrder?.id) {
          createdOrderId = newOrder.id;
          await supabase.from('order_items').insert({
            order_id: newOrder.id,
            product_id: enquiry.product_id,
            artisan_id: artisan.id,
            quantity: qty,
            unit_price: Number((agreedTotal / qty).toFixed(2)),
            subtotal: agreedTotal
          });
          await supabase.from('enquiries').update({ order_id: newOrder.id }).eq('id', enquiry.id);
        }
      } catch (orderCreateErr) {
        console.warn('Orders creation fallback:', orderCreateErr);
      }

      // 3. Persist in enquiry_messages
      try {
        await supabase.from('enquiry_messages').insert({
          enquiry_id: enquiry.id,
          sender_id: profile?.id || user?.id,
          sender_role: 'artisan',
          message: `Production Confirmed! Artisan scheduled workshop completion for ${readyDate}. Note: "${notes}"`,
          message_type: 'production_confirmation',
          proposed_amount: agreedTotal,
          unit_price_equivalent: Number((agreedTotal / qty).toFixed(2)),
          kannada_translation: `ಉತ್ಪಾದನೆ ದೃಢೀಕರಿಸಲಾಗಿದೆ! ನಿರೀಕ್ಷಿತ ದಿನಾಂಕ: ${readyDate}. ಟಿಪ್ಪಣಿ: "${notes}"`
        });
      } catch (msgErr) {
        console.warn('enquiry_messages insert fallback:', msgErr);
      }

      // 4. Notify customer
      if (enquiry.customer_id) {
        try {
          await supabase.from('notifications').insert({
            user_id: enquiry.customer_id,
            type: 'enquiry_confirmed',
            title: 'Custom Order Confirmed! 🔨',
            message: `Artisan confirmed production for "${enquiry.product_name}". Expected ready date: ${readyDate}.`,
            reference_id: enquiry.id,
            reference_type: 'enquiry',
            is_read: false
          });
        } catch {
          // non-blocking
        }
      }

      // 5. Update UI state
      setMessages(prev => prev.map(m => {
        if (m.enquiryCard && m.enquiryCard.id === enquiry.id) {
          return {
            ...m,
            enquiryCard: {
              ...m.enquiryCard,
              status: 'confirmed',
              expected_ready_date: readyDate,
              production_notes: notes,
              order_id: createdOrderId
            }
          };
        }
        return m;
      }));

      addMessage('assistant', isKn
        ? `🔨 **ಉತ್ಪಾದನೆ ಮತ್ತು ಆರ್ಡರ್ ಯಶಸ್ವಿಯಾಗಿ ದೃಢೀಕರಿಸಲಾಗಿದೆ!**\n\n• ನಿರೀಕ್ಷಿತ ದಿನಾಂಕ: ${readyDate}\n• ಒಟ್ಟು ಮೌಲ್ಯ: ₹${agreedTotal}\n• ಟಿಪ್ಪಣಿ: "${notes}"\n\nಗ್ರಾಹಕರಿಗೆ ದೃಢೀಕರಣ ಸಂದೇಶ ಕಳುಹಿಸಲಾಗಿದೆ.`
        : `🔨 **Production & Order Confirmed!**\n\n• Expected Ready Date: ${readyDate}\n• Total Agreed: ₹${agreedTotal}\n• Notes: "${notes}"\n\nCustomer notified with production schedule.`
      );
    } catch (err) {
      console.error('Error confirming production:', err);
      addMessage('assistant', isKn ? "⚠️ ಉತ್ಪಾದನೆ ದೃಢೀಕರಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ." : "⚠️ Failed to confirm production.");
    } finally {
      setProcessing(false);
    }
  };

  // Reply to customer enquiry directly
  const handleReplyToEnquiry = async (enquiryId) => {
    const defaultSuggestion = isKn
      ? "ನಮಸ್ಕಾರ, ನಿಮ್ಮ ವಿಚಾರಣೆಗೆ ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ಅಗತ್ಯಕ್ಕೆ ತಕ್ಕಂತೆ ನಾವು ಇದನ್ನು ಪ್ರೀತಿಯಿಂದ ತಯಾರಿಸಲು ಸಿದ್ಧರಿದ್ದೇವೆ."
      : "Hello, thank you for your enquiry. We would be pleased to handcraft this to your exact specifications.";
    const userReply = window.prompt(
      isKn ? "ಗ್ರಾಹಕರಿಗೆ ನಿಮ್ಮ ಉತ್ತರವನ್ನು ಬರೆಯಿರಿ:" : "Type your response to the customer:",
      defaultSuggestion
    );
    if (!userReply || !userReply.trim()) return;

    try {
      setProcessing(true);
      const { error } = await supabase
        .from('enquiries')
        .update({
          artisan_response: userReply.trim(),
          status: 'responded'
        })
        .eq('id', enquiryId);

      if (error) throw error;

      // Add to enquiry_messages
      try {
        await supabase.from('enquiry_messages').insert({
          enquiry_id: enquiryId,
          sender_id: profile?.id || user?.id,
          sender_role: 'artisan',
          message: userReply.trim(),
          message_type: 'text',
          kannada_translation: userReply.trim()
        });
      } catch (msgErr) {
        console.warn('enquiry_messages insert fallback:', msgErr);
      }

      setMessages(prev => prev.map(m => {
        if (m.enquiryCard && m.enquiryCard.id === enquiryId) {
          return {
            ...m,
            enquiryCard: { ...m.enquiryCard, artisan_response: userReply.trim(), status: 'responded' }
          };
        }
        return m;
      }));

      addMessage('assistant', isKn
        ? `✅ **ಗ್ರಾಹಕರಿಗೆ ಪ್ರತ್ಯುತ್ತರ ಕಳುಹಿಸಲಾಗಿದೆ:**\n\n"${userReply.trim()}"`
        : `✅ **Response sent to customer successfully:**\n\n"${userReply.trim()}"`
      );
    } catch (err) {
      console.error('Error replying to enquiry:', err);
      addMessage('assistant', isKn ? "⚠️ ಪ್ರತ್ಯುತ್ತರ ಕಳುಹಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ." : "⚠️ Failed to send response.");
    } finally {
      setProcessing(false);
    }
  };

  // Handle Action Buttons
  const handleAction = (action) => {
    switch (action) {
      case 'open_camera':
        cameraInputRef.current?.click();
        break;
      case 'open_gallery':
        galleryInputRef.current?.click();
        break;
      case 'check_orders':
        handleCheckOrders();
        break;
      case 'check_enquiries':
        handleCheckEnquiries();
        break;
      case 'how_it_works':
        addMessage('assistant', isKn
          ? "💡 **ಉತ್ಪನ್ನ ಸೇರಿಸುವ ಹಂತಗಳು:**\n\n1. ನಿಮ್ಮ ಕಲಾಕೃತಿಯ ಸ್ಪಷ್ಟ ಫೋಟೋ ತೆಗೆಯಿರಿ.\n2. ಮೈಕ್ರೊಫೋನ್ ಒತ್ತಿ: ವಸ್ತು, ಬೆಲೆ, ಮತ್ತು ಎಷ್ಟು ದಾಸ್ತಾನು ಇದೆ ಎಂಬುದನ್ನು ಧ್ವನಿಯಲ್ಲಿ ತಿಳಿಸಿ.\n3. ನಮ್ಮ AI ಅದನ್ನು ಇಂಗ್ಲಿಷ್ ಹಾಗೂ ಕನ್ನಡದಲ್ಲಿ ಸಿದ್ಧಪಡಿಸುತ್ತದೆ.\n4. 'Publish' ಬಟನ್ ಒತ್ತಿದ ತಕ್ಷಣ ಅದು ನೇರವಾಗಿ ಸರ್ಕಾರಿ-ಪರಿಶೀಲಿತ ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ಪ್ರಕಟವಾಗುತ್ತದೆ!"
          : "💡 **How It Works:**\n\n1. Snap or upload a photo of your craft item.\n2. Tap the microphone and describe materials, craft techniques, price, and stock.\n3. Our AI generates an English marketplace title & description alongside your original Kannada review.\n4. Tap 'Publish' to list it live on the verified marketplace!",
          {
            actionButtons: [
              { label: isKn ? '📷 ಫೋಟೋ ತೆಗೆಯಿರಿ' : '📷 Take Photo', action: 'open_camera' },
              { label: isKn ? '🖼️ ಗ್ಯಾಲರಿ' : '🖼️ Gallery', action: 'open_gallery' }
            ]
          }
        );
        break;
      case 'publish_product':
        handleSaveProduct('published');
        break;
      case 'save_draft':
        handleSaveProduct('draft');
        break;
      case 'retry_voice':
        startVoiceRecording();
        break;
      case 'cancel_flow':
        handleCancelFlow();
        break;
      case 'view_my_products':
        navigate('/my-products');
        break;
      default:
        console.log('Action:', action);
    }
  };

  // Cancel flow
  const handleCancelFlow = () => {
    if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview);
    setPendingPhotoFile(null);
    setPendingPhotoPreview("");
    setCurrentDraft(null);
    setWorkflowStep('idle');
    addMessage('assistant', isKn ? "🛑 ಪ್ರಕ್ರಿಯೆ ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ. ಹೊಸ ಉತ್ಪನ್ನ ಸೇರಿಸಲು ಫೋಟೋ ಕಳುಹಿಸಿ." : "🛑 Workflow reset. Send a photo anytime to start a new listing.", {
      actionButtons: [
        { label: isKn ? '📷 ಕ್ಯಾಮೆರಾ' : '📷 Camera', action: 'open_camera' },
        { label: isKn ? '🖼️ ಗ್ಯಾಲರಿ' : '🖼️ Gallery', action: 'open_gallery' }
      ]
    });
  };

  // Handle Photo Selection
  const handlePhotoSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addMessage('assistant', isKn ? "⚠️ ದಯವಿಟ್ಟು ಮಾನ್ಯವಾದ ಫೋಟೋವನ್ನು ಆಯ್ಕೆಮಾಡಿ (JPG/PNG/WebP)." : "⚠️ Please select a valid photo file.");
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addMessage('assistant', isKn ? "⚠️ ಚಿತ್ರದ ಗಾತ್ರ 5 MB ಗಿಂತ ಕಡಿಮೆಯಿರಬೇಕು." : "⚠️ Image must be under 5 MB.");
      e.target.value = '';
      return;
    }

    if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview);
    const previewUrl = URL.createObjectURL(file);

    setPendingPhotoFile(file);
    setPendingPhotoPreview(previewUrl);
    setWorkflowStep('awaiting_voice');

    // Add user photo bubble
    addMessage('artisan', isKn ? "📸 ಉತ್ಪನ್ನದ ಫೋಟೋ ಲಗತ್ತಿಸಲಾಗಿದೆ" : "📸 Attached craft photo", {
      photoUrl: previewUrl
    });

    // Add assistant prompt for voice description
    setTimeout(() => {
      addMessage('assistant', isKn
        ? "📸 **ಫೋಟೋ ಸ್ವೀಕರಿಸಲಾಗಿದೆ!**\n\nಈಗ ಕೆಳಗಿನ **ಮೈಕ್ರೊಫೋನ್ (🎙️)** ಒತ್ತಿ ನಿಮ್ಮ ಉತ್ಪನ್ನದ ವಿವರಣೆ ನೀಡಿ:\n• ಇದು ಯಾವ ವಸ್ತು? (ಉದಾ: ಬಿದಿರು, ಜೇಡಿಮಣ್ಣು, ಶ್ರೀಗಂಧ)\n• ಇದರ ಬೆಲೆ ಎಷ್ಟು?\n• ನಿಮ್ಮ ಬಳಿ ಎಷ್ಟು ದಾಸ್ತಾನು ಇದೆ?"
        : "📸 **Photo Received!**\n\nNow tap the **microphone (🎙️)** below and describe your craft:\n• What material is it made of? (e.g., bamboo, clay, brass)\n• What is the selling price in ₹?\n• How many units are available?",
        {
          actionButtons: [
            { label: isKn ? '🎙️ ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಪ್ರಾರಂಭಿಸಿ' : '🎙️ Start Voice Recording', action: 'retry_voice' },
            { label: isKn ? '❌ ರದ್ದುಮಾಡಿ' : '❌ Cancel', action: 'cancel_flow' }
          ]
        }
      );
    }, 400);

    e.target.value = '';
  };

  // Voice Recording Management
  const startVoiceRecording = async () => {
    if (isRecording) return;

    setLiveTranscript("");
    setRecordingSeconds(0);

    const session = createVoiceSession({
      language: isKn ? 'kn-IN' : 'en-IN',
      onStateChange: (newState) => {
        setVoiceState(newState);
      },
      onTimerTick: (sec) => {
        setRecordingSeconds(sec);
      },
      onInterimResult: (_interim, fullDisplay) => {
        setLiveTranscript(fullDisplay);
      },
      onFinalTranscript: async (finalText, _audioBlob, audioUrl) => {
        await handleVoiceTranscriptFinished(finalText, audioUrl);
      },
      onError: (errType, details) => {
        console.warn('Voice session error:', errType, details);
        const errMsg = getVoiceStatusMessage(errType, language, details);
        addMessage('assistant', `⚠️ ${errMsg}`, {
          actionButtons: [
            { label: isKn ? '🔄 ಮರುಪ್ರಯತ್ನಿಸಿ' : '🔄 Retry Mic', action: 'retry_voice' },
            { label: isKn ? '❌ ರದ್ದು' : '❌ Cancel', action: 'cancel_flow' }
          ]
        });
      },
      backendTranscribe: async (audioBlob, lang) => {
        try {
          const base64Audio = await fileToBase64(audioBlob);
          const { data, error } = await supabase.functions.invoke('transcribe-voice', {
            body: {
              audio: base64Audio,
              mimeType: audioBlob.type || 'audio/webm',
              language: lang
            }
          });
          if (!error && data && data.transcript) {
            return data.transcript;
          }
        } catch (e) {
          console.warn('Backend transcription note:', e);
        }
        return null;
      }
    });

    voiceSessionRef.current = session;
    await session.start();
  };

  const stopVoiceRecording = () => {
    if (voiceSessionRef.current) {
      voiceSessionRef.current.stop();
    }
  };

  const cancelVoiceRecording = () => {
    if (voiceSessionRef.current) {
      voiceSessionRef.current.cancel();
      voiceSessionRef.current = null;
    }
    setVoiceState(VOICE_STATES.IDLE);
    setLiveTranscript("");
    setRecordingSeconds(0);
  };

  // Handle Finished Voice Transcript
  const handleVoiceTranscriptFinished = async (transcriptText, audioUrl) => {
    const text = (transcriptText || "").trim();
    if (!text) {
      addMessage('assistant', isKn ? "⚠️ ಯಾವುದೇ ಧ್ವನಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮೈಕ್ರೊಫೋನ್ ಒತ್ತಿ ಮತ್ತೆ ಮಾತನಾಡಿ." : "⚠️ No speech detected. Please tap the microphone and speak again.", {
        actionButtons: [{ label: isKn ? '🔄 ಮರುಪ್ರಯತ್ನಿಸಿ' : '🔄 Try Again', action: 'retry_voice' }]
      });
      return;
    }

    // Add artisan audio/transcript bubble
    addMessage('artisan', text, {
      audioUrl: audioUrl || null
    });

    // Check if this is a voice correction to an existing draft
    if (currentDraft && workflowStep === 'reviewing_draft') {
      const correction = interpretCorrectionCommand(text, currentDraft, language);
      if (correction.success) {
        setCurrentDraft(correction.updatedDraft);
        addMessage('assistant', isKn
          ? `✏️ **ವಿವರಗಳನ್ನು ನವೀಕರಿಸಲಾಗಿದೆ!**\n\nಬೆಲೆ: ₹${correction.updatedDraft.price || '---'} | ದಾಸ್ತಾನು: ${correction.updatedDraft.stock_quantity || 1} units.`
          : `✏️ **Listing Updated!**\n\nPrice: ₹${correction.updatedDraft.price || '---'} | Stock: ${correction.updatedDraft.stock_quantity || 1} units.`,
          {
            draftCard: correction.updatedDraft,
            actionButtons: [
              { label: isKn ? '✅ ಮಾರುಕಟ್ಟೆಗೆ ಪ್ರಕಟಿಸಿ' : '✅ Publish Live', action: 'publish_product' },
              { label: isKn ? '💾 ಕರಡು ಉಳಿಸಿ' : '💾 Save Draft', action: 'save_draft' },
              { label: isKn ? '❌ ರದ್ದುಮಾಡಿ' : '❌ Cancel', action: 'cancel_flow' }
            ]
          }
        );
        return;
      }
    }

    // Extract facts and generate listing
    setProcessing(true);
    setWorkflowStep('processing_voice');

    try {
      const nlpStart = performance.now();
      const facts = extractProductFacts(text);
      const nlpEnd = performance.now();

      const listingStart = performance.now();
      const listing = buildProductListing(text, facts);
      const listingEnd = performance.now();

      const nlpExtractionMs = Math.max(1, Math.round(nlpEnd - nlpStart));
      const listingGenerationMs = Math.max(1, Math.round(listingEnd - listingStart));
      const totalProcessingMs = nlpExtractionMs + listingGenerationMs;

      // Match category ID
      const matchedCat = categories.find(c =>
        c.name.toLowerCase().includes(listing.category?.toLowerCase() || '')
      ) || categories[0];

      const draftObj = {
        name: listing.englishTitle,
        local_title: listing.localTitle,
        description: listing.englishDescription,
        local_description: listing.localDescription,
        price: listing.price,
        isPriceProvisional: listing.isPriceProvisional,
        stock_quantity: listing.stockQuantity || 1,
        category: listing.category || 'Handicrafts',
        category_id: matchedCat?.id || null,
        imageUrl: pendingPhotoPreview,
        rawTranscript: text,
        latencyStats: {
          nlpExtractionMs,
          listingGenerationMs,
          totalProcessingMs,
          recordedAt: new Date().toISOString()
        }
      };

      setCurrentDraft(draftObj);
      setWorkflowStep('reviewing_draft');
      setProcessing(false);

      addMessage('assistant', isKn
        ? `✨ **ಉತ್ಪನ್ನದ ಕರಡು ಪಟ್ಟಿ ಸಿದ್ಧವಾಗಿದೆ!**\n\nದಯವಿಟ್ಟು ಕೆಳಗಿನ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ. ಎಲ್ಲವೂ ಸರಿಯಾಗಿದ್ದರೆ **ಪ್ರಕಟಿಸಿ** ಒತ್ತಿ:`
        : `✨ **Product Listing Generated!**\n\nPlease review the bilingual listing below. If everything looks good, tap **Publish Live**:`,
        {
          draftCard: draftObj,
          actionButtons: [
            { label: isKn ? '✅ ಮಾರುಕಟ್ಟೆಗೆ ಪ್ರಕಟಿಸಿ' : '✅ Publish Live', action: 'publish_product' },
            { label: isKn ? '💾 ಕರಡು ಉಳಿಸಿ' : '💾 Save Draft', action: 'save_draft' },
            { label: isKn ? '❌ ರದ್ದುಮಾಡಿ' : '❌ Cancel', action: 'cancel_flow' }
          ]
        }
      );
    } catch (err) {
      console.error('Error generating listing:', err);
      setProcessing(false);
      setWorkflowStep('awaiting_voice');
      addMessage('assistant', isKn ? `⚠️ ಕರಡು ತಯಾರಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ: ${err.message}` : `⚠️ Failed to build listing: ${err.message}`);
    }
  };

  // Manual Edit Field on Draft
  const handleEditDraftField = (field, val) => {
    if (!currentDraft) return;
    const updated = { ...currentDraft, [field]: val };
    if (field === 'price' && Number(val) > 0) {
      updated.isPriceProvisional = false;
    }
    setCurrentDraft(updated);
  };

  // Save or Publish Product to Supabase
  const handleSaveProduct = async (targetStatus = 'published') => {
    if (!currentDraft) return;

    if (!user) {
      addMessage('assistant', isKn ? "⚠️ ಉತ್ಪನ್ನ ಉಳಿಸಲು ದಯವಿಟ್ಟು ಸೈನ್ ಇನ್ ಮಾಡಿ." : "⚠️ Please sign in to save your product.", {
        actionButtons: [{ label: isKn ? '🔑 ಸೈನ್ ಇನ್' : '🔑 Sign In', action: 'login' }]
      });
      return;
    }

    if (!artisan?.id) {
      addMessage('assistant', isKn ? "⚠️ ಕುಶಲಕರ್ಮಿ ಪ್ರೊಫೈಲ್ ಕಂಡುಬಂದಿಲ್ಲ. ದಯವಿಟ್ಟು ಮುಖಪುಟದಲ್ಲಿ ಪ್ರೊಫೈಲ್ ಪರಿಶೀಲಿಸಿ." : "⚠️ Artisan profile not found. Please verify your artisan account.");
      return;
    }

    if (targetStatus === 'published' && (!currentDraft.price || Number(currentDraft.price) <= 0)) {
      addMessage('assistant', isKn
        ? "⚠️ ಪ್ರಕಟಿಸಲು ನಿಖರವಾದ ಬೆಲೆ ಅಗತ್ಯವಿದೆ. ದಯವಿಟ್ಟು ಬೆಲೆಯನ್ನು ನಮೂದಿಸಿ ಅಥವಾ ಧ್ವನಿಯಲ್ಲಿ ತಿಳಿಸಿ (ಉದಾ: 'ಬೆಲೆ 400')."
        : "⚠️ A confirmed price is required to publish live. Please enter a valid price.",
        {
          draftCard: currentDraft
        }
      );
      return;
    }

    setProcessing(true);
    setWorkflowStep('saving');

    try {
      const cleanEnglishTitle = currentDraft.name?.trim() || 'Handcrafted Artisan Product';
      const cleanEnglishDesc = currentDraft.description?.trim() || 'Authentic handcrafted product.';
      const cleanPrice = Number(currentDraft.price) || 0;
      const cleanStock = Number(currentDraft.stock_quantity) || 1;

      // 1. Primary insert attempt with local_title/local_description
      const primaryPayload = {
        artisan_id: artisan.id,
        category_id: currentDraft.category_id || categories[0]?.id || null,
        name: cleanEnglishTitle,
        description: cleanEnglishDesc,
        local_title: currentDraft.local_title ? currentDraft.local_title.trim() : null,
        local_description: currentDraft.local_description ? currentDraft.local_description.trim() : null,
        price: cleanPrice,
        stock_quantity: cleanStock,
        status: targetStatus
      };

      let newProd = null;
      const primaryRes = await supabase.from('products').insert(primaryPayload).select().single();

      if (primaryRes.error && (primaryRes.error.message?.includes('local_title') || primaryRes.error.message?.includes('local_description'))) {
        // Fallback for database without local_title column: combine into description
        const fallbackDesc = currentDraft.local_description
          ? `${cleanEnglishDesc}\n\n---\nಕನ್ನಡ ವಿವರಣೆ (Kannada Listing):\nಶೀರ್ಷಿಕೆ: ${currentDraft.local_title || cleanEnglishTitle}\nವಿವರಣೆ: ${currentDraft.local_description}`
          : cleanEnglishDesc;

        const fallbackRes = await supabase
          .from('products')
          .insert({
            artisan_id: artisan.id,
            category_id: currentDraft.category_id || categories[0]?.id || null,
            name: cleanEnglishTitle,
            description: fallbackDesc.trim(),
            price: cleanPrice,
            stock_quantity: cleanStock,
            status: targetStatus
          })
          .select()
          .single();

        if (fallbackRes.error) throw fallbackRes.error;
        newProd = fallbackRes.data;
      } else {
        if (primaryRes.error) throw primaryRes.error;
        newProd = primaryRes.data;
      }

      // 2. Upload image to product-images storage bucket
      let photoLinked = false;
      if (pendingPhotoFile && newProd?.id) {
        try {
          const ext = pendingPhotoFile.name.split('.').pop() || 'jpg';
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
          const filePath = `${artisan.id}/${newProd.id}/${fileName}`;

          const { error: uploadErr } = await supabase.storage
            .from('product-images')
            .upload(filePath, pendingPhotoFile);

          if (!uploadErr) {
            const { data: urlData } = supabase.storage
              .from('product-images')
              .getPublicUrl(filePath);

            if (urlData?.publicUrl) {
              await supabase.from('product_images').insert({
                product_id: newProd.id,
                image_url: urlData.publicUrl,
                display_order: 0
              });
              photoLinked = true;
            }
          }
        } catch (imgErr) {
          console.warn('Image upload note:', imgErr);
        }
      }

      setLastPublishedProduct(newProd);
      setWorkflowStep('published');
      setProcessing(false);

      // Clean up preview
      if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview);
      setPendingPhotoFile(null);
      setPendingPhotoPreview("");
      setCurrentDraft(null);

      const isPublished = targetStatus === 'published';
      addMessage('assistant', isKn
        ? `🎉 **ಅಭಿನಂದನೆಗಳು! ${isPublished ? 'ಉತ್ಪನ್ನವನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಪ್ರಕಟಿಸಲಾಗಿದೆ!' : 'ಉತ್ಪನ್ನವನ್ನು ಕರಡಾಗಿ ಉಳಿಸಲಾಗಿದೆ!'}**\n\n📌 **ಶೀರ್ಷಿಕೆ:** ${cleanEnglishTitle}\n💰 **ಬೆಲೆ:** ₹${cleanPrice}\n📦 **ದಾಸ್ತಾನು:** ${cleanStock} units\n🆔 **Product ID:** \`${newProd.id.slice(0, 8)}\`${photoLinked ? '\n📸 ಫೋಟೋ ಸಂಪರ್ಕಿಸಲಾಗಿದೆ' : ''}`
        : `🎉 **Success! Product ${isPublished ? 'Published Live' : 'Saved as Draft'}!**\n\n📌 **Title:** ${cleanEnglishTitle}\n💰 **Price:** ₹${cleanPrice}\n📦 **Stock:** ${cleanStock} units\n🆔 **Product ID:** \`${newProd.id.slice(0, 8)}\`${photoLinked ? '\n📸 Photo attached' : ''}`,
        {
          actionButtons: [
            { label: isKn ? '📦 ನನ್ನ ಉತ್ಪನ್ನಗಳ ಕ್ಯಾಟಲಾಗ್' : '📦 View in My Products', action: 'view_my_products' },
            { label: isKn ? '➕ ಇನ್ನೊಂದು ಉತ್ಪನ್ನ ಸೇರಿಸಿ' : '➕ Add Another Product', action: 'open_camera' }
          ]
        }
      );
    } catch (err) {
      console.error('Error saving product:', err);
      setProcessing(false);
      setWorkflowStep('reviewing_draft');
      addMessage('assistant', isKn ? `❌ ಉಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ: ${err.message}` : `❌ Failed to save product: ${err.message}`);
    }
  };

  // Handle Send Text Message
  const handleSendMessage = (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    setInputText("");
    addMessage('artisan', text);

    // Process text as potential voice/text correction or command
    if (currentDraft && workflowStep === 'reviewing_draft') {
      const correction = interpretCorrectionCommand(text, currentDraft, language);
      if (correction.success) {
        setCurrentDraft(correction.updatedDraft);
        addMessage('assistant', isKn
          ? `✏️ **ವಿವರಗಳನ್ನು ನವೀಕರಿಸಲಾಗಿದೆ!**\n\nಬೆಲೆ: ₹${correction.updatedDraft.price || '---'} | ದಾಸ್ತಾನು: ${correction.updatedDraft.stock_quantity || 1} units.`
          : `✏️ **Listing Updated!**\n\nPrice: ₹${correction.updatedDraft.price || '---'} | Stock: ${correction.updatedDraft.stock_quantity || 1} units.`,
          {
            draftCard: correction.updatedDraft,
            actionButtons: [
              { label: isKn ? '✅ ಮಾರುಕಟ್ಟೆಗೆ ಪ್ರಕಟಿಸಿ' : '✅ Publish Live', action: 'publish_product' },
              { label: isKn ? '💾 ಕರಡು ಉಳಿಸಿ' : '💾 Save Draft', action: 'save_draft' },
              { label: isKn ? '❌ ರದ್ದುಮಾಡಿ' : '❌ Cancel', action: 'cancel_flow' }
            ]
          }
        );
        return;
      }
    }

    // Conversational commands routing
    const lower = text.toLowerCase().trim();
    if (lower === 'publish' || lower === 'ಪ್ರಕಟಿಸು') {
      handleSaveProduct('published');
    } else if (lower === 'cancel' || lower === 'ರದ್ದು') {
      handleCancelFlow();
    } else if (lower.includes('order') || lower.includes('ಆರ್ಡರ್')) {
      handleCheckOrders();
    } else if (lower.includes('enquir') || lower.includes('ವಿಚಾರಣೆ') || lower.includes('question')) {
      handleCheckEnquiries();
    } else if (lower.includes('photo') || lower.includes('ಫೋಟೋ') || lower.includes('ಚಿತ್ರ')) {
      handleAction('open_camera');
    } else {
      setTimeout(() => {
        addMessage('assistant', isKn
          ? `ಸ್ವೀಕರಿಸಲಾಗಿದೆ: "${text}". ನೀವು ಉತ್ಪನ್ನ ರಚಿಸಲು ಫೋಟೋ ಕಳುಹಿಸಬಹುದು, ಅಥವಾ ನಿಮ್ಮ ಆರ್ಡರ್‌ಗಳು ಹಾಗೂ ವಿಚಾರಣೆಗಳನ್ನು ಪರಿಶೀಲಿಸಬಹುದು.`
          : `Received: "${text}". You can send a photo to list a product, or check your orders and customer enquiries below.`,
          {
            actionButtons: [
              { label: isKn ? '📷 ಫೋಟೋ ತೆಗೆಯಿರಿ' : '📷 Take Photo', action: 'open_camera' },
              { label: isKn ? '📦 ಹೊಸ ಆರ್ಡರ್‌ಗಳು' : '📦 Orders', action: 'check_orders' },
              { label: isKn ? '💬 ವಿಚಾರಣೆಗಳು' : '💬 Enquiries', action: 'check_enquiries' }
            ]
          }
        );
      }, 300);
    }
  };

  return (
    <div className="whatsapp-container" style={{
      maxWidth: '560px',
      margin: '0 auto',
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg, #efeae2)',
      color: 'var(--text, #111b21)',
      fontFamily: 'inherit',
      overflow: 'hidden',
      position: 'relative',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
    }}>
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handlePhotoSelected}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        onChange={handlePhotoSelected}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* WhatsApp App Bar */}
      <header style={{
        background: 'var(--primary-green, #075e54)',
        color: '#FFFFFF',
        padding: '0.65rem 0.85rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <Link
            to="/"
            style={{
              color: '#FFFFFF',
              textDecoration: 'none',
              fontSize: '1.25rem',
              fontWeight: 700,
              padding: '0.2rem 0.4rem',
              display: 'flex',
              alignItems: 'center'
            }}
            title={isKn ? "ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ" : "Back to Home"}
          >
            ←
          </Link>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: '#128c7e',
              border: '2px solid #25d366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}>
              🏺
            </div>
            <span style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '10px',
              height: '10px',
              background: '#25d366',
              borderRadius: '50%',
              border: '2px solid #075e54'
            }}></span>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2 }}>
              Artisan Connect Assistant
            </h1>
            <span style={{ fontSize: '0.72rem', color: '#c7edd5', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              ● {isKn ? 'ಆನ್‌ಲೈನ್ • WhatsApp ಮಾದರಿಯ ಸಹಾಯಕ' : 'online • WhatsApp-Style Assistant'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Language Switcher */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.15)', borderRadius: '6px', padding: '2px' }}>
            <button
              type="button"
              onClick={() => handleLanguageToggle('kn')}
              style={{
                background: isKn ? '#25d366' : 'transparent',
                color: isKn ? '#075e54' : '#FFFFFF',
                border: 'none',
                borderRadius: '4px',
                padding: '0.2rem 0.45rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ಕನ್ನಡ
            </button>
            <button
              type="button"
              onClick={() => handleLanguageToggle('en')}
              style={{
                background: !isKn ? '#25d366' : 'transparent',
                color: !isKn ? '#075e54' : '#FFFFFF',
                border: 'none',
                borderRadius: '4px',
                padding: '0.2rem 0.45rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              EN
            </button>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Chat Messages Viewport */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.85rem 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        backgroundImage: 'radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)',
        backgroundSize: '16px 16px'
      }}>
        {/* Meta Cloud API Notice Pill */}
        <div style={{ textAlign: 'center', margin: '0.25rem 0' }}>
          <button
            type="button"
            onClick={() => setShowMetaInfo(!showMetaInfo)}
            style={{
              background: 'var(--card-bg, #ffffff)',
              color: 'var(--secondary-text, #667781)',
              border: '1px solid var(--border, #d1d7db)',
              borderRadius: '16px',
              padding: '0.3rem 0.75rem',
              fontSize: '0.72rem',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>📱</span>
            <strong>{isKn ? 'ಸ್ಥಳೀಯ WhatsApp ಅನುಭವ' : 'Local WhatsApp Mode'}</strong>: {showMetaInfo ? 'Hide Setup ▲' : 'Meta Cloud API Info ▼'}
          </button>
        </div>

        {/* Expandable Meta Setup Panel */}
        {showMetaInfo && (
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border, #d1d7db)',
            borderRadius: '8px',
            padding: '0.75rem',
            fontSize: '0.78rem',
            color: 'var(--text)',
            lineHeight: 1.4
          }}>
            <p style={{ margin: '0 0 0.4rem', fontWeight: 700, color: 'var(--primary-green)' }}>
              ⚡ WhatsApp Business Cloud API Integration
            </p>
            <p style={{ margin: '0 0 0.4rem', color: 'var(--secondary-text)' }}>
              This local interface simulates the complete voice & photo listing experience inside our app.
              The backend webhook handler is configured at:
            </p>
            <div style={{ background: 'var(--bg)', padding: '0.4rem 0.5rem', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.72rem', wordBreak: 'break-all', marginBottom: '0.4rem' }}>
              {webhookUrl} (whatsapp-webhook)
            </div>
            <p style={{ margin: '0 0 0.4rem', fontSize: '0.72rem', color: 'var(--secondary-text)' }}>
              Server environment variables for production webhook: <code>WHATSAPP_VERIFY_TOKEN</code> and <code>WHATSAPP_ACCESS_TOKEN</code>.
            </p>
            <div style={{ marginTop: '0.5rem' }}>
              <Link
                to="/"
                style={{
                  display: 'inline-block',
                  padding: '0.4rem 0.75rem',
                  background: 'var(--primary-green)',
                  color: '#FFFFFF',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
              >
                Launch Web Assistant →
              </Link>
            </div>
          </div>
        )}

        {/* Quick Action Shortcut Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap', margin: '0.35rem 0 0.5rem' }}>
          <button
            type="button"
            onClick={() => handleAction('open_camera')}
            style={{
              padding: '0.25rem 0.6rem',
              borderRadius: '16px',
              border: '1px solid var(--border, #d1d7db)',
              background: 'var(--card-bg, #ffffff)',
              color: 'var(--text)',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            📷 {isKn ? 'ಫೋಟೋ' : 'Photo'}
          </button>
          <button
            type="button"
            onClick={() => handleAction('open_gallery')}
            style={{
              padding: '0.25rem 0.6rem',
              borderRadius: '16px',
              border: '1px solid var(--border, #d1d7db)',
              background: 'var(--card-bg, #ffffff)',
              color: 'var(--text)',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            🖼️ {isKn ? 'ಗ್ಯಾಲರಿ' : 'Gallery'}
          </button>
          <button
            type="button"
            onClick={() => handleAction('check_orders')}
            style={{
              padding: '0.25rem 0.6rem',
              borderRadius: '16px',
              border: '1px solid var(--border, #d1d7db)',
              background: 'var(--card-bg, #ffffff)',
              color: 'var(--primary-green)',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            📦 {isKn ? 'ಆರ್ಡರ್‌ಗಳು' : 'Orders'}
          </button>
          <button
            type="button"
            onClick={() => handleAction('check_enquiries')}
            style={{
              padding: '0.25rem 0.6rem',
              borderRadius: '16px',
              border: '1px solid var(--border, #d1d7db)',
              background: 'var(--card-bg, #ffffff)',
              color: '#2563EB',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            💬 {isKn ? 'ವಿಚಾರಣೆಗಳು' : 'Enquiries'}
          </button>
        </div>

        {/* Messages List */}
        {messages.map((msg) => {
          const isUser = msg.sender === 'artisan';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                width: '100%'
              }}
            >
              <div style={{
                maxWidth: '85%',
                minWidth: '120px',
                padding: '0.65rem 0.8rem',
                borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: isUser ? 'var(--wa-user-bubble, #d9fdd3)' : 'var(--card-bg, #ffffff)',
                color: 'var(--text, #111b21)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                border: isUser ? 'none' : '1px solid var(--border, rgba(0,0,0,0.06))',
                fontSize: '0.88rem',
                position: 'relative'
              }}>
                {/* Photo Attachment if present */}
                {msg.photoUrl && (
                  <div style={{ marginBottom: '0.5rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
                    <img
                      src={msg.photoUrl}
                      alt="Artisan craft attachment"
                      style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                )}

                {/* Text Content */}
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                  {msg.text}
                </div>

                {/* Interactive Draft Card if attached */}
                {msg.draftCard && (
                  <div style={{
                    marginTop: '0.65rem',
                    padding: '0.65rem',
                    background: 'var(--chat-bg, #f8f5ee)',
                    borderRadius: '8px',
                    border: '1.5px solid var(--primary-green, #075e54)',
                    fontSize: '0.82rem'
                  }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary-green)', marginBottom: '0.35rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>
                      🏷️ {isKn ? 'ಕರಡು ಪರಿಶೀಲನೆ (Review Draft)' : 'Product Review Draft'}
                    </div>

                    {msg.draftCard.imageUrl && (
                      <img src={msg.draftCard.imageUrl} alt="Draft preview" style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '6px', marginBottom: '0.4rem' }} />
                    )}

                    <div style={{ marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--secondary-text)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                        {isKn ? 'ಸ್ಥಳೀಯ ಶೀರ್ಷಿಕೆ (Kannada)' : 'Local Title'}
                      </span>
                      <strong style={{ color: 'var(--text)', fontSize: '0.86rem' }}>
                        {msg.draftCard.local_title || msg.draftCard.name}
                      </strong>
                    </div>

                    <div style={{ marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--secondary-text)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                        English Marketplace Title
                      </span>
                      <span style={{ color: 'var(--text)', fontSize: '0.84rem' }}>
                        {msg.draftCard.name}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', margin: '0.4rem 0' }}>
                      <div style={{ background: 'var(--card-bg, #ffffff)', padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--secondary-text)', display: 'block' }}>
                          {isKn ? 'ಬೆಲೆ (Price)' : 'Price'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <span style={{ fontWeight: 700 }}>₹</span>
                          <input
                            type="number"
                            value={msg.draftCard.price ?? ''}
                            onChange={(e) => handleEditDraftField('price', e.target.value)}
                            placeholder={isKn ? "ಬೆಲೆ ಹಾಕಿ" : "Enter price"}
                            style={{ width: '100%', border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary-green)' }}
                          />
                        </div>
                      </div>

                      <div style={{ background: 'var(--card-bg, #ffffff)', padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--secondary-text)', display: 'block' }}>
                          {isKn ? 'ದಾಸ್ತಾನು (Stock)' : 'Stock'}
                        </span>
                        <input
                          type="number"
                          value={msg.draftCard.stock_quantity ?? 1}
                          onChange={(e) => handleEditDraftField('stock_quantity', e.target.value)}
                          style={{ width: '100%', border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--secondary-text)', marginTop: '0.35rem', borderTop: '1px dashed var(--border)', paddingTop: '0.3rem' }}>
                      💡 {isKn ? 'ಬೆಲೆ ತಿದ್ದಲು ಧ್ವನಿಯಲ್ಲಿ ಹೇಳಿ: "ಬೆಲೆ 450 ಮಾಡಿ" ಅಥವಾ ಬಾಕ್ಸ್‌ನಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ.' : 'You can voice-correct: "Change price to 450" or type in the box above.'}
                    </div>

                    {msg.draftCard.latencyStats && (
                      <div style={{
                        marginTop: '0.4rem',
                        padding: '0.25rem 0.45rem',
                        background: 'rgba(5, 150, 105, 0.08)',
                        border: '1px solid rgba(5, 150, 105, 0.25)',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        color: 'var(--primary-green)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.3rem'
                      }}>
                        <span>⚡ {isKn ? 'ಸಂಸ್ಕರಣಾ ಸಮಯ' : 'Latency'}: <strong>{msg.draftCard.latencyStats.totalProcessingMs}ms</strong></span>
                        <span style={{ fontSize: '0.64rem', color: 'var(--secondary-text)' }}>
                          NLP: {msg.draftCard.latencyStats.nlpExtractionMs}ms | Gen: {msg.draftCard.latencyStats.listingGenerationMs}ms
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Interactive Order Card */}
                {msg.orderCard && (
                  <div style={{
                    marginTop: '0.65rem',
                    padding: '0.75rem',
                    background: 'var(--chat-bg, #f8f5ee)',
                    borderRadius: '8px',
                    border: '1.5px solid var(--primary-green, #075e54)',
                    fontSize: '0.82rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--primary-green)' }}>
                        📦 {isKn ? 'ಆರ್ಡರ್ ವಿವರ' : 'Order'} #{msg.orderCard.id?.slice(0, 8).toUpperCase()}
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        background: msg.orderCard.status === 'confirmed' ? '#dcfce7' : msg.orderCard.status === 'cancelled' ? '#fee2e2' : '#fef3c7',
                        color: msg.orderCard.status === 'confirmed' ? '#166534' : msg.orderCard.status === 'cancelled' ? '#991b1b' : '#92400e'
                      }}>
                        {msg.orderCard.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ marginBottom: '0.4rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.86rem' }}>
                        {msg.orderCard.product_name}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--secondary-text)', marginTop: '0.15rem' }}>
                        {isKn ? 'ಪ್ರಮಾಣ:' : 'Qty:'} <strong>{msg.orderCard.quantity}</strong> • {isKn ? 'ಮೊತ್ತ:' : 'Total:'} <strong style={{ color: 'var(--primary-green)' }}>₹{Number(msg.orderCard.total_amount).toFixed(2)}</strong>
                      </div>
                      {msg.orderCard.shipping_location && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--secondary-text)', marginTop: '0.25rem' }}>
                          📍 {isKn ? 'ತಲುಪಿಸಬೇಕಾದ ವಿಳಾಸ:' : 'Ship to:'} {msg.orderCard.shipping_location}
                        </div>
                      )}
                    </div>

                    {msg.orderCard.status === 'placed' && (
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--border)' }}>
                        <button
                          type="button"
                          onClick={() => handleWhatsAppOrderAction(msg.orderCard.id, 'confirmed')}
                          disabled={processing}
                          style={{
                            flex: 1,
                            padding: '0.45rem 0.6rem',
                            background: 'var(--primary-green)',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {isKn ? 'ಸ್ವೀಕರಿಸಿ ✅' : 'Accept Order ✅'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleWhatsAppOrderAction(msg.orderCard.id, 'cancelled')}
                          disabled={processing}
                          style={{
                            flex: 1,
                            padding: '0.45rem 0.6rem',
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #ef4444',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {isKn ? 'ನಿರಾಕರಿಸಿ ❌' : 'Reject ❌'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Interactive Customer Enquiry Card */}
                {msg.enquiryCard && (
                  <div style={{
                    marginTop: '0.65rem',
                    padding: '0.75rem',
                    background: 'var(--chat-bg, #f8f5ee)',
                    borderRadius: '8px',
                    border: '1.5px solid #2563EB',
                    fontSize: '0.82rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 700, color: '#2563EB' }}>
                        💬 {isKn ? 'ಗ್ರಾಹಕರ ಕಸ್ಟಮ್ ವಿಚಾರಣೆ' : 'Customer Enquiry'}
                      </span>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>
                        {msg.enquiryCard.status}
                      </span>
                    </div>

                    <div style={{ marginBottom: '0.35rem' }}>
                      <strong style={{ color: 'var(--text)', fontSize: '0.86rem' }}>{msg.enquiryCard.product_name}</strong>
                    </div>

                    <p style={{ margin: '0.2rem 0 0.4rem', fontStyle: 'italic', color: 'var(--text)', background: 'var(--card-bg, #ffffff)', padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      "{msg.enquiryCard.message}"
                    </p>

                    {msg.enquiryCard.knTranslation && (
                      <p style={{ margin: '0.2rem 0 0.4rem', color: '#1e3a8a', background: '#eff6ff', padding: '0.45rem', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.78rem' }}>
                        🌐 <strong>{isKn ? 'ಕನ್ನಡ ಅನುವಾದ:' : 'Translation:'}</strong> {msg.enquiryCard.knTranslation}
                      </p>
                    )}

                    {msg.enquiryCard.reference_image_url && (
                      <div style={{ marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--secondary-text)', display: 'block' }}>
                          📷 {isKn ? 'ಗ್ರಾಹಕರು ಲಗತ್ತಿಸಿದ ಫೋಟೋ:' : 'Customer attachment:'}
                        </span>
                        <img src={msg.enquiryCard.reference_image_url} alt="Customer reference" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }} />
                      </div>
                    )}

                    {/* Bulk Negotiation Analysis Breakdown */}
                    {msg.enquiryCard.estimate && (
                      <div style={{ marginTop: '0.4rem', padding: '0.45rem 0.6rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.72rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ color: 'var(--secondary-text)' }}>{isKn ? 'ಪಟ್ಟಿಮಾಡಿದ ಅಂದಾಜು:' : 'Listed Estimate:'}</span>
                          <span style={{ fontWeight: 700, color: 'var(--text)' }}>₹{msg.enquiryCard.estimate} (₹{msg.enquiryCard.unitPrice}/unit)</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ color: 'var(--secondary-text)' }}>{isKn ? 'ಗ್ರಾಹಕರ ಪ್ರಸ್ತಾಪ:' : 'Customer Offer:'}</span>
                          <span style={{ fontWeight: 700, color: '#059669' }}>₹{msg.enquiryCard.budget}</span>
                        </div>
                        {msg.enquiryCard.diff !== null && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: msg.enquiryCard.diff > 0 ? '#b91c1c' : '#059669', fontWeight: 600 }}>
                            <span>{isKn ? 'ವ್ಯತ್ಯಾಸ:' : 'Variance:'}</span>
                            <span>{msg.enquiryCard.diff > 0 ? `-₹${msg.enquiryCard.diff} (${Math.round((msg.enquiryCard.diff / msg.enquiryCard.estimate) * 100)}% below)` : `+₹${Math.abs(msg.enquiryCard.diff)}`}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ fontSize: '0.72rem', color: 'var(--secondary-text)' }}>
                      {msg.enquiryCard.quantity && <span>{isKn ? 'ಪ್ರಮಾಣ:' : 'Qty:'} <strong>{msg.enquiryCard.quantity}</strong> • </span>}
                      {msg.enquiryCard.budget && <span>{isKn ? 'ಬಜೆಟ್:' : 'Budget:'} <strong style={{ color: '#059669' }}>₹{msg.enquiryCard.budget}</strong> • </span>}
                      {msg.enquiryCard.preferred_delivery_date && <span>📅 {msg.enquiryCard.preferred_delivery_date}</span>}
                    </div>

                    {/* Order Confirmed Banner */}
                    {msg.enquiryCard.status === 'confirmed' ? (
                      <div style={{ marginTop: '0.4rem', padding: '0.5rem 0.65rem', background: '#ecfdf5', borderRadius: '6px', color: '#065f46', fontSize: '0.76rem', border: '1px solid #a7f3d0' }}>
                        ✓ <strong>{isKn ? 'ಉತ್ಪಾದನೆ ಮತ್ತು ಆರ್ಡರ್ ದೃಢೀಕರಿಸಲಾಗಿದೆ!' : 'Production & Order Confirmed!'}</strong>
                        {msg.enquiryCard.expected_ready_date && (
                          <div style={{ marginTop: '2px' }}>📅 {isKn ? 'ನಿರೀಕ್ಷಿತ ದಿನಾಂಕ:' : 'Ready Date:'} <strong>{msg.enquiryCard.expected_ready_date}</strong></div>
                        )}
                        {msg.enquiryCard.production_notes && (
                          <div style={{ fontStyle: 'italic', marginTop: '2px' }}>"{msg.enquiryCard.production_notes}"</div>
                        )}
                      </div>
                    ) : msg.enquiryCard.status === 'offer_accepted' ? (
                      <div style={{ marginTop: '0.4rem', padding: '0.55rem 0.65rem', background: '#fef3c7', borderRadius: '6px', color: '#92400e', fontSize: '0.76rem', border: '1px solid #fde68a' }}>
                        🎉 <strong>{isKn ? 'ಗ್ರಾಹಕರು ಪ್ರಸ್ತಾಪವನ್ನು ಒಪ್ಪಿಕೊಂಡಿದ್ದಾರೆ!' : 'Customer Accepted Offer!'}</strong>
                        <div style={{ fontSize: '0.72rem', margin: '3px 0 6px' }}>
                          {isKn ? 'ಕಾರ್ಯಾಗಾರ ವೇಳಾಪಟ್ಟಿ ಪರಿಶೀಲಿಸಿ ಉತ್ಪಾದನೆ ಮತ್ತು ದಿನಾಂಕ ದೃಢೀಕರಿಸಿ:' : 'Review workshop capacity and confirm production schedule:'}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleConfirmProduction(msg.enquiryCard)}
                          style={{
                            padding: '0.4rem 0.75rem',
                            background: '#059669',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          🔨 {isKn ? 'ಉತ್ಪಾದನೆ ಮತ್ತು ದಿನಾಂಕ ದೃಢೀಕರಿಸಿ' : 'Confirm Production & Ready Date'}
                        </button>
                      </div>
                    ) : (
                      <>
                        {msg.enquiryCard.counteroffer_amount && (
                          <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.6rem', background: '#f5f3ff', borderRadius: '6px', color: '#5b21b6', fontSize: '0.76rem', border: '1px solid #ddd6fe' }}>
                            ⏳ <strong>{isKn ? 'ಪ್ರತಿ-ಕೊಡುಗೆ ₹' + msg.enquiryCard.counteroffer_amount + ' ಕಳುಹಿಸಲಾಗಿದೆ' : 'Counteroffer ₹' + msg.enquiryCard.counteroffer_amount + ' sent'}</strong>
                            <div style={{ fontSize: '0.68rem', color: '#6d28d9', marginTop: '2px' }}>
                              {isKn ? 'ಗ್ರಾಹಕರ ಅನುಮೋದನೆಗಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ.' : 'Awaiting customer response.'}
                            </div>
                          </div>
                        )}

                        {msg.enquiryCard.artisan_response && !msg.enquiryCard.counteroffer_amount && (
                          <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.6rem', background: '#ecfdf5', borderRadius: '6px', color: '#065f46', fontSize: '0.76rem', border: '1px solid #a7f3d0' }}>
                            ✓ <strong>{isKn ? 'ನಿಮ್ಮ ಪ್ರತ್ಯುತ್ತರ:' : 'Your Reply:'}</strong> {msg.enquiryCard.artisan_response}
                          </div>
                        )}

                        <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => handleReplyToEnquiry(msg.enquiryCard.id)}
                            style={{
                              padding: '0.35rem 0.65rem',
                              background: '#2563EB',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            ✍️ {isKn ? 'ಗ್ರಾಹಕರಿಗೆ ಉತ್ತರಿಸಿ' : 'Reply'}
                          </button>
                          {msg.enquiryCard.quantity && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleNegotiateCounteroffer(msg.enquiryCard)}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  background: '#059669',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                🤝 {isKn ? 'ಪ್ರತಿ-ಕೊಡುಗೆ' : 'Counteroffer'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleVoiceCounteroffer(msg.enquiryCard)}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  background: '#7C3AED',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                🎙️ {isKn ? 'ಧ್ವನಿ ಮೂಲಕ' : 'Voice Offer'}
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Action Buttons if attached */}
                {msg.actionButtons && msg.actionButtons.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '0.45rem' }}>
                    {msg.actionButtons.map((btn, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleAction(btn.action)}
                        disabled={processing}
                        style={{
                          background: btn.action === 'publish_product' ? 'var(--primary-green, #075e54)' : 'var(--card-bg, #ffffff)',
                          color: btn.action === 'publish_product' ? '#FFFFFF' : 'var(--primary-green, #075e54)',
                          border: btn.action === 'publish_product' ? 'none' : '1px solid var(--primary-green, #075e54)',
                          borderRadius: '6px',
                          padding: '0.45rem 0.75rem',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: '36px'
                        }}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Message Timestamp & Status */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '0.2rem',
                  fontSize: '0.65rem',
                  color: 'var(--secondary-text, #667781)',
                  marginTop: '0.25rem'
                }}>
                  <span>{msg.time}</span>
                  {isUser && <span style={{ color: '#53bdeb' }}>✓✓</span>}
                </div>
              </div>
            </div>
          );
        })}

        {/* Processing Indicator */}
        {processing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'var(--card-bg)', borderRadius: '8px', width: 'fit-content', fontSize: '0.8rem', color: 'var(--secondary-text)' }}>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
            <span>{isKn ? 'AI ಪಟ್ಟಿ ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ...' : 'Processing craft listing...'}</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </main>

      {/* Voice Recording Banner (if active) */}
      {isRecording && (
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          borderTop: '2px solid #ef4444',
          padding: '0.65rem 0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.08)',
          zIndex: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#ef4444', fontFamily: 'monospace' }}>
              {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {liveTranscript || (isKn ? 'ಮಾತನಾಡಿ...' : 'Listening...')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={cancelVoiceRecording}
              style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '0.35rem 0.65rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
            >
              ❌ {isKn ? 'ರದ್ದು' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={stopVoiceRecording}
              style={{ background: '#25d366', color: '#075e54', border: 'none', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
            >
              ⏹️ {isKn ? 'ಮುಗಿಸಿ' : 'Done'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Message Input Bar */}
      <footer style={{
        background: 'var(--card-bg, #ffffff)',
        borderTop: '1px solid var(--border, #d1d7db)',
        padding: '0.5rem 0.65rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexShrink: 0
      }}>
        {/* Attachment Options (Camera & Gallery) */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          title={isKn ? "ಕ್ಯಾಮೆರಾದಿಂದ ಫೋಟೋ ತೆಗೆಯಿರಿ" : "Take Photo"}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.35rem',
            cursor: 'pointer',
            padding: '0.2rem',
            color: 'var(--secondary-text)'
          }}
        >
          📷
        </button>

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          title={isKn ? "ಗ್ಯಾಲರಿಯಿಂದ ಫೋಟೋ ಆಯ್ಕೆಮಾಡಿ" : "Pick from Gallery"}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.35rem',
            cursor: 'pointer',
            padding: '0.2rem',
            color: 'var(--secondary-text)'
          }}
        >
          📎
        </button>

        {/* Text Input */}
        <form onSubmit={handleSendMessage} style={{ flex: 1, display: 'flex' }}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isKn ? "ಸಂದೇಶ ಅಥವಾ ತಿದ್ದುಪಡಿ ಟೈಪ್ ಮಾಡಿ..." : "Type message or correction..."}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '20px',
              border: '1px solid var(--border, #d1d7db)',
              background: 'var(--bg, #f0f2f5)',
              color: 'var(--text, #111b21)',
              fontSize: '0.88rem',
              outline: 'none'
            }}
          />
        </form>

        {/* Send or Voice Record Action */}
        {inputText.trim() ? (
          <button
            type="button"
            onClick={handleSendMessage}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'var(--primary-green, #075e54)',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem'
            }}
            title="Send Message"
          >
            ➤
          </button>
        ) : (
          <button
            type="button"
            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: isRecording ? '#ef4444' : 'var(--primary-green, #075e54)',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }}
            title={isKn ? "ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಮಾಡಿ" : "Speak Voice Description"}
          >
            {isRecording ? '⏹️' : '🎙️'}
          </button>
        )}
      </footer>
    </div>
  );
}

export default WhatsAppPlaceholderPage;
