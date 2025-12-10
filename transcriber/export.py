"""
Export-Modul für PDF und TXT
"""

from typing import Dict, Any, Union
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os


class ExportManager:
    """Klasse für Export von Transkriptionen"""

    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_styles()

    def _setup_styles(self):
        """Erstellt benutzerdefinierte Styles für PDF"""
        # Titel Style
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor='#2c3e50',
            spaceAfter=30,
            alignment=TA_CENTER
        ))

        # Sprecher Style
        self.styles.add(ParagraphStyle(
            name='Speaker',
            parent=self.styles['Heading2'],
            fontSize=12,
            textColor='#3498db',
            spaceAfter=6,
            spaceBefore=12,
            fontName='Helvetica-Bold'
        ))

        # Text Style
        self.styles.add(ParagraphStyle(
            name='TranscriptText',
            parent=self.styles['Normal'],
            fontSize=11,
            leading=16,
            textColor='#34495e',
            alignment=TA_LEFT
        ))

        # Timestamp Style
        self.styles.add(ParagraphStyle(
            name='Timestamp',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor='#95a5a6',
            spaceAfter=4
        ))

    def export_to_pdf(
        self,
        data: Union[str, Dict[str, Any]],
        output_path: str,
        title: str = "Audio Transkription"
    ) -> str:
        """
        Exportiert Transkription als PDF

        Args:
            data: Transkriptionsdaten (String oder Dictionary)
            output_path: Ausgabepfad für PDF
            title: Titel des Dokuments

        Returns:
            Pfad zur erstellten PDF-Datei
        """
        try:
            # Erstelle PDF-Dokument
            doc = SimpleDocTemplate(
                output_path,
                pagesize=A4,
                rightMargin=2*cm,
                leftMargin=2*cm,
                topMargin=2*cm,
                bottomMargin=2*cm
            )

            # Story-Elemente
            story = []

            # Titel
            story.append(Paragraph(title, self.styles['CustomTitle']))
            story.append(Spacer(1, 0.5*cm))

            # Datum
            date_str = datetime.now().strftime("%d.%m.%Y %H:%M")
            story.append(Paragraph(
                f"Erstellt am: {date_str}",
                self.styles['Timestamp']
            ))
            story.append(Spacer(1, 1*cm))

            # Inhalt basierend auf Datentyp
            if isinstance(data, dict) and "segments" in data:
                # Mit Sprechertrennung
                story.extend(self._format_segments_for_pdf(data["segments"]))
            else:
                # Einfacher Text
                text = data if isinstance(data, str) else str(data)
                story.extend(self._format_plain_text_for_pdf(text))

            # Baue PDF
            doc.build(story)

            print(f"PDF erstellt: {output_path}")
            return output_path

        except Exception as e:
            print(f"Fehler beim PDF-Export: {str(e)}")
            raise

    def _format_segments_for_pdf(self, segments: list) -> list:
        """
        Formatiert Segmente mit Sprechern für PDF

        Args:
            segments: Liste von Segmenten

        Returns:
            Liste von PDF-Elementen
        """
        elements = []

        for i, segment in enumerate(segments):
            speaker = segment.get("speaker", "Unbekannt")
            text = segment.get("text", "")
            start = segment.get("start", 0)
            end = segment.get("end", 0)

            # Timestamp
            timestamp_text = f"[{self._format_time(start)} - {self._format_time(end)}]"
            elements.append(Paragraph(timestamp_text, self.styles['Timestamp']))

            # Sprecher
            speaker_text = f"<b>{speaker}:</b>"
            elements.append(Paragraph(speaker_text, self.styles['Speaker']))

            # Text
            # Escape special XML characters
            safe_text = self._escape_xml(text)
            elements.append(Paragraph(safe_text, self.styles['TranscriptText']))

            # Abstand zwischen Segmenten
            elements.append(Spacer(1, 0.4*cm))

        return elements

    def _format_plain_text_for_pdf(self, text: str) -> list:
        """
        Formatiert einfachen Text für PDF

        Args:
            text: Text-String

        Returns:
            Liste von PDF-Elementen
        """
        elements = []

        # Teile Text in Absätze
        paragraphs = text.split("\n\n")

        for para in paragraphs:
            if para.strip():
                safe_text = self._escape_xml(para.strip())
                elements.append(Paragraph(safe_text, self.styles['TranscriptText']))
                elements.append(Spacer(1, 0.3*cm))

        return elements

    def export_to_txt(
        self,
        data: Union[str, Dict[str, Any]],
        output_path: str,
        title: str = "Audio Transkription"
    ) -> str:
        """
        Exportiert Transkription als TXT

        Args:
            data: Transkriptionsdaten (String oder Dictionary)
            output_path: Ausgabepfad für TXT
            title: Titel des Dokuments

        Returns:
            Pfad zur erstellten TXT-Datei
        """
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                # Header
                f.write("=" * 80 + "\n")
                f.write(f"{title}\n")
                f.write("=" * 80 + "\n\n")

                # Datum
                date_str = datetime.now().strftime("%d.%m.%Y %H:%M")
                f.write(f"Erstellt am: {date_str}\n")
                f.write("-" * 80 + "\n\n")

                # Inhalt
                if isinstance(data, dict) and "segments" in data:
                    # Mit Sprechertrennung
                    f.write(self._format_segments_for_txt(data["segments"]))
                else:
                    # Einfacher Text
                    text = data if isinstance(data, str) else str(data)
                    f.write(text)

                # Footer
                f.write("\n\n" + "=" * 80 + "\n")
                f.write("Ende der Transkription\n")
                f.write("=" * 80 + "\n")

            print(f"TXT erstellt: {output_path}")
            return output_path

        except Exception as e:
            print(f"Fehler beim TXT-Export: {str(e)}")
            raise

    def _format_segments_for_txt(self, segments: list) -> str:
        """
        Formatiert Segmente mit Sprechern für TXT

        Args:
            segments: Liste von Segmenten

        Returns:
            Formatierter Text-String
        """
        lines = []

        for segment in segments:
            speaker = segment.get("speaker", "Unbekannt")
            text = segment.get("text", "")
            start = segment.get("start", 0)
            end = segment.get("end", 0)

            # Timestamp
            timestamp = f"[{self._format_time(start)} - {self._format_time(end)}]"
            lines.append(timestamp)

            # Sprecher und Text
            lines.append(f"{speaker}:")
            lines.append(text)
            lines.append("")  # Leerzeile

        return "\n".join(lines)

    def _format_time(self, seconds: float) -> str:
        """
        Formatiert Zeit in MM:SS Format

        Args:
            seconds: Zeit in Sekunden

        Returns:
            Formatierter Zeitstring
        """
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes:02d}:{secs:02d}"

    def _escape_xml(self, text: str) -> str:
        """
        Escaped XML-Sonderzeichen für ReportLab

        Args:
            text: Eingabetext

        Returns:
            Escaped Text
        """
        replacements = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&apos;'
        }

        for old, new in replacements.items():
            text = text.replace(old, new)

        return text

    def export_both(
        self,
        data: Union[str, Dict[str, Any]],
        base_path: str,
        title: str = "Audio Transkription"
    ) -> tuple:
        """
        Exportiert sowohl PDF als auch TXT

        Args:
            data: Transkriptionsdaten
            base_path: Basis-Pfad ohne Endung
            title: Titel des Dokuments

        Returns:
            Tuple (pdf_path, txt_path)
        """
        pdf_path = self.export_to_pdf(data, f"{base_path}.pdf", title)
        txt_path = self.export_to_txt(data, f"{base_path}.txt", title)

        return pdf_path, txt_path
