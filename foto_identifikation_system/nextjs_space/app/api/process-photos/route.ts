export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest, NextResponse } from 'next/server';
import { uploadFile } from '@/lib/s3';
import { extractExifData, extractGeoData, getCameraModel, getDateTimeTaken } from '@/lib/exif-utils';
import { analyzeImage } from '@/lib/vision-api-client';
import { globalQueue } from '@/lib/queue-manager';
import { visionRateLimiter } from '@/lib/rate-limiter';
import { prisma } from '@/lib/db';
import { getNextSequenceNumber, getPlaceName } from '@/lib/photo-utils';

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
            const analysisResult = await globalQueue.add(file.name, async () => {
              await visionRateLimiter.checkLimit();
              return analyzeImage(base64String, file.name, placeName);
            });

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

