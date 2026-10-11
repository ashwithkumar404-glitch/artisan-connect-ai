import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { FunctionsHttpError } from '@supabase/supabase-js';

// Safe Edge Function invoker
const safeInvokeAI = async (functionName, options) => {
  const { data, error } = await supabase.functions.invoke(functionName, options);

  if (error) {
    console.error(`Edge Function ${functionName} returned error:`, error);
    let errorMsg = error.message || 'AI service failed. Please try again.';

    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        if (body && (body.code === 'AI_QUOTA_EXHAUSTED' || body.error === 'AI_QUOTA_EXHAUSTED')) {
          errorMsg = 'AI_QUOTA_EXHAUSTED';
        } else if (body && body.error) {
          errorMsg = body.error;
        }
      } catch (_) {
        try {
          const text = await error.context.text();
          if (text && text.includes('AI_QUOTA_EXHAUSTED')) {
            errorMsg = 'AI_QUOTA_EXHAUSTED';
          }
        } catch (__) {}
      }
    }

    if (errorMsg === 'AI_QUOTA_EXHAUSTED' || errorMsg.includes('AI_QUOTA_EXHAUSTED')) {
      throw new Error('🤖 AI service is temporarily busy. Please try again in a moment.');
    }
    throw new Error(errorMsg);
  }

  return { data, error: null };
};

export default function ConversationalAssistant() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [artisan, setArtisan] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loadingArtisan, setLoadingArtisan] = useState(true);

  // Messages stream
  const [messages, setMessages] = useState([]);
  const [inputState, setInputState] = useState('idle'); // idle | awaiting_image | awaiting_voice | reviewing_draft | saving
  const [isTyping, setIsTyping] = useState(false);
  const [inputText, setInputText] = useState('');

  // Workflow temporary states
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [pendingImagePreview, setPendingImagePreview] = useState('');
  const [pendingVoiceBlob, setPendingVoiceBlob] = useState(null);
  const [pendingVoiceUrl, setPendingVoiceUrl] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState(null);

  // Draft product state
  const [productDraft, setProductDraft] = useState(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const fileInputRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Load Artisan Profile and Categories
  useEffect(() => {
    let mounted = true;

    async function initialize() {
      if (!user) {
        if (!authLoading && mounted) {
          setLoadingArtisan(false);
          addAssistantMessage(
            "👋 Welcome to Artisan Connect Assistant!\n\nPlease sign in with your artisan account to create listings, manage orders, and query your shop data.",
            [
              { label: '🔑 Sign In', action: 'login' },
              { label: '📝 Register as Artisan', action: 'register' }
            ]
          );
        }
        return;
      }

      try {
        setLoadingArtisan(true);

        // Fetch artisan record
        const { data: artisanData, error: artisanErr } = await supabase
          .from('artisans')
          .select('id, business_name, specialization, location, verification_status')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (artisanErr) throw artisanErr;

        // Fetch categories list
        const { data: categoriesData, error: catErr } = await supabase
          .from('categories')
          .select('id, name')
          .order('name', { ascending: true });

        if (catErr) throw catErr;

        if (mounted) {
          setArtisan(artisanData);
          setCategories(categoriesData || []);
          setLoadingArtisan(false);

          const shopName = artisanData?.business_name || 'Artisan';
          addAssistantMessage(
            `🙏 **Namaste, ${shopName}!**\n\nI am your conversational AI Assistant. You can speak to me in your preferred language (Hindi, Tamil, Bengali, English, etc.) or upload photos.\n\nHow would you like to proceed today?`,
            [
              { label: '📸 Add New Product', action: 'start_add_product' },
              { label: '📦 View My Products', action: 'view_products' },
              { label: '❓ How it works', action: 'how_it_works' }
            ]
          );
        }
      } catch (err) {
        console.error('Initialization error:', err);
        if (mounted) {
          setLoadingArtisan(false);
          addAssistantMessage(
            "⚠️ We could not verify your artisan profile. Please ensure you have created an artisan account.",
            [{ label: 'Go to Shop Profile', action: 'profile' }]
          );
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
      if (pendingVoiceUrl) URL.revokeObjectURL(pendingVoiceUrl);
    };
  }, [user, authLoading]);

  // Helper to append Assistant message
  const addAssistantMessage = (content, actionButtons = [], extraData = null) => {
    const newMsg = {
      id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender: 'assistant',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content,
      actionButtons,
      extraData
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  // Helper to append User message
  const addUserMessage = (content, media = null) => {
    const newMsg = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content,
      media // { type: 'image'|'audio', url, fileName }
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  // Handle Action Button Clicks
  const handleActionClick = (action) => {
    switch (action) {
      case 'start_add_product':
        startAddProductFlow();
        break;
      case 'view_products':
        handleViewArtisanProducts();
        break;
      case 'how_it_works':
        handleHowItWorks();
        break;
      case 'login':
        navigate('/login');
        break;
      case 'register':
        navigate('/register');
        break;
      case 'profile':
        navigate('/artisan/profile');
        break;
      case 'cancel_workflow':
        resetWorkflow("Workflow cancelled. What else would you like to do?");
        break;
      case 'retry_voice':
        startVoiceRecordingPrompt();
        break;
      default:
        console.log('Unknown action:', action);
    }
  };

  // Reset workflow
  const resetWorkflow = (farewellMessage = "Ready for the next task.") => {
    setInputState('idle');
    setPendingImageFile(null);
    setPendingImagePreview('');
    setPendingVoiceBlob(null);
    setPendingVoiceUrl('');
    setVoiceTranscript(null);
    setProductDraft(null);
    setIsEditingDraft(false);

    addAssistantMessage(farewellMessage, [
      { label: '📸 Add New Product', action: 'start_add_product' },
      { label: '📦 View My Products', action: 'view_products' }
    ]);
  };

  // 1. Workflow: Start Add Product
  const startAddProductFlow = () => {
    setInputState('awaiting_image');
    addUserMessage("I want to add a new product.");

    setTimeout(() => {
      addAssistantMessage(
        "Wonderful! Let's get your handcrafted item listed. 📸\n\nPlease **upload or snap a clear photo** of your product using the camera icon or attachment button below.",
        [{ label: '❌ Cancel', action: 'cancel_workflow' }]
      );
    }, 400);
  };

  // 2. Handle Image Selection
  const handleImageFilePicked = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      addAssistantMessage("⚠️ Please upload a valid image file (JPG, PNG, or WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addAssistantMessage("⚠️ Image size is too large (maximum 5 MB allowed). Please pick a smaller photo.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPendingImageFile(file);
    setPendingImagePreview(previewUrl);

    // Show image bubble in chat
    addUserMessage("Here is my product photo.", {
      type: 'image',
      url: previewUrl,
      fileName: file.name
    });

    setIsTyping(true);

    try {
      // Convert to base64 for AI quality check
      const base64Data = await fileToBase64(file);

      // Invoke analyze-image Edge Function
      const { data: analysis } = await safeInvokeAI('analyze-image', {
        body: {
          image: base64Data,
          mimeType: file.type
        }
      });

      setIsTyping(false);

      let qualityNotice = "";
      if (analysis?.quality_score) {
        if (analysis.quality_score >= 70) {
          qualityNotice = `✅ Image clarity is great (Quality score: ${analysis.quality_score}/100).`;
        } else {
          qualityNotice = `ℹ️ Image quality score: ${analysis.quality_score}/100. Tip: ${analysis.recommendations?.[0] || 'Ensure good lighting'}.`;
        }
      }

      setInputState('awaiting_voice');

      addAssistantMessage(
        `${qualityNotice}\n\nNow, **tell me about your product** in your preferred language! 🎙️\n\nTap the **Microphone** button below and speak (or type a message). You can mention:\n- Materials used (e.g. terracotta, bamboo, silk)\n- Craft technique\n- Approximate dimensions or colors\n- Estimated price or quantity`,
        [
          { label: '🎙️ Record Voice', action: 'retry_voice' },
          { label: '❌ Cancel', action: 'cancel_workflow' }
        ]
      );
    } catch (err) {
      console.warn('Image analysis skipped/failed:', err);
      setIsTyping(false);
      setInputState('awaiting_voice');
      addAssistantMessage(
        "Photo received! Now please **tell me about your product** in your own words. Tap the 🎙️ **Microphone** to speak, or type below.",
        [{ label: '❌ Cancel', action: 'cancel_workflow' }]
      );
    }
  };

  const startVoiceRecordingPrompt = () => {
    addAssistantMessage("Tap and hold the 🎙️ **Microphone button** at the bottom right to record up to 60 seconds of audio.");
  };

  // Convert File to Base64 (stripping header)
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64Str = reader.result.toString().split(',')[1];
        resolve(base64Str);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // 3. Microphone Recording Handling
  const startRecording = async () => {
    let stream = null;
    try {
      audioChunksRef.current = [];
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine browser-supported recording MIME format (iOS Safari uses mp4/aac, Chrome uses webm)
      let selectedMimeType = '';
      const candidateTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg;codecs=opus'
      ];
      for (const t of candidateTypes) {
        if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t)) {
          selectedMimeType = t;
          break;
        }
      }

      const recorderOptions = selectedMimeType ? { mimeType: selectedMimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const effectiveMimeType = mediaRecorder.mimeType || selectedMimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: effectiveMimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        setPendingVoiceBlob(audioBlob);
        setPendingVoiceUrl(audioUrl);
        handleVoiceAudioCaptured(audioBlob, audioUrl);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 59) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Microphone recording initialization failed:', err);
      // Ensure microphone stream tracks are released immediately if setup fails
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setIsRecording(false);
      addAssistantMessage("⚠️ Microphone permission was denied or could not be initialized. You can type your description in the text box instead.");
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
  };

  // 4. Voice Processed -> Transcribe -> Generate Draft
  const handleVoiceAudioCaptured = async (blob, url) => {
    addUserMessage("🎙️ Voice message recorded", {
      type: 'audio',
      url: url,
      duration: recordingSeconds
    });

    setIsTyping(true);

    try {
      // Transcribe voice
      const reader = new FileReader();
      reader.readAsDataURL(blob);

      const base64Audio = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result.toString().split(',')[1];
          resolve(res);
        };
        reader.onerror = reject;
      });

      const mimeType = blob.type || 'audio/webm';
      const { data: transData } = await safeInvokeAI('transcribe-voice', {
        body: {
          audio: base64Audio,
          mimeType
        }
      });

      setVoiceTranscript(transData);

      const detectedLang = transData.detected_language || 'Regional';
      const englishText = transData.english_translation || transData.transcript || '';

      addAssistantMessage(
        `🗣️ **Transcribed Audio (${detectedLang}):**\n*"${transData.transcript}"*\n\n` +
        (transData.english_translation && transData.english_translation !== transData.transcript
          ? `🌐 **English Meaning:**\n*"${englishText}"*\n\n`
          : '') +
        `✨ Now formulating your marketplace product listing...`
      );

      // Next: generate product draft
      await generateProductDraftWithAI(englishText);
    } catch (err) {
      console.error('Voice processing failed:', err);
      setIsTyping(false);
      addAssistantMessage(
        `⚠️ Voice transcription failed: ${err.message || 'Please try again.'}\n\nYou can re-record your voice or type the description below.`,
        [
          { label: '🎙️ Try Recording Again', action: 'retry_voice' },
          { label: '❌ Cancel', action: 'cancel_workflow' }
        ]
      );
    }
  };

  // 5. Generate Product Draft from inputs
  const generateProductDraftWithAI = async (descriptionText) => {
    setIsTyping(true);

    try {
      let base64Image = null;
      let mimeType = 'image/jpeg';

      if (pendingImageFile) {
        base64Image = await fileToBase64(pendingImageFile);
        mimeType = pendingImageFile.type;
      }

      // Invoke generate-product Edge Function
      const { data: productData } = await safeInvokeAI('generate-product', {
        body: {
          image: base64Image,
          mimeType,
          voiceTranscript: descriptionText,
          description: descriptionText
        }
      });

      if (!productData || !productData.product_name) {
        throw new Error('Malformed draft returned from AI.');
      }

      // Ensure we have an active array of categories from state or Supabase
      let currentCategories = Array.isArray(categories) ? categories : [];
      if (currentCategories.length === 0) {
        try {
          const { data: freshCats, error: catFetchErr } = await supabase
            .from('categories')
            .select('id, name')
            .order('name', { ascending: true });
          if (!catFetchErr && Array.isArray(freshCats) && freshCats.length > 0) {
            currentCategories = freshCats;
            setCategories(freshCats);
          }
        } catch (catErr) {
          console.warn('Could not refresh categories:', catErr);
        }
      }

      // Safely match category name from AI output against database categories
      const targetCatName = (productData.category || '').toLowerCase();
      let matchedCat = currentCategories.find(
        (c) => c && typeof c.name === 'string' && c.name.toLowerCase() === targetCatName
      );
      if (!matchedCat && currentCategories.length > 0) {
        matchedCat = currentCategories[0];
      }

      const initialPrice = productData.price_suggestion?.min || 500;
      const initialStock = productData.quantity || 1;

      const draft = {
        name: productData.product_name,
        category_id: matchedCat?.id || '',
        category_name: matchedCat?.name || productData.category || 'Handicrafts',
        price: initialPrice,
        priceMin: productData.price_suggestion?.min || 300,
        priceMax: productData.price_suggestion?.max || 1000,
        stock_quantity: initialStock,
        description: productData.description || descriptionText || '',
        keywords: productData.keywords || [],
        confidence: productData.confidence || 'medium',
        imageUrl: pendingImagePreview
      };

      setProductDraft(draft);
      setInputState('reviewing_draft');
      setIsTyping(false);

      addAssistantMessage(
        "🎉 **Here is your generated product draft!**\n\nPlease review the details below. You can adjust the price, stock, or description, then tap **Approve & Save**.",
        [],
        { isDraftCard: true }
      );
    } catch (err) {
      console.error('Generate product error:', err);
      setIsTyping(false);
      addAssistantMessage(
        `⚠️ Could not generate listing: ${err.message || 'Please try again.'}`,
        [{ label: '❌ Cancel', action: 'cancel_workflow' }]
      );
    }
  };

  // 6. Handle Manual Text Input
  const handleSendText = async (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    setInputText('');

    if (inputState === 'awaiting_voice') {
      addUserMessage(text);
      setIsTyping(true);
      addAssistantMessage(`✨ Received description: "${text}". Formulating product listing...`);
      await generateProductDraftWithAI(text);
      return;
    }

    if (inputState === 'awaiting_image') {
      addUserMessage(text);
      addAssistantMessage(
        "To ensure buyers see your authentic craft, please upload a photo using the 📎 button before we proceed.",
        [{ label: '❌ Cancel', action: 'cancel_workflow' }]
      );
      return;
    }

    // Default conversational responses
    addUserMessage(text);
    const lower = text.toLowerCase();

    if (lower.includes('add') || lower.includes('new product') || lower.includes('sell') || lower.includes('list')) {
      startAddProductFlow();
    } else if (lower.includes('product') || lower.includes('show') || lower.includes('catalog') || lower.includes('items')) {
      handleViewArtisanProducts();
    } else if (lower.includes('help') || lower.includes('how')) {
      handleHowItWorks();
    } else {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addAssistantMessage(
          "I can help you add products with photos and voice, or view your current listings.\n\nWhat would you like to do?",
          [
            { label: '📸 Add New Product', action: 'start_add_product' },
            { label: '📦 View My Products', action: 'view_products' }
          ]
        );
      }, 500);
    }
  };

  // 7. Save Approved Product to Supabase
  const handleApproveAndSave = async () => {
    if (!productDraft) return;

    if (!artisan) {
      addAssistantMessage("⚠️ You must be registered as an artisan to save products. Please complete your shop profile.");
      return;
    }

    // Validation 1: Title must not be empty
    const trimmedName = (productDraft.name || '').trim();
    if (!trimmedName) {
      addAssistantMessage("⚠️ Please provide a product title before approving.");
      return;
    }

    // Validation 2: Price must be a valid positive number
    const numericPrice = Number(productDraft.price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      addAssistantMessage("⚠️ Please provide a valid price (greater than ₹0) before approving.");
      return;
    }

    // Validation 3: Stock must be a non-negative whole number (no decimals like 2.5)
    const stockRaw = String(productDraft.stock_quantity ?? '').trim();
    const stockIsWholeNumber = /^\d+$/.test(stockRaw);
    const numericStock = Number(stockRaw);

    if (!stockIsWholeNumber || !Number.isInteger(numericStock) || numericStock < 0) {
      addAssistantMessage("⚠️ Available stock must be a non-negative whole number (e.g. 1, 5, 10). Decimal values like 2.5 are not allowed.");
      return;
    }

    // Validation 4: Category ID must match an actual category ID in the database
    let catList = Array.isArray(categories) && categories.length > 0 ? categories : [];
    if (catList.length === 0) {
      try {
        const { data: freshCats } = await supabase
          .from('categories')
          .select('id, name')
          .order('name', { ascending: true });
        if (Array.isArray(freshCats) && freshCats.length > 0) {
          catList = freshCats;
          setCategories(freshCats);
        }
      } catch (catErr) {
        console.warn('Error fetching categories for validation:', catErr);
      }
    }

    const matchingCategory = catList.find((c) => c && c.id === productDraft.category_id);
    const validCategoryId = matchingCategory ? matchingCategory.id : (catList[0]?.id || null);

    if (!validCategoryId) {
      addAssistantMessage("⚠️ Unable to verify product category against the database. Please refresh the page and try again.");
      return;
    }

    setIsSavingProduct(true);
    setIsTyping(true);

    let createdProductId = null;
    let uploadedStoragePath = null;

    try {
      // 1. Insert product record into public.products
      const { data: newProd, error: insertErr } = await supabase
        .from('products')
        .insert({
          artisan_id: artisan.id,
          category_id: validCategoryId,
          name: trimmedName,
          description: productDraft.description?.trim() || null,
          price: numericPrice,
          stock_quantity: numericStock,
          status: 'draft'
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      createdProductId = newProd.id;

      // 2. Upload image to Supabase Storage if file exists
      if (pendingImageFile) {
        const fileExt = pendingImageFile.name.split('.').pop() || 'jpg';
        const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
        const storagePath = `${artisan.id}/${createdProductId}/${uniqueFileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('product-images')
          .upload(storagePath, pendingImageFile);

        if (uploadErr) {
          // Compensating delete
          await supabase.from('products').delete().eq('id', createdProductId);
          throw new Error(`Image storage upload failed: ${uploadErr.message}`);
        }

        uploadedStoragePath = storagePath;

        // 3. Get Public URL
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(storagePath);

        const publicUrl = urlData.publicUrl;

        // 4. Insert image record into public.product_images
        const { error: imageDbErr } = await supabase
          .from('product_images')
          .insert({
            product_id: createdProductId,
            image_url: publicUrl,
            display_order: 0
          });

        if (imageDbErr) {
          await supabase.storage.from('product-images').remove([uploadedStoragePath]);
          await supabase.from('products').delete().eq('id', createdProductId);
          throw new Error(`Could not link image to product: ${imageDbErr.message}`);
        }
      }

      setIsSavingProduct(false);
      setIsTyping(false);
      setInputState('idle');

      // Success Confirmation message
      addAssistantMessage(
        `🎉 **Congratulations! Your product is saved!**\n\n` +
        `**${productDraft.name}** has been added to your catalog as a **Draft**.\n\n` +
        `💰 Price: ₹${productDraft.price} | 📦 Stock: ${productDraft.stock_quantity}\n\n` +
        `You can publish it anytime from your Artisan Products dashboard when you are ready to sell.`,
        [
          { label: '📦 View in My Products', action: 'view_products' },
          { label: '➕ Add Another Product', action: 'start_add_product' }
        ]
      );

      // Clean up memory
      setProductDraft(null);
      setPendingImageFile(null);
      setPendingVoiceBlob(null);
    } catch (err) {
      console.error('Error saving product:', err);
      setIsSavingProduct(false);
      setIsTyping(false);
      addAssistantMessage(
        `❌ Failed to save product: ${err.message || 'Database error'}. Please try approving again.`,
        [{ label: '🔄 Retry Save', action: 'retry_save' }]
      );
    }
  };

  // View artisan products helper
  const handleViewArtisanProducts = async () => {
    if (!artisan) {
      addAssistantMessage("⚠️ Please sign in as an artisan to view your catalog.");
      return;
    }

    setIsTyping(true);

    try {
      const { data: prods, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          status,
          stock_quantity,
          product_images (image_url)
        `)
        .eq('artisan_id', artisan.id)
        .order('created_at', { ascending: false })
        .limit(4);

      setIsTyping(false);

      if (error) throw error;

      if (!prods || prods.length === 0) {
        addAssistantMessage(
          "📦 You have not added any products yet.\n\nWould you like to add your first product now?",
          [{ label: '📸 Add New Product', action: 'start_add_product' }]
        );
        return;
      }

      let summaryText = `📦 **Your Recent Products (${prods.length} shown):**\n\n`;
      prods.forEach((p, idx) => {
        const statusBadge = p.status === 'published' ? '🟢 Published' : '🟡 Draft';
        summaryText += `${idx + 1}. **${p.name}**\n   ₹${p.price} | Stock: ${p.stock_quantity} | ${statusBadge}\n`;
      });

      addAssistantMessage(summaryText, [
        { label: '➕ Add New Product', action: 'start_add_product' },
        { label: '💻 Open Web Dashboard', action: 'profile' }
      ]);
    } catch (err) {
      setIsTyping(false);
      console.error('Error fetching products:', err);
      addAssistantMessage("Could not retrieve products at this time. Please check your dashboard.");
    }
  };

  // How it works helper
  const handleHowItWorks = () => {
    addAssistantMessage(
      "💡 **How Artisan Connect Assistant Works:**\n\n" +
      "1. Tap **Add New Product** or type 'I want to add a product'.\n" +
      "2. Upload or take a photo of your handicraft.\n" +
      "3. Tap the **Microphone** and describe your craft in Hindi, Tamil, Bengali, or your native language.\n" +
      "4. AI prepares title, description, category, and fair pricing suggestion.\n" +
      "5. Review and tap **Approve & Save** to save it directly to your store catalog!\n\n" +
      "Everything saves straight into your Artisan account with zero complex typing.",
      [{ label: '📸 Start Listing Product', action: 'start_add_product' }]
    );
  };

  return (
    <div className="flex flex-col h-[100dvh] max-w-2xl mx-auto bg-slate-100 shadow-2xl relative overflow-hidden font-sans border-x border-slate-200">
      {/* Top Header - WhatsApp Inspired with Artisan Connect Branding */}
      <header className="bg-emerald-800 text-white px-4 py-3 flex items-center justify-between shadow-md z-20 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <Link
            to="/artisan/dashboard"
            className="text-white hover:text-emerald-200 p-1 -ml-1 text-xl flex items-center justify-center min-w-[36px] min-h-[36px]"
            title="Return to Website Dashboard"
          >
            ←
          </Link>
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-emerald-700 border-2 border-emerald-500 flex items-center justify-center text-xl shadow-inner">
              🏺
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-emerald-800 rounded-full"></span>
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight m-0 text-white flex items-center gap-1.5">
              Artisan AI Assistant
              <span className="text-[10px] bg-emerald-900/80 text-emerald-200 px-1.5 py-0.5 rounded font-medium border border-emerald-600/50">
                Official
              </span>
            </h1>
            <p className="text-xs text-emerald-200 m-0">
              {artisan?.business_name ? `${artisan.business_name} • Online` : 'Online • Voice & Photo AI'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to="/artisan/dashboard"
            className="text-xs bg-emerald-700/80 hover:bg-emerald-600 text-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-600 transition flex items-center gap-1 font-medium"
          >
            <span>💻</span>
            <span className="hidden sm:inline">Web Portal</span>
          </Link>
        </div>
      </header>

      {/* Notice Banner */}
      <div className="bg-emerald-900/90 text-emerald-100 text-[11px] px-3 py-1 text-center border-b border-emerald-800 flex items-center justify-center gap-1.5">
        <span>🔒</span>
        <span>Securely connected to your Artisan Connect catalog</span>
      </div>

      {/* Chat Messages Stream Area */}
      <div
        className="flex-grow overflow-y-auto p-4 space-y-3.5 bg-[#efeae2] bg-opacity-95"
        style={{
          backgroundImage: `radial-gradient(#cbd5e1 0.75px, transparent 0.75px)`,
          backgroundSize: '16px 16px'
        }}
      >
        {/* Date chip */}
        <div className="flex justify-center my-2">
          <span className="bg-slate-200/90 text-slate-600 text-[11px] font-semibold px-3 py-0.5 rounded-full shadow-xs">
            Today
          </span>
        </div>

        {/* Message items */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-3.5 shadow-sm text-sm ${
                msg.sender === 'user'
                  ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-xs'
                  : 'bg-white text-slate-800 rounded-tl-xs border border-slate-200/60'
              }`}
            >
              {/* Media preview (Image) */}
              {msg.media?.type === 'image' && (
                <div className="mb-2 rounded-xl overflow-hidden border border-slate-200 max-w-xs">
                  <img
                    src={msg.media.url}
                    alt="Uploaded craft"
                    className="w-full h-auto max-h-56 object-cover"
                  />
                </div>
              )}

              {/* Media preview (Audio) */}
              {msg.media?.type === 'audio' && (
                <div className="mb-2 bg-emerald-50 rounded-xl p-2.5 border border-emerald-200 flex items-center gap-2">
                  <span className="text-xl">🎙️</span>
                  <audio controls src={msg.media.url} className="h-8 max-w-[210px] w-full" />
                </div>
              )}

              {/* Content text */}
              <div className="whitespace-pre-wrap leading-relaxed break-words font-normal">
                {msg.content}
              </div>

              {/* Timestamp */}
              <div className="text-[10px] text-slate-400 text-right mt-1.5 flex items-center justify-end gap-1">
                <span>{msg.time}</span>
                {msg.sender === 'user' && <span className="text-emerald-600 font-bold">✓✓</span>}
              </div>
            </div>

            {/* Interactive Action Buttons attached to message */}
            {msg.actionButtons && msg.actionButtons.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                {msg.actionButtons.map((btn, i) => (
                  <button
                    key={i}
                    onClick={() => handleActionClick(btn.action)}
                    className="bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-600/40 text-xs font-semibold px-3 py-1.5 rounded-full shadow-xs transition hover:border-emerald-600 flex items-center gap-1 active:scale-95 cursor-pointer"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}

            {/* Product Draft Review Card */}
            {msg.extraData?.isDraftCard && productDraft && (
              <div className="w-full max-w-sm mt-3 bg-white border-2 border-emerald-600 rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-emerald-800 text-white px-4 py-2 flex items-center justify-between text-xs font-bold">
                  <span>✨ AI PRODUCT DRAFT</span>
                  <span className="bg-emerald-700 px-2 py-0.5 rounded text-[10px] uppercase font-semibold">
                    Requires Your Approval
                  </span>
                </div>

                <div className="p-4 space-y-3 text-xs">
                  {/* Image thumbnail */}
                  {productDraft.imageUrl && (
                    <div className="relative rounded-lg overflow-hidden border border-slate-200 h-36 bg-slate-50">
                      <img
                        src={productDraft.imageUrl}
                        alt="Product preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Title */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Product Title</label>
                    {isEditingDraft ? (
                      <input
                        type="text"
                        value={productDraft.name}
                        onChange={(e) => setProductDraft({ ...productDraft, name: e.target.value })}
                        className="w-full mt-1 border border-slate-300 rounded p-1.5 text-xs text-slate-800 font-bold focus:border-emerald-600 focus:outline-hidden"
                      />
                    ) : (
                      <p className="font-bold text-slate-800 text-sm mt-0.5">{productDraft.name}</p>
                    )}
                  </div>

                  {/* Category & Pricing Grid */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase">Category</label>
                      {isEditingDraft ? (
                        <select
                          value={productDraft.category_id}
                          onChange={(e) => {
                            const selected = categories.find((c) => c.id === e.target.value);
                            setProductDraft({
                              ...productDraft,
                              category_id: e.target.value,
                              category_name: selected?.name || productDraft.category_name
                            });
                          }}
                          className="w-full mt-1 border border-slate-300 rounded p-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-hidden"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-block mt-1 bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px]">
                          {productDraft.category_name}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase">Price (₹)</label>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-slate-500 font-bold text-sm">₹</span>
                        <input
                          type="number"
                          value={productDraft.price}
                          onChange={(e) => setProductDraft({ ...productDraft, price: e.target.value })}
                          className="w-full border border-slate-300 rounded p-1 text-xs text-slate-800 font-bold focus:border-emerald-600 focus:outline-hidden"
                          placeholder="Price in INR"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Suggested: ₹{productDraft.priceMin} - ₹{productDraft.priceMax}
                      </span>
                    </div>
                  </div>

                  {/* Stock quantity */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase">Available Stock</label>
                      <input
                        type="number"
                        min="1"
                        value={productDraft.stock_quantity}
                        onChange={(e) => setProductDraft({ ...productDraft, stock_quantity: e.target.value })}
                        className="w-full mt-1 border border-slate-300 rounded p-1 text-xs text-slate-800 font-medium focus:border-emerald-600 focus:outline-hidden"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => setIsEditingDraft(!isEditingDraft)}
                        className="text-xs text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer pb-1.5"
                      >
                        {isEditingDraft ? 'Done Editing' : '✏️ Edit Fields'}
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Craft Story & Description</label>
                    {isEditingDraft ? (
                      <textarea
                        rows={3}
                        value={productDraft.description}
                        onChange={(e) => setProductDraft({ ...productDraft, description: e.target.value })}
                        className="w-full mt-1 border border-slate-300 rounded p-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-hidden"
                      />
                    ) : (
                      <p className="text-slate-600 text-xs mt-0.5 line-clamp-3 leading-relaxed">
                        {productDraft.description}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={isSavingProduct}
                      onClick={handleApproveAndSave}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
                    >
                      {isSavingProduct ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Saving to Your Store...</span>
                        </>
                      ) : (
                        <>
                          <span>✅</span>
                          <span>Approve & Save Product</span>
                        </>
                      )}
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startVoiceRecordingPrompt()}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-1.5 px-2 rounded-lg text-[11px] transition text-center cursor-pointer"
                      >
                        🎙️ Re-record
                      </button>
                      <button
                        type="button"
                        onClick={() => resetWorkflow("Product draft discarded. Ready for new task.")}
                        className="flex-1 bg-slate-100 hover:bg-red-50 text-red-600 font-semibold py-1.5 px-2 rounded-lg text-[11px] transition text-center cursor-pointer"
                      >
                        ❌ Discard
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-start">
            <div className="bg-white rounded-2xl rounded-tl-xs px-4 py-2.5 shadow-sm border border-slate-200 flex items-center space-x-1.5">
              <span className="text-xs font-semibold text-slate-500 mr-1">AI Assistant is thinking</span>
              <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Voice Recording Active Overlay */}
      {isRecording && (
        <div className="bg-rose-50 border-t border-rose-200 px-4 py-3 flex items-center justify-between z-30 flex-shrink-0 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 bg-rose-600 rounded-full animate-ping"></div>
            <div>
              <p className="text-xs font-bold text-rose-800 m-0">Recording your voice message...</p>
              <p className="text-[11px] text-rose-600 m-0">
                0:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds} / 1:00 (Speak naturally)
              </p>
            </div>
          </div>
          <button
            onClick={stopRecording}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow cursor-pointer"
          >
            ⏹️ Done
          </button>
        </div>
      )}

      {/* Bottom Input Area */}
      <footer className="bg-slate-200/90 border-t border-slate-300 p-2.5 flex-shrink-0 z-20">
        <form onSubmit={handleSendText} className="flex items-center gap-2">
          {/* Hidden image file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageFilePicked}
            className="hidden"
          />

          {/* Photo attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach product photo"
            className="w-10 h-10 rounded-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 flex items-center justify-center text-lg shadow-xs transition active:scale-95 cursor-pointer flex-shrink-0"
          >
            📷
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              inputState === 'awaiting_voice'
                ? 'Type details or tap microphone to speak...'
                : inputState === 'awaiting_image'
                ? 'Upload a photo using 📷 or type here...'
                : 'Message your assistant in any language...'
            }
            className="flex-grow bg-white text-slate-800 text-sm rounded-full px-4 py-2.5 border border-slate-300 focus:outline-hidden focus:border-emerald-600 shadow-inner"
          />

          {/* Send text button or Mic button */}
          {inputText.trim() ? (
            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center text-base shadow transition active:scale-95 cursor-pointer flex-shrink-0"
              title="Send message"
            >
              ➤
            </button>
          ) : (
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              title={isRecording ? 'Stop recording' : 'Hold or click to record voice in any language'}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow transition active:scale-95 cursor-pointer flex-shrink-0 ${
                isRecording
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              🎙️
            </button>
          )}
        </form>
      </footer>
    </div>
  );
}
