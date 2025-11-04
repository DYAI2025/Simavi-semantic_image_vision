export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { uploadFile } from '@/lib/s3';
import { extractExifData, extractGeoData, getCameraModel, getDateTimeTaken } from '@/lib/exif-utils';
import { analyzeImage } from '@/lib/vision-api-client';
import { globalQueue } from '@/lib/queue-manager';
import { visionRateLimiter } from '@/lib/rate-limiter';

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

            // Vision AI für Bildanalyse - using queue and rate limiter
            const base64String = buffer.toString('base64');

            console.log(`[Process] Starting analysis for ${file.name}`);

            const analysisResult = await globalQueue.add(file.name, async () => {
              await visionRateLimiter.checkLimit();
              return analyzeImage(base64String, file.name, placeName);
            });

            console.log(`[Process] Analysis result for ${file.name}:`, analysisResult);

            // Validate analysis result (allow fallback values)
            if (!analysisResult || !analysisResult.location || !analysisResult.scene) {
              console.error(`[Process] Invalid analysis result for ${file.name}:`, analysisResult);
              throw new Error('KI-Analyse fehlgeschlagen - unvollständige Ergebnisse');
            }

            // Check if analysis used fallback (Unbekannt) - still process but log warning
            if (analysisResult.location === 'Unbekannt') {
              console.warn(`[Process] Fallback naming used for ${file.name}`);
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
            console.error(`[Process] Error processing ${file.name}:`, error);
            console.error(`[Process] Error stack:`, error.stack);
            failedCount++;

            // Create detailed error message
            const errorMessage = error.message || 'Unbekannter Fehler';
            const detailedError = `${file.name}: ${errorMessage}`;

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
                  processingError: detailedError
                }
              });
            } catch (dbError) {
              console.error('[Process] Database error:', dbError);
            }

            sendData({
              type: 'error',
              message: detailedError
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
