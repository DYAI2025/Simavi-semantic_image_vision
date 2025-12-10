"""
Whisper-basierte Transkriptionsmodul
"""

import whisper
import torch
import warnings
from typing import Optional, Dict, Any

warnings.filterwarnings("ignore")


class WhisperTranscriber:
    """Klasse für Audio-Transkription mit OpenAI Whisper"""

    def __init__(self):
        self.model = None
        self.current_model_size = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Whisper wird auf {self.device} ausgeführt")

    def load_model(self, model_size: str = "base"):
        """
        Lädt das Whisper-Modell

        Args:
            model_size: Größe des Modells (tiny, base, small, medium, large)
        """
        if self.model is None or self.current_model_size != model_size:
            print(f"Lade Whisper-Modell '{model_size}'...")
            self.model = whisper.load_model(model_size, device=self.device)
            self.current_model_size = model_size
            print("Modell geladen!")

    def transcribe(
        self,
        audio_path: str,
        model_size: str = "base",
        language: Optional[str] = None,
        task: str = "transcribe",
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """
        Transkribiert eine Audiodatei

        Args:
            audio_path: Pfad zur Audiodatei
            model_size: Größe des Whisper-Modells
            language: Sprache (None für auto-detect, oder z.B. 'de', 'en')
            task: 'transcribe' oder 'translate' (übersetzt nach Englisch)
            **kwargs: Zusätzliche Parameter für whisper.transcribe()

        Returns:
            Dictionary mit Transkriptionsergebnissen oder None bei Fehler
        """
        try:
            # Lade Modell falls noch nicht geladen
            self.load_model(model_size)

            # Bereite Parameter vor
            transcribe_params = {
                "audio": audio_path,
                "task": task,
                "verbose": False,
                **kwargs
            }

            # Füge Sprache hinzu wenn spezifiziert
            if language and language != "auto":
                transcribe_params["language"] = language

            # Transkribiere
            print(f"Transkribiere {audio_path}...")
            result = self.model.transcribe(**transcribe_params)

            print("Transkription abgeschlossen!")
            return result

        except Exception as e:
            print(f"Fehler bei der Transkription: {str(e)}")
            return None

    def transcribe_with_timestamps(
        self,
        audio_path: str,
        model_size: str = "base",
        language: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Transkribiert mit detaillierten Zeitstempeln pro Wort

        Args:
            audio_path: Pfad zur Audiodatei
            model_size: Größe des Whisper-Modells
            language: Sprache

        Returns:
            Dictionary mit detaillierten Zeitstempeln
        """
        return self.transcribe(
            audio_path,
            model_size=model_size,
            language=language,
            word_timestamps=True
        )

    def get_segments(self, result: Dict[str, Any]) -> list:
        """
        Extrahiert Segmente aus dem Transkriptionsergebnis

        Args:
            result: Whisper Transkriptionsergebnis

        Returns:
            Liste von Segmenten mit Text und Zeitstempeln
        """
        if not result or "segments" not in result:
            return []

        segments = []
        for segment in result["segments"]:
            segments.append({
                "start": segment["start"],
                "end": segment["end"],
                "text": segment["text"].strip()
            })

        return segments

    def format_timestamp(self, seconds: float) -> str:
        """
        Formatiert Sekunden zu MM:SS Format

        Args:
            seconds: Zeit in Sekunden

        Returns:
            Formatierter Zeitstempel
        """
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes:02d}:{secs:02d}"

    def get_text_with_timestamps(self, result: Dict[str, Any]) -> str:
        """
        Erstellt formatierten Text mit Zeitstempeln

        Args:
            result: Whisper Transkriptionsergebnis

        Returns:
            Formatierter Text mit Zeitstempeln
        """
        segments = self.get_segments(result)
        formatted_lines = []

        for segment in segments:
            timestamp = self.format_timestamp(segment["start"])
            formatted_lines.append(f"[{timestamp}] {segment['text']}")

        return "\n".join(formatted_lines)
