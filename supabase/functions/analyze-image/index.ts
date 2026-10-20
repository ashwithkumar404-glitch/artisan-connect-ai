// Deno Serverless Edge Function for Artisan Connect AI Image Audit (Gemini replaced with deterministic CV)
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

// Access-Control CORS headers for cross-origin resource requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Helper to compute image quality metrics using deterministic algorithms.
 * Returns an object matching the original Gemini contract.
 */
async function auditImage({
  image,
  mimeType,
}: {
  image: string;
  mimeType?: string;
}): Promise<{
  quality_score: number;
  blur_detected: boolean;
  lighting: 'good' | 'average' | 'poor';
  background: 'clean' | 'busy' | 'distracting';
  product_visibility: 'high' | 'medium' | 'low';
  recommendations: string[];
}> {
  // Decode base64 image data safely
  const binaryString = atob(image);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Load image via ImageScript – will throw if undecodable
  const img = await Image.decode(bytes);
  const { width, height } = img;
  const totalPixels = width * height;

  // Helper to get pixel RGBA array (0‑255)
  const getPixel = (x: number, y: number): [number, number, number, number] => img.getPixel(x, y);

  /** ---------- Brightness / Lighting ---------- */
  const luminances: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = getPixel(x, y);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; // Rec. 709 luminance
      luminances.push(lum);
    }
  }
  const avgLum = luminances.reduce((a, b) => a + b, 0) / totalPixels;
  let lighting: 'good' | 'average' | 'poor' = 'average';
  if (avgLum > 130) lighting = 'good';
  else if (avgLum < 70) lighting = 'poor';

  /** ---------- Background uniformity ---------- */
  const meanLum = avgLum;
  const varianceLum = luminances.reduce((s, l) => s + (l - meanLum) ** 2, 0) / totalPixels;
  const stdDevLum = Math.sqrt(varianceLum);
  let background: 'clean' | 'busy' | 'distracting' = 'busy';
  if (stdDevLum < 15) background = 'clean';
  else if (stdDevLum > 30) background = 'distracting';

  /** ---------- Blur detection (Laplacian variance) ---------- */
  const laplacianVals: number[] = [];
  const kernel = [
    [-1, -1, -1],
    [-1, 8, -1],
    [-1, -1, -1],
  ];
  // Skip border pixels to avoid out‑of‑range checks
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let lap = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const [r, g, b] = getPixel(x + kx, y + ky);
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          lap += lum * kernel[ky + 1][kx + 1];
        }
      }
      laplacianVals.push(lap);
    }
  }
  const meanLap = laplacianVals.reduce((a, b) => a + b, 0) / laplacianVals.length;
  const varLap = laplacianVals.reduce((s, v) => s + (v - meanLap) ** 2, 0) / laplacianVals.length;
  // Empirically, low variance indicates a blurry image
  const blur_detected = varLap < 500;

  /** ---------- Product visibility heuristic ---------- */
  const visibilityThreshold = 30; // luminance difference from mean considered foreground
  const foregroundPixels = luminances.filter((l) => Math.abs(l - meanLum) > visibilityThreshold).length;
  const visibilityRatio = foregroundPixels / totalPixels;
  let product_visibility: 'high' | 'medium' | 'low' = 'low';
  if (visibilityRatio > 0.3) product_visibility = 'high';
  else if (visibilityRatio > 0.1) product_visibility = 'medium';

  /** ---------- Composite quality score (0‑100) ---------- */
  let quality_score = Math.round((avgLum / 255) * 100);
  if (blur_detected) quality_score = Math.max(0, quality_score - 20);
  if (background === 'distracting') quality_score = Math.max(0, quality_score - 20);
  else if (background === 'busy') quality_score = Math.max(0, quality_score - 10);
  quality_score = Math.min(100, quality_score);

  /** ---------- Recommendations ---------- */
  const recommendations: string[] = [];
  if (blur_detected) recommendations.push('Consider using a sharper image or a tripod to reduce motion blur.');
  if (lighting === 'poor') recommendations.push('Improve lighting; avoid harsh shadows or dim environments.');
  if (background === 'distracting') recommendations.push('Use a plain background to keep the focus on the product.');
  if (quality_score < 60) recommendations.push('Overall image quality is low; retake the photo with better lighting and focus.');
  // Guarantee at least two suggestions
  while (recommendations.length < 2) {
    recommendations.push('Adjust image composition for a clearer presentation.');
    break;
  }

  return {
    quality_score,
    blur_detected,
    lighting,
    background,
    product_visibility,
    recommendations,
  };
}

/**
 * Deno edge function entry point – retains the original request/response contract.
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("Edge Function 'analyze-image' invocation started.");
    const { image, mimeType } = await req.json();
    if (!image) {
      return new Response(
        JSON.stringify({ error: 'Image data is missing from the payload.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const result = await auditImage({ image, mimeType });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error during image audit function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// Export for unit‑testing
export { auditImage };
