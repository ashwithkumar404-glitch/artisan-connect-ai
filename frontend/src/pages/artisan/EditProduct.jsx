import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Button from '../../components/Button';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js';

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`;
};

const safeInvokeAI = async (functionName, options) => {
  const { data, error } = await supabase.functions.invoke(functionName, options);
  
  if (error) {
    console.error(`Edge Function ${functionName} returned error:`, error);
    let errorMsg = error.message || 'AI service failed. Please try again.';
    
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        console.error(`Edge Function ${functionName} HTTP error body:`, body);
        if (body && (body.code === 'AI_QUOTA_EXHAUSTED' || body.error === 'AI_QUOTA_EXHAUSTED' || body.message === 'AI_QUOTA_EXHAUSTED')) {
          errorMsg = 'AI_QUOTA_EXHAUSTED';
        } else if (body && body.error) {
          errorMsg = body.error;
        } else if (body && body.message) {
          errorMsg = body.message;
        }
      } catch (_) {
        try {
          const text = await error.context.text();
          console.error(`Edge Function ${functionName} HTTP error text:`, text);
          if (text && text.includes('AI_QUOTA_EXHAUSTED')) {
            errorMsg = 'AI_QUOTA_EXHAUSTED';
          } else {
            errorMsg = text || errorMsg;
          }
        } catch (__) {}
      }
    }
    
    if (errorMsg === 'AI_QUOTA_EXHAUSTED' || errorMsg.includes('AI_QUOTA_EXHAUSTED')) {
      throw new Error('🤖 AI service is temporarily busy. Please try again shortly.');
    }
    throw new Error(errorMsg);
  }
  
  if (data && (data.error === 'AI_QUOTA_EXHAUSTED' || data.code === 'AI_QUOTA_EXHAUSTED')) {
    throw new Error('🤖 AI service is temporarily busy. Please try again shortly.');
  }
  
  return { data, error: null };
};

export default function EditProduct() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');

  // Image management states
  const [existingImageUrl, setExistingImageUrl] = useState('');
  const [originalImageUrl, setOriginalImageUrl] = useState(''); // Keep track to delete from storage if replaced
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  // AI analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');

  // AI enhancement states
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedImageUrl, setEnhancedImageUrl] = useState('');
  const [useEnhanced, setUseEnhanced] = useState(false);
  const [enhanceError, setEnhanceError] = useState('');

  // AI voice transcription states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeResult, setTranscribeResult] = useState(null);
  const [transcribeError, setTranscribeError] = useState('');
  const [transcribeSuccess, setTranscribeSuccess] = useState('');

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
  const priceInputRef = useRef(null);

  const [categoriesList, setCategoriesList] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [productError, setProductError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Cleanup object URLs to prevent memory leaks
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
    };
  }, [imagePreviewUrl, audioUrl]);

  // Load categories and product details
  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!user) return;

      try {
        setLoadingCategories(true);
        setLoadingProduct(true);
        setProductError('');
        setCategoriesError('');

        // 1. Fetch categories
        const { data: cats, error: catError } = await supabase
          .from('categories')
          .select('id, name')
          .order('name', { ascending: true });

        if (catError) throw catError;

        if (active) {
          setCategoriesList(cats || []);
        }

        // 2. Fetch corresponding artisan record
        const { data: artisan, error: artisanError } = await supabase
          .from('artisans')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (artisanError) throw artisanError;

        if (!artisan) {
          throw new Error('No artisan profile found. You must be registered as an artisan to edit products.');
        }

        // 3. Fetch product details
        const { data: product, error: productError } = await supabase
          .from('products')
          .select(`
            id,
            artisan_id,
            category_id,
            name,
            description,
            price,
            stock_quantity,
            product_images (
              image_url
            )
          `)
          .eq('id', id)
          .single();

        if (productError) throw productError;

        if (product.artisan_id !== artisan.id) {
          throw new Error('Access Denied. You do not have permission to edit this product.');
        }

        // 4. Pre-populate form fields
        if (active) {
          setName(product.name || '');
          setSelectedCategoryId(product.category_id || '');
          setPrice(product.price ? String(product.price) : '');
          setDescription(product.description || '');
          setStockQuantity(product.stock_quantity ? String(product.stock_quantity) : '0');

          const imageRecs = product.product_images || [];
          if (imageRecs.length > 0) {
            setExistingImageUrl(imageRecs[0].image_url);
            setOriginalImageUrl(imageRecs[0].image_url);
          }
        }
      } catch (err) {
        console.error('Error fetching product for editing:', err);
        if (active) {
          setProductError(err.message || 'Failed to load product details.');
        }
      } finally {
        if (active) {
          setLoadingCategories(false);
          setLoadingProduct(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [id, user]);

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
    setExistingImageUrl(''); // Mark existing image as deleted
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
    console.log("Image source:", imageFile ? "Local File Upload" : "Remote Storage URL");
    console.log("Image MIME type:", imageFile ? imageFile.type : 'existing-image');
    if (imageFile) {
      console.log("Image file size (approx):", Math.round(imageFile.size / 1024) + " KB");
    }

    try {
      let base64Data = '';
      let mimeType = 'image/jpeg';

      if (imageFile) {
        // Convert newly selected local image file
        const resBase64 = await getBase64(imageFile);
        base64Data = resBase64.split(',')[1];
        mimeType = imageFile.type;
      } else if (existingImageUrl) {
        // Fetch and convert existing image from storage URL
        console.log("Fetching remote image from URL:", existingImageUrl);
        const res = await fetch(existingImageUrl);
        if (!res.ok) {
          throw new Error(`Failed to retrieve image: ${res.statusText}`);
        }
        const blob = await res.blob();
        mimeType = blob.type || 'image/jpeg';
        const resBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = (e) => reject(new Error('Failed to read image blob: ' + e.message));
        });
        base64Data = resBase64.split(',')[1];
      } else {
        throw new Error('Please select or upload a product image first.');
      }

      console.log("Invoking Edge Function 'analyze-image' with base64 size:", Math.round(base64Data.length / 1024) + " KB");

      // Call Supabase Edge Function using helper
      const { data } = await safeInvokeAI('analyze-image', {
        body: {
          image: base64Data,
          mimeType
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
      let base64Data = '';
      let mimeType = 'image/jpeg';

      if (imageFile) {
        // Convert local file to base64
        const resBase64 = await getBase64(imageFile);
        base64Data = resBase64.split(',')[1];
        mimeType = imageFile.type;
      } else if (existingImageUrl) {
        // Convert remote file from storage URL
        console.log("Fetching remote image from URL:", existingImageUrl);
        const res = await fetch(existingImageUrl);
        if (!res.ok) throw new Error('Failed to retrieve product image.');
        const blob = await res.blob();
        mimeType = blob.type || 'image/jpeg';
        const resBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = (e) => reject(new Error('Failed to parse image file: ' + e.message));
        });
        base64Data = resBase64.split(',')[1];
      } else {
        throw new Error('Please select a product image first.');
      }

      console.log("Invoking Edge Function 'enhance-image'...");
      const { data, error } = await supabase.functions.invoke('enhance-image', {
        body: {
          image: base64Data,
          mimeType
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

  const startRecording = async () => {
    setTranscribeError('');
    setTranscribeResult(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl('');
    }
    setAudioBlob(null);
    audioChunksRef.current = [];

    try {
      console.log("Requesting microphone permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      console.log("Beginning audio recording...");
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        console.log("Voice recording captured successfully. Blob type:", blob.type, "Size:", blob.size);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);

      // Start elapsed timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 59) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.error('Error requesting microphone permissions:', err);
      setTranscribeError('Could not access microphone. Please enable microphone permissions in your browser.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    console.log("Recording stopped.");
  };

  const performVoiceTranscription = async () => {
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Voice message is empty. Please record again.');
    }

    if (recordingTime > 60) {
      throw new Error('Voice message exceeds 60 seconds limit.');
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
    console.log("--- Voice Recording Diagnostics ---");
    console.log("Audio MIME type:", mimeType);
    console.log("Audio blob size:", audioBlob.size, "bytes");
    console.log("Base64 data length:", base64Data.length, "characters");
    console.log("-----------------------------------");

    console.log(`Invoking Edge Function 'transcribe-voice' with MIME: ${mimeType}`);

    const { data } = await safeInvokeAI('transcribe-voice', {
      body: {
        audio: base64Data,
        mimeType
      }
    });

    console.log("Transcription response received:", data);
    
    if (!data || !data.transcript) {
      throw new Error('Malformed translation response received from AI model.');
    }

    setTranscribeResult(data);
    return data;
  };

  const handleSendVoiceToAI = async () => {
    setTranscribeError('');
    setTranscribeResult(null);
    setIsTranscribing(true);

    try {
      await performVoiceTranscription();
    } catch (err) {
      console.error('AI Transcription error:', err);
      setTranscribeError(`Voice processing failed: ${err.message || 'Please try again.'}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleUseVoiceDescription = () => {
    if (transcribeResult && transcribeResult.english_translation) {
      setDescription(transcribeResult.english_translation);
      setTranscribeSuccess('English description added.');
      setTimeout(() => setTranscribeSuccess(''), 3000);
      console.log("Description updated from English translation.");
    }
  };

  const executePriceIntelligence = async (productName, category, description, quantity, currentPrice, similarProducts) => {
    if (isAnalyzingPrice) return;
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
          currentPrice: parseFloat(currentPrice) || null,
          similarProducts: validSimilar
        }
      });

      console.log("price-intelligence result:", data);
      setPriceIntelligenceResult(data);
    } catch (err) {
      console.error("AI Price Intelligence Error:", err);
      setPriceIntelligenceError("Price intelligence analysis failed: " + err.message);
    } finally {
      setIsAnalyzingPrice(false);
    }
  };

  const handleExplicitPriceAnalysis = async () => {
    if (isAnalyzingPrice) return; // Prevent duplicate requests
    setPriceIntelligenceError('');
    setPriceIntelligenceResult(null);

    if (!selectedCategoryId) {
      setPriceIntelligenceError('Please select a traditional craft category first.');
      return;
    }

    setIsAnalyzingPrice(true);

    try {
      const categoryObj = categoriesList.find(c => c.id === selectedCategoryId);
      const categoryName = categoryObj ? categoryObj.name : '';

      console.log("Explicit price analysis: fetching similar products for category ID:", selectedCategoryId, "excluding product ID:", id);
      const { data: similarList, error: similarErr } = await supabase
        .from('products')
        .select('id, name, description, price')
        .eq('category_id', selectedCategoryId)
        .eq('status', 'published')
        .neq('id', id); // EXCLUDE CURRENT PRODUCT BEING EDITED

      if (similarErr) {
        console.error("Error fetching similar products:", similarErr);
        throw new Error("Price intelligence analysis failed. Please try again.");
      }

      await executePriceIntelligence(
        name,
        categoryName,
        description,
        stockQuantity,
        price,
        similarList || []
      );
    } catch (err) {
      console.error("Explicit price analysis error:", err);
      setPriceIntelligenceError(err.message || "Price intelligence analysis failed. Please try again.");
      setIsAnalyzingPrice(false);
    }
  };

  const handleGenerateProduct = async () => {
    setGenerateProductError('');
    setGeneratedProductResult(null);
    setPriceIntelligenceResult(null);
    setPriceIntelligenceError('');
    setApplyDetailsSuccess('');
    setIsGeneratingProduct(true);

    try {
      // 1. If voice recording exists and has not been transcribed yet, transcribe it first
      let activeVoiceTranscript = transcribeResult?.english_translation || null;
      if (audioBlob && !transcribeResult) {
        setIsTranscribing(true);
        try {
          const transcribeData = await performVoiceTranscription();
          if (transcribeData && transcribeData.english_translation) {
            activeVoiceTranscript = transcribeData.english_translation;
          }
        } catch (transcribeErr) {
          console.error("Auto-transcription failed:", transcribeErr);
          throw new Error('Failed to transcribe voice recording. ' + transcribeErr.message);
        } finally {
          setIsTranscribing(false);
        }
      }

      let base64Image = null;
      let mimeType = null;

      // 2. Determine active image to send (if any)
      if (useEnhanced && enhancedImageUrl) {
        base64Image = enhancedImageUrl.split(',')[1];
        mimeType = 'image/jpeg';
      } else if (imageFile) {
        const resBase64 = await getBase64(imageFile);
        base64Image = resBase64.split(',')[1];
        mimeType = imageFile.type;
      } else if (existingImageUrl) {
        console.log("Fetching remote image for AI Creator:", existingImageUrl);
        const res = await fetch(existingImageUrl);
        if (!res.ok) throw new Error('Failed to retrieve product image.');
        const blob = await res.blob();
        mimeType = blob.type || 'image/jpeg';
        const resBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = (e) => reject(new Error('Failed to parse image file: ' + e.message));
        });
        base64Image = resBase64.split(',')[1];
      }

      // 3. Determine description
      const manualDesc = description || null;

      if (!base64Image && !activeVoiceTranscript && !manualDesc) {
        throw new Error('Please select/upload an image, record a voice description, or enter a description first.');
      }

      console.log("Invoking Edge Function 'generate-product'...");
      const { data } = await safeInvokeAI('generate-product', {
        body: {
          image: base64Image,
          mimeType,
          voiceTranscript: activeVoiceTranscript,
          description: manualDesc
        }
      });

      console.log("Product metadata generation response:", data);
      
      if (!data || !data.product_name) {
        throw new Error('Malformed metadata response received from AI model.');
      }

      setGeneratedProductResult(data);

      // Auto-populate the actual form fields immediately after successful generation
      if (data.product_name) {
        setName(data.product_name);
      }

      let matchedCategoryId = null;
      let categoryName = data.category || '';
      if (data.category && categoriesList.length > 0) {
        const foundCategory = categoriesList.find(
          cat => cat.name.toLowerCase() === data.category.toLowerCase()
        );
        if (foundCategory) {
          matchedCategoryId = foundCategory.id;
          setSelectedCategoryId(foundCategory.id);
        } else {
          console.warn(`Generated category "${data.category}" not found in current marketplace list.`);
        }
      }

      if (data.description) {
        setDescription(data.description);
      }

      let activePrice = price;
      if (data.price_suggestion) {
        if (!isPriceManuallyEdited) {
          const { min, max } = data.price_suggestion;
          const midPrice = Math.round((min + max) / 2);
          setPrice(midPrice.toString());
          activePrice = midPrice.toString();
        }
      }

      if (data.quantity !== undefined && data.quantity !== null) {
        setStockQuantity(data.quantity.toString());
      } else {
        setStockQuantity(''); // If quantity is not mentioned, keep it empty/blank for manual input
      }

      setApplyDetailsSuccess('Form fields populated successfully. Feel free to review and adjust.');
      setTimeout(() => setApplyDetailsSuccess(''), 5000);

      // Fetch similar published products and run price intelligence automatically
      // Exclude current product by ID (id)
      const finalCategoryId = matchedCategoryId || selectedCategoryId;
      if (finalCategoryId) {
        try {
          console.log("Fetching similar published products for category ID:", finalCategoryId, "excluding product ID:", id);
          const { data: similarList, error: similarErr } = await supabase
            .from('products')
            .select('id, name, description, price')
            .eq('category_id', finalCategoryId)
            .eq('status', 'published')
            .neq('id', id); // EXCLUDE CURRENT PRODUCT BEING EDITED

          if (similarErr) {
            console.error("Error fetching similar products:", similarErr);
            setPriceIntelligenceError("Price intelligence analysis failed. Please try again.");
          } else {
            await executePriceIntelligence(
              data.product_name,
              categoryName,
              data.description,
              data.quantity,
              activePrice,
              similarList || []
            );
          }
        } catch (priceIntelErr) {
          console.error("Price Intelligence pipeline failed:", priceIntelErr);
          setPriceIntelligenceError("Price intelligence analysis failed. Please try again.");
        }
      }

    } catch (err) {
      console.error('AI Product Generator error:', err);
      setGenerateProductError(err.message || 'AI product generation failed. Please try again.');
    } finally {
      setIsGeneratingProduct(false);
    }
  };

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
      image: (imageFile || existingImageUrl) ? 'success' : 'skipped',
      voice: 'pending',
      generation: 'pending',
      pricing: 'pending'
    };
    setPipelineProgress({ ...progress });
    setPipelineStep('image');
    
    // Tiny delay for UI feel
    await new Promise(r => setTimeout(r, 600));

    let activeDescription = description || '';

    // STEP 2: Voice transcription
    if (audioBlob && !transcribeResult) {
      setPipelineStep('voice');
      progress.voice = 'running';
      setPipelineProgress({ ...progress });
      try {
        const transcribeData = await performVoiceTranscription();
        progress.voice = 'success';
        setPipelineProgress({ ...progress });
        const voiceText = transcribeData.english_translation || '';
        if (voiceText) {
          activeDescription = description.trim() 
            ? `${description.trim()}\n\n${voiceText}`
            : voiceText;
          setDescription(activeDescription);
        }
      } catch (err) {
        console.error("Pipeline Voice Transcription Error:", err);
        progress.voice = 'error';
        setPipelineProgress({ ...progress });
        if (!description.trim()) {
          setPipelineError(`Voice processing failed: ${err.message || 'Please try again.'}`);
          setIsPipelineRunning(false);
          return;
        }
      }
    } else {
      progress.voice = audioBlob ? 'success' : 'skipped';
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
    } else if (existingImageUrl) {
      try {
        console.log("Fetching existing image for pipeline...");
        const res = await fetch(existingImageUrl);
        if (res.ok) {
          const blob = await res.blob();
          mimeType = blob.type || 'image/jpeg';
          const resBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = (e) => reject(new Error('Failed to read image: ' + e.message));
          });
          base64Image = resBase64.split(',')[1];
        }
      } catch (err) {
        console.error("Failed to fetch remote image:", err);
      }
    }

    let generatedData = null;
    try {
      console.log("Invoking generate-product from orchestrator...");
      const { data } = await safeInvokeAI('generate-product', {
        body: {
          image: base64Image,
          mimeType,
          voiceTranscript: transcribeResult?.english_translation || null,
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
      
      let activePrice = price;
      if (data.price_suggestion) {
        if (!isPriceManuallyEdited) {
          const { min, max } = data.price_suggestion;
          const midPrice = Math.round((min + max) / 2);
          setPrice(midPrice.toString());
          activePrice = midPrice.toString();
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
      if (imageFile || existingImageUrl) {
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
        console.log("Fetching similar products for pricing comparison excluding ID:", id);
        const { data: similarList, error: similarErr } = await supabase
          .from('products')
          .select('id, name, description, price')
          .eq('category_id', finalCategoryId)
          .eq('status', 'published')
          .neq('id', id);

        if (similarErr) throw similarErr;
        
        await executePriceIntelligence(
          data.product_name,
          categoryName,
          data.description,
          data.quantity,
          activePrice,
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

  const handleApplyAiDetails = () => {
    if (!generatedProductResult) return;

    if (generatedProductResult.product_name) {
      setName(generatedProductResult.product_name);
    }

    if (generatedProductResult.category && categoriesList.length > 0) {
      const foundCategory = categoriesList.find(
        cat => cat.name.toLowerCase() === generatedProductResult.category.toLowerCase()
      );
      if (foundCategory) {
        setSelectedCategoryId(foundCategory.id);
      }
    }

    if (generatedProductResult.description) {
      setDescription(generatedProductResult.description);
    }

    if (generatedProductResult.price_suggestion) {
      if (!isPriceManuallyEdited) {
        const { min, max } = generatedProductResult.price_suggestion;
        const midPrice = Math.round((min + max) / 2);
        setPrice(midPrice.toString());
      }
    }

    if (generatedProductResult.quantity !== undefined && generatedProductResult.quantity !== null) {
      setStockQuantity(generatedProductResult.quantity.toString());
    } else {
      setStockQuantity('');
    }

    setApplyDetailsSuccess('AI-generated details have been re-applied. You can edit them.');
    setTimeout(() => setApplyDetailsSuccess(''), 5000);
    console.log("AI details successfully applied to the form fields.");
  };

  const handleApplyRecommendedPrice = () => {
    let recommended = null;
    if (priceIntelligenceResult) {
      if (priceIntelligenceResult.recommendation?.recommended_price !== undefined && priceIntelligenceResult.recommendation?.recommended_price !== null) {
        recommended = priceIntelligenceResult.recommendation.recommended_price;
      } else if (priceIntelligenceResult.recommended_price !== undefined && priceIntelligenceResult.recommended_price !== null) {
        recommended = priceIntelligenceResult.recommended_price;
      }
    }

    const parsed = parseFloat(recommended);
    if (!isNaN(parsed) && parsed > 0) {
      setPrice(String(parsed));
      setIsPriceManuallyEdited(true);
      setPriceIntelligenceError('');
      setApplyPriceSuccess('Suggested price applied.');
      setTimeout(() => setApplyPriceSuccess(''), 3000);
    } else {
      setPriceIntelligenceError('Suggested price is null or invalid. Cannot apply.');
    }
  };

  const handleUseSuggestedPrice = () => {
    if (!generatedProductResult || !generatedProductResult.price_suggestion) return;
    const { min, max } = generatedProductResult.price_suggestion;
    const midPrice = Math.round((min + max) / 2);
    setPrice(midPrice.toString());
    console.log(`Suggested price set to midpoint: ₹${midPrice}`);
  };

  const handleFormSubmit = async (e, publishStatus = null) => {
    if (e && e.preventDefault) e.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);

    try {
      // 1. Client-side Validation
      if (!name.trim()) {
        throw new Error('Product name is required.');
      }
      if (!selectedCategoryId) {
        throw new Error('Product category is required.');
      }
      
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        throw new Error('Price must be a valid positive number.');
      }

      const parsedStock = parseInt(stockQuantity, 10);
      if (isNaN(parsedStock) || parsedStock < 0 || !Number.isInteger(parsedStock)) {
        throw new Error('Stock quantity must be a non-negative integer.');
      }

      // Verify artisan profile
      const { data: artisan, error: artisanError } = await supabase
        .from('artisans')
        .select('id, verification_status')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (artisanError) throw artisanError;
      if (!artisan) {
        throw new Error('No artisan profile found. You must be registered as an artisan to save changes.');
      }

      const finalStatus = publishStatus || status;
      if (finalStatus === 'published' && artisan.verification_status !== 'approved') {
        throw new Error('⚠️ Verification Required\nYour artisan account must be verified before you can publish products.');
      }

      // 2. Update product row in public.products
      const updateData = {
        category_id: selectedCategoryId,
        name: name.trim(),
        description: description.trim() || null,
        price: parsedPrice,
        stock_quantity: parsedStock
      };
      if (publishStatus) {
        updateData.status = publishStatus;
      }

      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .eq('artisan_id', artisan.id);

      if (updateError) throw updateError;

      // 3. Handle image adjustments
      if (imageFile || (useEnhanced && enhancedImageUrl)) {
        // A new file was selected to replace/add or enhance
        let fileToUpload = imageFile;
        if (useEnhanced && enhancedImageUrl) {
          const mimeType = 'image/jpeg';
          const base64Data = enhancedImageUrl.split(',')[1];
          const blob = base64ToBlob(base64Data, mimeType);
          fileToUpload = new File([blob], imageFile ? imageFile.name : 'enhanced_product.jpg', { type: mimeType });
        }

        const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
        const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
        const storagePath = `${artisan.id}/${id}/${uniqueFileName}`;
        
        // A. Upload new file to Storage
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(storagePath, fileToUpload);

        if (uploadError) {
          throw new Error(`Product details saved, but failed to upload new image: ${uploadError.message}`);
        }

        // B. Get public URL of new image
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(storagePath);
        
        const publicUrl = urlData.publicUrl;

        // C. Update database product_images record
        if (originalImageUrl) {
          // Update the existing row
          const { error: imgDbError } = await supabase
            .from('product_images')
            .update({ image_url: publicUrl })
            .eq('product_id', id);

          if (imgDbError) {
            // Cleanup uploaded file to avoid orphans
            await supabase.storage.from('product-images').remove([storagePath]);
            throw new Error(`Product details saved, but failed to update image database details: ${imgDbError.message}`);
          }

          // D. Delete the old file from Storage
          if (originalImageUrl.includes('/public/product-images/')) {
            const oldPath = originalImageUrl.split('/public/product-images/')[1];
            if (oldPath) {
              await supabase.storage.from('product-images').remove([oldPath]);
            }
          }
        } else {
          // Insert a new row
          const { error: imgDbError } = await supabase
            .from('product_images')
            .insert({
              product_id: id,
              image_url: publicUrl,
              display_order: 0
            });

          if (imgDbError) {
            await supabase.storage.from('product-images').remove([storagePath]);
            throw new Error(`Product details saved, but failed to insert image database details: ${imgDbError.message}`);
          }
        }
      } else if (!existingImageUrl && originalImageUrl) {
        // The user explicitly removed the existing image
        // A. Delete database image record
        const { error: imgDbError } = await supabase
          .from('product_images')
          .delete()
          .eq('product_id', id);

        if (imgDbError) throw imgDbError;

        // B. Remove old file from Storage
        if (originalImageUrl.includes('/public/product-images/')) {
          const oldPath = originalImageUrl.split('/public/product-images/')[1];
          if (oldPath) {
            await supabase.storage.from('product-images').remove([oldPath]);
          }
        }
      }

      // Redirect to catalog on success
      navigate('/artisan/products', {
        state: { successMessage: 'Product updated successfully!' }
      });
    } catch (err) {
      console.error('Error updating product:', err);
      setSubmitError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingProduct) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500">Loading product details for editing...</p>
      </div>
    );
  }

  if (productError) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto shadow-inner text-red-655 font-bold text-3xl">
          ⚠️
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-800">Cannot Edit Product</h2>
          <p className="text-slate-550 text-sm leading-relaxed">{productError}</p>
        </div>
        <div className="pt-4">
          <Link to="/artisan/products">
            <button className="bg-gov-navy hover:bg-gov-navy-light text-white text-sm font-bold px-5 py-2.5 rounded transition-colors cursor-pointer min-h-[40px] shadow-sm">
              ← Return to Catalog
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const isAiCreatorEnabled = !!imageFile || !!existingImageUrl || !!audioBlob || !!(transcribeResult?.english_translation) || !!description.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gov-navy m-0">Edit Product</h2>
          <p className="text-sm text-slate-500 mt-1">Modify your catalog listing details.</p>
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
            <p className="text-xs text-slate-500 mt-1 font-medium font-bold">Upload a product photo and describe your product. AI will prepare your marketplace listing.</p>
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

            {imagePreviewUrl || existingImageUrl ? (
              <div className="relative border border-slate-200 rounded-lg p-2 bg-slate-50 flex flex-col items-center">
                <img
                  src={useEnhanced && enhancedImageUrl ? enhancedImageUrl : (imagePreviewUrl || existingImageUrl)}
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
                  <label className="bg-white hover:bg-slate-50 border border-slate-350 text-slate-705 text-xs font-bold px-3 py-1.5 rounded cursor-pointer flex-grow text-center transition-colors inline-flex items-center justify-center">
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
              <label className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-55 cursor-pointer block hover:border-gov-navy transition-colors">
                <span className="text-2xl" role="img" aria-label="Camera icon">📷</span>
                <p className="text-xs text-slate-555 mt-2 font-bold">Select Product Image</p>
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

          {/* Product Description */}
          <div className="bg-white/60 backdrop-blur-xs border border-slate-200/80 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎙️</span>
                <span className="font-bold text-slate-805 text-sm">Describe Your Product</span>
              </div>
              
              {audioUrl && !isRecording && (
                <span className="bg-indigo-100 text-indigo-805 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Audio Ready
                </span>
              )}
            </div>

            <textarea
              rows="3"
              placeholder="Describe your craft, materials used, size, and care instructions, or record your voice below..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-350 rounded-lg text-xs focus:ring-2 focus:ring-gov-navy focus:border-gov-navy bg-white"
            ></textarea>

            {/* Voice record controls */}
            <div className="border-t border-slate-100 pt-3">
              {isRecording ? (
                <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 text-red-655 font-bold text-xs animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-red-600"></span>
                    <span>🔴 Recording... {formatTime(recordingTime)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1 min-h-[32px] shadow-sm"
                  >
                    <span>⏹️</span> Stop Recording
                  </button>
                </div>
              ) : audioUrl ? (
                <div className="flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold">
                    <span>🎙️</span> Audio Ready
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <audio src={audioUrl} controls className="w-full h-8" />
                    <button
                      type="button"
                      onClick={startRecording}
                      className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-bold px-2.5 py-1.5 rounded transition-all cursor-pointer whitespace-nowrap min-h-[30px]"
                    >
                      🔄 Record Again
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
                >
                  <span>🎙️</span>
                  <span>Record Voice Description</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline state display / error / trigger */}
        <div className="flex flex-col items-center border-t border-slate-150 pt-5">
          {isPipelineRunning && (
            <div className="w-full max-w-lg mb-5 bg-white border border-indigo-100 rounded-xl p-4 shadow-sm space-y-3.5 text-xs text-slate-750">
              <div className="flex items-center gap-2 text-indigo-705 font-bold">
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
              disabled={!imagePreviewUrl && !existingImageUrl && !description.trim() && !audioBlob}
              onClick={runOrchestratedPipeline}
              className="w-full md:w-72 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md hover:shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <span>✨</span>
              <span>Create Product with AI</span>
            </button>
          )}

          {!isPipelineRunning && !showAiReview && !imagePreviewUrl && !existingImageUrl && !description.trim() && !audioBlob && (
            <span className="text-[10px] text-amber-600 font-semibold mt-2.5">
              ⚠️ Please select an image or add description details to begin AI Creation.
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
                'bg-red-950/80 text-red-400 border border-red-855'
              }`}>
                {generatedProductResult.confidence} Confidence
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Image Review & Optional Enhancer */}
              <div className="md:col-span-1 space-y-4">
                <span className="text-slate-405 font-bold uppercase tracking-wider text-[9px] block">Product Image</span>
                
                <div className="border border-slate-855 rounded-xl p-2 bg-slate-950 flex items-center justify-center min-h-[160px]">
                  <img
                    src={useEnhanced && enhancedImageUrl ? enhancedImageUrl : (imagePreviewUrl || existingImageUrl)}
                    alt="Final product"
                    className="max-h-40 object-contain rounded"
                  />
                </div>

                {/* Quality Score Badge */}
                {aiResult && (
                  <div className="bg-slate-955 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-slate-405 font-bold text-[10px] uppercase">Image Quality:</span>
                    <span className={`font-black text-sm ${aiResult.quality_score >= 80 ? 'text-green-400' : aiResult.quality_score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                      {aiResult.quality_score}/100
                    </span>
                  </div>
                )}

                {/* Non-blocking Quality analysis failure */}
                {aiError && (
                  <div className="bg-amber-950/40 border border-amber-900/60 text-amber-400 p-2.5 rounded text-[11px] leading-relaxed">
                    Image quality analysis is temporarily unavailable.
                  </div>
                )}

                {/* Optional Image Enhancement Button inside Review Panel */}
                {(imageFile || existingImageUrl) && !enhancedImageUrl && (
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
                  <div className="border border-slate-800 p-3 bg-slate-955 rounded-lg space-y-2">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">✨ AI Enhancement Ready</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setUseEnhanced(true)}
                        className={`text-[10px] font-bold py-1.5 px-2.5 rounded-md flex-1 text-center cursor-pointer transition-all ${
                          useEnhanced ? 'bg-green-600 text-white font-extrabold' : 'bg-slate-855 text-slate-350 border border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        Use Enhanced
                      </button>
                      <button
                        type="button"
                        onClick={() => setUseEnhanced(false)}
                        className={`text-[10px] font-bold py-1.5 px-2.5 rounded-md flex-1 text-center cursor-pointer transition-all ${
                          !useEnhanced ? 'bg-slate-805 text-white' : 'bg-slate-850 text-slate-350 border border-slate-800 hover:bg-slate-805'
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
                      className="w-full bg-slate-955 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white mt-1.5 font-bold focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <span className="text-slate-450 font-bold uppercase tracking-wider text-[9px] block">Traditional Category</span>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 mt-1.5 font-semibold focus:ring-1 focus:ring-indigo-500"
                    >
                      {categoriesList.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <span className="text-slate-455 font-bold uppercase tracking-wider text-[9px] block">Description</span>
                  <textarea
                    rows="4"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded p-2.5 mt-1.5 text-xs text-slate-300 leading-relaxed focus:ring-1 focus:ring-indigo-500 whitespace-pre-wrap"
                  ></textarea>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-455 font-bold uppercase tracking-wider text-[9px] block">Price (INR)</span>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => {
                        setPrice(e.target.value);
                        setIsPriceManuallyEdited(true);
                      }}
                      className="w-full bg-slate-955 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white mt-1.5 font-bold focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <span className="text-slate-455 font-bold uppercase tracking-wider text-[9px] block">Quantity</span>
                    <input
                      type="number"
                      value={stockQuantity}
                      placeholder="Enter quantity"
                      onChange={(e) => setStockQuantity(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white mt-1.5 font-semibold focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {generatedProductResult.keywords && generatedProductResult.keywords.length > 0 && (
                  <div>
                    <span className="text-slate-455 font-bold uppercase tracking-wider text-[9px] block">Keywords</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {generatedProductResult.keywords.map((k, i) => (
                        <span key={i} className="bg-slate-855 text-slate-355 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-800">
                          #{k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Price Intelligence details inside review block */}
            {priceIntelligenceResult && (
              <div className="mt-6 pt-5 border-t border-slate-800">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 block mb-3">💰 AI Price Intelligence</span>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-855/80">
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

                    <div className="bg-slate-900/60 p-3 rounded border border-slate-855 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-indigo-400">Recommended Price:</span>
                        <span className={`px-1.5 py-0.25 rounded text-[8px] font-extrabold uppercase ${
                          priceIntelligenceResult.confidence === 'high' ? 'bg-green-955 text-green-400 border border-green-800' :
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
                    <p className="text-[10.5px] text-slate-455 leading-normal italic font-medium pt-3 mt-3 border-t border-slate-900">
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
                    <span className="text-slate-505 font-bold block text-[9px] uppercase">Lighting</span>
                    <span className="font-bold text-slate-200 mt-0.5 block capitalize">{aiResult.lighting}</span>
                  </div>
                  <div>
                    <span className="text-slate-505 font-bold block text-[9px] uppercase">Background</span>
                    <span className="font-bold text-slate-200 mt-0.5 block capitalize">{aiResult.background}</span>
                  </div>
                  <div>
                    <span className="text-slate-505 font-bold block text-[9px] uppercase">Blur Status</span>
                    <span className={`font-bold mt-0.5 block ${aiResult.blur_detected ? 'text-red-400' : 'text-green-400'}`}>
                      {aiResult.blur_detected ? 'Blurry' : 'Clear'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-505 font-bold block text-[9px] uppercase">Visibility</span>
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
                className="flex-1 bg-slate-805 hover:bg-slate-700 text-slate-200 font-bold py-2.5 px-4 rounded-lg text-xs transition-colors border border-slate-700 min-h-[38px] cursor-pointer"
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
              <div className="flex gap-2">
                <input
                  id="prod-price"
                  ref={priceInputRef}
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
                  className="flex-grow px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy disabled:opacity-50"
                />
                <button
                  id="btn-analyze-price"
                  type="button"
                  onClick={handleExplicitPriceAnalysis}
                  disabled={isAnalyzingPrice || isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <span>💰</span> Analyze Price
                </button>
              </div>
            </div>

            {/* Price Intelligence Card */}
            {(isAnalyzingPrice || priceIntelligenceResult || priceIntelligenceError) && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 mt-4 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="text-xl">💰</span>
                  <h4 className="font-bold text-slate-800 text-sm m-0">AI Price Intelligence</h4>
                </div>

                {isAnalyzingPrice && (
                  <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold animate-pulse py-2">
                    <svg className="animate-spin h-4 w-4 text-indigo-600" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Analyzing marketplace prices...</span>
                  </div>
                )}

                {!isAnalyzingPrice && priceIntelligenceError && (
                  <div className="text-red-600 text-xs font-semibold py-2">
                    Price intelligence analysis failed. Please try again.
                  </div>
                )}

                {!isAnalyzingPrice && priceIntelligenceResult && (
                  <>
                    {priceIntelligenceResult.comparable_products_count === 0 ? (
                      <div className="text-slate-600 text-xs font-medium py-2">
                        No comparable published products are currently available.<br />
                        Please enter your price manually.
                      </div>
                    ) : (
                      <div className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center py-1 border-b border-slate-200">
                              <span className="text-slate-500 font-medium">Comparable Products</span>
                              <span className="font-bold text-slate-800 bg-slate-200 px-2 py-0.5 rounded text-[11px]">
                                {priceIntelligenceResult.comparable_products_count}
                              </span>
                            </div>

                            <div className="flex justify-between items-center py-1 border-b border-slate-200">
                              <span className="text-slate-500 font-medium">Market Range</span>
                              <span className="font-bold text-slate-800">
                                ₹{priceIntelligenceResult.market_min} — ₹{priceIntelligenceResult.market_max}
                              </span>
                            </div>

                            <div className="flex justify-between items-center py-1 border-b border-slate-200">
                              <span className="text-slate-500 font-medium">Average</span>
                              <span className="font-bold text-slate-800">₹{priceIntelligenceResult.market_average}</span>
                            </div>

                            <div className="flex justify-between items-center py-1 border-b border-slate-200">
                              <span className="text-slate-500 font-medium">Median</span>
                              <span className="font-bold text-slate-800">₹{priceIntelligenceResult.market_median}</span>
                            </div>
                          </div>

                          <div className="bg-white p-3 rounded border border-slate-200 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1.5">
                                <span className="text-[10px] uppercase tracking-wider text-indigo-600 font-bold flex items-center gap-1">
                                  <span>🤖</span> AI Recommended Price
                                </span>
                                <span className={`px-1.5 py-0.25 rounded text-[9px] font-extrabold uppercase tracking-wide capitalize ${
                                  priceIntelligenceResult.confidence === 'high' ? 'bg-green-100 text-green-800 border border-green-200' :
                                  priceIntelligenceResult.confidence === 'medium' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                  'bg-red-100 text-red-800 border border-red-200'
                                }`}>
                                  {priceIntelligenceResult.confidence}
                                </span>
                              </div>
                              <span className="text-slate-800 font-extrabold text-2xl block mb-2">
                                ₹{priceIntelligenceResult.recommendation?.recommended_price || priceIntelligenceResult.recommended_price || 'N/A'}
                              </span>
                            </div>
                            
                            {(priceIntelligenceResult.recommendation?.reasoning || priceIntelligenceResult.reasoning) && (
                              <div className="text-[11px] text-slate-600 leading-normal pt-1.5 border-t border-slate-100">
                                <span className="font-bold block text-slate-700 mb-0.5">Reasoning</span>
                                <p className="italic">
                                  "{priceIntelligenceResult.recommendation?.reasoning || priceIntelligenceResult.reasoning}"
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2 border-t border-slate-200 pt-3">
                          <button
                            type="button"
                            onClick={handleApplyRecommendedPrice}
                            className="flex-grow bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded text-xs transition-colors shadow-sm cursor-pointer min-h-[34px]"
                          >
                            Use Suggested Price
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (priceInputRef.current) {
                                priceInputRef.current.scrollIntoView({ behavior: 'smooth' });
                                priceInputRef.current.focus();
                              }
                            }}
                            className="flex-grow bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold py-2 px-3 rounded text-xs transition-colors cursor-pointer min-h-[34px]"
                          >
                            Edit Price
                          </button>
                        </div>
                        
                        {applyPriceSuccess && (
                          <p className="text-[11px] text-green-600 font-bold text-center mt-2">
                            ✓ {applyPriceSuccess}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

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

            {/* AI Voice Assistant section */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl" role="img" aria-label="Microphone">🎙️</span>
                <h4 className="font-bold text-gov-navy m-0 text-sm">Describe Handicraft by Voice</h4>
              </div>
              <p className="text-xs text-slate-550 leading-relaxed">
                Describe your handicraft by speaking in your local language (e.g. Kannada, Hindi, English). Gemini will automatically transcribe and translate it into English.
              </p>

              {!isRecording && !audioUrl && (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isSubmitting || isAnalyzing || isEnhancing || isTranscribing}
                  className="bg-gov-navy hover:bg-gov-navy-light text-white text-xs font-bold px-4 py-2 rounded transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 min-h-[34px]"
                >
                  <span className="text-sm">🎙️</span>
                  <span>Start Recording Description</span>
                </button>
              )}

              {isRecording && (
                <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded p-3">
                  <div className="flex items-center gap-2 text-red-655 font-bold text-xs animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                    <span>🔴 Recording... {formatTime(recordingTime)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    <span>⏹️</span> Stop Recording
                  </button>
                </div>
              )}

              {!isRecording && audioUrl && (
                <div className="space-y-4 border border-slate-200 rounded-lg p-4 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-indigo-705 flex items-center gap-1">
                      <span>🎙️</span> Audio Ready
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">{recordingTime}s recorded (max 60s)</span>
                  </div>
                  <audio src={audioUrl} controls className="w-full h-9" />
                  
                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      disabled={isTranscribing}
                      onClick={handleSendVoiceToAI}
                      className="bg-gov-navy hover:bg-gov-navy-light text-white text-xs font-bold px-3.5 py-2 rounded transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[34px]"
                    >
                      {isTranscribing ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Transcribing and translating...</span>
                        </>
                      ) : (
                        <span>✈️ Send to AI</span>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isTranscribing}
                      onClick={startRecording}
                      className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold px-3.5 py-2 rounded transition-all cursor-pointer disabled:opacity-50 min-h-[34px]"
                    >
                      🔄 Record Again
                    </button>
                  </div>
                </div>
              )}

              {transcribeError && (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 text-xs font-semibold">
                  ⚠️ {transcribeError}
                </div>
              )}

              {transcribeResult && (
                <div className="border border-slate-250 rounded-lg p-4 bg-white space-y-4 animate-fade-in">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="text-lg">🤖</span>
                    <h4 className="font-bold text-slate-800 text-sm m-0">AI Voice Result</h4>
                  </div>
                  
                  <div className="space-y-3.5 text-xs">
                    <div>
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Language detected:</span>
                      <span className="font-bold text-slate-800 capitalize block mt-0.5">{transcribeResult.detected_language}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Original speech transcription:</span>
                      <p className="text-slate-700 leading-relaxed bg-slate-50 border border-slate-150 rounded p-2.5 mt-1 italic whitespace-pre-wrap">
                        "{transcribeResult.transcript}"
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">English translation:</span>
                      <p className="text-slate-700 leading-relaxed bg-slate-50 border border-slate-150 rounded p-2.5 mt-1 font-medium whitespace-pre-wrap">
                        "{transcribeResult.english_translation}"
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                      <div>
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Confidence:</span>
                        <span className={`font-bold mt-0.5 capitalize block ${
                          transcribeResult.confidence === 'high' ? 'text-green-600' :
                          transcribeResult.confidence === 'medium' ? 'text-amber-600' : 'text-red-655'
                        }`}>
                          {transcribeResult.confidence}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleUseVoiceDescription}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-3 py-1.5 rounded transition-all cursor-pointer shadow-sm min-h-[30px]"
                      >
                        Use English Description
                      </button>
                      {transcribeSuccess && (
                        <span className="text-green-600 text-xs font-semibold ml-2 animate-pulse">
                          ✓ {transcribeSuccess}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Image Selector & Preview */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-700">
                Product Image
              </label>

              {imagePreviewUrl ? (
                // New Image Preview Mode
                <div className="relative border border-slate-200 rounded-lg p-2 bg-slate-50 flex flex-col items-center">
                  <img
                    src={useEnhanced && enhancedImageUrl ? enhancedImageUrl : imagePreviewUrl}
                    alt="New preview"
                    className="max-h-48 object-contain rounded border border-slate-200"
                  />
                  <div className="mt-3 flex gap-2 w-full">
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={isSubmitting}
                      className="bg-red-55 hover:bg-red-100 text-red-750 text-xs font-bold px-3 py-2 rounded border border-red-200 cursor-pointer flex-grow text-center transition-colors disabled:opacity-50"
                    >
                      ✕ Remove / Delete Image
                    </button>
                    <label className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-750 text-xs font-bold px-3 py-2 rounded cursor-pointer flex-grow text-center transition-colors disabled:opacity-50 inline-flex items-center justify-center">
                      Change Image Selection
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
              ) : existingImageUrl ? (
                // Existing Image Display
                <div className="relative border border-slate-200 rounded-lg p-2 bg-slate-50 flex flex-col items-center">
                  <img
                    src={useEnhanced && enhancedImageUrl ? enhancedImageUrl : existingImageUrl}
                    alt="Current product photo"
                    className="max-h-48 object-contain rounded border border-slate-200"
                  />
                  <div className="mt-3 flex gap-2 w-full">
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={isSubmitting}
                      className="bg-red-55 hover:bg-red-100 text-red-750 text-xs font-bold px-3 py-2 rounded border border-red-200 cursor-pointer flex-grow text-center transition-colors disabled:opacity-50"
                    >
                      ✕ Delete Existing Image
                    </button>
                    <label className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-750 text-xs font-bold px-3 py-2 rounded cursor-pointer flex-grow text-center transition-colors disabled:opacity-50 inline-flex items-center justify-center">
                      Replace Image
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
                // File Picker Mode (if no image currently exists)
                <label
                  htmlFor="prod-image"
                  className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 cursor-pointer block hover:border-gov-navy transition-colors"
                >
                  <span className="text-2xl" role="img" aria-label="Camera icon">📷</span>
                  <p className="text-xs text-slate-500 mt-2 font-semibold">Click to upload product image (JPEG, PNG, WebP)</p>
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
              
              {(imagePreviewUrl || existingImageUrl) && (
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
                    <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 text-xs font-semibold">
                      ⚠️ {aiError}
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
                                  src={imagePreviewUrl || existingImageUrl}
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
                {isSubmitting ? 'Saving Changes...' : 'Save Product Changes'}
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
              <h3 className="font-bold text-gov-navy m-0 text-base">AI Product Creator</h3>
            </div>
            <p className="text-xs text-slate-550 leading-relaxed">
              Use your product image and artisan description to automatically create product details.
            </p>

            <button
              type="button"
              disabled={!isAiCreatorEnabled || isSubmitting || isAnalyzing || isEnhancing || isTranscribing || isGeneratingProduct}
              onClick={handleGenerateProduct}
              className="w-full bg-gov-navy hover:bg-gov-navy-light text-white text-xs font-bold py-2.5 px-4 rounded transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[38px]"
            >
              {isGeneratingProduct ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>✨ Creating product details...</span>
                </>
              ) : (
                <>
                  <span>✨ Describe Product with AI</span>
                </>
              )}
            </button>

            {!isAiCreatorEnabled && (
              <p className="text-[10px] text-amber-600 font-semibold text-center mt-1">
                ⚠️ Upload an image or enter a description first to enable AI details.
              </p>
            )}

            {generateProductError && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 text-xs font-semibold">
                ⚠️ {generateProductError}
              </div>
            )}

            {generatedProductResult && (
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-4 animate-fade-in text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-slate-800 text-sm m-0">✨ AI Generated Details</h4>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                    generatedProductResult.confidence === 'high' ? 'bg-green-100 text-green-800' :
                    generatedProductResult.confidence === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {generatedProductResult.confidence} Confidence
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Product Name:</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{generatedProductResult.product_name}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Category:</span>
                    <span className="font-semibold text-slate-700 mt-0.5 block">{generatedProductResult.category}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Description:</span>
                    <p className="text-slate-655 mt-0.5 leading-normal max-h-24 overflow-y-auto bg-white p-2 border border-slate-200 rounded">
                      {generatedProductResult.description}
                    </p>
                  </div>

                  {generatedProductResult.materials && generatedProductResult.materials.length > 0 && (
                    <div>
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Materials:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {generatedProductResult.materials.map((m, i) => (
                          <span key={i} className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {generatedProductResult.keywords && generatedProductResult.keywords.length > 0 && (
                    <div>
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Search Keywords:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {generatedProductResult.keywords.map((k, i) => (
                          <span key={i} className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">#{k}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {generatedProductResult.price_suggestion && (
                    <div className="bg-white border border-slate-200 rounded p-3 space-y-1.5">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">AI Suggested Price Range</span>
                      <div className="text-base font-black text-gov-navy">
                        ₹{generatedProductResult.price_suggestion.min} – ₹{generatedProductResult.price_suggestion.max}
                      </div>
                      <button
                        type="button"
                        onClick={handleUseSuggestedPrice}
                        className="bg-gov-navy hover:bg-gov-navy-light text-white text-[10px] font-bold px-2 py-1 rounded transition-colors cursor-pointer"
                      >
                        Use Suggested Price (Midpoint: ₹{Math.round((generatedProductResult.price_suggestion.min + generatedProductResult.price_suggestion.max) / 2)})
                      </button>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleApplyAiDetails}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded text-xs transition-colors cursor-pointer shadow-sm min-h-[34px]"
                    >
                      Apply AI Details
                    </button>
                    {applyDetailsSuccess && (
                      <p className="text-[10px] text-green-600 font-bold text-center">
                        ✓ {applyDetailsSuccess}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
