import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
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
        { label: isKn ? '❓ ಇದು ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ?' : '❓ How It Works', action: 'how_it_works' }
      ]
    };

    setMessages([welcomeMsg]);
  }, [authLoading, artisan, profile, isKn]);

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

  // Handle Action Buttons
  const handleAction = (action) => {
    switch (action) {
      case 'open_camera':
        cameraInputRef.current?.click();
        break;
      case 'open_gallery':
        galleryInputRef.current?.click();
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
      const facts = extractProductFacts(text);
      const listing = buildProductListing(text, facts);

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
        rawTranscript: text
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

    // Default conversational responses
    if (text.toLowerCase() === 'publish' || text === 'ಪ್ರಕಟಿಸು') {
      handleSaveProduct('published');
    } else if (text.toLowerCase() === 'cancel' || text === 'ರದ್ದು') {
      handleCancelFlow();
    } else {
      setTimeout(() => {
        addMessage('assistant', isKn
          ? `ಸ್ವೀಕರಿಸಲಾಗಿದೆ: "${text}". ಉತ್ಪನ್ನ ರಚಿಸಲು 📷 ಕ್ಯಾಮೆರಾ ಬಳಸಿ ಫೋಟೋ ತೆಗೆಯಿರಿ ಅಥವಾ 🎙️ ಮೈಕ್ ಒತ್ತಿ ವಿವರಣೆ ನೀಡಿ.`
          : `Received: "${text}". To list a craft item, tap 📷 to take a photo or 🎙️ to speak your description.`,
          {
            actionButtons: [
              { label: isKn ? '📷 ಫೋಟೋ ತೆಗೆಯಿರಿ' : '📷 Take Photo', action: 'open_camera' },
              { label: isKn ? '🖼️ ಗ್ಯಾಲರಿ' : '🖼️ Gallery', action: 'open_gallery' }
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
