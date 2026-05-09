import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';
import { processImage, deleteImage, getPhotoDirectory, getPhotoUrl } from '../utils/image.util.js';
import { extractExifData } from '../utils/exif.util.js';
import path from 'path';

export async function uploadPhoto(req: AuthRequest, res: Response) {
  try {
    const { applicationId } = req.params;
    const { stage } = req.body;

    // Validate required fields
    if (!stage) {
      return res.status(400).json({ error: 'Stage is required (BEFORE_UNTREATED or AFTER_TREATED)' });
    }

    if (!['BEFORE_UNTREATED', 'AFTER_TREATED'].includes(stage)) {
      return res.status(400).json({ error: 'Invalid stage value' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify application exists
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { trial: true },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Extract EXIF data before processing
    const exifData = await extractExifData(req.file.path);

    // Get photo directory
    const photoDir = getPhotoDirectory(application.trial_id, applicationId, stage);

    // Process and optimize image
    const processedImage = await processImage(req.file.path, photoDir);

    // Generate URLs
    const originalFilename = path.basename(processedImage.originalPath);
    const thumbnailFilename = processedImage.thumbnailPath
      ? path.basename(processedImage.thumbnailPath)
      : null;

    const file_url = getPhotoUrl(application.trial_id, applicationId, stage, originalFilename);
    const thumbnail_url = thumbnailFilename
      ? getPhotoUrl(application.trial_id, applicationId, stage, thumbnailFilename)
      : null;

    // Save photo metadata to database
    const photo = await prisma.photo.create({
      data: {
        application_id: applicationId,
        stage,
        file_path: processedImage.originalPath,
        file_url,
        file_size: processedImage.fileSize,
        thumbnail_path: processedImage.thumbnailPath,
        gps_lat: exifData.gps_lat,
        gps_lng: exifData.gps_lng,
        exif_timestamp: exifData.exif_timestamp,
        created_by: req.user!.userId,
      },
    });

    res.status(201).json({
      photo: {
        id: photo.id,
        stage: photo.stage,
        file_url,
        thumbnail_url,
        file_size: photo.file_size,
        gps_lat: photo.gps_lat,
        gps_lng: photo.gps_lng,
        exif_timestamp: photo.exif_timestamp,
        created_at: photo.created_at,
      },
    });
  } catch (error) {
    logger.error('Upload photo error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
}

export async function getPhotosByApplication(req: AuthRequest, res: Response) {
  try {
    const { applicationId } = req.params;

    const photos = await prisma.photo.findMany({
      where: { application_id: applicationId },
      orderBy: [{ stage: 'asc' }, { created_at: 'asc' }],
    });

    res.json({ photos });
  } catch (error) {
    logger.error('Get photos error:', error);
    res.status(500).json({ error: 'Failed to get photos' });
  }
}

export async function deletePhoto(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Get photo details
    const photo = await prisma.photo.findUnique({
      where: { id },
    });

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Delete physical files
    await deleteImage(photo.file_path, photo.thumbnail_path);

    // Delete database record
    await prisma.photo.delete({ where: { id } });

    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    logger.error('Delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
}
