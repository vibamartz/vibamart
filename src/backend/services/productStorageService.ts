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
 * High-definition image processor for fallback cases.
 * Preserves high resolution (up to 2048x2048) and high quality (0.92) with smoothing.
 */
export async function compressDataUrl(
  dataUrl: string,
  maxWidth = 2048,
  maxHeight = 2048,
  quality = 0.92
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
 * Uploads a base64 Data URL, Blob URL, or raw base64 string to Firebase Storage under `folderPath`.
 * Preserves high-definition original image fidelity and returns the public Firebase Storage HTTP download URL.
 * If Storage fails or is unavailable, returns a high-quality data URL for Firestore fallback.
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

  // Reject oversized data URLs (> 15MB raw binary size)
  const MAX_BYTES = 15 * 1024 * 1024;
  if (trimmed.startsWith('data:') || trimmed.length > 500) {
    const approxBytes = Math.round((trimmed.length * 3) / 4);
    if (approxBytes > MAX_BYTES * 1.5) {
      console.warn('Image data exceeds 15 MB limit, skipping upload');
      return '';
    }
  }

  // Attempt direct high-quality upload to Firebase Storage
  try {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    
    // Determine accurate extension from MIME type to preserve format
    let ext = 'jpg';
    if (trimmed.startsWith('data:image/png')) ext = 'png';
    else if (trimmed.startsWith('data:image/webp')) ext = 'webp';
    else if (trimmed.startsWith('data:image/svg')) ext = 'svg';
    else if (trimmed.startsWith('data:image/gif')) ext = 'gif';
    else if (trimmed.startsWith('data:image/avif')) ext = 'avif';

    const storageRef = ref(storage, `${folderPath}/img_${timestamp}_${randomStr}.${ext}`);

    if (trimmed.startsWith('data:')) {
      await withTimeout(uploadString(storageRef, trimmed, 'data_url'));
      const downloadUrl = await withTimeout(getDownloadURL(storageRef));
      if (downloadUrl) return downloadUrl;
    } else if (trimmed.startsWith('blob:')) {
      const res = await fetch(trimmed);
      const blob = await res.blob();
      if (blob.size > MAX_BYTES) {
        console.warn('Blob exceeds limit');
        return '';
      }
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
    console.warn('Firebase Storage upload failed/bypassed, using high quality fallback for Firestore:', err);
  }

  // Fallback: If Firebase Storage upload fails, compress data URL for Firestore with high clarity
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.length > 500) {
    try {
      return await compressDataUrl(trimmed, 1920, 1920, 0.88);
    } catch (compressErr) {
      console.error('Data URL compression error:', compressErr);
    }
  }

  return trimmed;
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
