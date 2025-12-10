# Schnellstart-Anleitung

## In 3 Schritten zur Audio-Transkription

### 1. FFmpeg installieren

**Linux:**
```bash
sudo apt-get install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Download von https://ffmpeg.org/download.html

### 2. HuggingFace Token einrichten (optional, nur für Sprechertrennung)

```bash
# .env Datei erstellen
cp .env.example .env

# Token einfügen (registrieren bei https://huggingface.co/)
nano .env
```

### 3. Anwendung starten

**Linux/macOS:**
```bash
./start.sh
```

**Windows:**
```bash
start.bat
```

Das war's! Die Anwendung öffnet sich unter http://localhost:7860

## Erste Schritte

1. **Audiodatei hochladen** oder direkt aufnehmen
2. **Modell wählen:**
   - `base` für schnelle Tests
   - `medium` oder `large` für beste Qualität
3. **Sprechertrennung** aktivieren für Meetings/Interviews
4. Auf **"Transkribieren"** klicken
5. **Exportieren** als PDF oder TXT

## Ohne Sprechertrennung verwenden

Wenn Sie nur Transkription ohne Sprechertrennung benötigen:
- Lassen Sie die .env Datei leer
- Deaktivieren Sie "Sprechertrennung aktivieren" in der UI
- Alles andere funktioniert wie gewohnt

## Performance-Tipps

- **Schnell:** `tiny` oder `base` Modell, keine Sprechertrennung
- **Qualität:** `medium` oder `large` Modell
- **GPU:** Installiere CUDA-PyTorch für 5-10x Geschwindigkeit

## Unterstützte Formate

✅ MP3, WAV, M4A, FLAC, OGG, WMA, AAC, OPUS

## Probleme?

**"FFmpeg not found"** → FFmpeg installieren (siehe oben)
**"Module not found"** → `pip install -r requirements.txt`
**"Token fehlt"** → Nur für Sprechertrennung nötig, .env einrichten

## Mehr Infos

Siehe [README.md](README.md) für detaillierte Dokumentation.
