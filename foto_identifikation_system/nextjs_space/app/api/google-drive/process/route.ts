

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { downloadGoogleDriveFile, renameGoogleDriveFile } from '@/lib/google-drive';
import { extractExifData, extractGeoData, getCameraModel, getDateTimeTaken } from '@/lib/exif-utils';
import { uploadFile } from '@/lib/s3';

const prisma = new PrismaClient();

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

            // Vision AI für Bildanalyse
            const base64String = buffer.toString('base64');
            const analysisResult = await analyzeImage(base64String, image.name);

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

async function analyzeImage(base64String: string, fileName: string): Promise<{ location: string; scene: string } | null> {
  try {
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
1. Die Ort-Kategorie (z.B. Strand, Restaurant, Auto, Wald, Park, Büro, Zuhause, etc.) - ein einzelnes Wort auf Deutsch
2. Eine Szene-Beschreibung mit einem Adjektiv/Wort auf Deutsch (z.B. sonnig, gemütlich, modern, dunkel, etc.)

Antworte nur in folgendem JSON-Format:
{
  "location": "Ort-Kategorie",
  "scene": "Szene-Beschreibung"
}

Verwende nur deutsche Begriffe und halte sie kurz und prägnant.`
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
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision AI API Fehler: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('Keine Antwort von Vision AI');
    }

    const parsed = JSON.parse(content);
    
    if (!parsed.location || !parsed.scene) {
      throw new Error('Unvollständige Analyse');
    }

    return {
      location: parsed.location.trim(),
      scene: parsed.scene.trim()
    };

  } catch (error: any) {
    console.error('Vision AI Fehler:', error);
    throw error;
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
    console.error('Fehler bei Sequenznummer:', error);
    return Math.floor(Math.random() * 1000) + 1;
  }
}
