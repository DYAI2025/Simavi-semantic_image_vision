
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { PhotoData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  MapPin, 
  Camera, 
  Calendar, 
  Image as ImageIcon,
  Package,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Thumbnail-Komponente für Bildvorschau
function ImageThumbnail({ cloudStoragePath, alt }: { cloudStoragePath: string; alt: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        // Temporäre Signed URL vom Server holen
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
        <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
        <ImageIcon className="h-12 w-12 text-gray-400" />
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

interface PhotoResultsProps {
  photos: PhotoData[];
  batchId: string | null;
  onClear: () => void;
}

export function PhotoResults({ photos, batchId, onClear }: PhotoResultsProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const { toast } = useToast();

  const processedPhotos = photos.filter(p => p.processed);
  const failedPhotos = photos.filter(p => !p.processed && p.processingError);
  const hasGeoData = processedPhotos.filter(p => p.latitude && p.longitude).length;

  const handleDownloadSingle = async (photo: PhotoData) => {
    if (downloading) return;
    
    setDownloading(photo.id);
    try {
      const response = await fetch(`/api/download?photoId=${photo.id}&type=single`);
      if (!response.ok) throw new Error('Download fehlgeschlagen');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photo.newName;
      a.click();
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
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadAll = async () => {
    if (downloadingAll || processedPhotos.length === 0) return;
    
    setDownloadingAll(true);
    try {
      const response = await fetch(`/api/download?batchId=${batchId}&type=batch`);
      if (!response.ok) throw new Error('Download fehlgeschlagen');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fotos_batch_${batchId}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download erfolgreich",
        description: `Alle ${processedPhotos.length} Bilder wurden als ZIP heruntergeladen.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download-Fehler",
        description: "Die Bilder konnten nicht heruntergeladen werden.",
        variant: "destructive"
      });
    } finally {
      setDownloadingAll(false);
    }
  };

  const formatCoordinates = (lat: number, lng: number) => {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'O' : 'W';
    return `${Math.abs(lat).toFixed(6)}°${latDir}, ${Math.abs(lng).toFixed(6)}°${lngDir}`;
  };

  const openInMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Ergebnis-Header */}
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-semibold flex items-center gap-2">
              <ImageIcon className="h-6 w-6 text-green-600" />
              Verarbeitungsergebnisse
            </CardTitle>
            <div className="flex gap-3">
              {processedPhotos.length > 0 && (
                <Button
                  onClick={handleDownloadAll}
                  disabled={downloadingAll}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {downloadingAll ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Package className="h-4 w-4 mr-2" />
                  )}
                  Alle als ZIP ({processedPhotos.length})
                </Button>
              )}
              <Button
                onClick={onClear}
                variant="outline"
                className="hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Neu starten
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {processedPhotos.length}
              </div>
              <div className="text-sm text-green-700">Erfolgreich verarbeitet</div>
            </div>
            
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {hasGeoData}
              </div>
              <div className="text-sm text-blue-700">Mit Geodaten</div>
            </div>
            
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {new Set(processedPhotos.map(p => p.location)).size}
              </div>
              <div className="text-sm text-purple-700">Ort-Kategorien</div>
            </div>
            
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {failedPhotos.length}
              </div>
              <div className="text-sm text-red-700">Fehler</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Erfolgreich verarbeitete Bilder */}
      {processedPhotos.length > 0 && (
        <Card className="bg-white shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">
              Erfolgreich verarbeitete Bilder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {processedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="bg-gray-50 rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-200 rounded-md overflow-hidden">
                    <ImageThumbnail cloudStoragePath={photo.cloudStoragePath} alt={photo.newName} />
                  </div>

                  {/* Bild-Informationen */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        {photo.location}
                      </Badge>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {photo.scene}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      <div className="font-medium text-gray-800">
                        {photo.newName}
                      </div>
                      <div className="text-gray-600">
                        Original: {photo.originalName}
                      </div>
                    </div>
                  </div>

                  {/* Metadaten */}
                  <div className="space-y-2 text-sm border-t pt-3">
                    {photo.latitude && photo.longitude && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-medium">GPS-Koordinaten:</div>
                          <div className="text-gray-600 break-all">
                            {formatCoordinates(photo.latitude, photo.longitude)}
                          </div>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
                            onClick={() => openInMaps(photo.latitude!, photo.longitude!)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            In Karte anzeigen
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {photo.cameraModel && (
                      <div className="flex items-center gap-2">
                        <Camera className="h-4 w-4 text-blue-600" />
                        <span className="text-gray-600">{photo.cameraModel}</span>
                      </div>
                    )}
                    
                    {photo.dateTimeTaken && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-purple-600" />
                        <span className="text-gray-600">
                          {new Date(photo.dateTimeTaken).toLocaleString('de-DE')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Download-Button */}
                  <Button
                    onClick={() => handleDownloadSingle(photo)}
                    disabled={downloading === photo.id}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    {downloading === photo.id ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Herunterladen
                  </Button>
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
            <CardTitle className="text-xl font-semibold text-red-600">
              Fehler bei der Verarbeitung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {failedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="bg-red-50 rounded-lg p-4 space-y-2"
                >
                  <div className="font-medium text-red-800">
                    {photo.originalName}
                  </div>
                  <div className="text-sm text-red-600">
                    Fehler: {photo.processingError}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
