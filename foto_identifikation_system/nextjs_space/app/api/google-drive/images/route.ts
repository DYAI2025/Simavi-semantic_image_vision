

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { listImagesInFolder } from '@/lib/google-drive';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    if (!folderId) {
      return NextResponse.json(
        { error: 'Ordner-ID fehlt' },
        { status: 400 }
      );
    }

    const images = await listImagesInFolder(folderId);
    return NextResponse.json({ images });
  } catch (error: any) {
    console.error('Fehler beim Laden der Bilder:', error);
    return NextResponse.json(
      { error: error.message || 'Bilder konnten nicht geladen werden' },
      { status: 500 }
    );
  }
}
