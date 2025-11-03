
import ExifReader from 'exifreader';
import { ExifData, GeoData } from './types';

export async function extractExifData(file: File): Promise<ExifData | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const tags = await ExifReader.load(arrayBuffer, { expanded: true });
    
    if (!tags || Object.keys(tags).length === 0) {
      return null;
    }

    // Konvertiere ExifReader Tags zu unserem ExifData Format
    const exifData: any = {};

    // Basis-Informationen
    if (tags.exif) {
      if (tags.exif.Make?.description) exifData.Make = tags.exif.Make.description;
      if (tags.exif.Model?.description) exifData.Model = tags.exif.Model.description;
      if (tags.exif.DateTime?.description) exifData.DateTime = tags.exif.DateTime.description;
      if (tags.exif.DateTimeOriginal?.description) exifData.DateTimeOriginal = tags.exif.DateTimeOriginal.description;
    }

    // GPS-Daten - ExifReader gibt bereits Dezimalwerte zurück
    if (tags.gps) {
      exifData.GPS = {};
      
      if (typeof tags.gps.Latitude === 'number') {
        exifData.GPS.GPSLatitude = tags.gps.Latitude;
        exifData.GPS.GPSLatitudeRef = tags.gps.Latitude >= 0 ? 'N' : 'S';
      }
      if (typeof tags.gps.Longitude === 'number') {
        exifData.GPS.GPSLongitude = tags.gps.Longitude;
        exifData.GPS.GPSLongitudeRef = tags.gps.Longitude >= 0 ? 'E' : 'W';
      }
      if (typeof tags.gps.Altitude === 'number') {
        exifData.GPS.GPSAltitude = tags.gps.Altitude;
      }
    }

    return exifData;
  } catch (error) {
    console.error('EXIF extraction error:', error);
    return null;
  }
}

export function extractGeoData(exifData: ExifData | null): GeoData {
  if (!exifData?.GPS) {
    return {};
  }

  const gps = exifData.GPS;
  
  // ExifReader gibt bereits korrekte Dezimalwerte mit Vorzeichen zurück
  // Negative Werte für South (S) und West (W) sind bereits enthalten
  return {
    latitude: typeof gps.GPSLatitude === 'number' ? gps.GPSLatitude : undefined,
    longitude: typeof gps.GPSLongitude === 'number' ? gps.GPSLongitude : undefined,
    altitude: typeof gps.GPSAltitude === 'number' ? gps.GPSAltitude : undefined
  };
}

export function getCameraModel(exifData: ExifData | null): string | undefined {
  if (!exifData) return undefined;
  
  const make = exifData.Make || '';
  const model = exifData.Model || '';
  
  if (make && model) {
    return `${make} ${model}`.trim();
  } else if (model) {
    return model;
  } else if (make) {
    return make;
  }
  
  return undefined;
}

export function getDateTimeTaken(exifData: ExifData | null): Date | undefined {
  if (!exifData) return undefined;
  
  // Versuche zuerst DateTimeOriginal, dann DateTime
  const dateTimeStr = exifData.DateTimeOriginal || exifData.DateTime;
  
  if (!dateTimeStr) return undefined;
  
  try {
    // EXIF DateTime format: "2024:01:15 10:30:45"
    const normalizedStr = dateTimeStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    return new Date(normalizedStr);
  } catch {
    return undefined;
  }
}
