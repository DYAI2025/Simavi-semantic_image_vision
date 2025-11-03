
'use client';

import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { GoogleDrivePicker } from './google-drive-picker';
import { ProcessingProgress } from './processing-progress';
import { PhotoConfirmation } from './photo-confirmation';
import { PhotoData, UploadProgress } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, FolderOpen } from 'lucide-react';

export function GoogleDriveIntegration() {
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFolderSelected = useCallback((folderId: string, folderName: string) => {
    setSelectedFolder({ id: folderId, name: folderName });
  }, []);

  const handleStartProcessing = useCallback(async () => {
    if (!selectedFolder) return;

    const batchId = `gdrive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentBatchId(batchId);
    setIsProcessing(true);
    setUploadProgress({
      total: 0,
      processed: 0,
      completed: 0,
      failed: 0,
      current: undefined
    });

    abortControllerRef.current = new AbortController();

    try {
      await processGoogleDriveFolder(selectedFolder.id, selectedFolder.name, batchId, abortControllerRef.current.signal);
      
      toast({
        title: "Verarbeitung abgeschlossen",
        description: "Google Drive Ordner wurde verarbeitet. Bitte überprüfen Sie die Ergebnisse.",
      });
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Fehler bei der Verarbeitung:', error);
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
  }, [selectedFolder, toast]);

  const processGoogleDriveFolder = async (folderId: string, folderName: string, batchId: string, signal: AbortSignal) => {
    const response = await fetch('/api/google-drive/process-folder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ folderId, folderName }),
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
                total: parsed.total || prev.total,
                processed: parsed.processed || prev.processed,
                completed: parsed.completed || prev.completed,
                failed: parsed.failed || prev.failed,
                current: parsed.current
              } : {
                total: parsed.total || 0,
                processed: parsed.processed || 0,
                completed: parsed.completed || 0,
                failed: parsed.failed || 0,
                current: parsed.current
              });
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
    setPhotos([]);
    setCurrentBatchId(null);
    setSelectedFolder(null);
    toast({
      title: "Zurückgesetzt",
      description: "Sie können einen neuen Ordner auswählen.",
    });
  };

  return (
    <div className="space-y-8">
      {!isProcessing && photos.length === 0 && (
        <>
          <GoogleDrivePicker onFolderSelected={handleFolderSelected} />
          
          {selectedFolder && (
            <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-6 w-6 text-blue-600" />
                  Ausgewählter Ordner
                </CardTitle>
                <CardDescription>
                  Bereit zur Verarbeitung
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white p-4 rounded-lg">
                  <div className="font-semibold text-lg text-gray-800">
                    {selectedFolder.name}
                  </div>
                  <div className="text-sm text-gray-600">
                    Alle Bilder in diesem Ordner werden verarbeitet und umbenannt.
                  </div>
                </div>
                
                <Button
                  onClick={handleStartProcessing}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  <Play className="h-5 w-5 mr-2" />
                  Verarbeitung starten
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {isProcessing && uploadProgress && (
        <ProcessingProgress 
          progress={uploadProgress} 
          onAbort={handleAbortProcessing}
        />
      )}

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
