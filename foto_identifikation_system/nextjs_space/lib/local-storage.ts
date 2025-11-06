// Local file storage implementation for testing
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const UPLOAD_DIR = path.join(os.tmpdir(), 'simavi_uploads');

// Ensure upload directory exists
await fs.mkdir(UPLOAD_DIR, { recursive: true });

export async function uploadFile(buffer: Buffer, fileName: string): Promise<string> {
  const timestamp = Date.now();
  const key = `${timestamp}-${fileName}`;
  const filePath = path.join(UPLOAD_DIR, key);
  
  await fs.writeFile(filePath, buffer);
  
  // Return a local file path reference
  return `local://${key}`;
}

export async function downloadFile(key: string): Promise<string> {
  if (key.startsWith('local://')) {
    const fileName = key.replace('local://', '');
    const filePath = path.join(UPLOAD_DIR, fileName);
    
    // For testing purposes, return a data URL
    const fileBuffer = await fs.readFile(filePath);
    const base64 = fileBuffer.toString('base64');
    const mimeType = getMimeType(fileName);
    
    return `data:${mimeType};base64,${base64}`;
  }
  
  throw new Error(`Unsupported key format: ${key}`);
}

export async function deleteFile(key: string): Promise<void> {
  if (key.startsWith('local://')) {
    const fileName = key.replace('local://', '');
    const filePath = path.join(UPLOAD_DIR, fileName);
    
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
      // Don't throw, since we might be trying to delete a file that doesn't exist
    }
  }
}

function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}