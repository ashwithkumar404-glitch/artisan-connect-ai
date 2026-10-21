import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../../components/Button';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { FunctionsHttpError } from '@supabase/supabase-js';

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`;
};

const normalizeKeywords = (keywords) => {
  if (!keywords) return [];
  if (Array.isArray(keywords)) {
    return keywords
      .flatMap((k) => (typeof k === 'string' ? k.split(',') : String(k || '')))
      .map((k) => (typeof k === 'string' ? k.trim().replace(/^#+/, '') : ''))
      .filter(Boolean);
  }
  if (typeof keywords === 'string') {
    return keywords
      .split(',')
      .map((k) => k.trim().replace(/^#+/, ''))
      .filter(Boolean);
  }
  return [];
};

const safeInvokeAI = async (functionName, options) => {
  const { data, error } = await supabase.functions.invoke(functionName, options);
  
  if (error) {
    console.error(`Edge Function ${functionName} returned error:`, error);
    let errorMsg = error.message || 'Service request failed. Please try again.';
    let is503 = false;

    if (error instanceof FunctionsHttpError) {
      if (error.context && error.context.status === 503) is503 = true;

      try {
        const body = await error.context.json();
        console.error(`Edge Function ${functionName} HTTP error body:`, body);
        if (body?.error) {
          errorMsg = body.error;
        } else if (body?.message) {
          errorMsg = body.message;
        }
      } catch (_) {
        try {
          const text = await error.context.text();
          console.error(`Edge Function ${functionName} HTTP error text:`, text);
          if (text?.includes('503') || text?.toLowerCase().includes('service unavailable')) is503 = true;
        } catch (__) {}
      }
    } else {
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('503') || msg.includes('failed to send a request') || msg.includes('service unavailable')) {
        is503 = true;
      }
    }

    if (is503 || errorMsg.includes('503')) {
      throw new Error('Service is temporarily unavailable (HTTP 503). Please try again shortly.');
    }
    throw new Error(errorMsg);
  }
  
  return { data, error: null };
};

export default function NewProduct() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');
  
  // Image selection states
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  
  const [categoriesList, setCategoriesList] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // AI analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');

  // AI enhancement states
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedImageUrl, setEnhancedImageUrl] = useState('');
  const [useEnhanced, setUseEnhanced] = useState(false);
  const [enhanceError, setEnhanceError] = useState('');

  // AI voice transcription states (legacy)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeResult, setTranscribeResult] = useState(null);
  const [transcribeError, setTranscribeError] = useState('');
  const [transcribeSuccess, setTranscribeSuccess] = useState('');

  // Single continuous voice description state
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionError, setRecognitionError] = useState('');
  const [speechLang, setSpeechLang] = useState('en-IN');

  // AI product generation states
  const [isGeneratingProduct, setIsGeneratingProduct] = useState(false);
  const [generatedProductResult, setGeneratedProductResult] = useState(null);
  const [generateProductError, setGenerateProductError] = useState('');
  const [applyDetailsSuccess, setApplyDetailsSuccess] = useState('');

  // AI Price Intelligence states
  const [priceIntelligenceResult, setPriceIntelligenceResult] = useState(null);
  const [isAnalyzingPrice, setIsAnalyzingPrice] = useState(false);
  const [priceIntelligenceError, setPriceIntelligenceError] = useState('');
  const [isPriceManuallyEdited, setIsPriceManuallyEdited] = useState(false);
  const [applyPriceSuccess, setApplyPriceSuccess] = useState('');

  // Pipeline state variables
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  // Pipeline step tracking retained for UI progress indicators
  const [pipelineStep, setPipelineStep] = useState('idle');
  const [pipelineProgress, setPipelineProgress] = useState({
    image: 'pending',
    voice: 'pending',
    generation: 'pending',
    pricing: 'pending'
  });
  const [pipelineError, setPipelineError] = useState('');
  const [showAiReview, setShowAiReview] = useState(false);

  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const formRef = useRef(null);
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);
  
  const navigate = useNavigate();

  // Cleanup object URLs and audio/speech resources to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [imagePreviewUrl, audioUrl]);

  useEffect(() => {
    let active = true;
    async function loadCategories() {
      try {
        setLoadingCategories(true);
        setCategoriesError('');
        const { data, error } = await supabase
          .from('categories')
          .select('id, name')
          .order('name', { ascending: true });
        
        if (error) throw error;
        
        if (active) {
          setCategoriesList(data || []);
          if (data && data.length > 0) {
            setSelectedCategoryId(data[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
        if (active) {
          setCategoriesError('Failed to load categories. Please refresh the page.');
        }
      } finally {
        if (active) {
          setLoadingCategories(false);
        }
      }
    }
    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  const handleImageChange = (e) => {
    setSubmitError('');
    setAiResult(null);
    setAiError('');
    setEnhancedImageUrl('');
    setUseEnhanced(false);
    setEnhanceError('');
    const file = e.target.files[0];
    if (!file) return;

    // Validate type (JPEG, PNG, WebP)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setSubmitError('Invalid file type. Only JPG, PNG, and WebP images are allowed.');
      return;
    }

    // Validate size (5 MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setSubmitError('Image size must be less than 5 MB.');
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    setImagePreviewUrl('');
    setAiResult(null);
    setAiError('');
    setEnhancedImageUrl('');
    setUseEnhanced(false);
    setEnhanceError('');
    const fileInput = document.getElementById('prod-image');
    if (fileInput) fileInput.value = '';
  };

  const getBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  const handleAnalyzeImage = async () => {
    setAiError('');
    setAiResult(null);
    setIsAnalyzing(true);

    console.log("AI Image Analysis started...");
    console.log("Image MIME type:", imageFile ? imageFile.type : 'unknown');
    if (imageFile) {
      console.log("Image file size (approx):", Math.round(imageFile.size / 1024) + " KB");
    }

    try {
      if (!imageFile) {
        throw new Error('Please select a product image first.');
      }

      // Convert local file to base64
      const resBase64 = await getBase64(imageFile);
      const base64Data = resBase64.split(',')[1];
      console.log("Invoking Edge Function 'analyze-image' with base64 size:", Math.round(base64Data.length / 1024) + " KB");

      // Invoke Supabase Edge Function using helper
      const { data } = await safeInvokeAI('analyze-image', {
        body: {
          image: base64Data,
          mimeType: imageFile.type
        }
      });

      console.log("Edge Function response received:", data);

      if (!data || typeof data.quality_score !== 'number') {
        throw new Error('Malformed response received from AI model.');
      }

      setAiResult(data);
    } catch (err) {
      console.error('AI Image Analysis error:', err);
      setAiError(err.message || 'AI analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEnhanceImage = async () => {
    setEnhanceError('');
    setEnhancedImageUrl('');
    setIsEnhancing(true);

    try {
      if (!imageFile) {
        throw new Error('Please select a product image first.');
      }

      // Convert local file to base64
      const resBase64 = await getBase64(imageFile);
      const base64Data = resBase64.split(',')[1];
      console.log("Invoking Edge Function 'enhance-image'...");

      // Invoke Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('enhance-image', {
        body: {
          image: base64Data,
          mimeType: imageFile.type
        }
      });

      if (error) {
        console.error('Edge Function enhance-image returned error:', error);
        throw new Error(error.message || 'Image enhancement failed. Please try again.');
      }

      if (!data || !data.enhancedImage) {
        throw new Error('Malformed enhancement response received.');
      }

      const dataUrl = `data:${data.mimeType || 'image/jpeg'};base64,${data.enhancedImage}`;
      setEnhancedImageUrl(dataUrl);
      setUseEnhanced(true); // Default to enhanced image
    } catch (err) {
      console.error('Error enhancing image:', err);
      setEnhanceError(err.message || 'Image enhancement failed. Please try again.');
    } finally {
      setIsEnhancing(false);
    }
  };

  // Single continuous voice description using real-time Web Speech recognition and audio recording
  const startRecording = async () => {
    setTranscribeError('');
    setRecognitionError('');
    setTranscribeResult(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl('');
    }
    setAudioBlob(null);
    audioChunksRef.current = [];

    // 1. Initialize & start Web Speech API for real-time speech-to-text
    const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = speechLang || 'en-IN';

        rec.onstart = () => {
          setIsRecognizing(true);
        };

        rec.onresult = (e) => {
          let interim = '';
          let final = '';
          for (let i = 0; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
              final += e.results[i][0].transcript + ' ';
            } else {
              interim += e.results[i][0].transcript;
            }
          }
          const text = (final + interim).trim();
          if (text) {
            setVoiceTranscript(text);
            setDescription(text);
          }
        };

        rec.onerror = (e) => {
          console.warn('Speech recognition event:', e.error);
          if (e.error !== 'no-speech') {
            setRecognitionError(`Speech recognition note: ${e.error}`);
          }
        };

        rec.onend = () => {
          setIsRecognizing(false);
        };

        rec.start();
        recognitionRef.current = rec;
      } catch (recErr) {
        console.warn('SpeechRecognition initialization error:', recErr);
        setRecognitionError('Could not start browser speech recognition: ' + recErr.message);
      }
    } else {
      setRecognitionError('Browser speech recognition is not supported in this browser. For voice transcription, please use Google Chrome, Microsoft Edge, or Safari.');
    }

    // 2. Start MediaRecorder for audio recording & preview
    try {
      console.log('Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        console.log('Voice recording captured. Blob type:', blob.type, 'Size:', blob.size);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 119) {
            stopRecording();
            return 120;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Mic permission error:', err);
      setTranscribeError('Could not access microphone. Please enable microphone permissions in your browser.');
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
        recognitionRef.current = null;
      }
      setIsRecognizing(false);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    setIsRecognizing(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    console.log('Recording stopped.');
  };

  const performVoiceTranscription = async () => {
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Voice message is empty. Please record again.');
    }

    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    
    const base64Data = await new Promise((resolve, reject) => {
      reader.onloadend = () => {
        const base64Str = reader.result.split(',')[1];
        resolve(base64Str);
      };
      reader.onerror = (e) => reject(new Error('Failed to convert audio buffer: ' + e.message));
    });

    const mimeType = audioBlob.type || 'audio/webm';
    console.log(`Invoking Edge Function 'transcribe-voice' with MIME: ${mimeType}`);

    const { data } = await safeInvokeAI('transcribe-voice', {
      body: {
        audio: base64Data,
        mimeType
      }
    });

    console.log("Transcription response received:", data);
    
    if (!data || (!data.transcript && !data.english_translation)) {
      throw new Error('No transcript returned from server.');
    }

    setTranscribeResult(data);
    const transcriptText = data.english_translation || data.transcript;
    if (transcriptText) {
      setVoiceTranscript(transcriptText);
      setDescription(transcriptText);
    }
    return data;
  };



  const executePriceIntelligence = async (productName, category, description, quantity, similarProducts) => {
    setPriceIntelligenceError('');
    setPriceIntelligenceResult(null);
    setIsAnalyzingPrice(true);

    try {
      const validSimilar = similarProducts.filter(p => {
        if (!p || (typeof p.price !== 'number' && typeof p.price !== 'string')) return false;
        const priceVal = parseFloat(p.price);
        return !isNaN(priceVal) && priceVal > 0;
      });

      if (validSimilar.length === 0) {
        setPriceIntelligenceResult({
          comparable_products_count: 0,
          confidence: "low",
          recommendation: null,
          warning: "No comparable published products are currently available. Please enter your price manually."
        });
        return;
      }

      console.log("Invoking Edge Function 'price-intelligence'...");
      const { data } = await safeInvokeAI('price-intelligence', {
        body: {
          productName,
          category,
          description,
          quantity,
          similarProducts: validSimilar
        }
      });

      console.log("price-intelligence result:", data);
      setPriceIntelligenceResult(data);
    } catch (err) {
      console.error("AI Price Intelligence Error:", err);
      setPriceIntelligenceError(err.message || "Failed to analyze marketplace prices.");
    } finally {
      setIsAnalyzingPrice(false);
    }
  };

  const handleGenerateProduct = () => runOrchestratedPipeline();

  const runOrchestratedPipeline = async () => {
    if (isPipelineRunning) return;
    setIsPipelineRunning(true);
    setPipelineError('');
    setShowAiReview(false);
    
    // Reset individual states
    setAiResult(null);
    setAiError('');
    setEnhancedImageUrl('');
    setUseEnhanced(false);
    setEnhanceError('');
    setPriceIntelligenceResult(null);
    setPriceIntelligenceError('');
    setGeneratedProductResult(null);
    setGenerateProductError('');
    
    // Initialize pipeline progress steps
    const progress = {
      image: imageFile ? 'success' : 'skipped',
      voice: 'pending',
      generation: 'pending',
      pricing: 'pending'
    };
    setPipelineProgress({ ...progress });
    setPipelineStep('image');
    
    // Tiny delay for UI feel
    await new Promise(r => setTimeout(r, 600));

    let activeDescription = description || voiceTranscript || '';

    // STEP 2: Voice transcription / speech handling
    setPipelineStep('voice');
    progress.voice = 'running';
    setPipelineProgress({ ...progress });

    if (voiceTranscript || activeDescription.trim()) {
      progress.voice = 'success';
      setPipelineProgress({ ...progress });
      activeDescription = activeDescription.trim() || voiceTranscript.trim();
    } else if (audioBlob && !transcribeResult) {
      try {
        const transcribeData = await performVoiceTranscription();
        progress.voice = 'success';
        setPipelineProgress({ ...progress });
        const voiceText = transcribeData.english_translation || transcribeData.transcript || '';
        if (voiceText) {
          activeDescription = activeDescription.trim() 
            ? `${activeDescription.trim()}\n\n${voiceText}`
            : voiceText;
          setDescription(activeDescription);
        }
      } catch (err) {
        console.warn("Pipeline Voice Transcription Error:", err);
        if (!activeDescription.trim() && !imageFile) {
          progress.voice = 'error';
          setPipelineProgress({ ...progress });
          setPipelineError(
            err.message?.includes('501') || err.message?.includes('unavailable')
              ? 'Server voice transcription service is unavailable (HTTP 501: Not Implemented). In supported browsers (Chrome, Edge, Safari), your voice is transcribed live while recording.'
              : `Voice processing failed: ${err.message || 'Please try again.'}`
          );
          setIsPipelineRunning(false);
          return;
        } else {
          progress.voice = 'skipped';
          setPipelineProgress({ ...progress });
        }
      }
    } else {
      progress.voice = activeDescription ? 'success' : 'skipped';
      setPipelineProgress({ ...progress });
    }

    // STEP 3: Product details generation
    setPipelineStep('generation');
    progress.generation = 'running';
    setPipelineProgress({ ...progress });
    
    let base64Image = null;
    let mimeType = null;

    if (imageFile) {
      try {
        const resBase64 = await getBase64(imageFile);
        base64Image = resBase64.split(',')[1];
        mimeType = imageFile.type;
      } catch (err) {
        console.error("Failed to read image:", err);
      }
    }

    let generatedData = null;
    try {
      console.log("Invoking generate-product from orchestrator...");
      const { data } = await safeInvokeAI('generate-product', {
        body: {
          image: base64Image,
          mimeType,
          voiceTranscript: voiceTranscript || transcribeResult?.english_translation || transcribeResult?.transcript || null,
          description: activeDescription || null
        }
      });
      if (!data || !data.product_name) throw new Error("Malformed metadata returned from AI model.");
      
      generatedData = data;
      setGeneratedProductResult(data);
      
      // Auto-populate actual form fields
      setName(data.product_name);
      
      let matchedCategoryId = null;
      let categoryName = data.category || '';
      if (data.category && categoriesList.length > 0) {
        const foundCategory = categoriesList.find(
          cat => cat.name.toLowerCase() === data.category.toLowerCase()
        );
        if (foundCategory) {
          matchedCategoryId = foundCategory.id;
          setSelectedCategoryId(foundCategory.id);
        }
      }
      
      if (data.description) {
        setDescription(data.description);
      }
      
      if (data.price_suggestion) {
        if (!isPriceManuallyEdited) {
          const { min, max } = data.price_suggestion;
          const midPrice = Math.round((min + max) / 2);
          setPrice(midPrice.toString());
        }
      }
      
      if (data.quantity !== undefined && data.quantity !== null) {
        setStockQuantity(data.quantity.toString());
      } else {
        setStockQuantity('');
      }

      progress.generation = 'success';
      setPipelineProgress({ ...progress });

      // Run non-blocking Image Analysis
      if (imageFile) {
        handleAnalyzeImage().catch(err => {
          console.error("Non-blocking Image Analysis failed:", err);
          setAiError(err.message || 'Image quality analysis is temporarily unavailable.');
        });
      }

      // STEP 6: Price intelligence
      setPipelineStep('pricing');
      progress.pricing = 'running';
      setPipelineProgress({ ...progress });

      const finalCategoryId = matchedCategoryId || selectedCategoryId;
      if (finalCategoryId) {
        console.log("Fetching similar products for pricing comparison...");
        const { data: similarList, error: similarErr } = await supabase
          .from('products')
          .select('name, description, price, category_id')
          .eq('category_id', finalCategoryId)
          .eq('status', 'published');

        if (similarErr) throw similarErr;
        
        await executePriceIntelligence(
          data.product_name,
          categoryName,
          data.description,
          data.quantity,
          similarList || []
        );
      }
      
      progress.pricing = 'success';
      setPipelineProgress({ ...progress });
      setPipelineStep('ready');
      setShowAiReview(true);

    } catch (err) {
      console.error("Pipeline Product Generation failed:", err);
      progress.generation = 'error';
      setPipelineProgress({ ...progress });
      setPipelineError(err.message || "AI product generation failed. Please try again.");
    } finally {
      setIsPipelineRunning(false);
    }
  };

  const handleApplyRecommendedPrice = () => {
    let recommended = null;
    if (priceIntelligenceResult) {
      if (priceIntelligenceResult.recommendation?.recommended_price !== undefined && priceIntelligenceResult.recommendation?.recommended_price !== null) {
        recommended = priceIntelligenceResult.recommendation.recommended_price;
      } else if (priceIntelligenceResult.recommended_price !== undefined && priceIntelligenceResult.recommended_price !== null) {
        recommended = priceIntelligenceResult.recommended_price;
      } else if (priceIntelligenceResult.suggested_price !== undefined && priceIntelligenceResult.suggested_price !== null) {
        recommended = priceIntelligenceResult.suggested_price;
      }
    }

    const parsed = parseFloat(recommended);
    if (!isNaN(parsed) && parsed > 0) {
      setPrice(String(parsed));
      setIsPriceManuallyEdited(true);
      setPriceIntelligenceError('');
      setApplyPriceSuccess('✓ Suggested price applied');
      setTimeout(() => setApplyPriceSuccess(''), 3000);
    } else {
      setPriceIntelligenceError('Suggested price is null or invalid. Cannot apply.');
    }
  };

  const handleFormSubmit = async (e, publishStatus = 'draft') => {
    if (e && e.preventDefault) e.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);

    let createdProductId = null;
    let uploadedStoragePath = null;

    try {
      // 1. Client-side Validation
      if (!name.trim()) {
        setSubmitError('Product name is required.');
        setIsSubmitting(false);
        return;
      }
      if (!selectedCategoryId) {
        setSubmitError('Product category is required.');
        setIsSubmitting(false);
        return;
      }
      
      const cleanedPrice = String(price).replace(/[^\d.]/g, '');
      const parsedPrice = parseFloat(cleanedPrice);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        setSubmitError('Price must be a valid positive number.');
        setIsSubmitting(false);
        return;
      }

      const parsedStock = parseInt(stockQuantity, 10);
      if (isNaN(parsedStock) || parsedStock < 0 || !Number.isInteger(parsedStock)) {
        setSubmitError('Stock quantity must be a non-negative integer.');
        setIsSubmitting(false);
        return;
      }

      // Get authenticated user
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      
      const currentUser = session?.user || user;
      if (!currentUser) {
        setSubmitError('You must be logged in to add a product.');
        setIsSubmitting(false);
        return;
      }

      // Fetch corresponding artisan record
      const { data: artisan, error: artisanError } = await supabase
        .from('artisans')
        .select('id, verification_status')
        .eq('profile_id', currentUser.id)
        .maybeSingle();

      if (artisanError) {
        console.error('Error verifying artisan profile:', artisanError);
        throw new Error('Failed to verify artisan account status.');
      }

      if (!artisan) {
        setSubmitError('No artisan profile found for your account. You must register as an artisan to add products.');
        setIsSubmitting(false);
        return;
      }

      if (publishStatus === 'published' && artisan.verification_status !== 'approved') {
        setSubmitError("⚠️ Verification Required\nYour artisan account must be verified before you can publish products.");
        setIsSubmitting(false);
        return;
      }

      // 2. Insert product and obtain product ID
      const { data: newProduct, error: insertError } = await supabase
        .from('products')
        .insert({
          artisan_id: artisan.id,
          category_id: selectedCategoryId,
          name: name.trim(),
          description: description.trim() || null,
          price: parsedPrice,
          stock_quantity: parsedStock,
          status: publishStatus
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database product insertion failed:', insertError);
        throw new Error(insertError.message || 'Error inserting product into the database.');
      }

      createdProductId = newProduct.id;

      // 3. Upload image if selected
      if (imageFile || (useEnhanced && enhancedImageUrl)) {
        let fileToUpload = imageFile;
        if (useEnhanced && enhancedImageUrl) {
          const mimeType = 'image/jpeg';
          const base64Data = enhancedImageUrl.split(',')[1];
          const blob = base64ToBlob(base64Data, mimeType);
          fileToUpload = new File([blob], imageFile ? imageFile.name : 'enhanced_product.jpg', { type: mimeType });
        }

        const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
        const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
        const storagePath = `${artisan.id}/${createdProductId}/${uniqueFileName}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(storagePath, fileToUpload);

        if (uploadError) {
          console.error('Image upload to storage failed:', uploadError);
          // Compensating cleanup: Delete newly created product row
          await supabase.from('products').delete().eq('id', createdProductId);
          createdProductId = null; // Mark cleaned up
          throw new Error(`Product draft created, but image upload failed: ${uploadError.message}`);
        }

        uploadedStoragePath = storagePath;

        // 4. Get the public URL
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(storagePath);
        
        const publicUrl = urlData.publicUrl;

        // 5. Insert image record into public.product_images
        const { error: imageDbError } = await supabase
          .from('product_images')
          .insert({
            product_id: createdProductId,
            image_url: publicUrl,
            display_order: 0
          });

        if (imageDbError) {
          console.error('Saving image database record failed:', imageDbError);
          
          // Compensating cleanup:
          // A. Remove uploaded file from storage
          await supabase.storage.from('product-images').remove([uploadedStoragePath]);
          uploadedStoragePath = null; // Mark cleaned up
          // B. Delete product row
          await supabase.from('products').delete().eq('id', createdProductId);
          createdProductId = null; // Mark cleaned up
          
          throw new Error(`Product draft created, but database failed to save image details: ${imageDbError.message}`);
        }
      }

      // Redirect to products catalog on success
      navigate('/artisan/products', {
        state: { successMessage: 'Product created successfully!' }
      });
    } catch (err) {
      console.error('Error submitting product:', err);
      setSubmitError(err.message || 'An unexpected error occurred while saving the product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAiCreatorEnabled = !!imageFile || !!audioBlob || !!voiceTranscript || !!(transcribeResult?.english_translation) || !!description.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gov-navy m-0">Add New Product</h2>
          <p className="text-sm text-slate-500 mt-1">Create a catalog listing for your handicraft.</p>
        </div>
        <Link to="/artisan/products" className="text-sm font-semibold text-slate-600 hover:text-gov-navy">
          ← Cancel
        </Link>
      </div>

      {/* ✨ Create Product with AI Section */}
      <div className="relative bg-gradient-to-br from-indigo-50/90 via-white to-sky-50/90 border border-indigo-100 shadow-[0_8px_30px_rgb(99,102,241,0.08)] rounded-2xl p-6 overflow-hidden transition-all duration-300">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-indigo-200/20 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-32 h-32 bg-sky-200/20 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl p-2.5 bg-indigo-100/80 text-indigo-700 rounded-2xl shadow-sm">✨</span>
          <div>
            <h3 className="text-xl font-black text-gov-navy m-0">Create Product with AI</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium font-bold">Upload a product photo and record one continuous voice description. AI will prepare your marketplace listing.</p>
          </div>
        </div>

        {/* Inputs row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Product Image */}
          <div className="bg-white/60 backdrop-blur-xs border border-slate-200/80 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📷</span>
              <span className="font-bold text-slate-800 text-sm">Product Image</span>
            </div>

            {imagePreviewUrl ? (
              <div className="relative border border-slate-200 rounded-lg p-2 bg-slate-50 flex flex-col items-center">
                <img
                  src={useEnhanced && enhancedImageUrl ? enhancedImageUrl : imagePreviewUrl}
                  alt="Product preview"
                  className="max-h-36 object-contain rounded border border-slate-200"
                />
                <div className="mt-3 flex gap-2 w-full">
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="bg-red-50 hover:bg-red-100 text-red-750 text-xs font-bold px-3 py-1.5 rounded border border-red-200 cursor-pointer flex-grow text-center transition-colors"
                  >
                    Remove Image
                  </button>
                  <label className="bg-white hover:bg-slate-50 border border-slate-350 text-slate-700 text-xs font-bold px-3 py-1.5 rounded cursor-pointer flex-grow text-center transition-colors inline-flex items-center justify-center">
                    Change
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 cursor-pointer block hover:border-gov-navy transition-colors">
                <span className="text-2xl" role="img" aria-label="Camera icon">📷</span>
                <p className="text-xs text-slate-550 mt-2 font-bold">Select Product Image</p>
                <p className="text-[10px] text-slate-400 mt-1">JPEG, PNG, WebP up to 5MB</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Continuous Voice Description */}
          <div className="bg-white/60 backdrop-blur-xs border border-slate-200/80 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎙️</span>
                <span className="font-bold text-slate-800 text-sm">One-Shot Voice Description</span>
              </div>
              
              {voiceTranscript ? (
                <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  ✓ Speech Transcribed
                </span>
              ) : audioUrl && !isRecording ? (
                <span className="bg-indigo-100 text-indigo-805 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Audio Ready
                </span>
              ) : null}
            </div>

            {/* Instruction Box: What to describe naturally */}
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-950 space-y-1.5">
              <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                <span>💡</span>
                <span>Describe your craft naturally in one continuous voice recording:</span>
              </div>
              <ul className="text-[11px] text-slate-700 space-y-0.5 list-disc list-inside pl-1 leading-relaxed">
                <li>What the product is and what it is used for</li>
                <li>Materials used and how it was handcrafted</li>
                <li>Special qualities, design details, or dimensions</li>
                <li>Time taken, production cost, or desired selling price (optional)</li>
              </ul>
            </div>

            {/* Language Selection */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <label htmlFor="voice-lang-select" className="text-slate-600 font-semibold text-[11px] flex items-center gap-1">
                <span>🌐</span> Speaking language:
              </label>
              <select
                id="voice-lang-select"
                value={speechLang}
                onChange={(e) => setSpeechLang(e.target.value)}
                disabled={isRecording}
                className="bg-white border border-slate-300 text-slate-700 text-xs rounded px-2 py-1 focus:ring-1 focus:ring-gov-navy font-medium"
              >
                <option value="en-IN">English (India)</option>
                <option value="hi-IN">Hindi (हिंदी)</option>
                <option value="kn-IN">Kannada (ಕನ್ನಡ)</option>
                <option value="ta-IN">Tamil (தமிழ்)</option>
                <option value="te-IN">Telugu (తెలుగు)</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>

            {/* Real-time Voice Transcript / Description Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-600">
                  {isRecognizing ? '🎙️ Listening & Transcribing Live...' : 'Product Description (Voice Transcript):'}
                </span>
                {description && (
                  <span className="text-[10px] text-slate-400">
                    Optional manual edit
                  </span>
                )}
              </div>
              <textarea
                rows="3"
                placeholder="Click 'Start Voice Description' below and speak in your own words. Your speech will be converted to text automatically..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (!voiceTranscript && e.target.value) {
                    setVoiceTranscript(e.target.value);
                  }
                }}
                className={`w-full px-3 py-2 border rounded-lg text-xs bg-white transition-all ${
                  isRecognizing 
                    ? 'border-red-400 ring-2 ring-red-100 bg-red-50/20' 
                    : 'border-slate-350 focus:ring-2 focus:ring-gov-navy focus:border-gov-navy'
                }`}
              ></textarea>
            </div>

            {/* Recognition or Microphone Errors */}
            {recognitionError && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-850 rounded text-[11px] leading-relaxed">
                ⚠️ {recognitionError}
              </div>
            )}
            {transcribeError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded text-[11px] leading-relaxed">
                ⚠️ {transcribeError}
              </div>
            )}

            {/* Voice record controls */}
            <div className="border-t border-slate-100 pt-3">
              {isRecording ? (
                <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 text-red-655 font-bold text-xs animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
                    <span>🔴 Recording & Transcribing... {formatTime(recordingTime)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-sm min-h-[34px]"
                  >
                    <span>⏹️</span> Finish Recording
                  </button>
                </div>
              ) : audioUrl ? (
                <div className="flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs text-indigo-700 font-bold">
                    <span className="flex items-center gap-1.5">
                      <span>🎙️</span> Voice Recorded ({recordingTime}s)
                    </span>
                    {voiceTranscript && (
                      <span className="text-green-700 text-[10px] bg-green-50 px-2 py-0.5 rounded border border-green-200">
                        Speech Recognized
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <audio src={audioUrl} controls className="w-full h-8" />
                    <button
                      type="button"
                      onClick={startRecording}
                      className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-bold px-3 py-1.5 rounded transition-all cursor-pointer whitespace-nowrap min-h-[30px]"
                    >
                      🔄 Record Again
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-indigo-500/20"
                >
                  <span className="text-base">🎙️</span>
                  <span>Start Voice Description</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline state display / error / trigger */}
        <div className="flex flex-col items-center border-t border-slate-150 pt-5">
          {isPipelineRunning && (
            <div className="w-full max-w-lg mb-5 bg-white border border-indigo-100 rounded-xl p-4 shadow-sm space-y-3.5 text-xs text-slate-750">
              <div className="flex items-center gap-2 text-indigo-700 font-bold">
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="animate-pulse">🤖 Preparing your product...</span>
              </div>
              
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    {pipelineProgress.image === 'success' ? '✓' : pipelineProgress.image === 'skipped' ? '○' : '⏳'} 
                    Image Status
                  </span>
                  <span className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">
                    {pipelineProgress.image === 'success' ? 'Image received' : 'No image uploaded'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    {pipelineProgress.voice === 'success' ? '✓' : pipelineProgress.voice === 'running' ? '⏳' : pipelineProgress.voice === 'skipped' ? '○' : '⏳'} 
                    Voice Transcription
                  </span>
                  <span className={`font-semibold uppercase tracking-wider text-[9px] ${pipelineProgress.voice === 'running' ? 'text-indigo-600 animate-pulse' : 'text-slate-505'}`}>
                    {pipelineProgress.voice === 'running' ? 'Understanding description...' : 
                     pipelineProgress.voice === 'success' ? 'Voice understood' : 'No voice recording'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    {pipelineProgress.generation === 'success' ? '✓' : pipelineProgress.generation === 'running' ? '⏳' : '○'} 
                    Metadata Generation
                  </span>
                  <span className={`font-semibold uppercase tracking-wider text-[9px] ${pipelineProgress.generation === 'running' ? 'text-indigo-600 animate-pulse' : 'text-slate-505'}`}>
                    {pipelineProgress.generation === 'running' ? 'Generating catalog data...' : 
                     pipelineProgress.generation === 'success' ? 'Product details ready' : 'Pending'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    {pipelineProgress.pricing === 'success' ? '✓' : pipelineProgress.pricing === 'running' ? '⏳' : '○'} 
                    Market Price Intel
                  </span>
                  <span className={`font-semibold uppercase tracking-wider text-[9px] ${pipelineProgress.pricing === 'running' ? 'text-indigo-600 animate-pulse' : 'text-slate-505'}`}>
                    {pipelineProgress.pricing === 'running' ? 'Analyzing prices...' : 
                     pipelineProgress.pricing === 'success' ? 'Price analyzed' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {pipelineError && (
            <div className="mb-4 w-full max-w-lg bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-xs font-semibold text-center animate-fade-in">
              ⚠️ {pipelineError}
            </div>
          )}

          {!isPipelineRunning && !showAiReview && (
            <button
              type="button"
              disabled={!imagePreviewUrl && !description.trim() && !voiceTranscript && !audioBlob}
              onClick={runOrchestratedPipeline}
              className="w-full md:w-72 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md hover:shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <span>✨</span>
              <span>Create Product with AI</span>
            </button>
          )}

          {!isPipelineRunning && !showAiReview && !imagePreviewUrl && !description.trim() && !voiceTranscript && !audioBlob && (
            <span className="text-[10px] text-amber-600 font-semibold mt-2.5">
              ⚠️ Please select an image or record your voice description to begin AI Creation.
            </span>
          )}
        </div>

        {/* 🤖 AI Product Ready / Final Review Panel */}
        {showAiReview && generatedProductResult && (
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 mt-6 border border-slate-800 shadow-xl relative overflow-hidden animate-fade-in text-slate-200">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎉</span>
                <div>
                  <h4 className="font-bold text-sm text-white m-0">Your product is ready for review</h4>
                  <p className="text-[10px] text-slate-450 mt-0.5">Please review the details, optimize images or price, and save/publish below.</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                generatedProductResult.confidence === 'high' ? 'bg-green-950/80 text-green-400 border border-green-800' :
                generatedProductResult.confidence === 'medium' ? 'bg-amber-950/80 text-amber-400 border border-amber-800' :
                'bg-red-950/80 text-red-400 border border-red-850'
              }`}>
                {generatedProductResult.confidence} Confidence
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Image Review & Optional Enhancer */}
              <div className="md:col-span-1 space-y-4">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] block">Product Image</span>
                
                <div className="border border-slate-850 rounded-xl p-2 bg-slate-950 flex items-center justify-center min-h-[160px]">
                  <img
                    src={useEnhanced && enhancedImageUrl ? enhancedImageUrl : imagePreviewUrl}
                    alt="Final product"
                    className="max-h-40 object-contain rounded"
                  />
                </div>

                {/* Quality Score Badge */}
                {aiResult && (
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-slate-400 font-bold text-[10px] uppercase">Image Quality:</span>
                    <span className={`font-black text-sm ${aiResult.quality_score >= 80 ? 'text-green-400' : aiResult.quality_score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                      {aiResult.quality_score}/100
                    </span>
                  </div>
                )}

                {/* Non-blocking Quality analysis failure */}
                {aiError && (
                  <div className="bg-amber-950/40 border border-amber-900/60 text-amber-400 p-2.5 rounded text-[11px] leading-relaxed flex items-center justify-between">
                    <span>Image quality analysis note: {aiError}</span>
                    <button
                      type="button"
                      disabled={isAnalyzing}
                      onClick={handleAnalyzeImage}
                      className="bg-amber-900 hover:bg-amber-800 text-amber-200 text-[10px] font-bold px-2 py-1 rounded ml-2 transition-all cursor-pointer whitespace-nowrap"
                    >
                      {isAnalyzing ? 'Retrying...' : '🔄 Retry'}
                    </button>
                  </div>
                )}

                {/* Optional Image Enhancement Button inside Review Panel */}
                {imageFile && !enhancedImageUrl && (
                  <button
                    type="button"
                    disabled={isEnhancing}
                    onClick={handleEnhanceImage}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 font-bold py-2 px-3 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 min-h-[34px] cursor-pointer"
                  >
                    {isEnhancing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>Enhancing Image...</span>
                      </>
                    ) : (
                      <>
                        <span>✨ Enhance Image</span>
                      </>
                    )}
                  </button>
                )}

                {enhancedImageUrl && (
                  <div className="border border-slate-800 p-3 bg-slate-950 rounded-lg space-y-2">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">✨ AI Enhancement Ready</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setUseEnhanced(true)}
                        className={`text-[10px] font-bold py-1.5 px-2.5 rounded-md flex-1 text-center cursor-pointer transition-all ${
                          useEnhanced ? 'bg-green-600 text-white font-extrabold' : 'bg-slate-850 text-slate-350 border border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        Use Enhanced
                      </button>
                      <button
                        type="button"
                        onClick={() => setUseEnhanced(false)}
                        className={`text-[10px] font-bold py-1.5 px-2.5 rounded-md flex-1 text-center cursor-pointer transition-all ${
                          !useEnhanced ? 'bg-slate-805 text-white' : 'bg-slate-850 text-slate-350 border border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        Keep Original
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Middle Column: Metadata Review */}
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-440 font-bold uppercase tracking-wider text-[9px] block">Product Name</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white mt-1.5 font-bold focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <span className="text-slate-450 font-bold uppercase tracking-wider text-[9px] block">Traditional Category</span>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 mt-1.5 font-semibold focus:ring-1 focus:ring-indigo-500"
                    >
                      {categoriesList.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <span className="text-slate-450 font-bold uppercase tracking-wider text-[9px] block">Description</span>
                  <textarea
                    rows="4"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 mt-1.5 text-xs text-slate-300 leading-relaxed focus:ring-1 focus:ring-indigo-500 whitespace-pre-wrap"
                  ></textarea>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-450 font-bold uppercase tracking-wider text-[9px] block">Price (INR)</span>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => {
                        setPrice(e.target.value);
                        setIsPriceManuallyEdited(true);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white mt-1.5 font-bold focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <span className="text-slate-450 font-bold uppercase tracking-wider text-[9px] block">Quantity</span>
                    <input
                      type="number"
                      value={stockQuantity}
                      placeholder="Enter quantity"
                      onChange={(e) => setStockQuantity(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white mt-1.5 font-semibold focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {(() => {
                  const normalizedKeywords = normalizeKeywords(generatedProductResult.keywords);
                  return normalizedKeywords.length > 0 ? (
                    <div>
                      <span className="text-slate-450 font-bold uppercase tracking-wider text-[9px] block">Keywords</span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {normalizedKeywords.map((k, i) => (
                          <span key={i} className="bg-slate-850 text-slate-350 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-800">
                            #{k}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            {/* AI Price Intelligence details inside review block */}
            {priceIntelligenceResult && (
              <div className="mt-6 pt-5 border-t border-slate-800">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 block mb-3">💰 AI Price Intelligence</span>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850/80">
                  {Number(priceIntelligenceResult.comparable_products_count) > 0 ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center py-1 border-b border-slate-900">
                            <span className="text-slate-400 font-medium">Market Range:</span>
                            <span className="font-bold text-white">
                              ₹{priceIntelligenceResult.market_min} — ₹{priceIntelligenceResult.market_max}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-slate-900">
                            <span className="text-slate-400 font-medium">Average / Median:</span>
                            <span className="font-semibold text-slate-200">
                              ₹{priceIntelligenceResult.market_average} / ₹{priceIntelligenceResult.market_median}
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-900/60 p-3 rounded border border-slate-850 flex flex-col justify-between">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-bold text-indigo-400">Recommended Price:</span>
                            <span className={`px-1.5 py-0.25 rounded text-[8px] font-extrabold uppercase ${
                              priceIntelligenceResult.confidence === 'high' ? 'bg-green-950 text-green-400 border border-green-800' :
                              priceIntelligenceResult.confidence === 'medium' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                              'bg-red-950 text-red-400 border border-red-800'
                            }`}>
                              {priceIntelligenceResult.confidence}
                            </span>
                          </div>
                          <span className="text-white font-extrabold text-xl block">
                            ₹{priceIntelligenceResult.recommendation?.recommended_price || priceIntelligenceResult.recommended_price || 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Fallback support or standard reasoning */}
                      {(priceIntelligenceResult.recommendation?.reasoning || priceIntelligenceResult.reasoning) && (
                        <p className="text-[10.5px] text-slate-450 leading-normal italic font-medium pt-3 mt-3 border-t border-slate-900">
                          "{priceIntelligenceResult.recommendation?.reasoning || priceIntelligenceResult.reasoning}"
                        </p>
                      )}

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={handleApplyRecommendedPrice}
                          className="bg-indigo-650 hover:bg-indigo-755 text-white font-bold py-1.5 px-3 rounded text-[11px] transition-colors cursor-pointer"
                        >
                          Use Recommended Price
                        </button>
                        {applyPriceSuccess && (
                          <span className="text-[10px] text-green-400 font-bold self-center animate-pulse">
                            {applyPriceSuccess}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="p-3 bg-amber-950/30 border border-amber-900/60 rounded-lg text-amber-300 text-xs flex items-start gap-2.5">
                      <span className="text-base leading-none">⚠️</span>
                      <div className="space-y-1">
                        <span className="font-bold text-amber-200 block">No comparable products found</span>
                        <p className="text-[11px] text-slate-300 leading-relaxed m-0">
                          {priceIntelligenceResult.warning || "There are no published products in this category yet to analyze market pricing. Please enter your product price manually."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Non-blocking Price Analysis warning/failure */}
            {priceIntelligenceError && (
              <div className="mt-4 bg-amber-950/40 border border-amber-900/60 text-amber-400 p-3 rounded text-xs">
                Market pricing analysis is temporarily unavailable. You can enter your price manually.
              </div>
            )}

            {/* Image Quality Report inside Review Panel if analyze-image completed */}
            {aiResult && (
              <div className="mt-6 pt-5 border-t border-slate-800">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-3">📊 Image Quality Report</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-850">
                  <div>
                    <span className="text-slate-500 font-bold block text-[9px] uppercase">Lighting</span>
                    <span className="font-bold text-slate-200 mt-0.5 block capitalize">{aiResult.lighting}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block text-[9px] uppercase">Background</span>
                    <span className="font-bold text-slate-200 mt-0.5 block capitalize">{aiResult.background}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block text-[9px] uppercase">Blur Status</span>
                    <span className={`font-bold mt-0.5 block ${aiResult.blur_detected ? 'text-red-400' : 'text-green-400'}`}>
                      {aiResult.blur_detected ? 'Blurry' : 'Clear'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block text-[9px] uppercase">Visibility</span>
                    <span className="font-bold text-slate-200 mt-0.5 block capitalize">Good</span>
                  </div>
                </div>
              </div>
            )}

            {/* Pipeline Action Buttons */}
            <div className="mt-6 pt-5 border-t border-slate-800 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAiReview(false);
                  formRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 px-4 rounded-lg text-xs transition-colors border border-slate-700 min-h-[38px] cursor-pointer"
              >
                ✏️ Review & Edit
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={(e) => handleFormSubmit(e, 'draft')}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-colors min-h-[38px] cursor-pointer shadow-md"
              >
                {isSubmitting ? 'Saving...' : '💾 Save Product Draft'}
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={(e) => handleFormSubmit(e, 'published')}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-colors min-h-[38px] cursor-pointer shadow-md"
              >
                {isSubmitting ? 'Publishing...' : '🚀 Publish Product'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Form Left, AI Assistant Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-2">
          <form ref={formRef} onSubmit={handleFormSubmit} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
            {/* Error Notice */}
            {submitError && (
              <div className="bg-red-100 border border-red-400 text-red-900 rounded p-4 text-sm font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>{submitError}</div>
                </div>
                {submitError.includes('verification is required') && (
                  <Link
                    to="/artisan/verification"
                    className="bg-gov-navy hover:bg-gov-navy-light text-white font-semibold text-xs px-3 py-1.5 rounded transition-colors inline-flex items-center min-h-[32px] w-fit shadow-sm"
                  >
                    🛡️ Start Verification
                  </Link>
                )}
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <label htmlFor="prod-name" className="block text-sm font-bold text-slate-700">
                Product Name / Title
              </label>
              <input
                id="prod-name"
                type="text"
                required
                disabled={isSubmitting}
                placeholder="e.g. Handwoven Bamboo Flower Basket"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy disabled:opacity-50"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label htmlFor="prod-category" className="block text-sm font-bold text-slate-700">
                Traditional Craft Category
              </label>
              {loadingCategories ? (
                <div className="text-sm text-slate-500 italic py-2">Loading categories...</div>
              ) : categoriesError ? (
                <div className="text-sm text-red-655 font-semibold py-2">⚠️ {categoriesError}</div>
              ) : (
                <select
                  id="prod-category"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy font-semibold text-slate-800 disabled:opacity-50"
                >
                  <option value="" disabled>-- Select a Category --</option>
                  {categoriesList.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Price */}
            <div className="space-y-1.5">
              <label htmlFor="prod-price" className="block text-sm font-bold text-slate-700">
                Price (INR ₹)
              </label>
              <input
                id="prod-price"
                type="number"
                required
                min="0"
                step="0.01"
                disabled={isSubmitting}
                placeholder="e.g. 450"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setIsPriceManuallyEdited(true);
                }}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy disabled:opacity-50"
              />
            </div>

            {/* Stock Quantity */}
            <div className="space-y-1.5">
              <label htmlFor="prod-stock" className="block text-sm font-bold text-slate-700">
                Stock Quantity
              </label>
              <input
                id="prod-stock"
                type="number"
                required
                min="0"
                step="1"
                disabled={isSubmitting}
                placeholder="e.g. 10"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy disabled:opacity-50"
              />
              {stockQuantity === '' && (
                <p className="text-[11px] text-amber-605 font-bold mt-1">
                  ⚠️ AI did not detect quantity. Please enter the quantity manually.
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label htmlFor="prod-desc" className="block text-sm font-bold text-slate-700">
                Product Description
              </label>
              <textarea
                id="prod-desc"
                rows="4"
                disabled={isSubmitting}
                placeholder="Describe your craft, materials used, size, and care instructions..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy disabled:opacity-50"
              ></textarea>
            </div>



            {/* Image Selector & Preview */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-700">
                Upload Product Photo (Optional)
              </label>
              
              {imagePreviewUrl ? (
                // Image Preview Mode
                <div className="relative border border-slate-200 rounded-lg p-2 bg-slate-50 flex flex-col items-center">
                  <img
                    src={useEnhanced && enhancedImageUrl ? enhancedImageUrl : imagePreviewUrl}
                    alt="Product preview"
                    className="max-h-48 object-contain rounded border border-slate-200"
                  />
                  <div className="mt-3 flex gap-2 w-full">
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={isSubmitting}
                      className="bg-red-50 hover:bg-red-100 text-red-750 text-xs font-bold px-3 py-2 rounded border border-red-200 cursor-pointer flex-grow text-center transition-colors disabled:opacity-50"
                    >
                      ✕ Remove Image
                    </button>
                    <label className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold px-3 py-2 rounded cursor-pointer flex-grow text-center transition-colors disabled:opacity-50 inline-flex items-center justify-center">
                      Change Image
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={isSubmitting}
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                // File Picker Mode
                <label
                  htmlFor="prod-image"
                  className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 cursor-pointer block hover:border-gov-navy transition-colors"
                >
                  <span className="text-2xl" role="img" aria-label="Camera icon">📷</span>
                  <p className="text-xs text-slate-500 mt-2 font-semibold">Click to select product image (JPEG, PNG, WebP)</p>
                  <p className="text-[10px] text-slate-400 mt-1">Maximum file size: 5 MB</p>
                  <input
                    id="prod-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={isSubmitting}
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
              
              {imagePreviewUrl && (
                <div className="mt-4 border border-slate-250 rounded-lg p-4 bg-slate-50 space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl" role="img" aria-label="robot-face">🤖</span>
                      <h4 className="font-bold text-slate-800 text-sm m-0">AI Image Assistant</h4>
                    </div>
                    <button
                      type="button"
                      disabled={isSubmitting || isAnalyzing}
                      onClick={handleAnalyzeImage}
                      className="bg-gov-navy hover:bg-gov-navy-light text-white text-xs font-bold px-3.5 py-1.5 rounded transition-colors disabled:opacity-50 cursor-pointer min-h-[32px] shadow-sm flex items-center gap-1.5"
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Analyzing image...</span>
                        </>
                      ) : (
                        <span>Analyze with AI</span>
                      )}
                    </button>
                  </div>

                  {aiError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 text-xs font-semibold flex items-center justify-between">
                      <span>⚠️ {aiError}</span>
                      <button
                        type="button"
                        disabled={isSubmitting || isAnalyzing}
                        onClick={handleAnalyzeImage}
                        className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-2.5 py-1 rounded transition-all cursor-pointer disabled:opacity-50 ml-3 whitespace-nowrap"
                      >
                        {isAnalyzing ? 'Retrying...' : '🔄 Retry Analysis'}
                      </button>
                    </div>
                  )}

                  {aiResult && (
                    <div className="space-y-4 animate-fade-in border-t border-slate-200 pt-4">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-white border border-slate-200 rounded p-3 flex flex-col justify-between">
                          <span className="text-slate-450 font-bold uppercase tracking-wider text-[10px]">AI Image Quality</span>
                          <span className="text-xl font-black text-gov-navy mt-1">{aiResult.quality_score}/100</span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded p-3 flex flex-col justify-between">
                          <span className="text-slate-450 font-bold uppercase tracking-wider text-[10px]">Blur Status</span>
                          <span className={`text-sm font-bold mt-1 ${aiResult.blur_detected ? 'text-red-655' : 'text-green-600'}`}>
                            {aiResult.blur_detected ? 'Blur Detected' : 'Low / Clear'}
                          </span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded p-3 flex flex-col justify-between">
                          <span className="text-slate-450 font-bold uppercase tracking-wider text-[10px]">Lighting</span>
                          <span className="text-sm font-bold text-slate-800 capitalize mt-1">{aiResult.lighting}</span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded p-3 flex flex-col justify-between">
                          <span className="text-slate-450 font-bold uppercase tracking-wider text-[10px]">Background</span>
                          <span className="text-sm font-bold text-slate-800 capitalize mt-1">{aiResult.background}</span>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded p-3 space-y-2">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recommendations</div>
                        <ul className="text-xs text-slate-655 space-y-1.5 pl-4 list-disc">
                          {aiResult.recommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  {/* AI Image Enhancement Section */}
                  {aiResult && (
                    <div className="mt-4 border border-slate-250 rounded-lg p-4 bg-slate-50 space-y-4 animate-fade-in">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">✨</span>
                        <h4 className="font-bold text-slate-800 text-sm m-0">AI Image Enhancement</h4>
                      </div>

                      {!enhancedImageUrl ? (
                        <div className="space-y-3">
                          <p className="text-xs text-slate-550 leading-relaxed">
                            Improves product presentation (brightness, contrast, and color vibrancy) before publishing to customers.
                          </p>
                          <button
                            type="button"
                            disabled={isSubmitting || isAnalyzing || isEnhancing}
                            onClick={handleEnhanceImage}
                            className="bg-gov-navy hover:bg-gov-navy-light text-white text-xs font-bold px-3.5 py-1.5 rounded transition-colors disabled:opacity-50 cursor-pointer min-h-[32px] shadow-sm flex items-center gap-1.5"
                          >
                            {isEnhancing ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Enhancing image...</span>
                              </>
                            ) : (
                              <span>Enhance Image with AI</span>
                            )}
                          </button>
                        </div>
                      ) : (
                        // Before/After comparison
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5 text-center">
                              <span className="text-[10px] uppercase font-bold text-slate-400">Original</span>
                              <div className="border border-slate-200 rounded p-1 bg-white flex items-center justify-center min-h-[120px]">
                                <img
                                  src={imagePreviewUrl}
                                  alt="Original"
                                  className="max-h-28 object-contain rounded"
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5 text-center">
                              <span className="text-[10px] uppercase font-bold text-gov-navy flex items-center justify-center gap-1">
                                <span>✨ Enhanced</span>
                                {useEnhanced && <span className="text-green-600 font-extrabold">(Selected)</span>}
                              </span>
                              <div className="border-2 border-gov-navy rounded p-1 bg-white flex items-center justify-center min-h-[120px]">
                                <img
                                  src={enhancedImageUrl}
                                  alt="AI Enhanced"
                                  className="max-h-28 object-contain rounded"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2 border-t border-slate-200">
                            <button
                              type="button"
                              onClick={() => setUseEnhanced(true)}
                              className={`text-xs font-bold py-2 px-3 rounded flex-grow text-center min-h-[34px] cursor-pointer shadow-sm transition-all ${
                                useEnhanced
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-white hover:bg-slate-50 border border-slate-300 text-slate-700'
                              }`}
                            >
                              Use Enhanced Image
                            </button>
                            <button
                              type="button"
                              onClick={() => setUseEnhanced(false)}
                              className={`text-xs font-bold py-2 px-3 rounded flex-grow text-center min-h-[34px] cursor-pointer transition-all ${
                                !useEnhanced
                                  ? 'bg-slate-700 text-white hover:bg-slate-800'
                                  : 'bg-white hover:bg-slate-50 border border-slate-300 text-slate-700'
                              }`}
                            >
                              Keep Original
                            </button>
                          </div>
                        </div>
                      )}

                      {enhanceError && (
                        <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 text-xs font-semibold">
                          ⚠️ {enhanceError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" variant="primary" className="font-bold flex-grow" disabled={isSubmitting || loadingCategories}>
                {isSubmitting ? 'Saving & Uploading...' : 'Save Product Draft'}
              </Button>
              <Link to="/artisan/products" className="flex-grow">
                <Button variant="outline" className="w-full font-bold" disabled={isSubmitting}>
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </div>

        {/* AI Assistant Column */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xl" role="img" aria-label="Robot face">🤖</span>
              <h3 className="font-bold text-gov-navy m-0 text-base">AI Assistant Status</h3>
            </div>
            <p className="text-xs text-slate-550 leading-relaxed">
              Combine your product photo and spoken voice description to generate marketplace-ready details.
            </p>

            <div className="space-y-2 text-xs border border-slate-100 rounded-lg p-3 bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">📷 Product Photo:</span>
                <span className={`font-bold ${imageFile || imagePreviewUrl ? 'text-green-600' : 'text-slate-400'}`}>
                  {imageFile || imagePreviewUrl ? '✓ Attached' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">🎙️ Voice Description:</span>
                <span className={`font-bold ${voiceTranscript || description.trim() ? 'text-green-600' : 'text-slate-400'}`}>
                  {voiceTranscript ? '✓ Transcribed' : description.trim() ? '✓ Entered' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">✨ AI Listing:</span>
                <span className={`font-bold ${generatedProductResult ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {generatedProductResult ? '✓ Ready' : 'Pending'}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={!isAiCreatorEnabled || isSubmitting || isAnalyzing || isEnhancing || isGeneratingProduct || isPipelineRunning}
              onClick={runOrchestratedPipeline}
              className="w-full bg-gov-navy hover:bg-gov-navy-light text-white text-xs font-bold py-2.5 px-4 rounded transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[38px]"
            >
              {isPipelineRunning || isGeneratingProduct ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>✨ Generating with AI...</span>
                </>
              ) : generatedProductResult ? (
                <span>🔄 Regenerate with AI</span>
              ) : (
                <span>✨ Create Product with AI</span>
              )}
            </button>

            {!isAiCreatorEnabled && (
              <p className="text-[10px] text-amber-600 font-semibold text-center mt-1">
                ⚠️ Upload an image or record voice to generate listing.
              </p>
            )}

            {generateProductError && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 text-xs font-semibold">
                ⚠️ {generateProductError}
              </div>
            )}

            {applyDetailsSuccess && (
              <p className="text-[11px] text-green-700 font-bold text-center mt-1 animate-fade-in">
                ✓ {applyDetailsSuccess}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
