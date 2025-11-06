
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest, NextResponse } from 'next/server';
import { downloadFile } from '@/lib/s3';
import JSZip from 'jszip';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get('photoId');
    const batchId = searchParams.get('batchId');
    const type = searchParams.get('type'); // 'single' oder 'batch'
    const editedNamesStr = searchParams.get('editedNames');
    
    let editedNames: Record<string, string> | undefined;
    if (editedNamesStr) {
      try {
        editedNames = JSON.parse(decodeURIComponent(editedNamesStr));
      } catch (e) {
        console.warn('Fehler beim Parsen der bearbeiteten Namen:', e);
      }
    }

    if (type === 'single' && photoId) {
      return await downloadSinglePhoto(photoId);
    } else if (type === 'batch' && batchId) {
      return await downloadPhotoBatch(batchId, editedNames);
    } else {
      return NextResponse.json(
        { error: 'Ungültige Parameter' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Download-Fehler:', error);
    return NextResponse.json(
      { error: 'Download fehlgeschlagen' },
      { status: 500 }
    );
  }
}

async function downloadSinglePhoto(photoId: string): Promise<Response> {
  try {
    // Foto aus Datenbank laden
    const photo = await prisma.photo.findUnique({
      where: { id: photoId }
    });

    if (!photo || !photo.processed) {
      return NextResponse.json(
        { error: 'Foto nicht gefunden oder nicht verarbeitet' },
        { status: 404 }
      );
    }

    // Signed URL von S3 generieren
    const signedUrl = await downloadFile(photo.cloudStoragePath);
    
    // Datei von S3 laden
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error('Datei konnte nicht von S3 geladen werden');
    }

    const buffer = await response.arrayBuffer();
    
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="${photo.newName}"`,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error: any) {
    console.error('Einzeldownload-Fehler:', error);
    return NextResponse.json(
      { error: 'Download fehlgeschlagen' },
      { status: 500 }
    );
  }
}

async function downloadPhotoBatch(batchId: string, editedNames?: Record<string, string>): Promise<Response> {
  try {
    // Alle verarbeiteten Fotos des Batches laden
    const photos = await prisma.photo.findMany({
      where: { 
        uploadBatch: batchId,
        processed: true
      }
    });

    if (photos.length === 0) {
      return NextResponse.json(
        { error: 'Keine verarbeiteten Fotos für diesen Batch gefunden' },
        { status: 404 }
      );
    }

    // ZIP-Datei erstellen
    const zip = new JSZip();

    // Parallel alle Dateien laden und zum ZIP hinzufügen
    const downloadPromises = photos.map(async (photo: any) => {
      try {
        const signedUrl = await downloadFile(photo.cloudStoragePath);
        const response = await fetch(signedUrl);
        
        if (!response.ok) {
          throw new Error(`Konnte ${photo.newName} nicht laden`);
        }

        const buffer = await response.arrayBuffer();
        
        // Verwende bearbeiteten Namen falls vorhanden, sonst Original
        const fileName = editedNames?.[photo.id] || photo.newName;
        zip.file(fileName, buffer);
        
        return { success: true, name: fileName };
      } catch (error: any) {
        console.error(`Fehler beim Laden von ${photo.newName}:`, error);
        return { success: false, name: photo.newName, error: error.message };
      }
    });

    const results = await Promise.all(downloadPromises);
    const successCount = results.filter(r => r.success).length;
    
    if (successCount === 0) {
      return NextResponse.json(
        { error: 'Keine Dateien konnten geladen werden' },
        { status: 500 }
      );
    }

    // Metadaten-Datei hinzufügen
    const metadataContent = generateMetadataFile(photos, results, editedNames);
    zip.file('_metadaten.txt', metadataContent);

    // ZIP generieren
    const zipBuffer = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const fileName = `fotos_batch_${batchId}.zip`;
    
    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': zipBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error: any) {
    console.error('Batch-Download-Fehler:', error);
    return NextResponse.json(
      { error: 'Batch-Download fehlgeschlagen' },
      { status: 500 }
    );
  }
}

function generateMetadataFile(photos: any[], results: any[], editedNames?: Record<string, string>): string {
  const timestamp = new Date().toLocaleString('de-DE');
  let content = `Foto-Identifikations- und Ordnungssystem - Batch-Export\n`;
  content += `Exportiert am: ${timestamp}\n`;
  content += `Batch-ID: ${photos[0]?.uploadBatch || 'Unbekannt'}\n`;
  content += `\nGesamtanzahl Fotos: ${photos.length}\n`;
  content += `Erfolgreich exportiert: ${results.filter(r => r.success).length}\n`;
  content += `Fehler: ${results.filter(r => !r.success).length}\n\n`;

  content += `=== FOTO-DETAILS ===\n\n`;

  photos.forEach((photo, index) => {
    const result = results[index];
    const fileName = editedNames?.[photo.id] || photo.newName;
    
    content += `${index + 1}. ${fileName}\n`;
    content += `   Original: ${photo.originalName}\n`;
    if (editedNames?.[photo.id]) {
      content += `   AI-Vorschlag: ${photo.newName}\n`;
    }
    content += `   Kategorie: ${photo.location} | Szene: ${photo.scene}\n`;
    
    if (photo.latitude && photo.longitude) {
      content += `   GPS: ${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}\n`;
    }
    
    if (photo.cameraModel) {
      content += `   Kamera: ${photo.cameraModel}\n`;
    }
    
    if (photo.dateTimeTaken) {
      content += `   Aufgenommen: ${new Date(photo.dateTimeTaken).toLocaleString('de-DE')}\n`;
    }
    
    content += `   Status: ${result?.success ? 'Erfolgreich' : `Fehler - ${result?.error || 'Unbekannt'}`}\n`;
    content += `   Erstellt: ${new Date(photo.createdAt).toLocaleString('de-DE')}\n\n`;
  });

  if (results.some(r => !r.success)) {
    content += `=== FEHLER ===\n\n`;
    results.forEach((result, index) => {
      if (!result.success) {
        content += `${result.name}: ${result.error}\n`;
      }
    });
  }

  return content;
}
