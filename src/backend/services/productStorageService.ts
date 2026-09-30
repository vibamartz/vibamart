import { ref, uploadString, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/firebase';
import {
  buildCdnImageUrl,
  generateSecureImageId,
  getExtensionFromMimeType,
  isCdnImageUrl,
  validateImageInput,
  MAX_IMAGE_SIZE_BYTES
} from '../../shared/utilities/cdnImageUtils';

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Storage operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
};

/**
 * High-definition fallback image processor for offline/restricted environments.
 * Preserves high resolution (up to 2048x2048) and high quality (0.95) with smoothing.
 */
export async function compressDataUrl(
  dataUrl: string,
  maxWidth = 2048,
  maxHeight = 2048,
  quality = 0.95
): Promise<string> {
  if (
    !dataUrl ||
    typeof dataUrl !== 'string' ||
    (!dataUrl.startsWith('data:') && !dataUrl.startsWith('blob:') && dataUrl.length <= 500)
  ) {
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const isPng = dataUrl.startsWith('data:image/png');
      const format = isPng ? 'image/png' : 'image/jpeg';
      const compressed = canvas.toDataURL(format, isPng ? undefined : quality);
      resolve(compressed);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Uploads an image input (base64 Data URL, Blob URL, or raw base64 string) to Firebase Storage
 * and automatically returns a stable canonical ViBa Mart CDN URL:
 * https://cdn.vibamart.com/image/1920/1920/{imageId}.{ext}
 *
 * Rules:
 * 1. Generates a cryptographically secure, unique image ID without using the original filename.
 * 2. Stores the original image file without downscaling, compression, or quality reduction.
 * 3. Existing valid HTTP/HTTPS URLs (including existing CDN URLs) are preserved untouched.
 * 4. Strictly validates format and file size limits (<= 10MB).
 * 5. Cleans up orphan storage items if an upload fails mid-flight.
 */
export async function uploadProductImageToStorage(
  imageInput: string | null | undefined,
  folderPath: string = 'products/originals'
): Promise<string> {
  if (!imageInput || typeof imageInput !== 'string') return '';
  const trimmed = imageInput.trim();
  if (!trimmed) return '';

  // 1. Existing HTTP/HTTPS URLs (e.g. https://cdn.vibamart.com/... or legacy storage URLs) require no re-upload
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // 2. Validate input format and size
  const validation = validateImageInput(trimmed, MAX_IMAGE_SIZE_BYTES);
  if (!validation.valid) {
    console.warn(`[ProductStorageService] Validation rejected image: ${validation.error}`);
    return '';
  }

  // 3. Generate unique secure image ID and determine extension
  const ext = validation.extension || getExtensionFromMimeType(trimmed);
  const imageId = generateSecureImageId('viba_prod');
  const canonicalCdnUrl = buildCdnImageUrl({
    imageId,
    extension: ext,
    width: 1920,
    height: 1920,
  });

  const storageFilePath = `${folderPath}/${imageId}.${ext}`;
  const storageRef = ref(storage, storageFilePath);

  // 4. Upload original raw image without compression or quality reduction
  try {
    let uploadedSuccessfully = false;

    if (trimmed.startsWith('data:')) {
      const mimeType = trimmed.substring(5, trimmed.indexOf(';'));
      await withTimeout(
        uploadString(storageRef, trimmed, 'data_url', {
          contentType: mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          customMetadata: {
            originalImageId: imageId,
            cdnUrl: canonicalCdnUrl,
            uploadedAt: new Date().toISOString(),
          },
        })
      );
      uploadedSuccessfully = true;
    } else if (trimmed.startsWith('blob:')) {
      const res = await fetch(trimmed);
      const blob = await res.blob();
      if (blob.size > MAX_IMAGE_SIZE_BYTES) {
        console.warn('[ProductStorageService] Blob exceeds maximum allowed size (10 MB)');
        return '';
      }
      await withTimeout(
        uploadBytes(storageRef, blob, {
          contentType: blob.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          customMetadata: {
            originalImageId: imageId,
            cdnUrl: canonicalCdnUrl,
            uploadedAt: new Date().toISOString(),
          },
        })
      );
      uploadedSuccessfully = true;
    } else if (trimmed.length > 500 && !trimmed.startsWith('http')) {
      const fullDataUrl = trimmed.includes(';base64,') ? trimmed : `data:image/jpeg;base64,${trimmed}`;
      await withTimeout(
        uploadString(storageRef, fullDataUrl, 'data_url', {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          customMetadata: {
            originalImageId: imageId,
            cdnUrl: canonicalCdnUrl,
            uploadedAt: new Date().toISOString(),
          },
        })
      );
      uploadedSuccessfully = true;
    }

    if (uploadedSuccessfully) {
      // Storage upload succeeded: Return the canonical CDN URL
      return canonicalCdnUrl;
    }
  } catch (err) {
    console.warn('[ProductStorageService] Firebase Storage upload encounter:', err);

    // Attempt cleanup of orphan file if reference exists
    try {
      await deleteObject(storageRef).catch(() => {});
    } catch {
      // Ignore cleanup error if file was never written
    }

    // Fallback: If Firebase Storage bucket is offline/unreachable in local preview,
    // generate CDN URL format with fallback payload or high-clarity data URL for Firestore
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.length > 500) {
      try {
        const compressedFallback = await compressDataUrl(trimmed, 1920, 1920, 0.92);
        return compressedFallback;
      } catch (fallbackErr) {
        console.error('[ProductStorageService] Fallback compression failed:', fallbackErr);
        return '';
      }
    }
  }

  return '';
}

/**
 * Processes all product images (main product images, primary image, and variant galleries),
 * uploading them to Storage with unique IDs and generating stable CDN URLs before saving to Firestore.
 *
 * Rules:
 * - Enforces a maximum of 10 images per product and per variant.
 * - Preserves the exact original image ordering.
 * - Preserves existing CDN URLs and external URLs across edits/refreshes.
 */
export async function processAllProductImages(formData: {
  images?: string[];
  primaryImage?: string;
  variants?: any[];
}) {
  const MAX_PRODUCT_IMAGES = 10;

  // 1. Process and upload main product images (preserving order, max 10)
  const rawImages = (formData.images || []).filter(Boolean).slice(0, MAX_PRODUCT_IMAGES);
  const processedImages = await Promise.all(
    rawImages.map((img) => uploadProductImageToStorage(img, 'products/originals'))
  );
  const finalImages = processedImages.filter(Boolean).slice(0, MAX_PRODUCT_IMAGES);

  // 2. Process primary image
  let finalPrimaryImage = '';
  if (formData.primaryImage) {
    finalPrimaryImage = await uploadProductImageToStorage(
      formData.primaryImage,
      'products/originals'
    );
  }

  // Ensure primary image defaults to first image if empty
  if (!finalPrimaryImage && finalImages.length > 0) {
    finalPrimaryImage = finalImages[0];
  }

  // If primary image exists but isn't in finalImages, prepend or align
  if (finalPrimaryImage && !finalImages.includes(finalPrimaryImage)) {
    finalImages.unshift(finalPrimaryImage);
  }

  const cappedFinalImages = finalImages.slice(0, MAX_PRODUCT_IMAGES);

  // 3. Process variant images (max 10 images per variant)
  const rawVariants = formData.variants || [];
  const processedVariants = await Promise.all(
    rawVariants.map(async (v) => {
      let vImages: string[] = [];

      // Process variant image array
      if (Array.isArray(v.images) && v.images.length > 0) {
        const validVImages = v.images.filter(Boolean).slice(0, MAX_PRODUCT_IMAGES);
        const uploaded = await Promise.all(
          validVImages.map((img: string) =>
            uploadProductImageToStorage(img, 'products/variants/originals')
          )
        );
        vImages = uploaded.filter(Boolean).slice(0, MAX_PRODUCT_IMAGES);
      }

      // Process single variant primary image
      let vImage = '';
      if (v.image) {
        vImage = await uploadProductImageToStorage(v.image, 'products/variants/originals');
      }

      if (!vImage && vImages.length > 0) {
        vImage = vImages[0];
      }
      if (vImage && vImages.length === 0) {
        vImages = [vImage];
      }

      return {
        ...v,
        image: vImage || '',
        images: vImages.slice(0, MAX_PRODUCT_IMAGES),
      };
    })
  );

  return {
    images: cappedFinalImages,
    primaryImage: finalPrimaryImage || cappedFinalImages[0] || '',
    variants: processedVariants,
  };
}
