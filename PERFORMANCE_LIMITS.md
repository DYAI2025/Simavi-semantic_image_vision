# Performance & Kapazitäts-Limits

## Aktuelle Konfiguration

### System-Limits
- **Parallele Verarbeitung**: 3 Bilder gleichzeitig
- **Rate Limit**: 10 AI-Requests pro Minute
- **Retry-Versuche**: 3x pro Bild (mit Exponential Backoff)

### API-Provider Limits

#### Hugging Face (Primary - Kostenlos)
- **Free Tier**: ~30-60 Requests/Minute
- **Model Loading**: Cold Start kann 20-30s dauern
- **Memory**: ~512MB RAM pro Request
- **Timeout**: 60 Sekunden pro Request

#### OpenAI (Fallback - Kostenpflichtig)
- **Rate Limit**: 500 Requests/Minute
- **Kosten**: $0.15 pro 1M Input-Tokens (~$0.0001 pro Bild)
- **Timeout**: 30 Sekunden pro Request

## Kapazitäts-Tabelle

| Batch-Größe | Geschätzte Zeit | Status | Empfehlung |
|-------------|-----------------|--------|------------|
| 1-5 Bilder | 15-30 Sekunden | ✅ Optimal | Beste User Experience |
| 6-10 Bilder | 30-60 Sekunden | ✅ Gut | Empfohlen für normale Nutzung |
| 11-30 Bilder | 2-6 Minuten | ⚠️ Langsam | Benötigt Geduld |
| 31-50 Bilder | 6-10 Minuten | ⚠️ Sehr langsam | Nur für Batch-Verarbeitung |
| 51-100 Bilder | 10-20 Minuten | 🔴 Kritisch | Risiko: Browser-Timeout |
| 100+ Bilder | 20+ Minuten | 🔴 Instabil | NICHT empfohlen |

## Engpässe & Risiken

### 1. Rate Limiter (10/Minute)
**Problem**: Bei mehr als 10 Bildern müssen weitere warten
**Auswirkung**: Verzögerungen von ~30-60s nach jedem 10er-Block

### 2. Browser Connection Timeout
**Problem**: SSE (Server-Sent Events) Verbindung kann nach ~5-10 Min timeout
**Auswirkung**: Frontend verliert Verbindung, aber Backend läuft weiter
**Risiko**: Ab ~50-75 Bildern

### 3. Memory Limits (Next.js)
**Problem**: Große Bilder (>5MB) + Base64-Encoding = 2-3x RAM-Nutzung
**Auswirkung**: Server kann bei zu vielen parallelen Requests abstürzen
**Risiko**: Bei >100 Bildern mit je >5MB

### 4. Hugging Face Model Cold Start
**Problem**: Bei längerer Inaktivität schläft das Model (~5+ Min)
**Auswirkung**: Erste 1-3 Requests dauern 20-30s statt 3-5s
**Lösung**: Automatischer Fallback zu OpenAI

## Optimierungs-Empfehlungen

### Für Produktiv-Betrieb (Viele Nutzer):

```typescript
// lib/queue-manager.ts
export const globalQueue = new QueueManager(5); // Erhöht von 3 auf 5

// lib/rate-limiter.ts
export const visionRateLimiter = new RateLimiter(20, 60000); // Erhöht auf 20/Min
```

### Für High-Volume Batches (100+ Bilder):

**Option A: Erhöhe Limits**
```typescript
// Nur wenn Hugging Face Pro oder OpenAI als Primary verwendet wird
export const globalQueue = new QueueManager(10);
export const visionRateLimiter = new RateLimiter(50, 60000);
```

**Option B: Implementiere Batch-Splitting**
```typescript
// Frontend: Split große Uploads in Chunks von 20 Bildern
const BATCH_SIZE = 20;
for (let i = 0; i < files.length; i += BATCH_SIZE) {
  const chunk = files.slice(i, i + BATCH_SIZE);
  await processChunk(chunk);
}
```

### Für kostenlose Nutzung (Hugging Face Free):

**Bleib bei aktuellen Limits:**
- Max 3 parallel
- Max 10/Minute
- Batch-Größe: Max 20-30 Bilder pro Upload

**Grund**: Hugging Face Free Tier kann sonst Rate-Limiting aktivieren oder Account sperren

## Monitoring-Tipps

### Server-Logs überprüfen:
```bash
# Rate Limiter Status
[RateLimit] Warte 30s  # ⚠️ Zu viele Requests

# Queue Status
[Queue] Start: bild.jpg (3/3)  # ℹ️ Queue ist voll

# Vision API Probleme
[Vision] HF failed: 503  # ⚠️ Model Overload oder Cold Start
```

### Performance-Metriken:
- **Durchschnitt**: 3-5 Sekunden pro Bild (bei warmem Model)
- **Cold Start**: 20-30 Sekunden für erste 3 Bilder
- **Mit Fallback**: 5-8 Sekunden pro Bild (OpenAI ist schneller)

## Empfohlene User-Limits im Frontend

```typescript
// components/photo-upload-area.tsx
const MAX_FILES = 30; // Limit pro Upload
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB pro Bild

if (files.length > MAX_FILES) {
  toast({
    title: "Zu viele Dateien",
    description: `Bitte maximal ${MAX_FILES} Bilder auf einmal hochladen.`,
    variant: "destructive"
  });
}
```

## Zusammenfassung

**Aktuell STABIL für:**
- ✅ 1-30 Bilder pro Batch
- ✅ Free Tier (Hugging Face)
- ✅ Mehrere gleichzeitige Nutzer (5-10)

**INSTABIL ab:**
- ⚠️ >50 Bilder pro Batch (Browser-Timeout-Risiko)
- ⚠️ >100 Bilder (Memory-Probleme)
- ⚠️ >20 gleichzeitige Nutzer (Rate-Limiting)

**Für Production mit vielen Nutzern:**
- Upgrade zu Hugging Face Pro (~$9/Monat)
- Oder verwende OpenAI als Primary (~$10-20/Monat für 1000-2000 Bilder)
- Implementiere Backend-Queue (Redis/BullMQ) für große Batches
