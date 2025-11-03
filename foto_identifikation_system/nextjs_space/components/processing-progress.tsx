
'use client';

import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Zap, Eye, MapPin } from 'lucide-react';
import { UploadProgress } from '@/lib/types';

interface ProcessingProgressProps {
  progress: UploadProgress;
  onAbort?: () => void;
  message?: string;
}

export function ProcessingProgress({ progress, onAbort, message }: ProcessingProgressProps) {
  const totalProgress = (progress.processed / progress.total) * 100;
  const completionRate = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          {message || 'Bilder werden verarbeitet...'}
        </CardTitle>
        {onAbort && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={onAbort}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <X className="h-4 w-4 mr-1" />
            Abbrechen
          </Button>
        )}
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Haupt-Fortschrittsbalken */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Gesamtfortschritt</span>
            <span className="text-sm text-gray-600">
              {progress.processed} von {progress.total} verarbeitet
            </span>
          </div>
          <Progress value={totalProgress} className="h-3" />
        </div>

        {/* Statistiken */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {progress.completed}
            </div>
            <div className="text-sm text-green-700">Erfolgreich</div>
          </div>
          
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {progress.processed - progress.completed - progress.failed}
            </div>
            <div className="text-sm text-blue-700">In Bearbeitung</div>
          </div>
          
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {progress.failed}
            </div>
            <div className="text-sm text-red-700">Fehler</div>
          </div>
        </div>

        {/* Aktuell verarbeitetes Bild */}
        {progress.current && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm font-medium">Aktuell verarbeitet:</span>
            </div>
            <div className="text-sm text-gray-600 truncate">
              {progress.current}
            </div>
          </div>
        )}

        {/* Verarbeitungsschritte */}
        <div className="space-y-3 pt-3 border-t border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-3">
            Verarbeitungsschritte:
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
              <Eye className="h-4 w-4 text-blue-600" />
              <span>KI-Bildanalyse</span>
            </div>
            
            <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
              <MapPin className="h-4 w-4 text-green-600" />
              <span>Geodaten-Extraktion</span>
            </div>
            
            <div className="flex items-center gap-2 p-2 bg-purple-50 rounded">
              <Zap className="h-4 w-4 text-purple-600" />
              <span>Umbenennung</span>
            </div>
          </div>
        </div>

        {/* Erfolgsrate */}
        {progress.completed > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Erfolgsrate</span>
              <span className="text-sm text-gray-600">
                {completionRate.toFixed(1)}%
              </span>
            </div>
            <Progress value={completionRate} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
