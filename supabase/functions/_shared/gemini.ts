export const GEMINI_MODEL = "gemini-3.6-flash";

export interface GeminiRequestOptions {
  contents: any[];
  generationConfig?: {
    responseMimeType?: string;
    [key: string]: any;
  };
}

/**
 * Sends a content generation request to Gemini, trying multiple API keys in fallback order if rate limited (429).
 * If all keys fail due to rate limits or quota, throws an Error with message "AI_QUOTA_EXHAUSTED".
 */
export async function generateGeminiContent(
  options: GeminiRequestOptions,
  timeoutMs: number = 30000 // 30 seconds default timeout
): Promise<any> {
  // Retrieve keys in priority order
  const keys = [
    Deno.env.get("GEMINI_API_KEY"),
    Deno.env.get("GEMINI_API_KEY_1"),
    Deno.env.get("GEMINI_API_KEY_2")
  ].map(key => key?.trim()).filter((key): key is string => !!key);

  if (keys.length === 0) {
    console.error("No Gemini API keys found in environment vault.");
    throw new Error("GEMINI_API_KEY secret is not set in the Supabase workspace.");
  }

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const slotNum = i + 1;
    const keyLabel = i === 0 ? "GEMINI_API_KEY" : `GEMINI_API_KEY_${i}`;

    console.log(`Attempting Gemini API request using key slot ${slotNum} (Model: ${GEMINI_MODEL})...`);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: options.contents,
          generationConfig: options.generationConfig,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 404) {
        const errText = await response.text();
        console.error(`Gemini key slot ${slotNum} returned 404 (Model Not Found: ${GEMINI_MODEL}). Failing immediately.`);
        throw new Error(`Gemini API returned error 404: ${errText}`);
      }

      if (response.status === 429) {
        console.warn(`Gemini key slot ${slotNum} returned 429; trying fallback key slot ${slotNum + 1}.`);
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Gemini key slot ${slotNum} returned HTTP error ${response.status}.`);

        // Check if error body indicates resource exhaustion or quota limits
        let isQuotaError = false;
        try {
          const parsedErr = JSON.parse(errText);
          const errorStatus = parsedErr.error?.status || "";
          const errorMsg = parsedErr.error?.message || "";
          
          if (
            errorStatus === "RESOURCE_EXHAUSTED" ||
            errorMsg.toLowerCase().includes("quota") ||
            errorMsg.toLowerCase().includes("rate limit") ||
            errorMsg.toLowerCase().includes("exhausted")
          ) {
            isQuotaError = true;
          }
        } catch (_) {}

        if (isQuotaError) {
          console.warn(`Gemini key slot ${slotNum} returned quota/exhaustion error in body; trying fallback key slot ${slotNum + 1}.`);
          continue;
        }

        // Throw permanent request errors immediately (like invalid prompts, unsupported format)
        throw new Error(`Gemini API returned error ${response.status}: ${errText}`);
      }

      const resJson = await response.json();
      return resJson;

    } catch (err) {
      clearTimeout(timer);

      if (err.name === "AbortError") {
        console.warn(`Gemini request timed out after ${timeoutMs}ms for key slot ${slotNum}. Trying fallback key slot ${slotNum + 1}...`);
        continue;
      }

      // Re-throw permanent errors, but if we encountered fetch/network issues we could try fallback
      if (err instanceof TypeError && err.message.includes("fetch")) {
        console.warn(`Network/fetch error on key slot ${slotNum}: ${err.message}. Trying fallback key slot ${slotNum + 1}...`);
        continue;
      }

      throw err;
    }
  }

  // All configured keys returned 429 or quota errors
  throw new Error("AI_QUOTA_EXHAUSTED");
}
