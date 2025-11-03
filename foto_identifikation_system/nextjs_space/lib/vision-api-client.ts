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
      if (i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('Retry failed');
}

// Hugging Face API
async function analyzeWithHuggingFace(base64: string, placeName: string | null): Promise<VisionResult> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) throw new Error('HF_KEY missing');

  const prompt = `Analysiere das Bild auf Deutsch:\n1. Ort-Kategorie (1-2 Wörter): z.B. Strand, Restaurant, Park\n2. Szene (1 Wort): z.B. sonnig, dunkel, modern\n${placeName ? `\nGPS-Kontext: ${placeName}` : ''}\n\nAntworte nur JSON: {"location":"...", "scene":"..."}`;

  const res = await fetch('https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: base64,
      parameters: { max_length: 50 }
    })
  });

  if (!res.ok) throw new Error(`HF Error: ${res.status}`);
  
  const data = await res.json();
  const caption = data[0]?.generated_text || '';
  
  // Fallback auf simple Kategorisierung wenn HF nur Caption liefert
  const location = extractLocation(caption) || 'Unbekannt';
  const scene = extractScene(caption) || 'standard';
  
  return { location, scene };
}

// OpenAI Fallback
async function analyzeWithOpenAI(base64: string, placeName: string | null): Promise<VisionResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_KEY missing');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analysiere das Bild auf Deutsch:\n1. Ort-Kategorie (1-2 Wörter): Strand, Restaurant, Park, Auto, etc.\n2. Szene-Wort: sonnig, dunkel, modern, gemütlich, etc.\n${placeName ? `\nGPS-Kontext: ${placeName}` : ''}\n\nJSON: {"location":"...", "scene":"..."}`
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64}` }
          }
        ]
      }],
      max_tokens: 100,
      temperature: 0.3
    })
  });

  if (!res.ok) throw new Error(`OpenAI Error: ${res.status}`);
  
  const data = await res.json();
  const content = data.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);
  
  return {
    location: sanitize(parsed.location || 'Unbekannt'),
    scene: sanitize(parsed.scene || 'standard')
  };
}

// Main Export - Auto-Fallback
export async function analyzeImage(
  base64: string, 
  fileName: string, 
  placeName: string | null
): Promise<VisionResult> {
  
  // Versuch 1: Hugging Face (kostenlos)
  try {
    console.log(`[Vision] HF Analysis: ${fileName}`);
    return await retry(() => analyzeWithHuggingFace(base64, placeName));
  } catch (hfError: any) {
    console.warn(`[Vision] HF failed: ${hfError.message}`);
  }

  // Versuch 2: OpenAI Fallback
  try {
    console.log(`[Vision] OpenAI Fallback: ${fileName}`);
    return await retry(() => analyzeWithOpenAI(base64, placeName));
  } catch (openaiError: any) {
    console.error(`[Vision] Both providers failed: ${openaiError.message}`);
  }

  // Absolute Fallback
  return {
    location: 'Unbekannt',
    scene: fileName.split('.')[0].substring(0, 20)
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
    'beach': 'Strand',
    'restaurant': 'Restaurant', 
    'park': 'Park',
    'building': 'Gebäude',
    'street': 'Straße',
    'indoor': 'Innenraum',
    'outdoor': 'Außen',
    'car': 'Auto',
    'forest': 'Wald'
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
    'dark': 'dunkel',
    'bright': 'hell',
    'cloudy': 'bewölkt',
    'night': 'Nacht'
  };
  
  for (const [en, de] of Object.entries(moods)) {
    if (lower.includes(en)) return de;
  }
  return null;
}