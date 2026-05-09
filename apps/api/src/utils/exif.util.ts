import exifr from 'exifr';
import logger from '../config/logger.js';

export interface ExifData {
  gps_lat: number | null;
  gps_lng: number | null;
  exif_timestamp: Date | null;
}

/**
 * Extract EXIF data from image file
 * Returns GPS coordinates and timestamp if available
 */
export async function extractExifData(filePath: string): Promise<ExifData> {
  try {
    const exifData = await exifr.parse(filePath, {
      gps: true,
      pick: ['latitude', 'longitude', 'DateTimeOriginal', 'CreateDate', 'ModifyDate'],
    } as any);

    if (!exifData) {
      return {
        gps_lat: null,
        gps_lng: null,
        exif_timestamp: null,
      };
    }

    // Extract GPS coordinates
    const gps_lat = exifData.latitude ?? null;
    const gps_lng = exifData.longitude ?? null;

    // Extract timestamp (try different fields)
    let exif_timestamp: Date | null = null;
    if (exifData.DateTimeOriginal) {
      exif_timestamp = new Date(exifData.DateTimeOriginal);
    } else if (exifData.CreateDate) {
      exif_timestamp = new Date(exifData.CreateDate);
    } else if (exifData.ModifyDate) {
      exif_timestamp = new Date(exifData.ModifyDate);
    }

    logger.info('EXIF data extracted', {
      gps_lat,
      gps_lng,
      exif_timestamp,
    });

    return {
      gps_lat,
      gps_lng,
      exif_timestamp,
    };
  } catch (error) {
    logger.warn('Failed to extract EXIF data:', error);
    // Return null values if EXIF extraction fails (not critical)
    return {
      gps_lat: null,
      gps_lng: null,
      exif_timestamp: null,
    };
  }
}
