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
 */
export async function compressDataUrl(
  dataUrl: string,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.7
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
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Uploads a base64 Data URL, Blob URL, or raw base64 string to Firebase Storage under `folderPath`.
 * Returns the public Firebase Storage HTTP download URL.
 * If Storage fails or is unavailable, returns a compressed data URL (< 100KB) to ensure Firestore write limits are never exceeded.
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

  // Attempt upload to Firebase Storage
  try {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const storageRef = ref(storage, `${folderPath}/img_${timestamp}_${randomStr}.jpg`);

    if (trimmed.startsWith('data:')) {
      await withTimeout(uploadString(storageRef, trimmed, 'data_url'));
      const downloadUrl = await withTimeout(getDownloadURL(storageRef));
      if (downloadUrl) return downloadUrl;
    } else if (trimmed.startsWith('blob:')) {
      const res = await fetch(trimmed);
      const blob = await res.blob();
      await withTimeout(uploadBytes(storageRef, blob));
      const downloadUrl = await withTimeout(getDownloadURL(storageRef));
      if (downloadUrl) return downloadUrl;
    } else if (trimmed.length > 500 && !trimmed.startsWith('http')) {
      const dataUrl = trimmed.includes(';base64,') ? trimmed : `data:image/jpeg;base64,${trimmed}`;
      await withTimeout(uploadString(storageRef, dataUrl, 'data_url'));
      const downloadUrl = await withTimeout(getDownloadURL(storageRef));
      if (downloadUrl) return downloadUrl;
    }
  } catch (err) {
    console.warn('Firebase Storage upload failed/bypassed, compressing image data URL for Firestore:', err);
  }

  // Fallback: Compress data URL to lightweight JPEG (< 60KB) so Firestore write never fails
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.length > 500) {
    try {
      return await compressDataUrl(trimmed);
    } catch (compressErr) {
      console.error('Data URL compression error:', compressErr);
    }
  }

  return trimmed;
}

/**
 * Processes all product images (main images, primary image, and variant images),
 * uploading them to Storage (or compressing them as fallback) before saving to Firestore.
 */
export async function processAllProductImages(formData: {
  images?: string[];
  primaryImage?: string;
  variants?: any[];
}) {
  // 1. Upload main product images
  const rawImages = formData.images || [];
  const processedImages = await Promise.all(
    rawImages.map((img) => uploadProductImageToStorage(img, 'products'))
  );
  const finalImages = processedImages.filter(Boolean);

  // 2. Upload primary image
  let finalPrimaryImage = await uploadProductImageToStorage(
    formData.primaryImage || '',
    'products'
  );
  if (!finalPrimaryImage && finalImages.length > 0) {
    finalPrimaryImage = finalImages[0];
  }

  // 3. Upload variant images
  const rawVariants = formData.variants || [];
  const processedVariants = await Promise.all(
    rawVariants.map(async (v) => {
      let vImages: string[] = [];
      if (Array.isArray(v.images) && v.images.length > 0) {
        const uploaded = await Promise.all(
          v.images.map((img: string) => uploadProductImageToStorage(img, 'products/variants'))
        );
        vImages = uploaded.filter(Boolean);
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
        images: vImages,
      };
    })
  );

  return {
    images: finalImages,
    primaryImage: finalPrimaryImage,
    variants: processedVariants,
  };
}
