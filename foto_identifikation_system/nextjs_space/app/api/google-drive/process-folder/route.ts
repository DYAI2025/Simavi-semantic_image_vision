
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { uploadFile } from '@/lib/s3';
import { extractExifData, extractGeoData, getCameraModel, getDateTimeTaken } from '@/lib/exif-utils';
import { analyzeImage } from '@/lib/vision-api-client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { folderId, folderName } = await request.json();

    if (!folderId) {
      return NextResponse.json({ error: 'Folder-ID fehlt' }, { status: 400 });
    }

    // Access Token holen
    const authSecretsPath = path.join(process.env.HOME || '/home/ubuntu', '.config', 'abacusai_auth_secrets.json');
    
    if (!fs.existsSync(authSecretsPath)) {
      return NextResponse.json({ error: 'Nicht verbunden' }, { status: 401 });
    }

    const authData = JSON.parse(fs.readFileSync(authSecretsPath, 'utf-8'));
    const accessToken = authData?.GOOGLEDRIVEUSER?.secrets?.access_token?.value;

    if (!accessToken) {
      return NextResponse.json({ error: 'Nicht verbunden' }, { status: 401 });
    }

    // Batch-ID generieren
    const batchId = `gdrive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Bilder aus Ordner abrufen
    const filesResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=%27${folderId}%27+in+parents+and+(mimeType+contains+%27image%2F%27)&fields=files(id%2Cname%2CmimeType)`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!filesResponse.ok) {
      throw new Error('Fehler beim Laden der Bilder aus Google Drive');
    }

    const filesData = await filesResponse.json();
    const files = filesData.files || [];

    if (files.length === 0) {
      return NextResponse.json({ error: 'Keine Bilder im Ordner gefunden' }, { status: 400 });
    }

    // Upload-Batch erstellen
    await prisma.uploadBatch.create({
      data: {
        batchId,
        totalFiles: files.length,
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

        for (const file of files) {
          try {
            processedCount++;
            sendData({ 
              type: 'progress', 
              processed: processedCount, 
              completed: completedCount,
              failed: failedCount,
              current: file.name 
            });

            // Bild von Google Drive herunterladen
            const imageResponse = await fetch(
              `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              }
            );

            if (!imageResponse.ok) {
              throw new Error(`Fehler beim Herunterladen: ${imageResponse.status}`);
            }

            const arrayBuffer = await imageResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // EXIF-Daten extrahieren
            const blob = new Blob([buffer], { type: file.mimeType });
            const imageFile = new File([blob], file.name, { type: file.mimeType });
            const exifData = await extractExifData(imageFile);
            const geoData = extractGeoData(exifData);
            const cameraModel = getCameraModel(exifData);
            const dateTimeTaken = getDateTimeTaken(exifData);

            // File zu S3 hochladen
            const cloudStoragePath = await uploadFile(buffer, file.name);

            // Vision AI Analyse
            const base64String = buffer.toString('base64');
            const analysisResult = await analyzeImage(base64String, file.name);

            if (!analysisResult || !analysisResult.location || !analysisResult.scene) {
              throw new Error('KI-Analyse fehlgeschlagen');
            }

            // Sequenz-Nummer
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
            sendData({ type: 'photo', data: photo });

          } catch (error: any) {
            console.error(`Fehler bei ${file.name}:`, error);
            failedCount++;

            try {
              await prisma.photo.create({
                data: {
                  originalName: file.name,
                  newName: file.name,
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
              console.error('DB Fehler:', dbError);
            }

            sendData({ 
              type: 'error', 
              message: `Fehler bei ${file.name}: ${error.message}` 
            });
          }

          sendData({ 
            type: 'progress', 
            processed: processedCount, 
            completed: completedCount,
            failed: failedCount
          });
        }

        // Batch Status aktualisieren
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
    console.error('Fehler:', error);
    return NextResponse.json(
      { error: 'Verarbeitung fehlgeschlagen', details: error.message },
      { status: 500 }
    );
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
    return Math.floor(Math.random() * 1000) + 1;
  }
}
