"""
Audio Transcriber mit Sprechertrennung
Standalone Anwendung für Audio-Transkription
"""

__version__ = "1.0.0"
__author__ = "Simavi Team"

from .transcriber import WhisperTranscriber
from .diarization import SpeakerDiarizer
from .export import ExportManager

__all__ = [
    "WhisperTranscriber",
    "SpeakerDiarizer",
    "ExportManager"
]
