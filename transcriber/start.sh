#!/bin/bash

# Standalone Audio Transcriber - Start Script

echo "=========================================="
echo "Audio Transcriber mit Sprechertrennung"
echo "=========================================="
echo ""

# Prüfe ob Python installiert ist
if ! command -v python3 &> /dev/null; then
    echo "Fehler: Python 3 ist nicht installiert."
    echo "Bitte installieren Sie Python 3.8 oder höher."
    exit 1
fi

# Prüfe ob venv existiert
if [ ! -d "venv" ]; then
    echo "Erstelle virtuelle Umgebung..."
    python3 -m venv venv

    if [ $? -ne 0 ]; then
        echo "Fehler beim Erstellen der virtuellen Umgebung."
        exit 1
    fi
fi

# Aktiviere virtuelle Umgebung
echo "Aktiviere virtuelle Umgebung..."
source venv/bin/activate

# Prüfe ob Dependencies installiert sind
if [ ! -f "venv/.installed" ]; then
    echo "Installiere Dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt

    if [ $? -eq 0 ]; then
        touch venv/.installed
        echo "Dependencies erfolgreich installiert!"
    else
        echo "Fehler beim Installieren der Dependencies."
        exit 1
    fi
else
    echo "Dependencies bereits installiert."
fi

# Prüfe .env Datei
if [ ! -f ".env" ]; then
    echo ""
    echo "WARNUNG: Keine .env Datei gefunden!"
    echo "Kopiere .env.example zu .env und füge Ihren HuggingFace Token hinzu"
    echo "für die Sprechertrennung."
    echo ""
    cp .env.example .env
fi

# Starte Anwendung
echo ""
echo "Starte Audio Transcriber..."
echo "Die Anwendung wird unter http://localhost:7860 verfügbar sein"
echo ""
echo "Drücken Sie Ctrl+C zum Beenden"
echo ""

python3 app.py
