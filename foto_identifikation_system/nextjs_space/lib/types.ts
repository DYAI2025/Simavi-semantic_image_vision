
export interface PhotoData {
  id: string;
  originalName: string;
  newName: string;
  cloudStoragePath: string;
  location: string;
  scene: string;
  sequenceNumber: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  exifData?: any;
  dateTimeTaken?: Date;
  cameraModel?: string;
  uploadBatch: string;
  processed: boolean;
  processingError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadProgress {
  total: number;
  processed: number;
  completed: number;
  failed: number;
  current?: string;
}

export interface GeoData {
  latitude?: number;
  longitude?: number;
  altitude?: number;
}

export interface ExifData {
  [key: string]: any;
  DateTime?: string;
  GPS?: {
    GPSLatitude?: number[];
    GPSLatitudeRef?: string;
    GPSLongitude?: number[];
    GPSLongitudeRef?: string;
    GPSAltitude?: number;
  };
  Camera?: {
    Make?: string;
    Model?: string;
  };
}
