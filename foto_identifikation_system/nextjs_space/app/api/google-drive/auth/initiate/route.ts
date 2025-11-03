
export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';

export async function GET() {
  // Diese Route ist ein Platzhalter für die OAuth-Initiierung
  // In einer echten Implementierung würde dies durch das oauth_token_manager Tool erfolgen
  
  return new NextResponse(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Google Drive Authentifizierung</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
          background: white;
          padding: 2rem;
          border-radius: 1rem;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          text-align: center;
          max-width: 400px;
        }
        h1 {
          color: #333;
          margin-bottom: 1rem;
        }
        p {
          color: #666;
          margin-bottom: 1.5rem;
        }
        .info {
          background: #f0f9ff;
          padding: 1rem;
          border-radius: 0.5rem;
          border-left: 4px solid #3b82f6;
          text-align: left;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔐 Google Drive Verbindung</h1>
        <p>Um Google Drive zu verbinden, muss die OAuth-Authentifizierung vom Administrator eingerichtet werden.</p>
        <div class="info">
          <strong>Hinweis:</strong> Diese Funktion erfordert eine vollständige OAuth-Konfiguration mit Google Cloud Console.
        </div>
      </div>
      <script>
        setTimeout(() => {
          window.close();
        }, 5000);
      </script>
    </body>
    </html>
    `,
    {
      headers: {
        'Content-Type': 'text/html',
      },
    }
  );
}
