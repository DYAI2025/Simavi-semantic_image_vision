"""
Speaker Diarization Modul mit pyannote.audio
"""

import os
from typing import Dict, Any, Optional, List
import torch
from pyannote.audio import Pipeline
import warnings

warnings.filterwarnings("ignore")


class SpeakerDiarizer:
    """Klasse für Sprechertrennung (Speaker Diarization)"""

    def __init__(self):
        self.pipeline = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.hf_token = os.getenv("HUGGINGFACE_TOKEN")

    def load_pipeline(self):
        """Lädt das Pyannote Diarization Pipeline"""
        if self.pipeline is None:
            print("Lade Speaker Diarization Pipeline...")

            try:
                # Versuche mit HuggingFace Token zu laden
                if self.hf_token:
                    self.pipeline = Pipeline.from_pretrained(
                        "pyannote/speaker-diarization-3.1",
                        use_auth_token=self.hf_token
                    )
                else:
                    # Fallback ohne Token (benötigt lokale Modelle)
                    print(
                        "WARNUNG: Kein HUGGINGFACE_TOKEN gefunden. "
                        "Versuche lokale Modelle zu laden..."
                    )
                    self.pipeline = Pipeline.from_pretrained(
                        "pyannote/speaker-diarization-3.1"
                    )

                # Verschiebe auf GPU falls verfügbar
                if self.device == "cuda":
                    self.pipeline = self.pipeline.to(torch.device("cuda"))

                print("Pipeline geladen!")

            except Exception as e:
                print(f"Fehler beim Laden der Pipeline: {str(e)}")
                print(
                    "Tipp: Registrieren Sie sich bei HuggingFace und "
                    "akzeptieren Sie die Nutzungsbedingungen für "
                    "pyannote/speaker-diarization-3.1"
                )
                raise

    def diarize(
        self,
        audio_path: str,
        transcription_result: Dict[str, Any],
        num_speakers: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Führt Sprechertrennung durch und kombiniert mit Transkription

        Args:
            audio_path: Pfad zur Audiodatei
            transcription_result: Ergebnis von Whisper Transkription
            num_speakers: Erwartete Anzahl Sprecher (optional)

        Returns:
            Dictionary mit Segmenten inkl. Sprecherinformation
        """
        try:
            # Lade Pipeline falls noch nicht geladen
            if self.pipeline is None:
                self.load_pipeline()

            print("Führe Sprechertrennung durch...")

            # Führe Diarization durch
            diarization_params = {}
            if num_speakers:
                diarization_params["num_speakers"] = int(num_speakers)

            diarization = self.pipeline(audio_path, **diarization_params)

            # Kombiniere Diarization mit Transkription
            result = self._merge_diarization_with_transcription(
                diarization,
                transcription_result
            )

            print("Sprechertrennung abgeschlossen!")
            return result

        except Exception as e:
            print(f"Fehler bei der Sprechertrennung: {str(e)}")
            # Fallback: Gebe Transkription ohne Sprechertrennung zurück
            return transcription_result

    def _merge_diarization_with_transcription(
        self,
        diarization,
        transcription_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Kombiniert Diarization-Ergebnisse mit Transkription

        Args:
            diarization: Pyannote Diarization Ergebnis
            transcription_result: Whisper Transkription

        Returns:
            Kombiniertes Ergebnis mit Sprecher-Labels
        """
        # Extrahiere Segmente aus Transkription
        transcription_segments = transcription_result.get("segments", [])

        # Erstelle Speaker-Timeline aus Diarization
        speaker_timeline = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            speaker_timeline.append({
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker
            })

        # Weise jedem Transkriptionssegment einen Sprecher zu
        merged_segments = []
        for segment in transcription_segments:
            segment_start = segment["start"]
            segment_end = segment["end"]
            segment_mid = (segment_start + segment_end) / 2

            # Finde Sprecher zur Segment-Mitte
            speaker = self._find_speaker_at_time(speaker_timeline, segment_mid)

            merged_segments.append({
                "start": segment_start,
                "end": segment_end,
                "text": segment["text"].strip(),
                "speaker": speaker or "Unbekannt"
            })

        # Gruppiere aufeinanderfolgende Segmente desselben Sprechers
        grouped_segments = self._group_segments_by_speaker(merged_segments)

        return {
            "text": transcription_result.get("text", ""),
            "segments": grouped_segments,
            "language": transcription_result.get("language", "unknown")
        }

    def _find_speaker_at_time(
        self,
        speaker_timeline: List[Dict],
        time: float
    ) -> Optional[str]:
        """
        Findet den Sprecher zu einem bestimmten Zeitpunkt

        Args:
            speaker_timeline: Liste von Speaker-Segmenten
            time: Zeitpunkt in Sekunden

        Returns:
            Speaker-Label oder None
        """
        for segment in speaker_timeline:
            if segment["start"] <= time <= segment["end"]:
                return segment["speaker"]
        return None

    def _group_segments_by_speaker(
        self,
        segments: List[Dict]
    ) -> List[Dict]:
        """
        Gruppiert aufeinanderfolgende Segmente desselben Sprechers

        Args:
            segments: Liste von Segmenten mit Sprecher-Labels

        Returns:
            Gruppierte Segmente
        """
        if not segments:
            return []

        grouped = []
        current_group = segments[0].copy()

        for segment in segments[1:]:
            if segment["speaker"] == current_group["speaker"]:
                # Gleicher Sprecher: füge Text hinzu
                current_group["text"] += " " + segment["text"]
                current_group["end"] = segment["end"]
            else:
                # Neuer Sprecher: speichere aktuelle Gruppe
                grouped.append(current_group)
                current_group = segment.copy()

        # Füge letzte Gruppe hinzu
        grouped.append(current_group)

        return grouped

    def format_diarized_text(self, result: Dict[str, Any]) -> str:
        """
        Formatiert Transkription mit Sprechern für Textausgabe

        Args:
            result: Ergebnis mit Sprechertrennung

        Returns:
            Formatierter Text
        """
        if "segments" not in result:
            return result.get("text", "")

        formatted_lines = []
        for segment in result["segments"]:
            speaker = segment.get("speaker", "Unbekannt")
            text = segment.get("text", "")
            start = segment.get("start", 0)

            # Formatiere Zeitstempel
            minutes = int(start // 60)
            seconds = int(start % 60)
            timestamp = f"{minutes:02d}:{seconds:02d}"

            formatted_lines.append(f"[{timestamp}] {speaker}:\n{text}\n")

        return "\n".join(formatted_lines)
