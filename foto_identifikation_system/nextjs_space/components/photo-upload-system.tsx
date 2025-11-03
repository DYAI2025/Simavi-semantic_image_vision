
'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { PhotoUploadArea } from './photo-upload-area';
import { ProcessingProgress } from './processing-progress';
import { PhotoConfirmation } from './photo-confirmation';
import { PhotoData, UploadProgress } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, XCircle, Image as ImageIcon } from 'lucide-react';

interface UploadedFile {
  file: File;
  previewUrl: string;
  id: string;
}

export function PhotoUploadSystem() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Schritt 1: Bilder hochladen und anzeigen (OHNE Verarbeitung)
  const handleFilesSelected = useCallback((files: File[]) => {
    if (files.length === 0) return;

    // Validierung: nur Bilddateien
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie nur Bilddateien aus.",
        variant: "destructive"
      });
      return;
    }

    if (imageFiles.length < files.length) {
      toast({
        title: "Warnung",
        description: `${files.length - imageFiles.length} Nicht-Bilddateien wurden ignoriert.`,
        variant: "destructive"
      });
    }

    // Bilder sofort anzeigen (mit lokaler Vorschau)
    const newFiles: UploadedFile[] = imageFiles.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }));

    setUploadedFiles(newFiles);
    
    toast({
      title: "Bilder hochgeladen",
      description: `${imageFiles.length} Bilder wurden hochgeladen. Klicken Sie auf "Benennen", um die AI-Analyse zu starten.`,
    });
  }, [toast]);

  // Schritt 2: AI-Analyse starten (nach Klick auf "Benennen")
  const handleStartProcessing = useCallback(async () => {
    if (uploadedFiles.length === 0) return;

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentBatchId(batchId);
    setIsProcessing(true);
    setUploadProgress({
      total: uploadedFiles.length,
      processed: 0,
      completed: 0,
      failed: 0,
      current: undefined
    });

    abortControllerRef.current = new AbortController();

    try {
      await processPhotos(uploadedFiles.map(uf => uf.file), batchId, abortControllerRef.current.signal);
      
      toast({
        title: "Verarbeitung abgeschlossen",
        description: `${uploadedFiles.length} Bilder wurden analysiert. Überprüfen Sie die vorgeschlagenen Namen.`,
      });
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Fehler bei der Foto-Verarbeitung:', error);
        toast({
          title: "Fehler",
          description: "Ein Fehler ist bei der Verarbeitung aufgetreten.",
          variant: "destructive"
        });
      }
    } finally {
      setIsProcessing(false);
      setUploadProgress(null);
      abortControllerRef.current = null;
    }
  }, [uploadedFiles, toast]);

  const processPhotos = async (files: File[], batchId: string, signal: AbortSignal) => {
    const formData = new FormData();
    formData.append('batchId', batchId);
    
    files.forEach((file, index) => {
      formData.append(`file_${index}`, file);
    });

    const response = await fetch('/api/process-photos', {
      method: 'POST',
      body: formData,
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body ist nicht lesbar');
    }

    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            
            if (parsed.type === 'progress') {
              setUploadProgress(prev => prev ? {
                ...prev,
                processed: parsed.processed || prev.processed,
                completed: parsed.completed || prev.completed,
                failed: parsed.failed || prev.failed,
                current: parsed.current
              } : null);
            } else if (parsed.type === 'photo') {
              setPhotos(prev => {
                const exists = prev.find(p => p.id === parsed.data.id);
                if (exists) {
                  return prev.map(p => p.id === parsed.data.id ? parsed.data : p);
                } else {
                  return [...prev, parsed.data];
                }
              });
            } else if (parsed.type === 'error') {
              console.error('Verarbeitungsfehler:', parsed.message);
              toast({
                title: "Verarbeitungsfehler",
                description: parsed.message,
                variant: "destructive"
              });
            }
          } catch (e) {
            console.warn('JSON Parse Error:', e);
          }
        }
      }
    }
  };

  const handleAbortProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
      setUploadProgress(null);
      toast({
        title: "Abgebrochen",
        description: "Die Verarbeitung wurde abgebrochen.",
      });
    }
  };

  const handleConfirm = () => {
    toast({
      title: "Bestätigt",
      description: "Ergebnisse wurden bestätigt. Sie können jetzt herunterladen.",
    });
  };

  const handleReject = () => {
    // Aufräumen: Vorschau-URLs freigeben
    uploadedFiles.forEach(uf => URL.revokeObjectURL(uf.previewUrl));
    setUploadedFiles([]);
    setPhotos([]);
    setCurrentBatchId(null);
    toast({
      title: "Zurückgesetzt",
      description: "Sie können neue Bilder hochladen.",
    });
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  return (
    <div className="space-y-8">
      {/* Upload-Area: Nur anzeigen, wenn keine Bilder hochgeladen wurden */}
      {uploadedFiles.length === 0 && photos.length === 0 && !isProcessing && (
        <PhotoUploadArea onFilesSelected={handleFilesSelected} />
      )}

      {/* Hochgeladene Bilder anzeigen (VOR der Verarbeitung) */}
      {uploadedFiles.length > 0 && photos.length === 0 && !isProcessing && (
        <Card className="bg-white shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-6 w-6 text-blue-600" />
                <span>Hochgeladene Bilder ({uploadedFiles.length})</span>
              </div>
              <Button
                onClick={handleStartProcessing}
                className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white"
                size="lg"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Mit AI benennen
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {uploadedFiles.map((uploadedFile) => (
                <div
                  key={uploadedFile.id}
                  className="relative bg-gray-50 rounded-lg overflow-hidden hover:shadow-md transition-shadow group"
                >
                  {/* Vorschaubild */}
                  <div className="relative aspect-square bg-gray-200">
                    <Image
                      src={uploadedFile.previewUrl}
                      alt={uploadedFile.file.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                    />
                  </div>

                  {/* Entfernen-Button */}
                  <button
                    onClick={() => handleRemoveFile(uploadedFile.id)}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Bild entfernen"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>

                  {/* Dateiname */}
                  <div className="p-2 text-xs text-gray-600 truncate">
                    {uploadedFile.file.name}
                  </div>
                </div>
              ))}
            </div>

            {/* Neu starten Button */}
            <div className="mt-6 text-center">
              <Button
                onClick={handleReject}
                variant="outline"
                className="border-gray-300"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Alle entfernen und neu starten
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verarbeitungs-Fortschritt */}
      {isProcessing && uploadProgress && (
        <ProcessingProgress 
          progress={uploadProgress} 
          onAbort={handleAbortProcessing}
        />
      )}

      {/* Ergebnisse anzeigen (NACH der Verarbeitung) */}
      {photos.length > 0 && currentBatchId && (
        <PhotoConfirmation 
          photos={photos}
          batchId={currentBatchId}
          onConfirm={handleConfirm}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
