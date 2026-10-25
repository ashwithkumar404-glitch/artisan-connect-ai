import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import LanguageSelector from "../components/LanguageSelector.jsx";
import ChatBubble from "../components/ChatBubble.jsx";
import SideMenu from "../components/SideMenu.jsx";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import {
  isLatinTransliteration,
  extractProductFacts,
  buildProductListing,
  interpretCorrectionCommand
} from "../lib/kannadaProductEngine";
import {
  VOICE_STATES,
  createVoiceSession,
  getVoiceStatusMessage
} from "../lib/voiceRecognition";
import './HomePage.css';
import './Chat.css';

function HomePage() {
  const navigate = useNavigate();
  const { user, artisan, loading: authLoading } = useAuth();

  const [selectedLanguage, setSelectedLanguage] = useState('kn'); // Default to Kannada
  const [categories, setCategories] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Workflow state
  const [workflowState, setWorkflowState] = useState('idle'); // idle | awaiting_image | awaiting_voice | reviewing_draft | saving
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [pendingImagePreview, setPendingImagePreview] = useState('');
  const [currentDraft, setCurrentDraft] = useState(null);

  // Separate representation states as required by Task 3
  const [_originalAudioBlob, setOriginalAudioBlob] = useState(null);
  const [_originalAudioUrl, setOriginalAudioUrl] = useState('');
  const [_rawTranscript, setRawTranscript] = useState('');
  const [_extractedFacts, setExtractedFacts] = useState(null);

  // Voice recording state
  const [voiceState, setVoiceState] = useState(VOICE_STATES.IDLE);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const voiceSessionRef = useRef(null);

  const isRecording = voiceState === VOICE_STATES.LISTENING ||
    voiceState === VOICE_STATES.REQUESTING_PERMISSION ||
    voiceState === VOICE_STATES.PROCESSING;

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [showPhotoPickerSheet, setShowPhotoPickerSheet] = useState(false);
  const chatBottomRef = useRef(null);

  const isKn = selectedLanguage === 'kn';

  // Auto scroll
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, processing, isRecording]);

  // Load marketplace categories
  useEffect(() => {
    async function loadCategories() {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');
      if (!error && data) {
        setCategories(data);
      }
    }
    loadCategories();
  }, []);

  // Helper to add assistant message
  const addAssistantMessage = useCallback((text, actionButtons = [], draft = null) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sender: 'assistant',
        text,
        actionButtons,
        draft
      }
    ]);
  }, []);

  // Helper to add user message
  const addUserMessage = useCallback((text, media = null) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sender: 'user',
        text,
        media
      }
    ]);
  }, []);

  // Initial greeting
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setMessages([
        {
          id: 'welcome_guest',
          sender: 'assistant',
          text: isKn
            ? '🙏 **ಆರ್ಟಿಸನ್ ಕನೆಕ್ಟ್ AI ಸಹಾಯಕಕ್ಕೆ ಸ್ವಾಗತ!**\n\nನಿಮ್ಮ ಫೋನ್ ಕ್ಯಾಮೆರಾ ಮತ್ತು ಮಾತಿನ ಮೂಲಕ ವೃತ್ತಿಪರ ಮಾರುಕಟ್ಟೆ ಪಟ್ಟಿಗಳನ್ನು ರಚಿಸಲು ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡುತ್ತೇನೆ.\n\nಪ್ರಾರಂಭಿಸಲು ದಯವಿಟ್ಟು ನಿಮ್ಮ ಕುಶಲಕರ್ಮಿ ಖಾತೆಯೊಂದಿಗೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.'
            : '🙏 **Welcome to Artisan Connect AI Assistant!**\n\nI can help you create professional marketplace listings using your phone camera and voice.\n\nPlease sign in with your artisan account to get started.',
          actionButtons: [
            { label: isKn ? '🔑 ಸೈನ್ ಇನ್ (Sign In)' : '🔑 Sign In', action: 'login' },
            { label: isKn ? '📝 ಖಾತೆ ತೆರೆಯಿರಿ (Register)' : '📝 Create Account', action: 'register' }
          ]
        }
      ]);
    } else {
      const shopName = artisan?.business_name || (isKn ? 'ಕುಶಲಕರ್ಮಿಗಳೇ' : 'Artisan');
      setMessages([
        {
          id: 'welcome_user',
          sender: 'assistant',
          text: isKn
            ? `🙏 **ನಮಸ್ಕಾರ, ${shopName}!**\n\nನಾನು ನಿಮ್ಮ ಕರಕುಶಲ AI ಸಹಾಯಕ. ನಿಮ್ಮ ಕರಕುಶಲ ಉತ್ಪನ್ನದ ಫೋಟೋ ತೆಗೆದು, ನಿಮ್ಮ ಮಾತಿನಲ್ಲಿ (ಕನ್ನಡದಲ್ಲಿ) ವಿವರಣೆ ನೀಡಬಹುದು.\n\nಇಂದು ಯಾವ ಉತ್ಪನ್ನವನ್ನು ಪಟ್ಟಿ ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?`
            : `🙏 **Namaste, ${shopName}!**\n\nI am your conversational AI Assistant. You can snap a photo of your craft and speak your description in your preferred language.\n\nWhat would you like to list today?`,
          actionButtons: [
            { label: isKn ? '📸 ಫೋಟೋ ತೆಗೆದು ಉತ್ಪನ್ನ ಸೇರಿಸಿ' : '📸 Snap & Add Product', action: 'start_add_product' },
            { label: isKn ? '📦 ನನ್ನ ಉತ್ಪನ್ನಗಳನ್ನು ನೋಡಿ' : '📦 View My Products', action: 'view_products' },
            { label: isKn ? '❓ ಇದು ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ?' : '❓ How it Works', action: 'how_it_works' }
          ]
        }
      ]);
    }

    return () => {
      if (voiceSessionRef.current) {
        voiceSessionRef.current.cancel();
        voiceSessionRef.current = null;
      }
    };
  }, [user, artisan, authLoading, selectedLanguage, isKn]);

  // Helpers to trigger Camera vs Gallery
  const triggerCamera = () => {
    setShowPhotoPickerSheet(false);
    cameraInputRef.current?.click();
  };

  const triggerGallery = () => {
    setShowPhotoPickerSheet(false);
    galleryInputRef.current?.click();
  };

  // Action Button router
  const handleActionClick = (action) => {
    switch (action) {
      case 'start_add_product':
        startProductCreation();
        break;
      case 'open_camera':
        triggerCamera();
        break;
      case 'open_gallery':
        triggerGallery();
        break;
      case 'view_products':
        navigate('/my-products');
        break;
      case 'login':
      case 'register':
        navigate('/login');
        break;
      case 'how_it_works':
        addAssistantMessage(
          isKn
            ? "ℹ️ **ಆರ್ಟಿಸನ್ ಕನೆಕ್ಟ್ ಸಹಾಯಕ ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ:**\n\n1. **ಫೋಟೋ ತೆಗೆಯಿರಿ ಅಥವಾ ಆಯ್ಕೆಮಾಡಿ**: 📷 ಕ್ಯಾಮೆರಾ ಬಳಸಿ ಫೋಟೋ ತೆಗೆಯಿರಿ ಅಥವಾ 🖼️ ಗ್ಯಾಲರಿಯಿಂದ ಆಯ್ಕೆಮಾಡಿ.\n2. **ಧ್ವನಿಯಲ್ಲಿ ಮಾತನಾಡಿ**: 🎙️ ಮೈಕ್ರೊಫೋನ್ ಒತ್ತಿ ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಉತ್ಪನ್ನದ ವಸ್ತು, ತಂತ್ರಜ್ಞಾನ, ಮತ್ತು ಬೆಲೆಯನ್ನು ವಿವರಿಸಿ.\n3. **ಪರಿಶೀಲಿಸಿ**: ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಸಿದ್ಧವಾದ ಶೀರ್ಷಿಕೆ ಮತ್ತು ವಿವರಣೆಯನ್ನು ಪರಿಶೀಲಿಸಿ, ಧ್ವನಿ ಮೂಲಕ ತಿದ್ದಿ.\n4. **ಪ್ರಕಟಿಸಿ**: ಅಂತಿಮ ಅನುಮೋದನೆಯ ನಂತರ ನೇರವಾಗಿ ಮಾರುಕಟ್ಟೆಗೆ ಸೇರಿಸಿ!"
            : "ℹ️ **How Artisan Connect Assistant Works:**\n\n1. **Take Photo or Choose Gallery**: Snap using 📷 camera or select from 🖼️ gallery.\n2. **Speak Description**: Tap the 🎙️ microphone and describe materials, craft techniques, or estimated price.\n3. **Review**: Review the structured local-language listing and correct via voice.\n4. **Publish**: After explicit confirmation, publish the verified listing to the marketplace!",
          [
            { label: isKn ? '📷 ಕ್ಯಾಮೆರಾ ಬಳಸಿ' : '📷 Take Photo', action: 'open_camera' },
            { label: isKn ? '🖼️ ಗ್ಯಾಲರಿಯಿಂದ ಆಯ್ಕೆ' : '🖼️ Choose from Gallery', action: 'open_gallery' }
          ]
        );
        break;
      case 'cancel_flow':
        resetWorkflow(isKn ? "ಕಾರ್ಯಪ್ರವಾಹ ರದ್ದುಗೊಂಡಿದೆ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?" : "Workflow cancelled. How else can I assist you?");
        break;
      default:
        console.log('Action:', action);
    }
  };

  const resetWorkflow = (msg = isKn ? "ಮುಂದಿನ ಕರಕುಶಲ ಉತ್ಪನ್ನಕ್ಕಾಗಿ ಸಿದ್ಧವಾಗಿದೆ." : "Ready for your next craft item.") => {
    if (pendingImagePreview) {
      URL.revokeObjectURL(pendingImagePreview);
    }
    setWorkflowState('idle');
    setPendingImageFile(null);
    setPendingImagePreview('');
    setCurrentDraft(null);
    setOriginalAudioBlob(null);
    setOriginalAudioUrl('');
    setRawTranscript('');
    setExtractedFacts(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    addAssistantMessage(msg, [
      { label: isKn ? '📸 ಉತ್ಪನ್ನ ಸೇರಿಸಿ' : '📸 Add Product', action: 'start_add_product' },
      { label: isKn ? '📦 ನನ್ನ ಉತ್ಪನ್ನಗಳನ್ನು ನೋಡಿ' : '📦 View My Products', action: 'view_products' }
    ]);
  };

  // Remove current pending photo
  const removePendingPhoto = () => {
    if (pendingImagePreview) {
      URL.revokeObjectURL(pendingImagePreview);
    }
    setPendingImageFile(null);
    setPendingImagePreview('');
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';

    if (currentDraft) {
      setCurrentDraft(prev => prev ? { ...prev, imageUrl: '' } : null);
      setMessages(prev => prev.map(m => m.draft ? { ...m, draft: { ...m.draft, imageUrl: '' } } : m));
    }

    addAssistantMessage(
      isKn
        ? "🗑️ ಉತ್ಪನ್ನದ ಫೋಟೋವನ್ನು ತೆಗೆದುಹಾಕಲಾಗಿದೆ. ಹೊಸ ಫೋಟೋ ಸೇರಿಸಲು ಕೆಳಗಿನ ಆಯ್ಕೆಯನ್ನು ಆರಿಸಿ ಅಥವಾ 📎 ಐಕಾನ್ ಒತ್ತಿ."
        : "🗑️ Product photo removed. Choose an option below or tap 📎 to attach a new photo.",
      [
        { label: isKn ? '📷 ಕ್ಯಾಮೆರಾ ಬಳಸಿ' : '📷 Take Photo', action: 'open_camera' },
        { label: isKn ? '🖼️ ಗ್ಯಾಲರಿಯಿಂದ ಆಯ್ಕೆ' : '🖼️ Choose from Gallery', action: 'open_gallery' },
        { label: isKn ? '❌ ರದ್ದುಮಾಡಿ' : '❌ Cancel', action: 'cancel_flow' }
      ]
    );
  };

  // 1. Start Product Creation - gives 2 distinct visible photo options
  const startProductCreation = () => {
    if (!user) {
      addAssistantMessage(
        isKn
          ? "⚠️ ನಿಮ್ಮ ಉತ್ಪನ್ನಗಳನ್ನು ನಿಮ್ಮ ಅಂಗಡಿಗೆ ಸಂಪರ್ಕಿಸಲು ದಯವಿಟ್ಟು ಮೊದಲು ಸೈನ್ ಇನ್ ಮಾಡಿ."
          : "⚠️ Please sign in first so your listings are connected to your shop.",
        [{ label: isKn ? '🔑 ಸೈನ್ ಇನ್' : '🔑 Sign In', action: 'login' }]
      );
      return;
    }

    setWorkflowState('awaiting_image');
    addUserMessage(isKn ? "ನಾನು ಹೊಸ ಉತ್ಪನ್ನವನ್ನು ಸೇರಿಸಲು ಬಯಸುತ್ತೇನೆ." : "I want to add a new product.");
    addAssistantMessage(
      isKn
        ? "ಉತ್ತಮ! ನಿಮ್ಮ ಕರಕುಶಲ ಉತ್ಪನ್ನವನ್ನು ಸೇರಿಸೋಣ. 📸\n\nದಯವಿಟ್ಟು ಕೆಳಗಿನ ಆಯ್ಕೆ ಬಳಸಿ **ಕ್ಯಾಮೆರಾದಿಂದ ಫೋಟೋ ತೆಗೆಯಿರಿ** ಅಥವಾ **ಗ್ಯಾಲರಿಯಿಂದ ಫೋಟೋ ಆಯ್ಕೆಮಾಡಿ**:"
        : "Excellent! Let's get your craft listed. 📸\n\nPlease choose an option below to **take a photo with your camera** or **choose from your gallery**:",
      [
        { label: isKn ? '📷 ಕ್ಯಾಮೆರಾದಿಂದ ಫೋಟೋ ತೆಗೆಯಿರಿ' : '📷 Take Photo (Camera)', action: 'open_camera' },
        { label: isKn ? '🖼️ ಗ್ಯಾಲರಿಯಿಂದ ಆಯ್ಕೆಮಾಡಿ' : '🖼️ Choose from Gallery', action: 'open_gallery' },
        { label: isKn ? '❌ ರದ್ದುಮಾಡಿ' : '❌ Cancel', action: 'cancel_flow' }
      ]
    );
  };

  // 2. Photo picked via Camera or Gallery input
  const handlePhotoSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      addAssistantMessage(isKn ? "⚠️ ದಯವಿಟ್ಟು ಮಾನ್ಯವಾದ JPG, PNG, ಅಥವಾ WebP ಫೋಟೋವನ್ನು ಆಯ್ಕೆಮಾಡಿ." : "⚠️ Please pick a valid JPG, PNG, or WebP photo.");
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addAssistantMessage(isKn ? "⚠️ ಚಿತ್ರದ ಗಾತ್ರ ತುಂಬಾ ದೊಡ್ಡದಾಗಿದೆ (ಗರಿಷ್ಠ 5 MB). ದಯವಿಟ್ಟು ಸಣ್ಣ ಫೋಟೋ ಆಯ್ಕೆಮಾಡಿ." : "⚠️ Image size is too large (max 5 MB). Please choose a smaller photo.");
      e.target.value = '';
      return;
    }

    if (pendingImagePreview) {
      URL.revokeObjectURL(pendingImagePreview);
    }

    const preview = URL.createObjectURL(file);
    setPendingImageFile(file);
    setPendingImagePreview(preview);

    // Reset input value to allow re-selecting same file if desired
    e.target.value = '';

    // If currently reviewing draft, update draft image
    if (workflowState === 'reviewing_draft' && currentDraft) {
      setCurrentDraft(prev => ({ ...prev, imageUrl: preview }));
      setMessages(prev => prev.map(m => m.draft ? { ...m, draft: { ...m.draft, imageUrl: preview } } : m));
      addUserMessage(isKn ? "ಉತ್ಪನ್ನದ ಹೊಸ ಫೋಟೋ ಬದಲಾಯಿಸಲಾಗಿದೆ" : "Updated product photo", {
        type: 'image',
        url: preview
      });
      addAssistantMessage(isKn ? "✅ ಫೋಟೋವನ್ನು ನವೀಕರಿಸಲಾಗಿದೆ. ನೀವು ಈಗ ಪಟ್ಟಿಯನ್ನು ಪರಿಶೀಲಿಸಬಹುದು ಅಥವಾ ಉಳಿಸಬಹುದು." : "✅ Photo updated. You can now review or save the listing.");
      return;
    }

    addUserMessage(isKn ? "ಉತ್ಪನ್ನದ ಫೋಟೋ ನೀಡಲಾಗಿದೆ" : "Product photo captured", {
      type: 'image',
      url: preview
    });

    setWorkflowState('awaiting_voice');
    addAssistantMessage(
      isKn
        ? "ಫೋಟೋ ಸ್ವೀಕರಿಸಲಾಗಿದೆ! 🎙️ ಈಗ, **ನಿಮ್ಮ ಉತ್ಪನ್ನದ ಬಗ್ಗೆ ಮಾತನಾಡಿ**.\n\nಕೆಳಗಿನ **ಮೈಕ್ರೊಫೋನ್ (Microphone)** ಬಟನ್ ಒತ್ತಿ ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ:\n- ವಸ್ತು (ಉದಾ: ಮಣ್ಣು, ಬಿದಿರು, ರೇಷ್ಮೆ, ಹಿತ್ತಾಳೆ)\n- ತಯಾರಿಕಾ ವಿಧಾನ (ಉದಾ: ಕೈಮಗ್ಗ, ಕುಂಬಾರಿಕೆ ಚಕ್ರ, ಕೈ ಕೆತ್ತನೆ)\n- ಉದ್ದೇಶಿತ ಬೆಲೆ ಮತ್ತು ಅಳತೆ"
        : "Photo received! 🎙️ Now, **tell me about your product**.\n\nTap the **Microphone** button below to record in your chosen language:\n- Materials (e.g. clay, bamboo, silk, brass)\n- Craft technique (e.g. handloom, potter wheel, carving)\n- Target price or dimensions",
      [{ label: isKn ? '❌ ರದ್ದುಮಾಡಿ' : '❌ Cancel', action: 'cancel_flow' }]
    );
  };

  // Convert File to base64 string
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64Str = reader.result.toString().split(',')[1];
        resolve(base64Str);
      };
      reader.onerror = reject;
    });
  };

  // 3. Microphone Recording (configured to chosen language)
  const startVoiceRecording = async () => {
    // If a session is already active, cancel it first
    if (voiceSessionRef.current) {
      voiceSessionRef.current.cancel();
      voiceSessionRef.current = null;
    }

    setLiveTranscript('');
    setRecordingSeconds(0);

    const session = createVoiceSession({
      language: selectedLanguage,
      onStateChange: (newState, details) => {
        setVoiceState(newState);
        if (typeof details?.secondsElapsed === 'number') {
          setRecordingSeconds(details.secondsElapsed);
        }

        if (newState === VOICE_STATES.PERMISSION_DENIED) {
          addAssistantMessage(
            isKn
              ? "⚠️ ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿ ನಿರಾಕರಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಬ್ರೌಸರ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿಯನ್ನು ಆನ್ ಮಾಡಿ, ಅಥವಾ ಕೆಳಗಿನ ಸಂದೇಶ ಪೆಟ್ಟಿಗೆಯಲ್ಲಿ ವಿವರಣೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ."
              : "⚠️ Microphone permission was denied. Please allow microphone access in your browser settings, or type your description in the message box below."
          );
        } else if (newState === VOICE_STATES.UNSUPPORTED) {
          const msg = getVoiceStatusMessage(newState, selectedLanguage, details);
          addAssistantMessage(msg);
        }
      },
      onInterimResult: (_interim, fullDisplay) => {
        setLiveTranscript(fullDisplay);
      },
      onFinalTranscript: async (finalText, audioBlob, audioUrl) => {
        if (audioBlob) setOriginalAudioBlob(audioBlob);
        if (audioUrl) setOriginalAudioUrl(audioUrl);
        await handleVoiceTranscriptReady(finalText, audioUrl);
      },
      onError: (errType, details) => {
        console.warn('Voice session error:', errType, details);
        if (errType === 'no_speech') {
          if (details?.audioUrl) {
            addUserMessage(
              isKn ? "🎙️ ಧ್ವನಿ ವಿವರಣೆ ರೆಕಾರ್ಡ್ ಮಾಡಲಾಗಿದೆ" : "🎙️ Voice description recorded",
              { type: 'audio', url: details.audioUrl }
            );
          }
          addAssistantMessage(
            isKn
              ? "⚠️ ಯಾವುದೇ ಧ್ವನಿ ಕೇಳಿಸಲಿಲ್ಲ ಅಥವಾ ಗುರುತಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮೈಕ್ರೊಫೋನ್ ಬಟನ್ ಒತ್ತಿ ಮತ್ತೊಮ್ಮೆ ಸ್ಪಷ್ಟವಾಗಿ ಮಾತನಾಡಿ, ಅಥವಾ ಕೆಳಗಿನ ಸಂದೇಶ ಪೆಟ್ಟಿಗೆಯಲ್ಲಿ ವಿವರಣೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ."
              : "⚠️ No speech was detected or voice could not be recognized. Please tap the mic to speak clearly, or type your description in the message box below."
          );
        }
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
          console.warn('Backend transcription invoke note:', e);
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
    setLiveTranscript('');
    setRecordingSeconds(0);
  };

  // 4. Audio captured / Transcript Ready -> Validate Script & Transliteration -> Process or Correct
  const handleVoiceTranscriptReady = async (speechText, audioUrl) => {
    const cleanText = (speechText || '').trim();

    if (audioUrl) {
      addUserMessage(
        isKn ? "🎙️ ಧ್ವನಿ ವಿವರಣೆ ರೆಕಾರ್ಡ್ ಮಾಡಲಾಗಿದೆ" : "🎙️ Voice description recorded",
        { type: 'audio', url: audioUrl }
      );
    }

    // Checking transcript validity in initial listing workflow
    if (!cleanText) {
      // DO NOT fabricate fallback text! Report limitation and offer clear retry / text fallback
      addAssistantMessage(
        isKn
          ? "⚠️ ಧ್ವನಿ ಗುರುತಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮೈಕ್ರೊಫೋನ್ ಬಟನ್ ಒತ್ತಿ ಮತ್ತೊಮ್ಮೆ ಸ್ಪಷ್ಟವಾಗಿ ಮಾತನಾಡಿ, ಅಥವಾ ಕೆಳಗಿನ ಸಂದೇಶ ಪೆಟ್ಟಿಗೆಯಲ್ಲಿ ವಿವರಣೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ."
          : "⚠️ Could not transcribe audio. Please tap the mic to speak clearly, or type your description in the message box below."
      );
      return;
    }

    // If currently reviewing draft, route directly to Voice Correction (Task 5)
    if (workflowState === 'reviewing_draft') {
      handleVoiceCorrection(cleanText);
      return;
    }

    // Verify script if Kannada was selected (Reject Latin transliteration from being treated as verified Kannada script)
    if (isKn && isLatinTransliteration(cleanText, 'kn')) {
      addAssistantMessage(
        `⚠️ **ಗಮನಿಸಿ:** ಬ್ರೌಸರ್ ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆಯು ಕನ್ನಡ ಲಿಪಿಯ ಬದಲಿಗೆ ಇಂಗ್ಲಿಷ್ ಅಕ್ಷರಗಳನ್ನು (English letters) ನೀಡಿದೆ:\n*"${cleanText}"*\n\nಕನ್ನಡ ಲಿಪಿಯಲ್ಲಿ ಅಧಿಕೃತ ಪಟ್ಟಿ ಸಿದ್ಧಪಡಿಸಲು, ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಸ್ಪಷ್ಟವಾಗಿ ಮಾತನಾಡಿ ಅಥವಾ ಕೆಳಗಿನ ಪೆಟ್ಟಿಗೆಯಲ್ಲಿ ಕನ್ನಡದಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ.`
      );
      return;
    }

    // Display original transcript in native script for artisan review
    addAssistantMessage(
      isKn
        ? `🗣️ **ದಾಖಲಾದ ನುಡಿ (Transcript):**\n*"${cleanText}"*\n\nನಿಮ್ಮ ಉತ್ಪನ್ನದ ಪಟ್ಟಿಯನ್ನು ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ...`
        : `🗣️ **Transcribed Voice:**\n*"${cleanText}"*\n\nFormulating your product listing...`
    );

    await generateProductListing(cleanText);
  };

  // 5. Generate Product Listing strictly separating Transcript, Facts, and Descriptions (Task 3)
  const generateProductListing = async (voiceText) => {
    setProcessing(true);
    setRawTranscript(voiceText);

    try {
      // 1. Extract genuine facts strictly from transcript
      const facts = extractProductFacts(voiceText);
      setExtractedFacts(facts);

      // 2. Build local-language listing and English marketplace listing
      const listing = buildProductListing(voiceText, facts);

      // Match category against official database categories
      const targetCatName = (listing.category || '').toLowerCase();
      const matchedCat = categories.find((c) => c.name.toLowerCase() === targetCatName)
        || categories.find((c) => c.name.toLowerCase() === 'other handicrafts')
        || categories[0];

      let base64Image = null;
      let mimeType = 'image/jpeg';
      if (pendingImageFile) {
        base64Image = await fileToBase64(pendingImageFile);
        mimeType = pendingImageFile.type;
      }

      // Try edge function if available, fallback smoothly to local deterministic engine
      try {
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('generate-product', {
          body: {
            image: base64Image,
            mimeType,
            voiceTranscript: voiceText,
            language: selectedLanguage
          }
        });
        if (!edgeErr && edgeData && edgeData.product_name) {
          // Sync edge function data if successful
          listing.englishTitle = edgeData.product_name || listing.englishTitle;
          listing.englishDescription = edgeData.description || listing.englishDescription;
          if (edgeData.local_title) listing.localTitle = edgeData.local_title;
          if (edgeData.local_description) listing.localDescription = edgeData.local_description;
        }
      } catch (e) {
        console.warn('Edge function invoke skipped or fallback used:', e);
      }

      const draft = {
        name: listing.englishTitle, // English title for marketplace
        local_title: listing.localTitle, // Kannada title in native script
        category_id: matchedCat?.id || '',
        category_name: matchedCat?.name || listing.category || 'Other Handicrafts',
        category: listing.category || 'Other Handicrafts',
        price: listing.price,
        stock_quantity: listing.stock_quantity,
        description: listing.englishDescription, // English description for marketplace
        local_description: listing.localDescription, // Kannada natural description
        confidence: listing.confidence,
        imageUrl: pendingImagePreview,
        rawTranscript: voiceText,
        extractedFacts: facts
      };

      setCurrentDraft(draft);
      setWorkflowState('reviewing_draft');
      setProcessing(false);

      // Follow-up if missing essential details
      let followUpMsg = '';
      if (listing.missingDetails && listing.missingDetails.length > 0) {
        const prompts = listing.missingDetails.map(d => isKn ? d.prompt_kn : d.prompt_en).join('\n');
        followUpMsg = `\n\n📌 **ಪ್ರಶ್ನೆ / Clarification:**\n${prompts}`;
      }

      addAssistantMessage(
        isKn
          ? `🎉 **ಇಲ್ಲಿ ನಿಮ್ಮ ಉತ್ಪನ್ನದ ಪಟ್ಟಿ ಸಿದ್ಧವಾಗಿದೆ!**\n\nಕೆಳಗಿನ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ. ಧ್ವನಿಯ ಮೂಲಕ ತಿದ್ದಲು ಮೈಕ್ ಒತ್ತಿ (ಉದಾ: "ಬೆಲೆ 400 ಮಾಡಿ").${followUpMsg}`
          : `🎉 **Here is your generated product listing!**\n\nReview the details below. You can correct fields using your voice (e.g. "change price to 400").${followUpMsg}`,
        [],
        draft
      );
    } catch (err) {
      console.error('Generate product error:', err);
      setProcessing(false);
      addAssistantMessage(
        isKn
          ? `⚠️ ಪಟ್ಟಿ ರಚಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ: ${err.message || 'ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.'}`
          : `⚠️ Could not generate listing: ${err.message || 'Please try again.'}`,
        [{ label: isKn ? '❌ ರದ್ದುಮಾಡಿ' : '❌ Cancel', action: 'cancel_flow' }]
      );
    }
  };

  // 6. Voice & Text Corrections (Task 5)
  const handleVoiceCorrection = (commandText) => {
    if (!currentDraft) return;

    addUserMessage(
      isKn ? `✏️ "${commandText}"` : `✏️ "${commandText}"`
    );

    const result = interpretCorrectionCommand(commandText, currentDraft, selectedLanguage);

    if (!result.success) {
      // Ambiguous command -> Ask clarification, preserve approved fields
      addAssistantMessage(isKn ? result.message_kn : result.message_en);
      return;
    }

    // Update ONLY requested field, preserving other approved fields
    setCurrentDraft(result.updatedDraft);

    addAssistantMessage(
      isKn
        ? `${result.message_kn}\n\nಪರಿಷ್ಕೃತ ಪಟ್ಟಿಯನ್ನು ಕೆಳಗೆ ಪರಿಶೀಲಿಸಿ. ಉಳಿಸಲು ಅಥವಾ ಪ್ರಕಟಿಸಲು ಕೆಳಗಿನ ಬಟನ್ ಒತ್ತಿ.`
        : `${result.message_en}\n\nReview the updated listing below. Tap Save or Publish when ready.`,
      [],
      result.updatedDraft
    );
  };

  // 7. Save or Publish Product (Task 4)
  const handleSaveProduct = async (draft, targetStatus = 'draft') => {
    if (!artisan) {
      addAssistantMessage(
        isKn
          ? "⚠️ ಉತ್ಪನ್ನಗಳನ್ನು ಉಳಿಸಲು ಕುಶಲಕರ್ಮಿ ಪ್ರೊಫೈಲ್ ಅಗತ್ಯವಿದೆ."
          : "⚠️ You must have an artisan profile to save products."
      );
      return;
    }

    if (targetStatus === 'published' && artisan.verification_status !== 'approved') {
      addAssistantMessage(
        isKn
          ? "⚠️ **ಪರಿಶೀಲನೆ ಅಗತ್ಯವಿದೆ:** ಸಾರ್ವಜನಿಕ ಮಾರುಕಟ್ಟೆಗೆ ಪ್ರಕಟಿಸಲು ನಿಮ್ಮ ಖಾತೆಯು ಅನುಮೋದನೆ ಪಡೆದಿರಬೇಕು. ನೀವು ಇದನ್ನು **ಕರಡಾಗಿ (Draft)** ಉಳಿಸಬಹುದು."
          : "⚠️ **Verification Required:** Your artisan account must be verified before publishing. You can save as Draft instead."
      );
      return;
    }

    setProcessing(true);

    try {
      // Backward-compatible representation: Preserve verified Kannada version inside description
      const combinedDescription = draft.local_description
        ? `${draft.description}\n\n---\nಕನ್ನಡ ವಿವರಣೆ (Kannada Listing):\nಶೀರ್ಷಿಕೆ: ${draft.local_title || draft.name}\nವಿವರಣೆ: ${draft.local_description}`
        : draft.description;

      // 1. Insert product row
      const { data: newProd, error: prodErr } = await supabase
        .from('products')
        .insert({
          artisan_id: artisan.id,
          category_id: draft.category_id || categories[0]?.id,
          name: draft.name.trim(), // English marketplace name
          description: combinedDescription.trim(),
          price: Number(draft.price),
          stock_quantity: Number(draft.stock_quantity),
          status: targetStatus
        })
        .select()
        .single();

      if (prodErr) throw prodErr;

      // 2. Upload photo if present
      if (pendingImageFile) {
        const fileExt = pendingImageFile.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const storagePath = `${artisan.id}/${newProd.id}/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('product-images')
          .upload(storagePath, pendingImageFile);

        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(storagePath);

          await supabase.from('product_images').insert({
            product_id: newProd.id,
            image_url: urlData.publicUrl,
            display_order: 0
          });
        }
      }

      setProcessing(false);
      setWorkflowState('idle');

      const statusKn = targetStatus === 'published' ? 'ಮಾರ್ಕೆಟ್‌ಪ್ಲೇಸ್‌ನಲ್ಲಿ ಪ್ರಕಟಿಸಲಾಗಿದೆ (PUBLISHED)' : 'ಕರಡಾಗಿ (DRAFT) ಉಳಿಸಲಾಗಿದೆ';
      addAssistantMessage(
        isKn
          ? `✅ **ಯಶಸ್ವಿಯಾಗಿದೆ! ನಿಮ್ಮ ಉತ್ಪನ್ನವನ್ನು ${statusKn}!**\n\n` +
            `**${draft.local_title || draft.name}** ಅನ್ನು ನಿಮ್ಮ ಅಂಗಡಿಗೆ ಸೇರಿಸಲಾಗಿದೆ.\n` +
            `💰 ಬೆಲೆ: ₹${draft.price} | 📦 ದಾಸ್ತಾನು: ${draft.stock_quantity}\n\n` +
            `ಇದು ನಿಮ್ಮ ಕುಶಲಕರ್ಮಿ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ನಲ್ಲಿ ಲಭ್ಯವಿದೆ.`
          : `✅ **Success! Your product is saved as ${targetStatus.toUpperCase()}!**\n\n` +
            `**${draft.name}** is now in your catalog.\n` +
            `💰 Price: ₹${draft.price} | 📦 Stock: ${draft.stock_quantity}\n\n` +
            `It is immediately synchronized with your Artisan Dashboard.`,
        [
          { label: isKn ? '📦 ನನ್ನ ಉತ್ಪನ್ನಗಳನ್ನು ನೋಡಿ' : '📦 View in My Products', action: 'view_products' },
          { label: isKn ? '➕ ಮತ್ತೊಂದು ಉತ್ಪನ್ನ ಸೇರಿಸಿ' : '➕ Add Another Product', action: 'start_add_product' }
        ]
      );

      // Clean up workflow
      setPendingImageFile(null);
      setPendingImagePreview('');
      setCurrentDraft(null);
      setOriginalAudioBlob(null);
      setOriginalAudioUrl('');
      setRawTranscript('');
      setExtractedFacts(null);
    } catch (err) {
      console.error('Save error:', err);
      setProcessing(false);
      addAssistantMessage(
        isKn
          ? `❌ ಉತ್ಪನ್ನ ಉಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ: ${err.message || 'ಡೇಟಾಬೇಸ್ ದೋಷ'}`
          : `❌ Could not save product: ${err.message || 'Database error'}`
      );
    }
  };

  // 8. Manual text composer send
  const handleSend = async () => {
    if (!input.trim() || processing) return;
    const text = input.trim();
    setInput('');
    addUserMessage(text);

    // If reviewing draft, route text as voice/text correction command
    if (workflowState === 'reviewing_draft') {
      handleVoiceCorrection(text);
      return;
    }

    if (workflowState === 'awaiting_voice') {
      addAssistantMessage(
        isKn
          ? `✨ ವಿವರಣೆ ಸ್ವೀಕರಿಸಲಾಗಿದೆ: "${text}". ಉತ್ಪನ್ನದ ಪಟ್ಟಿ ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ...`
          : `✨ Received description: "${text}". Formulating product listing...`
      );
      await generateProductListing(text);
      return;
    }

    if (workflowState === 'awaiting_image') {
      addAssistantMessage(
        isKn
          ? "ಗ್ರಾಹಕರು ನಿಮ್ಮ ಕರಕುಶಲತೆಯನ್ನು ನೋಡಲು, ದಯವಿಟ್ಟು ಮುಂದುವರಿಯುವ ಮೊದಲು 📎 ಬಳಸಿ ಫೋಟೋ ತೆಗೆಯಿರಿ."
          : "To ensure buyers see your authentic craft, please snap or upload a photo using 📎 before we proceed.",
        [{ label: isKn ? '❌ ರದ್ದುಮಾಡಿ' : '❌ Cancel', action: 'cancel_flow' }]
      );
      return;
    }

    const lower = text.toLowerCase();
    if (lower.includes('add') || lower.includes('product') || lower.includes('sell') || lower.includes('new') || lower.includes('ಸೇರಿಸಿ') || lower.includes('ಉತ್ಪನ್ನ')) {
      startProductCreation();
    } else if (lower.includes('my products') || lower.includes('catalog') || lower.includes('inventory') || lower.includes('ನನ್ನ ಉತ್ಪನ್ನ')) {
      navigate('/my-products');
    } else if (lower.includes('help') || lower.includes('how') || lower.includes('ಸಹಾಯ')) {
      handleActionClick('how_it_works');
    } else {
      setProcessing(true);
      setTimeout(() => {
        setProcessing(false);
        addAssistantMessage(
          isKn
            ? "ನಾನು ಫೋಟೋ ಮತ್ತು ಧ್ವನಿಯ ಮೂಲಕ ಉತ್ಪನ್ನಗಳನ್ನು ಸೇರಿಸಲು ಅಥವಾ ನಿಮ್ಮ ಪ್ರಸ್ತುತ ಉತ್ಪನ್ನಗಳನ್ನು ವೀಕ್ಷಿಸಲು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ.\n\nನೀವು ಏನು ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?"
            : "I can help you add products with photos and voice, or view your current catalog.\n\nWhat would you like to do?",
          [
            { label: isKn ? '📸 ಫೋಟೋ ತೆಗೆದು ಉತ್ಪನ್ನ ಸೇರಿಸಿ' : '📸 Snap & Add Product', action: 'start_add_product' },
            { label: isKn ? '📦 ನನ್ನ ಉತ್ಪನ್ನಗಳನ್ನು ನೋಡಿ' : '📦 View My Products', action: 'view_products' }
          ]
        );
      }, 500);
    }
  };

  const isVerifiedArtisan = artisan?.verification_status === 'approved';

  return (
    <div className="chat-app">
      {/* Hidden Mobile Camera Input (rear camera on mobile) */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        id="camera-input"
        onChange={handlePhotoSelected}
        style={{ display: 'none' }}
      />

      {/* Hidden Mobile Gallery Input (photo library / files) */}
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        id="gallery-input"
        onChange={handlePhotoSelected}
        style={{ display: 'none' }}
      />

      {/* Header */}
      <header className="chat-header">
        <button
          className="menu-button"
          aria-label="Open menu"
          onClick={() => setMenuOpen(true)}
        >☰</button>
        <h1 className="app-title">Artisan Connect AI</h1>
        <LanguageSelector
          selectedLanguage={selectedLanguage}
          onLanguageChange={(newLang) => {
            setSelectedLanguage(newLang);
            addAssistantMessage(
              newLang === 'kn'
                ? "🌐 ಭಾಷೆಯನ್ನು **ಕನ್ನಡಕ್ಕೆ (Kannada)** ಬದಲಾಯಿಸಲಾಗಿದೆ. ನೀವು ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಬಹುದು."
                : "🌐 Language switched to **English**. You can speak or type in English."
            );
          }}
        />
      </header>

      {/* Side drawer */}
      <SideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Chat Area */}
      <main className="chat-area">
        <ul className="message-list">
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              sender={msg.sender}
              text={msg.text}
              media={msg.media}
              actionButtons={msg.actionButtons}
              onActionClick={handleActionClick}
              draft={msg.draft}
              isArtisanVerified={isVerifiedArtisan}
              language={selectedLanguage}
              onUpdateDraft={(updated) => {
                setCurrentDraft(updated);
                // Also update the draft on the message bubble directly in state
                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, draft: updated } : m));
              }}
              onSaveDraft={(d) => handleSaveProduct(d, 'draft')}
              onPublishDraft={(d) => handleSaveProduct(d, 'published')}
            />
          ))}
          {processing && (
            <li className="message-bubble assistant processing">
              {isKn ? 'AI ಮೂಲಕ ಪಟ್ಟಿಯನ್ನು ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ...' : 'Formulating listing with AI...'}
            </li>
          )}
          <div ref={chatBottomRef} />
        </ul>
      </main>

      {/* Recording Bar if microphone is active */}
      {isRecording && (
        <div className="recording-bar">
          <div className="recording-status-col">
            <span className="recording-indicator">
              {voiceState === VOICE_STATES.PROCESSING ? '⏳ ' : '🔴 '}
              {voiceState === VOICE_STATES.REQUESTING_PERMISSION
                ? (isKn ? 'ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿ ಪಡೆಯಲಾಗುತ್ತಿದೆ...' : 'Requesting permission...')
                : voiceState === VOICE_STATES.PROCESSING
                ? (isKn ? 'ಧ್ವನಿ ಪರಿವರ್ತಿಸಲಾಗುತ್ತಿದೆ...' : 'Processing voice...')
                : (isKn ? 'ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಆಗುತ್ತಿದೆ...' : 'Recording voice...')}
              {' '}
              {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}
            </span>
            {liveTranscript && (
              <span className="live-transcript-preview" title={liveTranscript}>
                🗣️ "{liveTranscript}"
              </span>
            )}
          </div>
          <div className="recording-actions">
            <button
              onClick={stopVoiceRecording}
              className="btn-recording-finish"
              disabled={voiceState === VOICE_STATES.PROCESSING}
            >
              ⏹ {isKn ? 'ಪೂರ್ಣಗೊಳಿಸಿ ಮತ್ತು ಕಳುಹಿಸಿ' : 'Finish & Send'}
            </button>
            <button
              onClick={cancelVoiceRecording}
              className="btn-recording-cancel"
            >
              ❌ {isKn ? 'ರದ್ದು' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Pending Photo Banner above Composer */}
      {pendingImagePreview && (
        <div className="pending-photo-banner">
          <div className="pending-photo-info">
            <img
              src={pendingImagePreview}
              alt="Selected product preview"
              className="pending-photo-thumb"
            />
            <div className="pending-photo-title">
              {isKn ? '📸 ಫೋಟೋ ಲಗತ್ತಿಸಲಾಗಿದೆ' : '📸 Photo attached'}
            </div>
          </div>
          <div className="pending-photo-actions">
            <button
              type="button"
              className="btn-photo-action"
              onClick={() => setShowPhotoPickerSheet(true)}
              disabled={processing || isRecording}
              title={isKn ? "ಫೋಟೋ ಬದಲಾಯಿಸಿ" : "Change photo"}
            >
              🔄 {isKn ? 'ಬದಲಾಯಿಸಿ' : 'Change'}
            </button>
            <button
              type="button"
              className="btn-photo-action remove"
              onClick={removePendingPhoto}
              disabled={processing || isRecording}
              title={isKn ? "ಫೋಟೋ ತೆಗೆದುಹಾಕಿ" : "Remove photo"}
            >
              🗑️ {isKn ? 'ತೆಗೆದುಹಾಕಿ' : 'Remove'}
            </button>
          </div>
        </div>
      )}

      {/* Composer */}
      <footer className="chat-composer">
        <button
          className="attach-button"
          aria-label="Attach photo from camera or gallery"
          title={isKn ? "ಕ್ಯಾಮೆರಾ ಅಥವಾ ಗ್ಯಾಲರಿಯಿಂದ ಫೋಟೋ ಸೇರಿಸಿ" : "Take photo or choose from gallery"}
          onClick={() => setShowPhotoPickerSheet(true)}
          disabled={processing || isRecording}
        >
          📎
        </button>

        <input
          type="text"
          placeholder={
            isRecording
              ? (isKn ? "ಕೇಳಿಸಿಕೊಳ್ಳಲಾಗುತ್ತಿದೆ..." : "Listening...")
              : (isKn ? "ಸಹಾಯಕರಿಗೆ ಸಂದೇಶ ಕಳುಹಿಸಿ ಅಥವಾ ತಿದ್ದಿ..." : "Message your assistant...")
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          disabled={isRecording || processing}
          className="text-input"
        />

        <button
          className="mic-button"
          aria-label={isRecording ? "Stop recording" : "Record voice description"}
          title={isRecording ? "Stop recording" : "Record voice description"}
          onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
          disabled={processing}
          style={{ color: isRecording ? '#dc2626' : 'inherit' }}
        >
          {isRecording ? '⏹' : '🎤'}
        </button>

        <button
          className="send-button"
          aria-label="Send message"
          onClick={handleSend}
          disabled={!input.trim() || processing || isRecording}
        >
          ✈️
        </button>
      </footer>

      {/* Photo Picker Bottom Action Sheet (Camera vs Gallery Choice) */}
      {showPhotoPickerSheet && (
        <div
          className="photo-sheet-backdrop"
          onClick={() => setShowPhotoPickerSheet(false)}
        >
          <div
            className="photo-sheet-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="photo-sheet-title">
              {isKn ? '📸 ಉತ್ಪನ್ನದ ಫೋಟೋ ಸೇರಿಸಿ' : '📸 Add Product Photo'}
            </h3>
            <div className="photo-sheet-options">
              <button
                type="button"
                className="photo-option-btn"
                onClick={triggerCamera}
                id="btn-choose-camera"
              >
                <span className="photo-option-icon">📷</span>
                <div className="photo-option-text">
                  <span>{isKn ? 'ಕ್ಯಾಮೆರಾದಿಂದ ಫೋಟೋ ತೆಗೆಯಿರಿ' : 'Take Photo (Camera)'}</span>
                  <span className="photo-option-subtext">
                    {isKn ? 'ಫೋನ್ ಹಿಂಬದಿಯ ಕ್ಯಾಮೆರಾ ಬಳಸಿ' : 'Use rear camera on mobile'}
                  </span>
                </div>
              </button>
              <button
                type="button"
                className="photo-option-btn"
                onClick={triggerGallery}
                id="btn-choose-gallery"
              >
                <span className="photo-option-icon">🖼️</span>
                <div className="photo-option-text">
                  <span>{isKn ? 'ಗ್ಯಾಲರಿಯಿಂದ ಆಯ್ಕೆಮಾಡಿ' : 'Choose from Gallery'}</span>
                  <span className="photo-option-subtext">
                    {isKn ? 'ಫೋನ್‌ನಲ್ಲಿರುವ ಫೋಟೋವನ್ನು ಆಯ್ಕೆಮಾಡಿ' : 'Select from photo library / files'}
                  </span>
                </div>
              </button>
            </div>
            <button
              type="button"
              className="photo-sheet-cancel"
              onClick={() => setShowPhotoPickerSheet(false)}
            >
              {isKn ? 'ರದ್ದುಮಾಡಿ' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
