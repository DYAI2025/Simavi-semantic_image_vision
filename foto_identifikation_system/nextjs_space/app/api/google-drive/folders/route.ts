
export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Access Token aus auth secrets lesen
    const authSecretsPath = path.join(process.env.HOME || '/home/ubuntu', '.config', 'abacusai_auth_secrets.json');
    
    if (!fs.existsSync(authSecretsPath)) {
      return NextResponse.json({ error: 'Nicht verbunden' }, { status: 401 });
    }

    const authData = JSON.parse(fs.readFileSync(authSecretsPath, 'utf-8'));
    const accessToken = authData?.GOOGLEDRIVEUSER?.secrets?.access_token?.value;

    if (!accessToken) {
      return NextResponse.json({ error: 'Nicht verbunden' }, { status: 401 });
    }

    // Google Drive API aufrufen
    const response = await fetch(
      'https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.folder%27&fields=files(id%2Cname)',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Google Drive API Fehler: ${response.status}`);
    }

    const data = await response.json();
    
    // Für jeden Ordner die Anzahl der Bilder zählen
    const foldersWithCount = await Promise.all(
      (data.files || []).map(async (folder: any) => {
        try {
          const imagesResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=%27${folder.id}%27+in+parents+and+(mimeType+contains+%27image%2F%27)&fields=files(id)`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );
          
          if (imagesResponse.ok) {
            const imagesData = await imagesResponse.json();
            return {
              id: folder.id,
              name: folder.name,
              imageCount: (imagesData.files || []).length,
            };
          }
          
          return {
            id: folder.id,
            name: folder.name,
            imageCount: 0,
          };
        } catch (err) {
          return {
            id: folder.id,
            name: folder.name,
            imageCount: 0,
          };
        }
      })
    );

    // Nur Ordner mit Bildern zurückgeben
    const foldersWithImages = foldersWithCount.filter(f => f.imageCount > 0);

    return NextResponse.json({ 
      folders: foldersWithImages,
      total: foldersWithImages.length 
    });
  } catch (error: any) {
    console.error('Fehler beim Laden der Ordner:', error);
    return NextResponse.json(
      { error: 'Ordner konnten nicht geladen werden', details: error.message },
      { status: 500 }
    );
  }
}
