
'use client';

import { useState, Suspense } from 'react';
import { PhotoUploadSystem } from '@/components/photo-upload-system';
import { GoogleDriveIntegration } from '@/components/google-drive-integration';
import { Button } from '@/components/ui/button';
import { Camera, MapPin, Image, Upload, Cloud } from 'lucide-react';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'local' | 'google-drive'>('local');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="p-3 bg-blue-100 rounded-full">
            <Camera className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            Foto-Identifikations- und Ordnungssystem
          </h1>
        </div>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Laden Sie Bilder lokal hoch oder verbinden Sie Ihr Google Drive für automatische Analyse und intelligente Umbenennung.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <Image className="h-6 w-6 text-blue-600" />
            <h3 className="font-semibold">KI-Bildanalyse</h3>
          </div>
          <p className="text-gray-600 text-sm">
            Automatische Erkennung von Orten und Szenen durch Vision AI
          </p>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <MapPin className="h-6 w-6 text-green-600" />
            <h3 className="font-semibold">Geodaten-Extraktion</h3>
          </div>
          <p className="text-gray-600 text-sm">
            GPS-Koordinaten aus EXIF-Daten für präzise Lokalisierung
          </p>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <Camera className="h-6 w-6 text-purple-600" />
            <h3 className="font-semibold">Intelligente Benennung</h3>
          </div>
          <p className="text-gray-600 text-sm">
            Schema: [Ort]_[Szene]_[Nummer] mit fortlaufender Nummerierung
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <Cloud className="h-6 w-6 text-orange-600" />
            <h3 className="font-semibold">Individuelle OAuth</h3>
          </div>
          <p className="text-gray-600 text-sm">
            Jeder Nutzer verbindet sein eigenes Google Drive sicher
          </p>
        </div>
      </div>

      {/* Tab-Navigation */}
      <div className="w-full">
        <div className="flex gap-2 justify-center mb-8">
          <Button
            onClick={() => setActiveTab('local')}
            variant={activeTab === 'local' ? 'default' : 'outline'}
            className={`flex items-center gap-2 ${
              activeTab === 'local' 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'hover:bg-blue-50'
            }`}
            size="lg"
          >
            <Upload className="h-4 w-4" />
            <span className="font-semibold">Lokaler Upload</span>
          </Button>
          <Button
            onClick={() => setActiveTab('google-drive')}
            variant={activeTab === 'google-drive' ? 'default' : 'outline'}
            className={`flex items-center gap-2 ${
              activeTab === 'google-drive' 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'hover:bg-green-50'
            }`}
            size="lg"
          >
            <Cloud className="h-4 w-4" />
            <span className="font-semibold">Google Drive</span>
          </Button>
        </div>

        <div className="w-full">
          {activeTab === 'local' && (
            <Suspense fallback={
              <div className="bg-white rounded-lg p-8 shadow-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p>System wird geladen...</p>
                </div>
              </div>
            }>
              <PhotoUploadSystem />
            </Suspense>
          )}

          {activeTab === 'google-drive' && (
            <Suspense fallback={
              <div className="bg-white rounded-lg p-8 shadow-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p>Google Drive wird geladen...</p>
                </div>
              </div>
            }>
              <GoogleDriveIntegration />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
