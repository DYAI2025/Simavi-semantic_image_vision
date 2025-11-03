

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { downloadFile } from '@/lib/s3';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { error: 'Pfad fehlt' },
        { status: 400 }
      );
    }

    // Signed URL generieren (gültig für 1 Stunde)
    const url = await downloadFile(path);

    return NextResponse.json({ url });

  } catch (error: any) {
    console.error('Fehler beim Generieren der Bild-URL:', error);
    return NextResponse.json(
      { error: 'URL konnte nicht generiert werden' },
      { status: 500 }
    );
  }
}
