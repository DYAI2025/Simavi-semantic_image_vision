import { prisma } from './db';

export async function getNextSequenceNumber(location: string): Promise<number> {
  try {
    const counter = await prisma.categoryCounter.upsert({
      where: { categoryName: location },
      update: {
        currentCounter: { increment: 1 }
      },
      create: {
        categoryName: location,
        currentCounter: 1
      }
    });

    return counter.currentCounter;
  } catch (error) {
    console.error('Fehler beim Generieren der Sequenznummer:', error);
    return Math.floor(Math.random() * 1000) + 1;
  }
}

export async function getPlaceName(latitude: number, longitude: number): Promise<string | null> {
  try {
    // OpenStreetMap Nominatim API für Reverse Geocoding (kostenlos)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'FotoIdentifikationSystem/1.0'
        }
      }
    );

    if (!response.ok) {
      console.warn('Nominatim API Fehler:', response.status);
      return null;
    }

    const data = await response.json();
    
    // Priorisiere spezifische Orte
    const placeName = 
      data.address?.tourism ||           // z.B. Sehenswürdigkeiten, Denkmäler
      data.address?.leisure ||           // z.B. Parks, Spielplätze
      data.address?.amenity ||           // z.B. Restaurants, Cafés
      data.address?.building ||          // z.B. spezifische Gebäude
      data.address?.neighbourhood ||     // z.B. Stadtviertel
      data.address?.suburb ||            // z.B. Stadtteile
      data.address?.town ||              // z.B. kleine Städte
      data.address?.city ||              // z.B. Städte
      data.address?.village;             // z.B. Dörfer

    return placeName || null;

  } catch (error) {
    console.error('Fehler beim Abrufen des Ortsnamens:', error);
    return null;
  }
}