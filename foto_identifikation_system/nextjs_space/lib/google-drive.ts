

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  webViewLink?: string;
}

interface GoogleDriveFolder {
  id: string;
  name: string;
  path: string;
}

// Google Drive OAuth-Token laden
function getAccessToken(): string {
  const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error('Google Drive ist nicht verbunden. Bitte authentifizieren Sie sich zuerst.');
  }
  
  return accessToken;
}

// Ordner in Google Drive auflisten
export async function listGoogleDriveFolders(): Promise<GoogleDriveFolder[]> {
  const accessToken = getAccessToken();
  
  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.folder%27%20and%20trashed%3Dfalse&fields=files(id%2Cname%2Cparents)&pageSize=100',
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
  
  return data.files.map((file: any) => ({
    id: file.id,
    name: file.name,
    path: file.name, // Vereinfachte Darstellung
  }));
}

// Bilder aus einem Google Drive-Ordner laden
export async function listImagesInFolder(folderId: string): Promise<GoogleDriveFile[]> {
  const accessToken = getAccessToken();
  
  // Bildformate
  const imageQuery = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp',
    'image/tiff'
  ].map(mime => `mimeType='${mime}'`).join(' or ');
  
  const query = `'${folderId}' in parents and (${imageQuery}) and trashed=false`;
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id%2Cname%2CmimeType%2Csize%2CthumbnailLink%2CwebViewLink)&pageSize=100`,
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
  return data.files || [];
}

// Einzelnes Bild aus Google Drive herunterladen
export async function downloadGoogleDriveFile(fileId: string): Promise<Buffer> {
  const accessToken = getAccessToken();
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Datei konnte nicht heruntergeladen werden: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Datei zu Google Drive hochladen (umbenennt)
export async function uploadToGoogleDrive(
  buffer: Buffer,
  fileName: string,
  folderId: string,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  const accessToken = getAccessToken();
  
  // Metadata
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  // Form-Data erstellen
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    buffer.toString('binary') +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    throw new Error(`Upload fehlgeschlagen: ${response.status}`);
  }

  const result = await response.json();
  return result.id;
}

// Datei in Google Drive umbenennen
export async function renameGoogleDriveFile(fileId: string, newName: string): Promise<void> {
  const accessToken = getAccessToken();
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newName }),
    }
  );

  if (!response.ok) {
    throw new Error(`Umbenennen fehlgeschlagen: ${response.status}`);
  }
}
