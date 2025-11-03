
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Cloud, 
  Folder, 
  RefreshCw, 
  CheckCircle2, 
  LogIn,
  FolderOpen,
  Image as ImageIcon
} from 'lucide-react';

interface GoogleDriveFolder {
  id: string;
  name: string;
  imageCount: number;
}

interface GoogleDrivePickerProps {
  onFolderSelected: (folderId: string, folderName: string) => void;
}

export function GoogleDrivePicker({ onFolderSelected }: GoogleDrivePickerProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const { toast } = useToast();

  // Status beim Laden prüfen
  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/google-drive/auth/status');
      const data = await response.json();
      setIsConnected(data.connected);
      
      if (data.connected) {
        loadFolders();
      }
    } catch (error) {
      console.error('Fehler beim Prüfen des Verbindungsstatus:', error);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/google-drive/auth/connect', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.authUrl) {
        // OAuth-Flow starten
        window.open(data.authUrl, '_blank', 'width=600,height=700');
        
        // Polling für Verbindungsstatus
        const pollInterval = setInterval(async () => {
          const statusResponse = await fetch('/api/google-drive/auth/status');
          const statusData = await statusResponse.json();
          
          if (statusData.connected) {
            clearInterval(pollInterval);
            setIsConnected(true);
            loadFolders();
            toast({
              title: "Erfolgreich verbunden",
              description: "Ihr Google Drive wurde erfolgreich verbunden.",
            });
          }
        }, 2000);
        
        // Nach 2 Minuten aufhören zu pollen
        setTimeout(() => clearInterval(pollInterval), 120000);
      }
    } catch (error) {
      console.error('Fehler bei der Verbindung:', error);
      toast({
        title: "Verbindungsfehler",
        description: "Google Drive konnte nicht verbunden werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/google-drive/folders');
      if (!response.ok) throw new Error('Fehler beim Laden der Ordner');
      
      const data = await response.json();
      setFolders(data.folders || []);
    } catch (error) {
      console.error('Fehler beim Laden der Ordner:', error);
      toast({
        title: "Fehler",
        description: "Ordner konnten nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFolderSelect = (folderId: string, folderName: string) => {
    setSelectedFolder(folderId);
    onFolderSelected(folderId, folderName);
  };

  if (!isConnected) {
    return (
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-6 w-6 text-blue-600" />
            Google Drive verbinden
          </CardTitle>
          <CardDescription>
            Verbinden Sie Ihr persönliches Google Drive, um Ordner mit Bildern direkt zu verarbeiten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>Hinweis:</strong> Jeder Nutzer verbindet sein eigenes Google Drive. 
              Es werden keine Daten mit anderen Nutzern geteilt.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">Sichere OAuth-Authentifizierung</div>
                <div className="text-sm text-gray-600">
                  Ihre Anmeldedaten werden nur zwischen Ihnen und Google ausgetauscht
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">Nur Lesezugriff</div>
                <div className="text-sm text-gray-600">
                  Die App kann nur Ordner lesen, keine Dateien löschen oder ändern
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">Individuelle Verbindung</div>
                <div className="text-sm text-gray-600">
                  Jeder Nutzer hat Zugriff nur auf sein eigenes Google Drive
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleConnect}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            {loading ? (
              <>
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Verbinde...
              </>
            ) : (
              <>
                <LogIn className="h-5 w-5 mr-2" />
                Mit Google Drive verbinden
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-6 w-6 text-green-600" />
            Google Drive - Ordner auswählen
          </CardTitle>
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Verbunden
          </Badge>
        </div>
        <CardDescription>
          Wählen Sie einen Ordner mit Bildern zur Verarbeitung aus.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={loadFolders}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Aktualisieren
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Lade Ordner...</p>
          </div>
        ) : folders.length === 0 ? (
          <Alert>
            <FolderOpen className="h-4 w-4" />
            <AlertDescription>
              Keine Ordner mit Bildern gefunden. Erstellen Sie Ordner in Ihrem Google Drive und laden Sie Bilder hoch.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {folders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => handleFolderSelect(folder.id, folder.name)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                  selectedFolder === folder.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Folder className={`h-5 w-5 ${
                      selectedFolder === folder.id ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                    <div>
                      <div className="font-medium">{folder.name}</div>
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" />
                        {folder.imageCount} {folder.imageCount === 1 ? 'Bild' : 'Bilder'}
                      </div>
                    </div>
                  </div>
                  {selectedFolder === folder.id && (
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
