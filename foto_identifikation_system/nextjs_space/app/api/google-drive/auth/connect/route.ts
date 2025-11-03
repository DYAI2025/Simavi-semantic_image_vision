
export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Trigger OAuth Flow - User wird zur Authentifizierung weitergeleitet
    // Dies wird durch das oauth_token_manager Tool im Backend gehandhabt
    
    return NextResponse.json({ 
      authUrl: '/api/google-drive/auth/initiate',
      message: 'OAuth-Flow wird gestartet' 
    });
  } catch (error) {
    console.error('Fehler beim Starten des OAuth-Flows:', error);
    return NextResponse.json(
      { error: 'OAuth-Flow konnte nicht gestartet werden' },
      { status: 500 }
    );
  }
}
