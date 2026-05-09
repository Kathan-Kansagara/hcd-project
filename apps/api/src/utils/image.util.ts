import sharp from 'sharp';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';

export interface ImageProcessingOptions {
  maxWidth?: number;
  quality?: number;
  thumbnailWidth?: number;
  thumbnailQuality?: number;
}

export interface ProcessedImage {
  originalPath: string;
  thumbnailPath: string | null;
  fileSize: number;
  fileType: 'image' | 'video';
}

/**
 * Check if file is a video based on extension
 */
function isVideoFile(filename: string): boolean {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mpeg', '.mpg'];
  const ext = path.extname(filename).toLowerCase();
  return videoExtensions.includes(ext);
}

/**
 * Process and optimize uploaded image or video
 * Creates optimized original and thumbnail versions for images
 * For videos, just moves them to the correct directory
 */
export async function processImage(
  inputPath: string,
  outputDir: string,
  options: ImageProcessingOptions = {}
): Promise<ProcessedImage> {
  try {
    // Ensure output directory exists
    await fs.ensureDir(outputDir);

    // Check if it's a video file
    const isVideo = isVideoFile(inputPath);

    if (isVideo) {
      // For videos, just move the file without processing
      const fileId = uuidv4();
      const ext = path.extname(inputPath);
      const originalPath = path.join(outputDir, `${fileId}-original${ext}`);

      // Move video file to output directory
      await fs.move(inputPath, originalPath);

      // Get file size
      const stats = await fs.stat(originalPath);
      const fileSize = stats.size;

      logger.info('Video processed successfully', {
        originalPath,
        fileSize,
      });

      return {
        originalPath,
        thumbnailPath: null,
        fileSize,
        fileType: 'video',
      };
    }

    // Process as image
    const {
      maxWidth = 1920,
      quality = 85,
      thumbnailWidth = 300,
      thumbnailQuality = 80,
    } = options;

    // Generate unique filename
    const fileId = uuidv4();
    const ext = '.jpg';

    // Paths for processed images
    const originalPath = path.join(outputDir, `${fileId}-original${ext}`);
    const thumbnailPath = path.join(outputDir, `${fileId}-thumb${ext}`);

    // Process original image (optimized)
    await sharp(inputPath)
      .resize(maxWidth, undefined, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .jpeg({ quality, progressive: true })
      .toFile(originalPath);

    // Create thumbnail
    await sharp(inputPath)
      .resize(thumbnailWidth, undefined, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .jpeg({ quality: thumbnailQuality, progressive: true })
      .toFile(thumbnailPath);

    // Get file size
    const stats = await fs.stat(originalPath);
    const fileSize = stats.size;

    // Remove temp uploaded file
    await fs.remove(inputPath);

    logger.info('Image processed successfully', {
      originalPath,
      thumbnailPath,
      fileSize,
    });

    return {
      originalPath,
      thumbnailPath,
      fileSize,
      fileType: 'image',
    };
  } catch (error) {
    logger.error('File processing error:', error);
    // Clean up temp file on error
    try {
      await fs.remove(inputPath);
    } catch (cleanupError) {
      logger.error('Failed to clean up temp file:', cleanupError);
    }
    throw new Error('Failed to process file');
  }
}

/**
 * Delete image files (original and thumbnail)
 */
export async function deleteImage(originalPath: string, thumbnailPath?: string | null): Promise<void> {
  try {
    // Delete original
    if (await fs.pathExists(originalPath)) {
      await fs.remove(originalPath);
      logger.info('Deleted original image:', originalPath);
    }

    // Delete thumbnail
    if (thumbnailPath && (await fs.pathExists(thumbnailPath))) {
      await fs.remove(thumbnailPath);
      logger.info('Deleted thumbnail:', thumbnailPath);
    }
  } catch (error) {
    logger.error('Error deleting image files:', error);
    throw new Error('Failed to delete image files');
  }
}

/**
 * Get directory path for trial application photos
 */
export function getPhotoDirectory(trialId: string, applicationId: string, stage: string): string {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const stageDir = stage.toLowerCase().replace('_', '-');
  return path.join(uploadDir, 'trials', trialId, 'applications', applicationId, stageDir);
}

/**
 * Get relative URL path for serving photos
 */
export function getPhotoUrl(trialId: string, applicationId: string, stage: string, filename: string): string {
  const stageDir = stage.toLowerCase().replace('_', '-');
  return `/uploads/trials/${trialId}/applications/${applicationId}/${stageDir}/${filename}`;
}
