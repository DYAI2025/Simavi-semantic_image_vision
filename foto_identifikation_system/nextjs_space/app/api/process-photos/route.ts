
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { uploadFile } from '@/lib/s3';
import { extractExifData, extractGeoData, getCameraModel, getDateTimeTaken } from '@/lib/exif-utils';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const batchId = formData.get('batchId') as string;

    if (!batchId) {
      return NextResponse.json({ error: 'Batch-ID fehlt' }, { status: 400 });
    }

    // Alle Dateien aus FormData extrahieren
    const files: { file: File; index: number }[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file_') && value instanceof File) {
        const index = parseInt(key.replace('file_', ''));
        files.push({ file: value, index });
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'Keine Dateien gefunden' }, { status: 400 });
    }

    // Upload-Batch in Datenbank erstellen
    await prisma.uploadBatch.create({
      data: {
        batchId,
        totalFiles: files.length,
        status: 'processing'
      }
    });

    // Streaming Response erstellen
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const sendData = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        let processedCount = 0;
        let completedCount = 0;
        let failedCount = 0;

        for (const { file, index } of files) {
          try {
            processedCount++;
            sendData({ 
              type: 'progress', 
              processed: processedCount, 
              completed: completedCount,
              failed: failedCount,
              current: file.name 
            });

            // EXIF-Daten extrahieren
            const exifData = await extractExifData(file);
            const geoData = extractGeoData(exifData);
            const cameraModel = getCameraModel(exifData);
            const dateTimeTaken = getDateTimeTaken(exifData);

            // File zu Buffer konvertieren
            const buffer = Buffer.from(await file.arrayBuffer());
            
            // File zu S3 hochladen
            const cloudStoragePath = await uploadFile(buffer, file.name);

            // Offizielle Ortsnamen via Reverse Geocoding abrufen (falls GPS verfügbar)
            let placeName: string | null = null;
            if (geoData.latitude && geoData.longitude) {
              placeName = await getPlaceName(geoData.latitude, geoData.longitude);
            }

            // Vision AI für Bildanalyse
            const base64String = buffer.toString('base64');
            const analysisResult = await analyzeImage(base64String, file.name, placeName);

            if (!analysisResult || !analysisResult.location || !analysisResult.scene) {
              throw new Error('KI-Analyse fehlgeschlagen - unvollständige Ergebnisse');
            }

            // Sequenz-Nummer für Kategorie ermitteln
            const sequenceNumber = await getNextSequenceNumber(analysisResult.location);

            // Neuen Namen generieren
            const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
            const newName = `${analysisResult.location}_${analysisResult.scene}_${sequenceNumber.toString().padStart(3, '0')}.${fileExtension}`;

            // In Datenbank speichern
            const photo = await prisma.photo.create({
              data: {
                originalName: file.name,
                newName,
                cloudStoragePath,
                location: analysisResult.location,
                scene: analysisResult.scene,
                sequenceNumber,
                latitude: geoData.latitude,
                longitude: geoData.longitude,
                altitude: geoData.altitude,
                exifData: exifData || {},
                dateTimeTaken,
                cameraModel,
                uploadBatch: batchId,
                processed: true
              }
            });

            completedCount++;
            sendData({ 
              type: 'photo', 
              data: photo 
            });

          } catch (error: any) {
            console.error(`Fehler bei Verarbeitung von ${file.name}:`, error);
            failedCount++;

            // Fehler in Datenbank speichern
            try {
              await prisma.photo.create({
                data: {
                  originalName: file.name,
                  newName: file.name, // Fallback
                  cloudStoragePath: '', // Leer bei Fehler
                  location: 'Unbekannt',
                  scene: 'Fehler',
                  sequenceNumber: 0,
                  uploadBatch: batchId,
                  processed: false,
                  processingError: error.message
                }
              });
            } catch (dbError) {
              console.error('Fehler beim Speichern in Datenbank:', dbError);
            }

            sendData({ 
              type: 'error', 
              message: `Fehler bei ${file.name}: ${error.message}` 
            });
          }

          // Fortschritt aktualisieren
          sendData({ 
            type: 'progress', 
            processed: processedCount, 
            completed: completedCount,
            failed: failedCount
          });
        }

        // Upload-Batch Status aktualisieren
        await prisma.uploadBatch.update({
          where: { batchId },
          data: {
            processedFiles: processedCount,
            completedFiles: completedCount,
            failedFiles: failedCount,
            status: failedCount === files.length ? 'failed' : 'completed'
          }
        });

        sendData({ type: 'completed' });
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Unerwarteter Fehler:', error);
    return NextResponse.json(
      { error: 'Unerwarteter Server-Fehler' },
      { status: 500 }
    );
  }
}

async function analyzeImage(base64String: string, fileName: string, placeName: string | null): Promise<{ location: string; scene: string } | null> {
  try {
    const placeContext = placeName 
      ? `\n\nZusätzliche Kontext-Information: Das Foto wurde aufgenommen bei/in "${placeName}". Wenn dies ein spezifischer Ort ist (z.B. eine Parkanlage, ein Restaurant, ein Denkmal), verwende diesen Namen als Ort-Kategorie. Ansonsten verwende eine allgemeine Kategorie.`
      : '';

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
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
                url: `data:image/jpeg;base64,${base64String}`
              }
            }
          ]
        }],
        response_format: { type: "json_object" },
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision AI API Fehler: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('Keine Antwort von Vision AI erhalten');
    }

    const parsed = JSON.parse(content);
    
    if (!parsed.location || !parsed.scene) {
      throw new Error('Unvollständige Vision AI Analyse');
    }

    // Leerzeichen durch Bindestriche ersetzen und Sonderzeichen entfernen
    const sanitizeForFilename = (str: string) => {
      return str
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9äöüÄÖÜß\-]/g, '')
        .replace(/-+/g, '-');
    };

    return {
      location: sanitizeForFilename(parsed.location),
      scene: sanitizeForFilename(parsed.scene)
    };

  } catch (error: any) {
    console.error('Vision AI Analyse Fehler:', error);
    throw new Error(`Vision AI Analyse fehlgeschlagen: ${error.message}`);
  }
}

async function getPlaceName(latitude: number, longitude: number): Promise<string | null> {
  try {
    // OpenStreetMap Nominatim API für Reverse Geocoding (kostenlos)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'FotoIdentifikationSystem/1.0'
        }
      }
    );

    if (!response.ok) {
      console.warn('Nominatim API Fehler:', response.status);
      return null;
    }

    const data = await response.json();
    
    // Priorisiere spezifische Orte
    const placeName = 
      data.address?.tourism ||           // z.B. Sehenswürdigkeiten, Denkmäler
      data.address?.leisure ||           // z.B. Parks, Spielplätze
      data.address?.amenity ||           // z.B. Restaurants, Cafés
      data.address?.building ||          // z.B. spezifische Gebäude
      data.address?.neighbourhood ||     // z.B. Stadtviertel
      data.address?.suburb ||            // z.B. Stadtteile
      data.address?.town ||              // z.B. kleine Städte
      data.address?.city ||              // z.B. Städte
      data.address?.village;             // z.B. Dörfer

    return placeName || null;

  } catch (error) {
    console.error('Fehler beim Abrufen des Ortsnamens:', error);
    return null;
  }
}

async function getNextSequenceNumber(location: string): Promise<number> {
  try {
    const counter = await prisma.categoryCounter.upsert({
      where: { categoryName: location },
      update: {
        currentCounter: { increment: 1 }
      },
      create: {
        categoryName: location,
        currentCounter: 1
      }
    });

    return counter.currentCounter;
  } catch (error) {
    console.error('Fehler beim Generieren der Sequenznummer:', error);
    return Math.floor(Math.random() * 1000) + 1; // Fallback
  }
}
