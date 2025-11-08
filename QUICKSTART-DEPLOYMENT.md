# 🚀 Quick Start: Fly.io Deployment

Dieses Projekt ist vollständig für Fly.io vorbereitet. Folgen Sie diesen Schritten für ein schnelles Deployment:

## Option 1: Automatisches Deployment (Empfohlen)

### Schritt 1: Flyctl installieren

**macOS/Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

**macOS mit Homebrew:**
```bash
brew install flyctl
```

**Windows (PowerShell):**
```powershell
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

### Schritt 2: Login bei Fly.io
```bash
flyctl auth login
```

### Schritt 3: Deployment-Script ausführen
```bash
cd foto_identifikation_system/nextjs_space
./deploy.sh
```

Das Script führt automatisch aus:
- ✅ App-Erstellung
- ✅ PostgreSQL Datenbank Setup
- ✅ Secrets-Konfiguration (interaktiv)
- ✅ Deployment
- ✅ Status-Check

---

## Option 2: Manuelles Deployment

### 1. App erstellen
```bash
cd foto_identifikation_system/nextjs_space
flyctl apps create simavi-semantic-image-vision --org personal
```

### 2. PostgreSQL Datenbank erstellen
```bash
flyctl postgres create --name simavi-db --region fra
flyctl postgres attach simavi-db --app simavi-semantic-image-vision
```

### 3. Secrets setzen
```bash
# NextAuth
flyctl secrets set NEXTAUTH_SECRET=$(openssl rand -base64 32) --app simavi-semantic-image-vision
flyctl secrets set NEXTAUTH_URL=https://simavi-semantic-image-vision.fly.dev --app simavi-semantic-image-vision

# AWS S3
flyctl secrets set AWS_BUCKET_NAME=your-bucket-name --app simavi-semantic-image-vision
flyctl secrets set AWS_ACCESS_KEY_ID=your-key --app simavi-semantic-image-vision
flyctl secrets set AWS_SECRET_ACCESS_KEY=your-secret --app simavi-semantic-image-vision

# AI APIs
flyctl secrets set HUGGINGFACE_API_KEY=hf_your_token --app simavi-semantic-image-vision
flyctl secrets set OPENAI_API_KEY=sk_your_key --app simavi-semantic-image-vision  # optional

# App Security
flyctl secrets set APP_PASSWORD=your_password --app simavi-semantic-image-vision
```

### 4. Deployen
```bash
flyctl deploy
```

---

## ✅ Deployment überprüfen

Nach dem Deployment:

```bash
# Status prüfen
flyctl status --app simavi-semantic-image-vision

# Logs ansehen
flyctl logs --app simavi-semantic-image-vision

# Health Check
curl https://simavi-semantic-image-vision.fly.dev/api/health
```

**Erwartete Antwort vom Health Check:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-07T...",
  "service": "Simavi Semantic Image Vision System"
}
```

---

## 🔧 Troubleshooting

### App startet nicht
```bash
# Detaillierte Logs
flyctl logs --app simavi-semantic-image-vision

# SSH in Container
flyctl ssh console --app simavi-semantic-image-vision
```

### Datenbank-Probleme
```bash
# Datenbank Status
flyctl postgres db list --app simavi-db

# Datenbank Connect
flyctl postgres connect --app simavi-db
```

### Build-Fehler
```bash
# Lokaler Test
docker build -t simavi-test .
docker run -p 3000:3000 -e DATABASE_URL="postgresql://..." simavi-test
```

### Secrets überprüfen
```bash
flyctl secrets list --app simavi-semantic-image-vision
```

---

## 🔄 Updates deployen

Nach Code-Änderungen:

```bash
cd foto_identifikation_system/nextjs_space
git pull origin main
flyctl deploy
```

---

## 💰 Kosten

**Fly.io Free Tier:**
- 3 shared-cpu-1x VMs (256MB)
- 3GB persistenter Speicher
- 160GB ausgehender Traffic

**Diese App nutzt:**
- 1 VM (1 CPU, 1GB RAM)
- Auto-Stop bei Inaktivität ✅
- Auto-Start bei Anfragen ✅

**Geschätzte Kosten:** $0-5/Monat (bei normaler Nutzung im Free Tier)

---

## 📚 Weitere Dokumentation

- **Vollständige Anleitung:** `foto_identifikation_system/nextjs_space/DEPLOYMENT.md`
- **Fly.io Docs:** https://fly.io/docs/
- **Next.js auf Fly.io:** https://fly.io/docs/languages-and-frameworks/nextjs/

---

## 🆘 Support

- Fly.io Community: https://community.fly.io/
- Fly.io Discord: https://fly.io/discord
- GitHub Issues: Für projektspezifische Probleme

---

**Viel Erfolg mit dem Deployment! 🎉**
