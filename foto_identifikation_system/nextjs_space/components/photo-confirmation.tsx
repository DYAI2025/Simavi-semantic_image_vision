
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { PhotoData } from '@/lib/types';
import { 
  Download, 
  CheckCircle2, 
  XCircle,
  MapPin, 
  Camera, 
  Calendar,
  Package,
  RefreshCw,
  AlertCircle,
  Edit2,
  Check
} from 'lucide-react';

interface PhotoConfirmationProps {
  photos: PhotoData[];
  batchId: string;
  onConfirm: () => void;
  onReject: () => void;
}

export function PhotoConfirmation({ photos, batchId, onConfirm, onReject }: PhotoConfirmationProps) {
  const [downloading, setDownloading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [editedNames, setEditedNames] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  const processedPhotos = photos.filter(p => p.processed);
  const failedPhotos = photos.filter(p => !p.processed);

  // Funktion zum Abrufen des aktuellen Namens (bearbeitet oder original)
  const getCurrentName = (photo: PhotoData) => {
    return editedNames[photo.id] || photo.newName;
  };

  // Name bearbeiten
  const handleEditName = (photoId: string, currentName: string) => {
    setEditingId(photoId);
    if (!editedNames[photoId]) {
      setEditedNames(prev => ({ ...prev, [photoId]: currentName }));
    }
  };

  // Name speichern
  const handleSaveName = (photoId: string) => {
    setEditingId(null);
    toast({
      title: "Name aktualisiert",
      description: "Der Dateiname wurde geändert.",
    });
  };

  // Name ändern
  const handleNameChange = (photoId: string, newName: string) => {
    setEditedNames(prev => ({ ...prev, [photoId]: newName }));
  };

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm();
  };

  const handleDownloadAll = async () => {
    if (!confirmed) {
      toast({
        title: "Bitte zuerst bestätigen",
        description: "Bitte bestätigen Sie die Ergebnisse vor dem Download.",
        variant: "destructive"
      });
      return;
    }

    setDownloading(true);
    try {
      // Bearbeitete Namen als URL-Parameter mitschicken
      const editedNamesParam = Object.keys(editedNames).length > 0
        ? `&editedNames=${encodeURIComponent(JSON.stringify(editedNames))}`
        : '';
      
      const response = await fetch(`/api/download?batchId=${batchId}&type=batch${editedNamesParam}`);
      
      // Prüfen, ob es ein JSON-Fehler ist
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download fehlgeschlagen');
      }
      
      if (!response.ok) {
        throw new Error('Download fehlgeschlagen');
      }
      
      const blob = await response.blob();
      
      // Prüfen, ob der Blob eine gültige Größe hat
      if (blob.size === 0) {
        throw new Error('Download-Datei ist leer');
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fotos_batch_${batchId}.zip`;
      a.style.display = 'none';
      
      // Sicheres Hinzufügen und Entfernen außerhalb des React-Render-Zyklus
      setTimeout(() => {
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
      }, 0);
      
      toast({
        title: "Download erfolgreich",
        description: `Alle ${processedPhotos.length} Bilder wurden heruntergeladen.`,
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download-Fehler",
        description: error.message || "Die Bilder konnten nicht heruntergeladen werden.",
        variant: "destructive"
      });
    } finally {
      setDownloading(false);
    }
  };

  const formatCoordinates = (lat: number, lng: number) => {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'O' : 'W';
    return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
  };

  // Einzeldownload-Funktion
  const handleDownloadSingle = async (photo: PhotoData) => {
    try {
      const response = await fetch(`/api/download?photoId=${photo.id}&type=single`);
      if (!response.ok) throw new Error('Download fehlgeschlagen');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = editedNames[photo.id] || photo.newName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download erfolgreich",
        description: `${photo.newName} wurde heruntergeladen.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download-Fehler",
        description: "Das Bild konnte nicht heruntergeladen werden.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Bestätigungs-Header */}
      <Card className={`shadow-lg ${confirmed ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {confirmed ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <span className="text-green-800">Ergebnisse bestätigt</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-6 w-6 text-yellow-600" />
                <span className="text-yellow-800">Bitte Ergebnisse überprüfen</span>
              </>
            )}
          </CardTitle>
          <CardDescription>
            {confirmed 
              ? `${processedPhotos.length} Bilder bereit zum Download.`
              : `Überprüfen Sie die ${processedPhotos.length} verarbeiteten Bilder und bestätigen Sie die Ergebnisse.`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {!confirmed ? (
              <>
                <Button
                  onClick={handleConfirm}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Ergebnisse bestätigen
                </Button>
                <Button
                  onClick={onReject}
                  variant="outline"
                  className="border-red-300 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Neu starten
                </Button>
              </>
            ) : (
              <Button
                onClick={handleDownloadAll}
                disabled={downloading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {downloading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Package className="h-4 w-4 mr-2" />
                )}
                Alle als ZIP herunterladen ({processedPhotos.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Erfolgreiche Bilder */}
      {processedPhotos.length > 0 && (
        <Card className="bg-white shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Verarbeitete Bilder</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {processedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="bg-gray-50 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Bildvorschau */}
                  <div className="relative aspect-video bg-gray-200">
                    <ImageThumbnail 
                      cloudStoragePath={photo.cloudStoragePath} 
                      alt={photo.newName} 
                    />
                  </div>

                  {/* Bildinfos */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                        {photo.location}
                      </Badge>
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        {photo.scene}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      {editingId === photo.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editedNames[photo.id] || photo.newName}
                            onChange={(e) => handleNameChange(photo.id, e.target.value)}
                            className="text-sm h-8"
                            autoFocus
                          />
                          <Button
                            onClick={() => handleSaveName(photo.id)}
                            size="sm"
                            className="h-8 px-2"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="font-semibold text-green-700 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="flex-1">{getCurrentName(photo)}</span>
                          {!confirmed && (
                            <button
                              onClick={() => handleEditName(photo.id, getCurrentName(photo))}
                              className="text-blue-600 hover:text-blue-700 p-1"
                              title="Namen bearbeiten"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        Original: {photo.originalName}
                      </div>
                    </div>

                    {/* Metadaten */}
                    <div className="space-y-2 text-xs border-t pt-2">
                      {photo.latitude && photo.longitude && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-600">
                            {formatCoordinates(photo.latitude, photo.longitude)}
                          </span>
                        </div>
                      )}
                      
                      {photo.cameraModel && (
                        <div className="flex items-center gap-2">
                          <Camera className="h-3 w-3 text-blue-600" />
                          <span className="text-gray-600 truncate">{photo.cameraModel}</span>
                        </div>
                      )}
                      
                      {photo.dateTimeTaken && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-purple-600" />
                          <span className="text-gray-600">
                            {new Date(photo.dateTimeTaken).toLocaleDateString('de-DE')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Einzeldownload */}
                    {confirmed && (
                      <Button
                        onClick={() => handleDownloadSingle(photo)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Download className="h-3 w-3 mr-2" />
                        Einzeln herunterladen
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fehlgeschlagene Bilder */}
      {failedPhotos.length > 0 && (
        <Card className="bg-white shadow-lg border-red-200">
          <CardHeader>
            <CardTitle className="text-xl text-red-600 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Fehler bei {failedPhotos.length} {failedPhotos.length === 1 ? 'Bild' : 'Bildern'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {failedPhotos.map((photo) => (
                <Alert key={photo.id} variant="destructive">
                  <AlertDescription>
                    <strong>{photo.originalName}</strong> - {photo.processingError}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Thumbnail-Komponente
function ImageThumbnail({ cloudStoragePath, alt }: { cloudStoragePath: string; alt: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        const response = await fetch(`/api/image-url?path=${encodeURIComponent(cloudStoragePath)}`);
        if (!response.ok) throw new Error('Bild konnte nicht geladen werden');
        
        const data = await response.json();
        setImageUrl(data.url);
        setLoading(false);
      } catch (err) {
        console.error('Fehler beim Laden des Bildes:', err);
        setError(true);
        setLoading(false);
      }
    };

    loadImage();
  }, [cloudStoragePath]);

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
        <RefreshCw className="h-6 w-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
        <Camera className="h-8 w-8 text-gray-400" />
      </div>
    );
  }

  return (
    <Image
      src={imageUrl}
      alt={alt}
      fill
      className="object-cover"
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  );
}
