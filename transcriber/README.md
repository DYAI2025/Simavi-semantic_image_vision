# Audio Transcriber mit Sprechertrennung

Eine standalone Python-Anwendung für Audio-Transkription mit automatischer Sprechertrennung und Export-Funktionen.

## Features

- **Audio-Transkription** mit OpenAI Whisper
  - Mehrere Modellgrößen (tiny bis large)
  - Automatische Spracherkennung
  - Unterstützt viele Audioformate (MP3, WAV, M4A, FLAC, OGG, etc.)

- **Sprechertrennung** (Speaker Diarization)
  - Automatische Erkennung verschiedener Sprecher
  - Konfigurierbare Anzahl von Sprechern
  - Powered by pyannote.audio

- **Export-Funktionen**
  - PDF-Export mit formatierter Ausgabe
  - TXT-Export als Plain Text
  - Zeitstempel für alle Segmente
  - Sprecher-Labels bei aktivierter Diarization

- **Benutzerfreundliche Web-UI**
  - Moderne Gradio-Oberfläche
  - Upload oder Aufnahme direkt im Browser
  - Echtzeit-Vorschau der Ergebnisse

## Systemanforderungen

- Python 3.8 oder höher
- FFmpeg (für Audio-Verarbeitung)
- Optional: NVIDIA GPU mit CUDA für schnellere Verarbeitung

### FFmpeg installieren

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Laden Sie FFmpeg von https://ffmpeg.org/download.html herunter und fügen Sie es zum PATH hinzu.

## Installation

### 1. Repository klonen oder Ordner herunterladen

```bash
cd transcriber
```

### 2. HuggingFace Token einrichten (für Sprechertrennung)

1. Registrieren Sie sich bei [HuggingFace](https://huggingface.co/)
2. Akzeptieren Sie die Nutzungsbedingungen für [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
3. Erstellen Sie einen Token unter [HuggingFace Settings](https://huggingface.co/settings/tokens)
4. Kopieren Sie `.env.example` zu `.env`:
   ```bash
   cp .env.example .env
   ```
5. Fügen Sie Ihren Token in die `.env` Datei ein:
   ```
   HUGGINGFACE_TOKEN=your_actual_token_here
   ```

**Hinweis:** Die Sprechertrennung funktioniert nur mit einem gültigen HuggingFace Token. Transkription ohne Sprechertrennung funktioniert auch ohne Token.

### 3. Anwendung starten

**Linux/macOS:**
```bash
./start.sh
```

**Windows:**
```bash
start.bat
```

Das Startscript:
- Erstellt automatisch eine virtuelle Python-Umgebung
- Installiert alle benötigten Dependencies
- Startet die Anwendung

## Verwendung

1. Öffnen Sie einen Browser und navigieren Sie zu `http://localhost:7860`

2. **Audiodatei hochladen:**
   - Klicken Sie auf "Audiodatei" um eine Datei hochzuladen
   - Oder nutzen Sie das Mikrofon-Symbol für direkte Aufnahme

3. **Einstellungen anpassen:**
   - **Modellgröße:** Wählen Sie zwischen tiny, base, small, medium, large
     - `tiny`: Schnell, weniger genau (~39M Parameter)
     - `base`: Gute Balance (~74M Parameter)
     - `small`: Bessere Qualität (~244M Parameter)
     - `medium`: Sehr gute Qualität (~769M Parameter)
     - `large`: Beste Qualität (~1550M Parameter)

   - **Sprache:** Auto-Erkennung oder manuell auswählen

   - **Sprechertrennung:** Aktivieren für Meetings, Interviews, Podcasts
     - Geben Sie die geschätzte Anzahl Sprecher an (2-10)

4. **Transkribieren:**
   - Klicken Sie auf "🎯 Transkribieren"
   - Warten Sie auf die Verarbeitung (kann je nach Modell und Länge variieren)

5. **Ergebnis exportieren:**
   - **PDF:** Formatiertes Dokument mit Zeitstempeln und Sprechern
   - **TXT:** Plain Text Format
   - Dateien werden automatisch zum Download bereitgestellt

## Tipps für beste Ergebnisse

### Modellwahl
- Für schnelle Tests: `base`
- Für Produktion: `medium` oder `large`
- Bei limitierten Ressourcen: `small`

### Audioqualität
- Verwenden Sie Aufnahmen mit wenig Hintergrundgeräuschen
- Idealerweise 16kHz oder höher Sample-Rate
- Mono oder Stereo werden unterstützt

### Sprechertrennung
- Funktioniert am besten bei klarer Trennung der Sprecher
- Geben Sie die korrekte Anzahl Sprecher an wenn bekannt
- Bei Unsicherheit: lassen Sie das System schätzen

## Architektur

```
transcriber/
├── app.py              # Hauptanwendung mit Gradio UI
├── transcriber.py      # Whisper Transkriptions-Logik
├── diarization.py      # Speaker Diarization
├── export.py           # PDF/TXT Export
├── requirements.txt    # Python Dependencies
├── .env.example        # Beispiel-Konfiguration
├── start.sh           # Linux/macOS Startscript
└── start.bat          # Windows Startscript
```

## Technologie-Stack

- **[OpenAI Whisper](https://github.com/openai/whisper)** - State-of-the-art Spracherkennung
- **[pyannote.audio](https://github.com/pyannote/pyannote-audio)** - Speaker Diarization
- **[Gradio](https://gradio.app/)** - Web UI Framework
- **[ReportLab](https://www.reportlab.com/)** - PDF Generation
- **PyTorch** - Deep Learning Framework

## GPU-Beschleunigung

Wenn Sie eine NVIDIA GPU haben, installieren Sie PyTorch mit CUDA-Unterstützung:

```bash
# Aktiviere virtuelle Umgebung
source venv/bin/activate  # Linux/macOS
# oder
venv\Scripts\activate.bat  # Windows

# Installiere PyTorch mit CUDA (siehe https://pytorch.org)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

Die Anwendung erkennt automatisch CUDA und nutzt die GPU wenn verfügbar.

## Fehlerbehebung

### "No module named 'whisper'"
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### "FFmpeg not found"
Installieren Sie FFmpeg (siehe Systemanforderungen oben).

### "HuggingFace Token fehlt" bei Sprechertrennung
1. Erstellen Sie eine `.env` Datei basierend auf `.env.example`
2. Fügen Sie Ihren HuggingFace Token hinzu
3. Akzeptieren Sie die Nutzungsbedingungen auf HuggingFace

### Langsame Verarbeitung
- Verwenden Sie ein kleineres Modell (tiny, base, small)
- Installieren Sie CUDA-Support für GPU-Beschleunigung
- Deaktivieren Sie Sprechertrennung wenn nicht benötigt

## Performance

Geschätzte Verarbeitungszeiten für 1 Minute Audio (CPU - Intel i7):

| Modell | Nur Transkription | Mit Sprechertrennung |
|--------|-------------------|---------------------|
| tiny   | ~2-3 Sekunden    | ~10-15 Sekunden     |
| base   | ~5-7 Sekunden    | ~15-20 Sekunden     |
| small  | ~15-20 Sekunden  | ~30-40 Sekunden     |
| medium | ~30-45 Sekunden  | ~60-90 Sekunden     |
| large  | ~60-90 Sekunden  | ~2-3 Minuten        |

Mit GPU können diese Zeiten um 5-10x reduziert werden.

## Sicherheit

- Die Anwendung läuft standardmäßig nur auf localhost
- Keine Daten werden an externe Server gesendet (außer Modell-Downloads)
- Audiodateien werden temporär verarbeitet und können gelöscht werden
- HuggingFace Token sollte niemals öffentlich geteilt werden

## Lizenz

Bitte beachten Sie die Lizenzen der verwendeten Bibliotheken:
- OpenAI Whisper: MIT License
- pyannote.audio: MIT License
- Gradio: Apache License 2.0

## Support

Bei Problemen oder Fragen:
1. Überprüfen Sie die Fehlerbehebung oben
2. Prüfen Sie die Logs in der Konsole
3. Stellen Sie sicher, dass alle Systemanforderungen erfüllt sind

## Weiterentwicklung

Mögliche Erweiterungen:
- Batch-Verarbeitung mehrerer Dateien
- Cloud-Storage-Integration
- Mehrsprachige UI
- Live-Transkription von Streams
- Weitere Export-Formate (DOCX, SRT für Untertitel)
- REST API für Integration in andere Systeme
