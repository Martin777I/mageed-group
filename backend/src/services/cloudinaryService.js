/**
 * MAGEED GROUP — Cloudinary Service
 * Reusable service for image upload, delete, and URL optimization.
 */

const cloudinary = require('cloudinary').v2;
const config = require('../config/config');
const logger = require('../config/logger');

// ── Configure Cloudinary ──
if (config.cloudinary.isConfigured) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
  logger.info('☁️  Cloudinary configured successfully');
} else {
  logger.warn('☁️  Cloudinary not configured — uploads will fall back to local storage');
}

// ── Default fallback image ──
const FALLBACK_IMAGE = 'https://res.cloudinary.com/demo/image/upload/v1/samples/placeholder.png';

/**
 * Upload an image to Cloudinary
 * @param {string|Buffer} source - File path or buffer
 * @param {string} folder - Cloudinary folder (e.g., 'logos', 'products')
 * @param {object} options - Additional upload options
 * @returns {Promise<{url: string, publicId: string, width: number, height: number}>}
 */
async function uploadImage(source, folder = 'logos', options = {}) {
  if (!config.cloudinary.isConfigured) {
    logger.warn('Cloudinary upload skipped — not configured');
    return null;
  }

  try {
    const uploadOptions = {
      folder: `${config.cloudinary.folder}/${folder}`,
      resource_type: 'image',
      // Auto-optimize
      quality: 'auto',
      fetch_format: 'auto',
      // Transformation
      transformation: [
        { width: options.maxWidth || 800, crop: 'limit' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' },
      ],
      // Overwrite if same public_id
      overwrite: true,
      ...options,
    };

    let result;

    if (Buffer.isBuffer(source)) {
      // Upload from buffer (memory storage)
      result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(uploadOptions, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
        stream.end(source);
      });
    } else {
      // Upload from file path
      result = await cloudinary.uploader.upload(source, uploadOptions);
    }

    logger.info(`☁️  Image uploaded: ${result.public_id}`, {
      category: 'cloudinary',
      action: 'upload',
      publicId: result.public_id,
      size: result.bytes,
      format: result.format,
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes,
    };
  } catch (error) {
    logger.error('Cloudinary upload failed:', {
      error: error.message,
      folder,
    });
    throw new Error(`فشل رفع الصورة: ${error.message}`);
  }
}

/**
 * Delete an image from Cloudinary
 * @param {string} publicId - The public ID of the image
 * @returns {Promise<boolean>}
 */
async function deleteImage(publicId) {
  if (!config.cloudinary.isConfigured || !publicId) {
    return false;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    
    logger.info(`☁️  Image deleted: ${publicId}`, {
      category: 'cloudinary',
      action: 'delete',
      publicId,
      result: result.result,
    });

    return result.result === 'ok';
  } catch (error) {
    logger.error(`Cloudinary delete failed for ${publicId}:`, {
      error: error.message,
    });
    return false;
  }
}

/**
 * Generate an optimized URL for a Cloudinary image
 * @param {string} publicId - The public ID
 * @param {object} transformations - Cloudinary transformations
 * @returns {string} Optimized URL
 */
function getOptimizedUrl(publicId, transformations = {}) {
  if (!config.cloudinary.isConfigured || !publicId) {
    return FALLBACK_IMAGE;
  }

  const defaultTransformations = {
    quality: 'auto',
    fetch_format: 'auto',
    ...transformations,
  };

  return cloudinary.url(publicId, {
    secure: true,
    transformation: [defaultTransformations],
  });
}

/**
 * Extract public ID from a Cloudinary URL
 * @param {string} url - Full Cloudinary URL
 * @returns {string|null} Public ID
 */
function extractPublicId(url) {
  if (!url || !url.includes('cloudinary')) return null;

  try {
    // URL format: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{public_id}.{ext}
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;

    const pathAfterUpload = parts[1];
    // Remove version prefix (v1234567890/)
    const withoutVersion = pathAfterUpload.replace(/^v\d+\//, '');
    // Remove file extension
    const publicId = withoutVersion.replace(/\.[^.]+$/, '');
    return publicId;
  } catch {
    return null;
  }
}

/**
 * Check if Cloudinary is reachable
 * @returns {Promise<{connected: boolean, error?: string}>}
 */
async function testConnection() {
  if (!config.cloudinary.isConfigured) {
    return { connected: false, error: 'Not configured' };
  }

  try {
    await cloudinary.api.ping();
    return { connected: true };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

module.exports = {
  uploadImage,
  deleteImage,
  getOptimizedUrl,
  extractPublicId,
  testConnection,
  FALLBACK_IMAGE,
};
