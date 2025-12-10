#!/usr/bin/env python3
"""
Standalone Audio Transcriber mit Sprechertrennung
Hauptanwendung mit Gradio UI
"""

import os
import gradio as gr
from pathlib import Path
from dotenv import load_dotenv
from transcriber import WhisperTranscriber
from diarization import SpeakerDiarizer
from export import ExportManager
import tempfile

# Load environment variables
load_dotenv()

class TranscriberApp:
    def __init__(self):
        self.transcriber = WhisperTranscriber()
        self.diarizer = SpeakerDiarizer()
        self.export_manager = ExportManager()
        self.temp_dir = tempfile.mkdtemp()

    def process_audio(
        self,
        audio_file,
        model_size,
        language,
        enable_diarization,
        num_speakers,
        progress=gr.Progress()
    ):
        """
        Verarbeitet eine Audiodatei und gibt Transkription zurück
        """
        try:
            if audio_file is None:
                return "Bitte laden Sie eine Audiodatei hoch.", None, None

            progress(0.1, desc="Lade Audio...")

            # Transkription mit Whisper
            progress(0.2, desc="Transkribiere Audio...")
            transcription_result = self.transcriber.transcribe(
                audio_file,
                model_size=model_size,
                language=language
            )

            if not transcription_result:
                return "Fehler bei der Transkription.", None, None

            # Optional: Sprechertrennung
            if enable_diarization:
                progress(0.6, desc="Führe Sprechertrennung durch...")
                diarization_result = self.diarizer.diarize(
                    audio_file,
                    transcription_result,
                    num_speakers=num_speakers
                )
                final_text = diarization_result
            else:
                final_text = transcription_result["text"]

            progress(1.0, desc="Fertig!")

            # Erstelle Vorschau
            preview = self._format_preview(final_text)

            return preview, final_text, transcription_result

        except Exception as e:
            return f"Fehler: {str(e)}", None, None

    def _format_preview(self, text):
        """Formatiert Text für die Vorschau"""
        if isinstance(text, dict):
            # Mit Sprechertrennung
            formatted = []
            for segment in text.get("segments", []):
                speaker = segment.get("speaker", "Unbekannt")
                content = segment.get("text", "")
                start = segment.get("start", 0)
                end = segment.get("end", 0)
                formatted.append(
                    f"[{start:.2f}s - {end:.2f}s] {speaker}: {content}"
                )
            return "\n\n".join(formatted)
        else:
            # Ohne Sprechertrennung
            return text

    def export_to_pdf(self, text_data, filename="transcription"):
        """Exportiert die Transkription als PDF"""
        if text_data is None:
            return None

        try:
            pdf_path = self.export_manager.export_to_pdf(
                text_data,
                os.path.join(self.temp_dir, f"{filename}.pdf")
            )
            return pdf_path
        except Exception as e:
            print(f"PDF Export Fehler: {str(e)}")
            return None

    def export_to_txt(self, text_data, filename="transcription"):
        """Exportiert die Transkription als TXT"""
        if text_data is None:
            return None

        try:
            txt_path = self.export_manager.export_to_txt(
                text_data,
                os.path.join(self.temp_dir, f"{filename}.txt")
            )
            return txt_path
        except Exception as e:
            print(f"TXT Export Fehler: {str(e)}")
            return None

    def create_interface(self):
        """Erstellt die Gradio-Benutzeroberfläche"""

        with gr.Blocks(
            title="Audio Transcriber",
            theme=gr.themes.Soft()
        ) as interface:

            gr.Markdown("# 🎙️ Audio Transcriber mit Sprechertrennung")
            gr.Markdown(
                "Laden Sie eine Audiodatei hoch, um sie zu transkribieren. "
                "Optional mit automatischer Sprechertrennung."
            )

            with gr.Row():
                with gr.Column(scale=1):
                    # Input Section
                    gr.Markdown("## Eingabe")
                    audio_input = gr.Audio(
                        label="Audiodatei",
                        type="filepath",
                        sources=["upload", "microphone"]
                    )

                    with gr.Accordion("Einstellungen", open=True):
                        model_size = gr.Dropdown(
                            choices=["tiny", "base", "small", "medium", "large"],
                            value="base",
                            label="Whisper Modellgröße",
                            info="Größere Modelle sind genauer, aber langsamer"
                        )

                        language = gr.Dropdown(
                            choices=["auto", "de", "en", "fr", "es", "it"],
                            value="auto",
                            label="Sprache",
                            info="'auto' für automatische Erkennung"
                        )

                        enable_diarization = gr.Checkbox(
                            label="Sprechertrennung aktivieren",
                            value=False,
                            info="Erkennt und markiert verschiedene Sprecher"
                        )

                        num_speakers = gr.Slider(
                            minimum=2,
                            maximum=10,
                            value=2,
                            step=1,
                            label="Anzahl Sprecher (geschätzt)",
                            visible=False
                        )

                        # Zeige Sprecher-Slider nur wenn Diarization aktiviert
                        enable_diarization.change(
                            fn=lambda x: gr.update(visible=x),
                            inputs=[enable_diarization],
                            outputs=[num_speakers]
                        )

                    transcribe_btn = gr.Button(
                        "🎯 Transkribieren",
                        variant="primary",
                        size="lg"
                    )

                with gr.Column(scale=2):
                    # Output Section
                    gr.Markdown("## Ergebnis")
                    output_text = gr.Textbox(
                        label="Transkription",
                        lines=15,
                        max_lines=20,
                        show_copy_button=True
                    )

                    with gr.Row():
                        export_pdf_btn = gr.Button("📄 Als PDF exportieren")
                        export_txt_btn = gr.Button("📝 Als TXT exportieren")

                    with gr.Row():
                        pdf_download = gr.File(
                            label="PDF Download",
                            visible=True
                        )
                        txt_download = gr.File(
                            label="TXT Download",
                            visible=True
                        )

            # Versteckte States für interne Daten
            transcription_data = gr.State()
            raw_result = gr.State()

            # Event Handlers
            transcribe_btn.click(
                fn=self.process_audio,
                inputs=[
                    audio_input,
                    model_size,
                    language,
                    enable_diarization,
                    num_speakers
                ],
                outputs=[output_text, transcription_data, raw_result]
            )

            export_pdf_btn.click(
                fn=self.export_to_pdf,
                inputs=[transcription_data],
                outputs=[pdf_download]
            )

            export_txt_btn.click(
                fn=self.export_to_txt,
                inputs=[transcription_data],
                outputs=[txt_download]
            )

            # Beispiele
            gr.Markdown("## 💡 Tipps")
            gr.Markdown(
                """
                - **Modellgröße**: Beginnen Sie mit 'base' für schnelle Tests,
                  verwenden Sie 'large' für beste Qualität
                - **Sprechertrennung**: Aktivieren Sie diese Option für Interviews,
                  Meetings oder Podcasts mit mehreren Sprechern
                - **Sprache**: 'auto' funktioniert gut, aber die manuelle Auswahl
                  kann die Genauigkeit verbessern
                - **Unterstützte Formate**: MP3, WAV, M4A, FLAC, OGG und mehr
                """
            )

        return interface


def main():
    """Startet die Anwendung"""
    app = TranscriberApp()
    interface = app.create_interface()

    # Starte Server
    interface.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=False,
        debug=True
    )


if __name__ == "__main__":
    main()
