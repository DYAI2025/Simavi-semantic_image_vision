
export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const authSecretsPath = path.join(process.env.HOME || '/home/ubuntu', '.config', 'abacusai_auth_secrets.json');
    
    if (!fs.existsSync(authSecretsPath)) {
      return NextResponse.json({ connected: false });
    }

    const authData = JSON.parse(fs.readFileSync(authSecretsPath, 'utf-8'));
    const googleDriveAuth = authData?.GOOGLEDRIVEUSER?.secrets?.access_token;

    if (!googleDriveAuth || !googleDriveAuth.value) {
      return NextResponse.json({ connected: false });
    }

    // Prüfen ob Token abgelaufen ist
    if (googleDriveAuth.expires_at) {
      const expiryDate = new Date(googleDriveAuth.expires_at);
      if (expiryDate < new Date()) {
        return NextResponse.json({ connected: false, expired: true });
      }
    }

    return NextResponse.json({ connected: true });
  } catch (error) {
    console.error('Fehler beim Prüfen des Auth-Status:', error);
    return NextResponse.json({ connected: false, error: true });
  }
}
