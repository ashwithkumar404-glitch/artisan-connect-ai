// Deno Serverless Edge Function for Artisan Connect AI Product Image Enhancement
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

// Access-Control CORS headers for cross-origin resource requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight options check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Parse request parameters
    const { image, mimeType } = await req.json();
    if (!image) {
      return new Response(
        JSON.stringify({ error: 'Image data is missing from the payload.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Decoding base64 image data...");
    // Convert base64 string to binary array buffer securely
    const binaryString = atob(image);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log("Loading image buffer into ImageScript...");
    const img = await Image.decode(bytes);

    console.log("Applying pixel-level visual enhancements: brightness, contrast, and saturation...");
    
    // A. exposure/brightness correction factor
    const brightnessFactor = 1.15; // 15% increase
    
    // B. contrast enhancement factor
    const contrastFactor = 1.30; // 30% increase
    
    // Iterate over the RGBA pixel array
    for (let i = 0; i < img.length; i += 4) {
      // Modify R, G, B channels
      for (let c = 0; c < 3; c++) {
        let val = img[i + c];
        
        // 1. Exposure adjustment
        val = val * brightnessFactor;
        
        // 2. Contrast adjustment (center around 128, multiply by factor, shift back)
        val = (val - 128) * contrastFactor + 128;
        
        // 3. Clamp between 0 and 255
        if (val < 0) val = 0;
        if (val > 255) val = 255;
        
        img[i + c] = Math.round(val);
      }
      // Alpha channel (img[i + 3]) is left untouched
    }

    // C. Saturation (vibrancy) boost using built-in method (20% increase)
    img.saturation(1.20);

    console.log("Encoding enhanced image as JPEG...");
    // Encode back to JPEG byte array (90% quality level)
    const enhancedBytes = await img.encodeJPEG(90);

    console.log("Converting binary buffer back to base64...");
    // Safe chunked conversion to base64 to prevent stack overflow on large buffers
    let binary = '';
    const chunkSize = 0xffff; 
    for (let i = 0; i < enhancedBytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, enhancedBytes.subarray(i, i + chunkSize));
    }
    const enhancedBase64 = btoa(binary);

    console.log("Enhancement complete. Returning response.");
    return new Response(
      JSON.stringify({
        enhancedImage: enhancedBase64,
        mimeType: 'image/jpeg'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error during image enhancement:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
