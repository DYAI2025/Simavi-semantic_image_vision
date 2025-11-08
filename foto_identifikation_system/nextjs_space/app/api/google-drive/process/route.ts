

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest, NextResponse } from 'next/server';
import { downloadGoogleDriveFile, renameGoogleDriveFile } from '@/lib/google-drive';
import { extractExifData, extractGeoData, getCameraModel, getDateTimeTaken } from '@/lib/exif-utils';
import { uploadFile } from '@/lib/s3';
import { analyzeImage } from '@/lib/vision-api-client';
import { globalQueue } from '@/lib/queue-manager';
import { visionRateLimiter } from '@/lib/rate-limiter';
import { prisma } from '@/lib/db';
import { getNextSequenceNumber } from '@/lib/photo-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { folderId, images, batchId } = body;

    if (!folderId || !images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'Ungültige Parameter' },
        { status: 400 }
      );
    }

    // Upload-Batch in Datenbank erstellen
    await prisma.uploadBatch.create({
      data: {
        batchId,
        totalFiles: images.length,
        status: 'processing'
      }
    });

    // Streaming Response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const sendData = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        let processedCount = 0;
        let completedCount = 0;
        let failedCount = 0;

        for (const image of images) {
          try {
            processedCount++;
            sendData({ 
              type: 'progress', 
              processed: processedCount, 
              completed: completedCount,
              failed: failedCount,
              current: image.name 
            });

            // Bild von Google Drive herunterladen
            const buffer = await downloadGoogleDriveFile(image.id);

            // EXIF-Daten extrahieren (aus Buffer)
            const blob = new Blob([buffer]);
            const file = new File([blob], image.name, { type: image.mimeType });
            const exifData = await extractExifData(file);
            const geoData = extractGeoData(exifData);
            const cameraModel = getCameraModel(exifData);
            const dateTimeTaken = getDateTimeTaken(exifData);

            // Zu S3 hochladen (für Backup/Vorschau)
            const cloudStoragePath = await uploadFile(buffer, image.name);

            // Vision AI für Bildanalyse - using queue and rate limiter
            const base64String = buffer.toString('base64');
            const analysisResult = await globalQueue.add(image.name, async () => {
              await visionRateLimiter.checkLimit();
              return analyzeImage(base64String, image.name, null); // Note: placeName is null for Google Drive
            });

            if (!analysisResult || !analysisResult.location || !analysisResult.scene) {
              throw new Error('KI-Analyse fehlgeschlagen');
            }

            // Sequenz-Nummer ermitteln
            const sequenceNumber = await getNextSequenceNumber(analysisResult.location);

            // Neuen Namen generieren
            const fileExtension = image.name.split('.').pop()?.toLowerCase() || 'jpg';
            const newName = `${analysisResult.location}_${analysisResult.scene}_${sequenceNumber.toString().padStart(3, '0')}.${fileExtension}`;

            // In Google Drive umbenennen
            await renameGoogleDriveFile(image.id, newName);

            // In Datenbank speichern
            const photo = await prisma.photo.create({
              data: {
                originalName: image.name,
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
            console.error(`Fehler bei ${image.name}:`, error);
            failedCount++;

            try {
              await prisma.photo.create({
                data: {
                  originalName: image.name,
                  newName: image.name,
                  cloudStoragePath: '',
                  location: 'Unbekannt',
                  scene: 'Fehler',
                  sequenceNumber: 0,
                  uploadBatch: batchId,
                  processed: false,
                  processingError: error.message
                }
              });
            } catch (dbError) {
              console.error('DB-Fehler:', dbError);
            }

            sendData({ 
              type: 'error', 
              message: `Fehler bei ${image.name}: ${error.message}` 
            });
          }

          sendData({ 
            type: 'progress', 
            processed: processedCount, 
            completed: completedCount,
            failed: failedCount
          });
        }

        // Batch-Status aktualisieren
        await prisma.uploadBatch.update({
          where: { batchId },
          data: {
            processedFiles: processedCount,
            completedFiles: completedCount,
            failedFiles: failedCount,
            status: failedCount === images.length ? 'failed' : 'completed'
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
      { error: 'Server-Fehler' },
      { status: 500 }
    );
  }
}



