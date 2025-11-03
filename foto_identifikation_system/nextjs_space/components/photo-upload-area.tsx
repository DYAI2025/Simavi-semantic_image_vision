
'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Camera, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PhotoUploadAreaProps {
  onFilesSelected: (files: File[]) => void;
}

export function PhotoUploadArea({ onFilesSelected }: PhotoUploadAreaProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  // Verhindert, dass Bilder außerhalb der Drop-Zone als Browser-Tab geöffnet werden
  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('dragover', preventDefaults);
    window.addEventListener('drop', preventDefaults);

    return () => {
      window.removeEventListener('dragover', preventDefaults);
      window.removeEventListener('drop', preventDefaults);
    };
  }, []);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[], event: any) => {
    // Verhindert, dass Bilder als Browser-Tab geöffnet werden
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    onFilesSelected(acceptedFiles);
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.bmp', '.webp', '.tiff']
    },
    multiple: true,
    noClick: true, // Verhindert, dass Bilder als Browser-Tab geöffnet werden
    noKeyboard: true,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    onDropAccepted: () => setIsDragActive(false),
    onDropRejected: () => setIsDragActive(false)
  });

  return (
    <Card className="border-2 border-dashed border-blue-300 bg-white hover:bg-blue-50 transition-colors">
      <CardContent className="p-12">
        <div 
          {...getRootProps()} 
          className={`text-center cursor-pointer space-y-6 ${
            isDragActive ? 'scale-105' : ''
          } transition-transform`}
        >
          <input {...getInputProps()} />
          
          <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center ${
            isDragActive ? 'bg-blue-200' : 'bg-blue-100'
          } transition-colors`}>
            {isDragActive ? (
              <Upload className="h-12 w-12 text-blue-600 animate-bounce" />
            ) : (
              <Camera className="h-12 w-12 text-blue-600" />
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-2xl font-semibold text-gray-800">
              {isDragActive ? 'Bilder hier ablegen' : 'Bilder hochladen'}
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              {isDragActive 
                ? 'Lassen Sie Ihre Bilder hier fallen für die automatische Verarbeitung'
                : 'Ziehen Sie 20-50 Bilder hierhin oder klicken Sie zum Auswählen'
              }
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <Button 
              onClick={open} 
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
            >
              <Image className="h-5 w-5 mr-2" />
              Bilder auswählen
            </Button>
            
            <div className="text-sm text-gray-500">
              Unterstützte Formate: JPEG, PNG, GIF, BMP, WebP, TIFF
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>KI-Bildanalyse</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Geodaten-Extraktion</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Automatische Umbenennung</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
