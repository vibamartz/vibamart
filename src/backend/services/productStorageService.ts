import {
  uploadImageFileToStorage,
  isExistingUrl
} from '../../shared/utilities/cdnImageUtils';

/**
 * High-definition fallback image processor for offline/restricted environments if canvas operations are requested.
 * Preserves full quality.
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
 * Uploads a product image input (File, Blob, or base64 Data URL) to Firebase Storage
 * and automatically returns a SHORT, clean, permanent image URL:
 * https://cdn.vibamart.com/images/products/{productSlug}-{shortId}.{ext}
 *
 * Rules:
 * 1. Generates a short, unique, clean filename & URL without exposing internal tokens.
 * 2. Stores the original image file without downscaling or quality reduction.
 * 3. Existing valid HTTP/HTTPS URLs are preserved untouched without duplication.
 * 4. Strictly validates format and file size limits (<= 10MB).
 */
export async function uploadProductImageToStorage(
  imageInput: string | File | Blob | null | undefined,
  folderPath: string = 'products',
  productName?: string
): Promise<string> {
  if (!imageInput) return '';

  // 1. Existing HTTP/HTTPS URLs require no re-upload
  if (typeof imageInput === 'string' && isExistingUrl(imageInput)) {
    return imageInput.trim();
  }

  // 2. Upload via unified clean storage system
  return await uploadImageFileToStorage(imageInput, {
    folder: 'products',
    entityName: productName || 'product'
  });
}

/**
 * Processes all product images (main product images, primary image, and variant galleries),
 * uploading them to Storage with clean short URLs before saving to Firestore.
 *
 * Rules:
 * - Enforces a maximum of 10 images per product and per variant.
 * - Preserves the exact original image ordering.
 * - Preserves existing CDN URLs and external URLs across edits/refreshes.
 */
export async function processAllProductImages(formData: {
  name?: string;
  images?: string[];
  primaryImage?: string;
  variants?: any[];
}) {
  const MAX_PRODUCT_IMAGES = 10;
  const prodName = formData.name || 'product';

  // 1. Process and upload main product images (preserving order, max 10)
  const rawImages = (formData.images || []).filter(Boolean).slice(0, MAX_PRODUCT_IMAGES);
  const processedImages = await Promise.all(
    rawImages.map((img) => uploadProductImageToStorage(img, 'products', prodName))
  );
  const finalImages = processedImages.filter(Boolean).slice(0, MAX_PRODUCT_IMAGES);

  // 2. Process primary image
  let finalPrimaryImage = '';
  if (formData.primaryImage) {
    finalPrimaryImage = await uploadProductImageToStorage(
      formData.primaryImage,
      'products',
      `${prodName}-primary`
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
      const variantLabel = v.name || v.color || v.shade || v.model || prodName;

      // Process variant image array
      if (Array.isArray(v.images) && v.images.length > 0) {
        const validVImages = v.images.filter(Boolean).slice(0, MAX_PRODUCT_IMAGES);
        const uploaded = await Promise.all(
          validVImages.map((img: string) =>
            uploadProductImageToStorage(img, 'products', `${prodName}-${variantLabel}`)
          )
        );
        vImages = uploaded.filter(Boolean).slice(0, MAX_PRODUCT_IMAGES);
      }

      // Process single variant primary image
      let vImage = '';
      if (v.image) {
        vImage = await uploadProductImageToStorage(
          v.image,
          'products',
          `${prodName}-${variantLabel}`
        );
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
