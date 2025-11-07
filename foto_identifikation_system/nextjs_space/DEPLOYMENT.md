# Fly.io Deployment Anleitung

## Voraussetzungen

1. **Fly.io Account erstellen**
   - Besuchen Sie https://fly.io/app/sign-up
   - Erstellen Sie einen Account (kostenloser Tier verfügbar)

2. **Flyctl CLI installieren**

   **macOS/Linux:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

   **Windows (PowerShell):**
   ```powershell
   pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```

3. **Bei Fly.io anmelden**
   ```bash
   flyctl auth login
   ```

## Deployment Schritte

### 1. PostgreSQL Datenbank erstellen

Erstellen Sie eine PostgreSQL Datenbank in der gleichen Region wie Ihre App:

```bash
flyctl postgres create --name simavi-db --region fra
```

Notieren Sie sich die Verbindungsdetails, insbesondere die DATABASE_URL.

### 2. Datenbank mit der App verbinden

```bash
flyctl postgres attach simavi-db --app simavi-semantic-image-vision
```

Dies setzt automatisch die DATABASE_URL Umgebungsvariable für Ihre App.

### 3. Secrets konfigurieren

Setzen Sie alle notwendigen Umgebungsvariablen als Secrets:

```bash
# NextAuth Konfiguration
flyctl secrets set NEXTAUTH_SECRET=$(openssl rand -base64 32) --app simavi-semantic-image-vision
flyctl secrets set NEXTAUTH_URL=https://simavi-semantic-image-vision.fly.dev --app simavi-semantic-image-vision

# AWS S3 Konfiguration
flyctl secrets set AWS_BUCKET_NAME=your-bucket-name --app simavi-semantic-image-vision
flyctl secrets set AWS_ACCESS_KEY_ID=your-access-key-id --app simavi-semantic-image-vision
flyctl secrets set AWS_SECRET_ACCESS_KEY=your-secret-access-key --app simavi-semantic-image-vision

# Vision AI - Hugging Face (Primary)
flyctl secrets set HUGGINGFACE_API_KEY=hf_your_token_here --app simavi-semantic-image-vision

# Vision AI - OpenAI (Fallback, optional)
flyctl secrets set OPENAI_API_KEY=sk_your_key_here --app simavi-semantic-image-vision

# App Password Protection
flyctl secrets set APP_PASSWORD=your_secure_password --app simavi-semantic-image-vision

# Google Drive OAuth (optional)
flyctl secrets set GOOGLE_CLIENT_ID=your-client-id --app simavi-semantic-image-vision
flyctl secrets set GOOGLE_CLIENT_SECRET=your-client-secret --app simavi-semantic-image-vision
flyctl secrets set GOOGLE_DRIVE_ACCESS_TOKEN=your-token --app simavi-semantic-image-vision
```

### 4. App deployen

Wechseln Sie in das Verzeichnis mit der fly.toml Datei:

```bash
cd foto_identifikation_system/nextjs_space
```

Deployen Sie die App:

```bash
flyctl deploy
```

Beim ersten Deploy wird die App automatisch erstellt, wenn sie noch nicht existiert.

### 5. Deployment überwachen

```bash
# App Status prüfen
flyctl status --app simavi-semantic-image-vision

# Logs anzeigen
flyctl logs --app simavi-semantic-image-vision

# Health Check prüfen
curl https://simavi-semantic-image-vision.fly.dev/api/health
```

### 6. Datenbank Migrationen

Die Prisma Migrationen werden automatisch beim Start der App ausgeführt (siehe scripts/start.sh).

Falls Sie manuelle Migrationen durchführen möchten:

```bash
# SSH in die laufende App
flyctl ssh console --app simavi-semantic-image-vision

# Migrationen ausführen
npx prisma migrate deploy

# Prisma Studio (für Datenbank-Management)
npx prisma studio
```

## Troubleshooting

### App startet nicht

1. **Logs prüfen:**
   ```bash
   flyctl logs --app simavi-semantic-image-vision
   ```

2. **Secrets überprüfen:**
   ```bash
   flyctl secrets list --app simavi-semantic-image-vision
   ```

3. **Datenbank-Verbindung testen:**
   ```bash
   flyctl ssh console --app simavi-semantic-image-vision
   echo $DATABASE_URL
   ```

### Datenbank-Probleme

1. **Datenbank Status prüfen:**
   ```bash
   flyctl postgres db list --app simavi-db
   ```

2. **Datenbank Verbindung testen:**
   ```bash
   flyctl postgres connect --app simavi-db
   ```

### Build-Fehler

1. **Dockerfile lokal testen:**
   ```bash
   docker build -t simavi-test .
   docker run -p 3000:3000 simavi-test
   ```

2. **Build-Logs anzeigen:**
   Die Build-Logs werden während `flyctl deploy` angezeigt.

## Wichtige Befehle

```bash
# App neu starten
flyctl apps restart simavi-semantic-image-vision

# App skalieren (mehr Ressourcen)
flyctl scale vm shared-cpu-2x --app simavi-semantic-image-vision
flyctl scale memory 2048 --app simavi-semantic-image-vision

# App löschen (Vorsicht!)
flyctl apps destroy simavi-semantic-image-vision

# Kosten überwachen
flyctl apps list
```

## Konfiguration anpassen

Nach Änderungen an der Konfiguration (fly.toml, Dockerfile):

```bash
flyctl deploy
```

Die App wird automatisch neu gebaut und deployed.

## Kostenoptimierung

Der Free Tier von Fly.io beinhaltet:
- 3 shared-cpu-1x 256mb VMs
- 3GB persistenten Speicher
- 160GB ausgehender Datenverkehr

Um Kosten zu sparen:
- `auto_stop_machines = true` (bereits konfiguriert)
- `min_machines_running = 0` (bereits konfiguriert)
- Die App stoppt automatisch bei Inaktivität

## Weitere Ressourcen

- [Fly.io Dokumentation](https://fly.io/docs/)
- [Fly.io PostgreSQL Dokumentation](https://fly.io/docs/postgres/)
- [Next.js auf Fly.io](https://fly.io/docs/languages-and-frameworks/nextjs/)
- [Prisma Deployment Guides](https://www.prisma.io/docs/guides/deployment)

## Support

Bei Problemen:
1. Fly.io Community Forum: https://community.fly.io/
2. Fly.io Discord: https://fly.io/discord
3. GitHub Issues: Dokumentieren Sie Probleme in Ihrem Repository
