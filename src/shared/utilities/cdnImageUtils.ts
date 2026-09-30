/**
 * ViBa Mart CDN Image Utilities
 * 
 * Provides utilities for generating, transforming, validating, and parsing
 * stable ViBa Mart CDN image URLs (e.g. https://cdn.vibamart.com/image/1920/1920/{imageId}.jpg).
 * 
 * Supports dynamic size presets (/400/400/, /1200/1200/, /1920/1920/),
 * optional quality parameter (?q=100), and maintains original image fidelity.
 */

export const CDN_BASE_DOMAIN = 'cdn.vibamart.com';
export const CDN_BASE_URL = `https://${CDN_BASE_DOMAIN}/image`;

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

export interface CdnUrlOptions {
  imageId: string;
  extension?: string;
  width?: number;
  height?: number;
  quality?: number; // Optional quality (e.g. 100)
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

/**
 * Generates a unique, high-entropy, secure image ID.
 * Does not rely on the user's original filename to prevent path traversal and collisions.
 */
export function generateSecureImageId(prefix: string = 'viba_img'): string {
  const timestamp = Date.now().toString(36);
  let randomPart = '';

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  } else if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    randomPart = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    randomPart = Math.random().toString(36).substring(2, 14) + Math.random().toString(36).substring(2, 8);
  }

  // Sanitize prefix and assemble
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${cleanPrefix}_${timestamp}_${randomPart}`;
}

/**
 * Sanitizes and normalizes an image extension.
 */
export function normalizeExtension(ext?: string): string {
  if (!ext) return 'jpg';
  const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean === 'jpeg') return 'jpg';
  if (SUPPORTED_IMAGE_EXTENSIONS.includes(clean as SupportedImageExtension)) {
    return clean;
  }
  return 'jpg';
}

/**
 * Derives the image extension from a MIME type or Data URL header.
 */
export function getExtensionFromMimeType(mimeOrDataUrl: string): string {
  if (!mimeOrDataUrl) return 'jpg';
  const lower = mimeOrDataUrl.toLowerCase();
  for (const [mime, ext] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (lower.startsWith(mime) || lower.includes(mime)) {
      return ext;
    }
  }
  return 'jpg';
}

/**
 * Builds a canonical ViBa Mart CDN image URL.
 * Example: https://cdn.vibamart.com/image/1920/1920/viba_img_123456.jpg
 */
export function buildCdnImageUrl(options: CdnUrlOptions): string {
  const {
    imageId,
    extension = 'jpg',
    width = 1920,
    height = 1920,
    quality
  } = options;

  // Sanitize imageId to prevent path injection
  const cleanImageId = imageId.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanExt = normalizeExtension(extension);
  const w = Math.max(1, Math.min(width, 4096));
  const h = Math.max(1, Math.min(height, 4096));

  let url = `${CDN_BASE_URL}/${w}/${h}/${cleanImageId}.${cleanExt}`;

  if (quality !== undefined && quality !== null) {
    const q = Math.max(1, Math.min(Math.round(quality), 100));
    url += `?q=${q}`;
  }

  return url;
}

/**
 * Checks if a given string is a ViBa Mart CDN URL.
 */
export function isCdnImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith(`https://${CDN_BASE_DOMAIN}/image/`) || url.startsWith(`http://${CDN_BASE_DOMAIN}/image/`);
}

/**
 * Parses a CDN image URL to extract its parameters.
 */
export function parseCdnImageUrl(url: string | null | undefined): ParsedCdnUrl {
  if (!url || typeof url !== 'string' || !isCdnImageUrl(url)) {
    return { isCdn: false, rawUrl: url || '' };
  }

  try {
    const parsed = new URL(url);
    // Path format: /image/:width/:height/:imageId.:ext
    const match = parsed.pathname.match(/^\/image\/(\d+)\/(\d+)\/([a-zA-Z0-9_-]+)\.([a-zA-Z0-9]+)$/);
    if (!match) {
      return { isCdn: true, rawUrl: url };
    }

    const width = parseInt(match[1], 10);
    const height = parseInt(match[2], 10);
    const imageId = match[3];
    const extension = match[4];
    const qParam = parsed.searchParams.get('q');
    const quality = qParam ? parseInt(qParam, 10) : undefined;

    return {
      isCdn: true,
      imageId,
      extension,
      width,
      height,
      quality,
      rawUrl: url
    };
  } catch {
    return { isCdn: false, rawUrl: url };
  }
}

/**
 * Transforms a CDN URL to a different resolution (e.g. /400/400/, /1200/1200/, /1920/1920/)
 * and optional quality (?q=100) without altering the master image.
 * If the input URL is not a ViBa CDN URL, it returns the URL unchanged.
 */
export function transformCdnImageUrl(
  url: string | null | undefined,
  width: number = 1920,
  height: number = 1920,
  quality?: number
): string {
  if (!url || typeof url !== 'string') return '';
  const parsed = parseCdnImageUrl(url);
  if (!parsed.isCdn || !parsed.imageId) {
    return url;
  }

  return buildCdnImageUrl({
    imageId: parsed.imageId,
    extension: parsed.extension || 'jpg',
    width,
    height,
    quality: quality !== undefined ? quality : parsed.quality
  });
}

/**
 * Validates whether an image input (data URL, blob, or file) meets size & format requirements.
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
      // Approximate bytes from base64 string length
      const base64Data = trimmed.split(',')[1] || '';
      const byteSize = Math.round((base64Data.length * 3) / 4);
      if (byteSize > maxSizeBytes) {
        return {
          valid: false,
          error: `Image size (${(byteSize / (1024 * 1024)).toFixed(1)} MB) exceeds limit of ${maxSizeBytes / (1024 * 1024)} MB`
        };
      }
      return { valid: true, extension: mime ? ALLOWED_MIME_TYPES[mime] : 'jpg' };
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
    return { valid: true, extension: ALLOWED_MIME_TYPES[blob.type.toLowerCase()] || 'jpg' };
  }

  return { valid: false, error: 'Invalid image format' };
}
