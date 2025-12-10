@echo off
REM Standalone Audio Transcriber - Start Script (Windows)

echo ==========================================
echo Audio Transcriber mit Sprechertrennung
echo ==========================================
echo.

REM Prüfe ob Python installiert ist
python --version >nul 2>&1
if errorlevel 1 (
    echo Fehler: Python ist nicht installiert.
    echo Bitte installieren Sie Python 3.8 oder hoeher.
    pause
    exit /b 1
)

REM Prüfe ob venv existiert
if not exist "venv\" (
    echo Erstelle virtuelle Umgebung...
    python -m venv venv
    if errorlevel 1 (
        echo Fehler beim Erstellen der virtuellen Umgebung.
        pause
        exit /b 1
    )
)

REM Aktiviere virtuelle Umgebung
echo Aktiviere virtuelle Umgebung...
call venv\Scripts\activate.bat

REM Prüfe ob Dependencies installiert sind
if not exist "venv\.installed" (
    echo Installiere Dependencies...
    python -m pip install --upgrade pip
    pip install -r requirements.txt
    if errorlevel 0 (
        echo. > venv\.installed
        echo Dependencies erfolgreich installiert!
    ) else (
        echo Fehler beim Installieren der Dependencies.
        pause
        exit /b 1
    )
) else (
    echo Dependencies bereits installiert.
)

REM Prüfe .env Datei
if not exist ".env" (
    echo.
    echo WARNUNG: Keine .env Datei gefunden!
    echo Kopiere .env.example zu .env und fuegen Sie Ihren HuggingFace Token hinzu
    echo fuer die Sprechertrennung.
    echo.
    copy .env.example .env
)

REM Starte Anwendung
echo.
echo Starte Audio Transcriber...
echo Die Anwendung wird unter http://localhost:7860 verfuegbar sein
echo.
echo Druecken Sie Ctrl+C zum Beenden
echo.

python app.py
pause
