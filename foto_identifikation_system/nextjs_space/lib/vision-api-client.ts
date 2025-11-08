// Vision AI Client - Multi-Provider mit Auto-Fallback
// Primary: Hugging Face | Fallback: OpenAI | Retry: 3x

interface VisionResult {
  location: string;
  scene: string;
}

// Retry mit Exponential Backoff
async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      // Don't retry on certain errors (503 model loading, 401/403 auth errors)
      const status = err?.status ?? err?.response?.status;
      if (
        status === 503 || status === 401 || status === 403 ||
        (typeof err.message === 'string' && (
          err.message.includes('503') ||
          err.message.includes('401') ||
          err.message.includes('403')
        ))
      ) {
        console.warn(`[Retry] Non-retryable error detected: ${err.message}`);
        throw err;
      }

      if (i === attempts - 1) throw err;

      const waitTime = 1000 * Math.pow(2, i);
      console.log(`[Retry] Attempt ${i + 1}/${attempts} failed, waiting ${waitTime}ms before retry`);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }
  throw new Error('Retry failed');
}

// Hugging Face API - Vision Task with BLIP Model
async function analyzeWithHuggingFace(base64: string, placeName: string | null): Promise<VisionResult> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) throw new Error('HF_KEY missing');

  // Convert base64 to binary buffer for Hugging Face
  const imageBuffer = Buffer.from(base64, 'base64');

  // First, get image caption using BLIP model
  const captionRes = await fetch('https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/octet-stream',
    },
    body: imageBuffer
  });

  if (!captionRes.ok) {
    const errorText = await captionRes.text();
    throw new Error(`HF Caption Error: ${captionRes.status} - ${errorText}`);
  }
  
  const captionData = await captionRes.json();

  // Validate caption response
  if (!captionData || !Array.isArray(captionData) || captionData.length === 0) {
    throw new Error('HF Caption: Empty or invalid response');
  }

  const caption = captionData[0]?.generated_text || '';

  if (!caption) {
    throw new Error('HF Caption: No caption text generated');
  }

  console.log(`[Vision] HF Caption: "${caption}"`);

  // Now make a separate text generation call to extract location/scene in our format
  const placeContext = placeName 
    ? `Zusätzlicher Kontext: Das Foto wurde aufgenommen bei/in "${placeName}". `
    : '';

  const textPrompt = `${placeContext}Bildbeschreibung: "${caption}"\n\nAnalysiere diese Bildbeschreibung und bestimme:
1. Die Ort-Kategorie (z.B. Strand, Restaurant, Auto, Wald, Park, Büro, Zuhause, etc.) - maximal 2-3 Wörter auf Deutsch
2. Eine Szene-Beschreibung mit einem Adjektiv/Wort auf Deutsch (z.B. sonnig, gemütlich, modern, dunkel, etc.)

**WICHTIG FÜR SCHILDER:**
Wenn die Bildbeschreibung Hinweise auf ein Schild, Plakat, Hinweisschild, Straßenschild, Wegweiser, Informationstafel oder ähnliches enthält:
- Verwende "Schild" als Ort-Kategorie
- Lies den Text in der Beschreibung und verwende ihn als Szene-Beschreibung (z.B. "Parken-verboten", "Eingang-A", "Berlin-Hauptbahnhof", etc.)
- Falls mehrere Texte erwähnt werden, verwende den wichtigsten/größten Text
- Entferne Satzzeichen und verwende Bindestriche statt Leerzeichen

Antworte nur in folgendem JSON-Format:
{
  "location": "Ort-Kategorie",
  "scene": "Szene-Beschreibung"
}

Verwende nur deutsche Begriffe und halte sie kurz und prägnant. Für die Ort-Kategorie: Verwende Bindestriche statt Leerzeichen (z.B. "Central-Park" statt "Central Park").`;

  // Try text generation for structured output, but have fallback ready
  let location = 'Unbekannt';
  let scene = 'standard';

  try {
    const textRes = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: textPrompt,
        parameters: {
          max_new_tokens: 150,
          return_full_text: false,
          temperature: 0.3
        }
      })
    });

    if (!textRes.ok) {
      console.warn(`[Vision] HF Text generation failed: ${textRes.status}, using caption fallback`);
      throw new Error(`HF Text Error: ${textRes.status}`);
    }

    const textData = await textRes.json();
    const responseText = textData[0]?.generated_text || '';

    console.log(`[Vision] HF Text response: ${responseText.substring(0, 200)}`);

    // Try to parse JSON from response
    try {
      // Try to extract JSON from the response
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}') + 1;
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        const jsonStr = responseText.substring(jsonStart, jsonEnd);
        const parsed = JSON.parse(jsonStr);
        if (parsed.location && parsed.scene) {
          location = sanitize(parsed.location);
          scene = sanitize(parsed.scene);
          console.log(`[Vision] HF parsed from JSON: location="${location}", scene="${scene}"`);
        } else {
          throw new Error('Incomplete JSON response');
        }
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError: any) {
      console.warn(`[Vision] JSON parsing failed: ${parseError.message}, using caption extraction`);
      // Fallback on simple extraction from the original caption
      location = extractLocation(caption) || 'Unbekannt';
      scene = extractScene(caption) || 'standard';
      console.log(`[Vision] HF extracted from caption: location="${location}", scene="${scene}"`);
    }
  } catch (textError: any) {
    console.warn(`[Vision] Text generation failed: ${textError.message}, using caption extraction`);
    // Fallback on simple extraction from the original caption
    location = extractLocation(caption) || 'Unbekannt';
    scene = extractScene(caption) || 'standard';
  }

  // Validate we have something usable
  return { location, scene };
}

// OpenAI Fallback
async function analyzeWithOpenAI(base64: string, placeName: string | null): Promise<VisionResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_KEY missing');

  const placeContext = placeName 
    ? `\n\nZusätzliche Kontext-Information: Das Foto wurde aufgenommen bei/in "${placeName}". Wenn dies ein spezifischer Ort ist (z.B. eine Parkanlage, ein Restaurant, ein Denkmal), verwende diesen Namen als Ort-Kategorie. Ansonsten verwende eine allgemeine Kategorie.`
    : '';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: "user", 
        content: [
          {
            type: "text", 
            text: `Analysiere dieses Bild und bestimme:
1. Die Ort-Kategorie (z.B. Strand, Restaurant, Auto, Wald, Park, Büro, Zuhause, etc.) - maximal 2-3 Wörter auf Deutsch
2. Eine Szene-Beschreibung mit einem Adjektiv/Wort auf Deutsch (z.B. sonnig, gemütlich, modern, dunkel, etc.)${placeContext}

**WICHTIG FÜR SCHILDER:**
Falls im Bild ein Schild, Plakat, Hinweisschild, Straßenschild, Wegweiser, Informationstafel oder ähnliches zu sehen ist:
- Verwende "Schild" als Ort-Kategorie
- Lies den Text auf dem Schild und verwende ihn als Szene-Beschreibung (z.B. "Parken-verboten", "Eingang-A", "Berlin-Hauptbahnhof", etc.)
- Falls mehrere Texte auf dem Schild sind, verwende den wichtigsten/größten Text
- Entferne Satzzeichen und verwende Bindestriche statt Leerzeichen

Antworte nur in folgendem JSON-Format:
{
  "location": "Ort-Kategorie",
  "scene": "Szene-Beschreibung"
}

Verwende nur deutsche Begriffe und halte sie kurz und prägnant. Für die Ort-Kategorie: Verwende Bindestriche statt Leerzeichen (z.B. "Central-Park" statt "Central Park").`
          },
          {
            type: "image_url", 
            image_url: {
              url: `data:image/jpeg;base64,${base64}`
            }
          }
        ]
      }],
      response_format: { type: "json_object" },
      max_tokens: 200,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI Error: ${res.status} - ${errorText}`);
  }

  const result = await res.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Keine Antwort von OpenAI erhalten');
  }

  console.log(`[Vision] OpenAI Response: ${content}`);

  const parsed = JSON.parse(content);

  if (!parsed.location || !parsed.scene) {
    throw new Error('Unvollständige OpenAI Analyse');
  }

  const sanitizedLocation = sanitize(parsed.location);
  const sanitizedScene = sanitize(parsed.scene);

  // Validate sanitized values are not empty
  if (!sanitizedLocation || !sanitizedScene) {
    throw new Error('OpenAI: Sanitized values are empty');
  }

  return {
    location: sanitizedLocation,
    scene: sanitizedScene
  };
}

// Main Export - Auto-Fallback
export async function analyzeImage(
  base64: string,
  fileName: string,
  placeName: string | null
): Promise<VisionResult> {

  // Validate input
  if (!base64 || base64.length === 0) {
    console.error(`[Vision] Invalid base64 for ${fileName}`);
    return {
      location: 'Unbekannt',
      scene: 'Fehler'
    };
  }

  console.log(`[Vision] Starting analysis for: ${fileName} (${base64.length} bytes base64)`);

  // Versuch 1: Hugging Face (kostenlos)
  try {
    console.log(`[Vision] Attempting HF Analysis: ${fileName}`);
    const result = await retry(() => analyzeWithHuggingFace(base64, placeName));
    console.log(`[Vision] HF Success for ${fileName}:`, result);
    return result;
  } catch (hfError: any) {
    console.warn(`[Vision] HF failed for ${fileName}: ${hfError.message}`);
  }

  // Versuch 2: OpenAI Fallback
  try {
    console.log(`[Vision] Attempting OpenAI Fallback: ${fileName}`);
    const result = await retry(() => analyzeWithOpenAI(base64, placeName));
    console.log(`[Vision] OpenAI Success for ${fileName}:`, result);
    return result;
  } catch (openaiError: any) {
    console.error(`[Vision] Both providers failed for ${fileName}: ${openaiError.message}`);
  }

  // Absolute Fallback - Generate safe filename
  console.warn(`[Vision] Using fallback naming for ${fileName}`);
  const safeName = fileName.split('.')[0].replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20);
  return {
    location: 'Unbekannt',
    scene: safeName || 'Fehler'
  
  // Check if API keys are configured properly
  const hasHuggingFaceKey = process.env.HUGGINGFACE_API_KEY && process.env.HUGGINGFACE_API_KEY !== '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';
  const hasOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== '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';

  if (hasHuggingFaceKey) {
    // Versuch 1: Hugging Face (kostenlos)
    try {
      console.log(`[Vision] HF Analysis: ${fileName}`);
      return await retry(() => analyzeWithHuggingFace(base64, placeName));
    } catch (hfError: any) {
      console.warn(`[Vision] HF failed: ${hfError.message}`);
    }
  }

  if (hasOpenAIKey) {
    // Versuch 2: OpenAI Fallback
    try {
      console.log(`[Vision] OpenAI Fallback: ${fileName}`);
      return await retry(() => analyzeWithOpenAI(base64, placeName));
    } catch (openaiError: any) {
      console.error(`[Vision] OpenAI failed: ${openaiError.message}`);
    }
  }

  // Development/Test Fallback - simulate AI analysis results
  console.log(`[Vision] Using development fallback for ${fileName}`);
  
  // Simple simulation based on filename or default values
  const baseName = fileName.split('.')[0].substring(0, 20);
  const locations = ['Strand', 'Restaurant', 'Park', 'Wald', 'Buergersteig', 'Innenraum', 'Gebaeude', 'Auto', 'Schild'];
  const scenes = ['sonnig', 'bewoelkt', 'dunkel', 'hell', 'gemuetlich', 'modern', 'Nacht', 'standard'];
  
  // For testing purposes, return predictable but varied results
  const location = locations[Math.abs(baseName.hashCode()) % locations.length] || 'Unbekannt';
  const scene = scenes[Math.abs(baseName.hashCode()) % scenes.length] || 'standard';

  return {
    location: location,
    scene: scene
  };
}

// Add string hash function for predictable simulation
declare global {
  interface String {
    hashCode(): number;
  }
}

if (!String.prototype.hasOwnProperty('hashCode')) {
  String.prototype.hashCode = function(): number {
    let hash = 0;
    for (let i = 0; i < this.length; i++) {
      const char = this.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash); // Return absolute value to ensure positive number
  };
}

// Helper: Dateinamen-safe
function sanitize(str: string): string {
  return str
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9äöüÄÖÜß\-]/g, '')
    .replace(/-+/g, '-')
    .substring(0, 30);
}

// Helper: Location aus Caption extrahieren
function extractLocation(caption: string): string | null {
  const lower = caption.toLowerCase();
  const keywords = {
    'sign': 'Schild',
    'signboard': 'Schild',
    'placard': 'Schild',
    'beach': 'Strand',
    'ocean': 'Strand',
    'sea': 'Meer',
    'restaurant': 'Restaurant',
    'cafe': 'Café',
    'coffee': 'Café',
    'park': 'Park',
    'garden': 'Garten',
    'building': 'Gebäude',
    'house': 'Haus',
    'home': 'Zuhause',
    'street': 'Straße',
    'road': 'Straße',
    'indoor': 'Innenraum',
    'room': 'Raum',
    'outdoor': 'Außen',
    'outside': 'Außen',
    'car': 'Auto',
    'vehicle': 'Fahrzeug',
    'forest': 'Wald',
    'tree': 'Wald',
    'mountain': 'Berg',
    'city': 'Stadt',
    'office': 'Büro',
    'kitchen': 'Küche',
    'bedroom': 'Schlafzimmer',
    'bathroom': 'Badezimmer',
    'living room': 'Wohnzimmer'
  };

  for (const [en, de] of Object.entries(keywords)) {
    if (lower.includes(en)) return de;
  }
  return null;
}

// Helper: Scene aus Caption extrahieren
function extractScene(caption: string): string | null {
  const lower = caption.toLowerCase();
  const moods = {
    'sunny': 'sonnig',
    'sun': 'sonnig',
    'dark': 'dunkel',
    'bright': 'hell',
    'light': 'hell',
    'cloudy': 'bewölkt',
    'cloud': 'bewölkt',
    'night': 'Nacht',
    'evening': 'Abend',
    'morning': 'Morgen',
    'day': 'Tag',
    'colorful': 'bunt',
    'black and white': 'schwarzweiß',
    'modern': 'modern',
    'old': 'alt',
    'new': 'neu',
    'beautiful': 'schön',
    'empty': 'leer',
    'crowded': 'voll',
    'quiet': 'ruhig',
    'busy': 'belebt'
  };

  for (const [en, de] of Object.entries(moods)) {
    if (lower.includes(en)) return de;
  }
  return null;
}