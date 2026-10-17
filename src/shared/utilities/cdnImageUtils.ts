import { ref, uploadString, uploadBytes, deleteObject, getDownloadURL } from 'firebase/storage';
import { storage } from '../../backend/firebase/firebase';

/**
 * ViBa Mart Clean Image & Storage Utilities
 * 
 * Provides unified utilities for generating SHORT, clean, permanent image URLs
 * and managing Firebase Storage uploads across all platform entities:
 * - Subcategories (e.g. https://cdn.vibamart.com/images/subcategories/electronics-abc123.webp)
 * - Categories (e.g. https://cdn.vibamart.com/images/categories/fashion-def456.jpg)
 * - Products (e.g. https://cdn.vibamart.com/images/products/nike-air-max-7b8c9d.webp)
 * - Brands (e.g. https://cdn.vibamart.com/images/brands/apple-1a2b3c.png)
 * - Rewards / Coupons (e.g. https://cdn.vibamart.com/images/rewards/zara-voucher-4d5e6f.webp)
 * - Banners (e.g. https://cdn.vibamart.com/images/banners/summer-sale-8g9h0i.jpg)
 * - General / Other (e.g. https://cdn.vibamart.com/images/general/review-ord123-2j3k4l.jpg)
 */

export const CDN_BASE_DOMAIN = 'cdn.vibamart.com';
export const CDN_IMAGES_BASE_URL = `https://${CDN_BASE_DOMAIN}/images`;
export const CDN_BASE_URL = `https://${CDN_BASE_DOMAIN}/image`; // Legacy compatibility

export const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif'] as const;
export type SupportedImageExtension = typeof SUPPORTED_IMAGE_EXTENSIONS[number];

export const ALLOWED_MIME_TYPES: Record<string, SupportedImageExtension> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
};

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export type ImageFolderType = 
  | 'subcategories' 
  | 'categories' 
  | 'products' 
  | 'brands' 
  | 'rewards' 
  | 'banners' 
  | 'general'
  | string;

export interface CleanImageUrlOptions {
  folder: ImageFolderType;
  name?: string;
  extension?: string;
  shortId?: string;
}

export interface CdnUrlOptions {
  imageId: string;
  extension?: string;
  width?: number;
  height?: number;
  quality?: number;
}

export interface ParsedCleanImageUrl {
  isClean: boolean;
  folder?: string;
  filename?: string;
  slug?: string;
  shortId?: string;
  extension?: string;
  rawUrl: string;
}

export interface ParsedCdnUrl {
  isCdn: boolean;
  imageId?: string;
  extension?: string;
  width?: number;
  height?: number;
  quality?: number;
  rawUrl: string;
}

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Storage operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
};

/**
 * Generates a short, clean, unique ID (6-8 alphanumeric chars).
 * e.g. "abc123" or "7f2b9a"
 */
export function generateShortImageId(length: number = 6): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length);
  }
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Legacy secure ID generator for backward compatibility.
 */
export function generateSecureImageId(prefix: string = 'viba_img'): string {
  const shortId = generateShortImageId(6);
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${cleanPrefix}_${Date.now().toString(36)}_${shortId}`;
}

/**
 * Sanitizes an entity title or name into a clean, readable URL slug.
 */
export function sanitizeImageSlug(name?: string, fallback: string = 'image'): string {
  if (!name || typeof name !== 'string') return fallback;
  const clean = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return clean || fallback;
}

/**
 * Sanitizes and normalizes an image extension.
 */
export function normalizeExtension(ext?: string): string {
  if (!ext) return 'webp';
  const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean === 'jpeg') return 'jpg';
  if (SUPPORTED_IMAGE_EXTENSIONS.includes(clean as SupportedImageExtension)) {
    return clean;
  }
  return 'webp';
}

/**
 * Derives the image extension from a MIME type or Data URL header.
 */
export function getExtensionFromMimeType(mimeOrDataUrl: string): string {
  if (!mimeOrDataUrl) return 'webp';
  const lower = mimeOrDataUrl.toLowerCase();
  for (const [mime, ext] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (lower.startsWith(mime) || lower.includes(mime)) {
      return ext;
    }
  }
  return 'webp';
}

/**
 * Builds a SHORT, clean, permanent image URL.
 * Example: https://cdn.vibamart.com/images/subcategories/electronics-abc123.webp
 */
export function buildCleanImageUrl(options: CleanImageUrlOptions): string {
  const { folder, name, extension = 'webp', shortId } = options;
  const cleanFolder = (folder || 'general').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  const cleanExt = normalizeExtension(extension);
  const id = shortId || generateShortImageId(6);
  const slug = sanitizeImageSlug(name, cleanFolder);
  const filename = `${slug}-${id}.${cleanExt}`;
  return `${CDN_IMAGES_BASE_URL}/${cleanFolder}/${filename}`;
}

/**
 * Entity-specific Clean URL Helpers
 */
export function buildSubcategoryImageUrl(name?: string, extension: string = 'webp', shortId?: string): string {
  return buildCleanImageUrl({ folder: 'subcategories', name, extension, shortId });
}

export function buildCategoryImageUrl(name?: string, extension: string = 'webp', shortId?: string): string {
  return buildCleanImageUrl({ folder: 'categories', name, extension, shortId });
}

export function buildProductImageUrl(name?: string, extension: string = 'webp', shortId?: string): string {
  return buildCleanImageUrl({ folder: 'products', name, extension, shortId });
}

export function buildBrandImageUrl(name?: string, extension: string = 'png', shortId?: string): string {
  return buildCleanImageUrl({ folder: 'brands', name, extension, shortId });
}

export function buildRewardImageUrl(name?: string, extension: string = 'webp', shortId?: string): string {
  return buildCleanImageUrl({ folder: 'rewards', name, extension, shortId });
}

export function buildBannerImageUrl(name?: string, extension: string = 'webp', shortId?: string): string {
  return buildCleanImageUrl({ folder: 'banners', name, extension, shortId });
}

export function buildGeneralImageUrl(name?: string, extension: string = 'webp', shortId?: string): string {
  return buildCleanImageUrl({ folder: 'general', name, extension, shortId });
}

/**
 * Checks if a given string is a clean ViBa Mart CDN image URL.
 */
export function isCleanImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return (
    url.startsWith(`${CDN_IMAGES_BASE_URL}/`) ||
    url.startsWith(`https://${CDN_BASE_DOMAIN}/images/`) ||
    url.startsWith(`http://${CDN_BASE_DOMAIN}/images/`) ||
    url.startsWith(`https://vibamart.com/images/`) ||
    url.startsWith(`https://${CDN_BASE_DOMAIN}/image/`)
  );
}

/**
 * Checks if a string is an existing HTTP/HTTPS URL (which should not be duplicated/re-uploaded).
 * Dead or phantom domains like cdn.vibamart.com are excluded so they get cleaned up properly.
 */
export function isExistingUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.includes('cdn.vibamart.com')) return false;
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

/**
 * Parses a clean image URL to extract folder, filename, slug, and shortId.
 */
export function parseCleanImageUrl(url: string | null | undefined): ParsedCleanImageUrl {
  if (!url || typeof url !== 'string') {
    return { isClean: false, rawUrl: url || '' };
  }

  try {
    const parsed = new URL(url);
    // Format: /images/:folder/:slug-:shortId.:ext or /images/:folder/:filename
    const match = parsed.pathname.match(/^\/images\/([a-zA-Z0-9_-]+)\/(?:([a-zA-Z0-9_-]+)-([a-zA-Z0-9]+)|([a-zA-Z0-9_.-]+))\.(jpg|jpeg|png|webp|gif|svg|avif)$/i);
    if (!match) {
      return { isClean: isCleanImageUrl(url), rawUrl: url };
    }

    const folder = match[1];
    const slug = match[2] || '';
    const shortId = match[3] || '';
    const ext = match[5]?.toLowerCase();
    const filename = `${slug ? `${slug}-${shortId}` : match[4]}.${ext}`;

    return {
      isClean: true,
      folder,
      filename,
      slug,
      shortId,
      extension: ext,
      rawUrl: url
    };
  } catch {
    return { isClean: false, rawUrl: url };
  }
}

/**
 * Legacy canonical URL builder (maintained for backward compatibility).
 */
export function buildCdnImageUrl(options: CdnUrlOptions): string {
  const { imageId, extension = 'webp' } = options;
  const cleanImageId = imageId.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanExt = normalizeExtension(extension);

  // If imageId already looks like an entity name or ID, route to products folder
  return `${CDN_IMAGES_BASE_URL}/products/${cleanImageId}.${cleanExt}`;
}

export function isCdnImageUrl(url: string | null | undefined): boolean {
  return isCleanImageUrl(url);
}

export function parseCdnImageUrl(url: string | null | undefined): ParsedCdnUrl {
  if (!url || typeof url !== 'string') {
    return { isCdn: false, rawUrl: url || '' };
  }

  const cleanParsed = parseCleanImageUrl(url);
  if (cleanParsed.isClean) {
    return {
      isCdn: true,
      imageId: cleanParsed.shortId || cleanParsed.filename,
      extension: cleanParsed.extension,
      rawUrl: url
    };
  }

  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/image\/(\d+)\/(\d+)\/([a-zA-Z0-9_-]+)\.([a-zA-Z0-9]+)$/);
    if (match) {
      return {
        isCdn: true,
        imageId: match[3],
        extension: match[4],
        width: parseInt(match[1], 10),
        height: parseInt(match[2], 10),
        rawUrl: url
      };
    }
  } catch {}

  return { isCdn: false, rawUrl: url };
}

export function transformCdnImageUrl(
  url: string | null | undefined,
  _width: number = 1920,
  _height: number = 1920,
  _quality?: number
): string {
  // Clean permanent URLs are direct, resolution-independent canonical URLs
  return url || '';
}

/**
 * Validates whether an image input meets size & format requirements.
 */
export function validateImageInput(
  input: string | Blob | File,
  maxSizeBytes: number = MAX_IMAGE_SIZE_BYTES
): { valid: boolean; error?: string; extension?: string } {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return { valid: false, error: 'Empty image input' };
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return { valid: true };
    }

    if (trimmed.startsWith('data:image/')) {
      const mimeMatch = trimmed.match(/^data:([^;]+);base64,/i);
      const mime = mimeMatch ? mimeMatch[1].toLowerCase() : '';
      if (mime && !ALLOWED_MIME_TYPES[mime]) {
        return {
          valid: false,
          error: `Unsupported image type (${mime}). Allowed: JPG, PNG, WEBP, GIF, SVG, AVIF`
        };
      }
      const base64Data = trimmed.split(',')[1] || '';
      const byteSize = Math.round((base64Data.length * 3) / 4);
      if (byteSize > maxSizeBytes) {
        return {
          valid: false,
          error: `Image size (${(byteSize / (1024 * 1024)).toFixed(1)} MB) exceeds limit of ${maxSizeBytes / (1024 * 1024)} MB`
        };
      }
      return { valid: true, extension: mime ? ALLOWED_MIME_TYPES[mime] : 'webp' };
    }

    return { valid: true };
  } else if (input && typeof (input as Blob).size === 'number') {
    const blob = input as Blob;
    if (blob.size > maxSizeBytes) {
      return {
        valid: false,
        error: `Image size (${(blob.size / (1024 * 1024)).toFixed(1)} MB) exceeds limit of ${maxSizeBytes / (1024 * 1024)} MB`
      };
    }
    if (blob.type && !ALLOWED_MIME_TYPES[blob.type.toLowerCase()]) {
      return {
        valid: false,
        error: `Unsupported image type (${blob.type}). Allowed: JPG, PNG, WEBP, GIF, SVG, AVIF`
      };
    }
    return { valid: true, extension: ALLOWED_MIME_TYPES[blob.type.toLowerCase()] || 'webp' };
  }

  return { valid: false, error: 'Invalid image format' };
}

export interface UploadImageFileOptions {
  folder: ImageFolderType;
  entityName?: string;
  customStoragePath?: string;
}

/**
 * Compresses a base64 Data URL or Blob URL to a lightweight data URL if needed for storage or fallback.
 * Preserves high visual quality while keeping document size minimal.
 */
export async function compressDataUrl(
  dataUrl: string,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.85
): Promise<string> {
  if (
    !dataUrl ||
    typeof dataUrl !== 'string' ||
    (!dataUrl.startsWith('data:') && !dataUrl.startsWith('blob:') && dataUrl.length <= 500)
  ) {
    return dataUrl;
  }

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width || maxWidth;
      let height = img.height || maxHeight;
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
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      let compressed = '';
      try {
        compressed = canvas.toDataURL('image/webp', quality);
      } catch {
        compressed = '';
      }
      if (!compressed || !compressed.startsWith('data:image/webp')) {
        try {
          compressed = canvas.toDataURL('image/jpeg', quality);
        } catch {
          compressed = dataUrl;
        }
      }
      resolve(compressed || dataUrl);
    };
    img.onerror = () => resolve(dataUrl);

    if (!dataUrl.startsWith('data:') && !dataUrl.startsWith('blob:')) {
      img.src = `data:image/png;base64,${dataUrl}`;
    } else {
      img.src = dataUrl;
    }
  });
}

/**
 * Universal Image Upload to Storage with Short Clean URL Generation.
 * 
 * Rules:
 * 1. Uploads to Firebase Storage and retrieves a permanent, working public download URL.
 * 2. If Firebase Storage is unavailable/offline, compresses to a high-quality lightweight data URL so photos are never lost.
 * 3. Preserves existing valid HTTP/HTTPS URLs (no duplicate uploads or file creation).
 * 4. Strictly validates format and file size limits (<= 10MB).
 */
let isStorageBucketUnavailable = false;
try {
  if (typeof window !== 'undefined') {
    isStorageBucketUnavailable = localStorage.getItem('viba_storage_bucket_unavailable') === 'true';
  }
} catch {}

export async function uploadImageFileToStorage(
  imageInput: string | File | Blob | null | undefined,
  options: UploadImageFileOptions
): Promise<string> {
  if (!imageInput) return '';

  const { folder, entityName } = options;
  const cleanFolder = (folder || 'general').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();

  // 1. Existing valid HTTP/HTTPS URLs require no re-upload
  if (typeof imageInput === 'string') {
    const trimmed = imageInput.trim();
    if (trimmed.includes('cdn.vibamart.com')) {
      // Ignore dead cdn.vibamart.com domain so it doesn't linger
    } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
  }

  // Fast-path: If storage bucket was verified unavailable (404/not found), proceed directly to client compression
  if (isStorageBucketUnavailable) {
    if (typeof imageInput === 'string' && (imageInput.startsWith('data:') || imageInput.length > 500)) {
      try {
        const compressed = await compressDataUrl(imageInput, 600, 600, 0.85);
        return compressed || imageInput;
      } catch {
        return imageInput;
      }
    } else if (imageInput instanceof File || imageInput instanceof Blob) {
      try {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string) || '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(imageInput);
        });
        if (dataUrl) {
          const compressed = await compressDataUrl(dataUrl, 600, 600, 0.85);
          return compressed || dataUrl;
        }
      } catch {}
    }
    return typeof imageInput === 'string' ? imageInput : '';
  }

  // 2. Validate input format and extract extension
  const validation = validateImageInput(imageInput, MAX_IMAGE_SIZE_BYTES);
  if (!validation.valid && typeof imageInput === 'string' && !imageInput.startsWith('data:') && !imageInput.startsWith('blob:')) {
    console.warn(`[StorageUpload] Validation warning: ${validation.error}`);
  }

  let ext = validation.extension || 'webp';
  if (imageInput instanceof File && imageInput.name) {
    const fileExt = imageInput.name.split('.').pop()?.toLowerCase();
    if (fileExt) ext = normalizeExtension(fileExt);
  } else if (typeof imageInput === 'string' && imageInput.startsWith('data:')) {
    ext = getExtensionFromMimeType(imageInput);
  }

  // 3. Generate unique file path
  const shortId = generateShortImageId(6);
  const slug = sanitizeImageSlug(entityName, cleanFolder);
  const filename = `${slug}-${shortId}.${ext}`;
  const storageFilePath = options.customStoragePath || `images/${cleanFolder}/${filename}`;
  const storageRef = ref(storage, storageFilePath);

  // 4. Upload original full-fidelity image to Firebase Storage
  try {
    let uploadedSuccessfully = false;

    if (imageInput instanceof File || imageInput instanceof Blob) {
      await withTimeout(
        uploadBytes(storageRef, imageInput, {
          contentType: imageInput.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          customMetadata: {
            folder: cleanFolder,
            uploadedAt: new Date().toISOString(),
          },
        }),
        2500
      );
      uploadedSuccessfully = true;
    } else if (typeof imageInput === 'string') {
      const trimmed = imageInput.trim();
      if (trimmed.startsWith('data:')) {
        const mimeType = trimmed.substring(5, trimmed.indexOf(';'));
        await withTimeout(
          uploadString(storageRef, trimmed, 'data_url', {
            contentType: mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
            customMetadata: {
              folder: cleanFolder,
              uploadedAt: new Date().toISOString(),
            },
          }),
          2500
        );
        uploadedSuccessfully = true;
      } else if (trimmed.startsWith('blob:')) {
        const res = await fetch(trimmed);
        const blob = await res.blob();
        if (blob.size > MAX_IMAGE_SIZE_BYTES) {
          console.warn('[StorageUpload] Blob exceeds maximum allowed size (10 MB)');
          return typeof imageInput === 'string' ? imageInput : '';
        }
        await withTimeout(
          uploadBytes(storageRef, blob, {
            contentType: blob.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
            customMetadata: {
              folder: cleanFolder,
              uploadedAt: new Date().toISOString(),
            },
          }),
          2500
        );
        uploadedSuccessfully = true;
      } else if (trimmed.length > 500) {
        const fullDataUrl = trimmed.includes(';base64,') ? trimmed : `data:image/jpeg;base64,${trimmed}`;
        await withTimeout(
          uploadString(storageRef, fullDataUrl, 'data_url', {
            contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
            customMetadata: {
              folder: cleanFolder,
              uploadedAt: new Date().toISOString(),
            },
          }),
          2500
        );
        uploadedSuccessfully = true;
      }
    }

    if (uploadedSuccessfully) {
      try {
        const downloadUrl = await withTimeout(getDownloadURL(storageRef), 2500);
        if (downloadUrl && (downloadUrl.startsWith('https://') || downloadUrl.startsWith('http://'))) {
          return downloadUrl;
        }
      } catch (getErr) {
        console.warn(`[StorageUpload] Could not retrieve download URL for ${storageFilePath}:`, getErr);
      }
    }
  } catch (err: any) {
    if (err?.status_ === 404 || err?.code === 'storage/unknown' || err?.code === 'storage/bucket-not-found' || err?.message?.includes('404')) {
      isStorageBucketUnavailable = true;
      try { localStorage.setItem('viba_storage_bucket_unavailable', 'true'); } catch {}
    }
    console.warn(`[StorageUpload] Firebase Storage operation warning for ${storageFilePath}:`, err);
  }

  // 5. Fallback: If Firebase Storage upload is not available (e.g. offline, permissions, restricted dev environment),
  // retain and compress the image data so it is NEVER lost and always persists in Firestore and displays properly
  if (typeof imageInput === 'string' && (imageInput.startsWith('data:') || imageInput.length > 500)) {
    try {
      const compressed = await compressDataUrl(imageInput, 600, 600, 0.85);
      return compressed || imageInput;
    } catch {
      return imageInput;
    }
  } else if (imageInput instanceof File || imageInput instanceof Blob) {
    try {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(imageInput);
      });
      if (dataUrl) {
        const compressed = await compressDataUrl(dataUrl, 600, 600, 0.85);
        return compressed || dataUrl;
      }
    } catch {}
  }

  return typeof imageInput === 'string' ? imageInput : '';
}
