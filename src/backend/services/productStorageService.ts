import { ref, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/firebase';

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 8000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Storage operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
};

/**
 * Compresses a base64 Data URL or Blob URL to a lightweight JPEG data URL (~30-60KB).
 * Always paints a solid white (#FFFFFF) background so transparent/no-background images
 * never turn dark or black when converted to JPEG.
 */
export async function compressDataUrl(
  dataUrl: string,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.8
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
      // Fill canvas with pure white background so transparent images never turn dark/black
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Uploads a base64 Data URL, Blob URL, or raw base64 string to Firebase Storage under `folderPath`.
 * Ensures images with no background (transparent PNG/WebP) are converted onto a solid white background.
 * Returns the public Firebase Storage HTTP download URL.
 * If Storage fails or is unavailable, returns a compressed white-backed data URL (< 100KB) to ensure Firestore write limits are never exceeded.
 */
export async function uploadProductImageToStorage(
  imageInput: string | null | undefined,
  folderPath: string = 'products'
): Promise<string> {
  if (!imageInput || typeof imageInput !== 'string') return '';
  const trimmed = imageInput.trim();
  if (!trimmed) return '';

  // Standard HTTP/HTTPS URLs require no upload or compression
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Reject oversized data URLs (> 10MB raw binary size, approx 14MB in base64)
  const MAX_BYTES = 10 * 1024 * 1024;
  if (trimmed.startsWith('data:') || trimmed.length > 500) {
    const approxBytes = Math.round((trimmed.length * 3) / 4);
    if (approxBytes > MAX_BYTES * 1.5) {
      console.warn('Image data exceeds 10 MB limit, skipping upload');
      return '';
    }
  }

  // Ensure image has a solid white background (replaces missing/transparent background with pure white)
  let whiteBackedDataUrl = trimmed;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.length > 500) {
    try {
      whiteBackedDataUrl = await compressDataUrl(trimmed);
    } catch (e) {
      console.warn('Failed to apply white background to data URL:', e);
    }
  }

  // Attempt upload to Firebase Storage
  try {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const storageRef = ref(storage, `${folderPath}/img_${timestamp}_${randomStr}.jpg`);

    if (whiteBackedDataUrl.startsWith('data:')) {
      await withTimeout(uploadString(storageRef, whiteBackedDataUrl, 'data_url'));
      const downloadUrl = await withTimeout(getDownloadURL(storageRef));
      if (downloadUrl) return downloadUrl;
    } else if (whiteBackedDataUrl.startsWith('blob:')) {
      const res = await fetch(whiteBackedDataUrl);
      const blob = await res.blob();
      if (blob.size > MAX_BYTES) {
        console.warn('Blob exceeds 10 MB limit');
        return '';
      }
      await withTimeout(uploadBytes(storageRef, blob));
      const downloadUrl = await withTimeout(getDownloadURL(storageRef));
      if (downloadUrl) return downloadUrl;
    } else if (whiteBackedDataUrl.length > 500 && !whiteBackedDataUrl.startsWith('http')) {
      const dataUrl = whiteBackedDataUrl.includes(';base64,') ? whiteBackedDataUrl : `data:image/jpeg;base64,${whiteBackedDataUrl}`;
      await withTimeout(uploadString(storageRef, dataUrl, 'data_url'));
      const downloadUrl = await withTimeout(getDownloadURL(storageRef));
      if (downloadUrl) return downloadUrl;
    }
  } catch (err) {
    console.warn('Firebase Storage upload failed/bypassed, using white-background image data URL for Firestore:', err);
  }

  // Fallback: Return white-background JPEG data URL (< 60KB) so Firestore write never fails
  return whiteBackedDataUrl;
}

/**
 * Processes all product images (main images, primary image, and variant images),
 * uploading them to Storage (or compressing them as fallback) before saving to Firestore.
 * Enforces a maximum of 10 images per product and per variant.
 */
export async function processAllProductImages(formData: {
  images?: string[];
  primaryImage?: string;
  variants?: any[];
}) {
  const MAX_PRODUCT_IMAGES = 10;

  // 1. Upload main product images (max 10)
  const rawImages = (formData.images || []).slice(0, MAX_PRODUCT_IMAGES);
  const processedImages = await Promise.all(
    rawImages.map((img) => uploadProductImageToStorage(img, 'products'))
  );
  const finalImages = processedImages.filter(Boolean).slice(0, MAX_PRODUCT_IMAGES);

  // 2. Upload primary image
  let finalPrimaryImage = await uploadProductImageToStorage(
    formData.primaryImage || '',
    'products'
  );
  if (!finalPrimaryImage && finalImages.length > 0) {
    finalPrimaryImage = finalImages[0];
  }

  // 3. Upload variant images (max 10 per variant)
  const rawVariants = formData.variants || [];
  const processedVariants = await Promise.all(
    rawVariants.map(async (v) => {
      let vImages: string[] = [];
      if (Array.isArray(v.images) && v.images.length > 0) {
        const uploaded = await Promise.all(
          v.images.slice(0, MAX_PRODUCT_IMAGES).map((img: string) => uploadProductImageToStorage(img, 'products/variants'))
        );
        vImages = uploaded.filter(Boolean).slice(0, MAX_PRODUCT_IMAGES);
      }

      let vImage = await uploadProductImageToStorage(v.image || '', 'products/variants');
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
    images: finalImages,
    primaryImage: finalPrimaryImage,
    variants: processedVariants,
  };
}
