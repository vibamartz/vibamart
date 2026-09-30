import { ref, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { storage, db } from '../firebase/firebase';
import { Category, SubCategory } from '../../shared/types';
import { cleanForFirestore } from '../../shared/utilities/firestoreUtils';

/**
 * Checks if a string is a base64 Data URL, Blob URL, or raw base64 string.
 */
export function isBase64OrDataUrl(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  return str.startsWith('data:') || str.startsWith('blob:') || (str.length > 500 && !str.startsWith('http://') && !str.startsWith('https://'));
}

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 8000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Storage operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
};

/**
 * Compresses a base64 Data URL or Blob URL to a lightweight data URL (~15-40KB).
 */
export async function compressDataUrl(
  dataUrl: string,
  maxWidth = 600,
  maxHeight = 600,
  quality = 0.8
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
 * Uploads a base64 data URL, Blob, or File to Firebase Storage and returns the download URL.
 * If Storage fails or is unavailable, compresses the image to a compact data URL to ensure
 * Firestore 1 MiB document limits are never breached.
 */
export async function uploadCategoryImageToStorage(
  imageInput: string | File | Blob | null | undefined,
  folderPath: string = 'categories'
): Promise<string> {
  if (!imageInput) return '';

  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB system max ceiling

  if (typeof imageInput === 'string') {
    // Return standard HTTP/HTTPS URLs directly
    if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
      return imageInput;
    }

    // Check size if base64 data string
    if (imageInput.startsWith('data:') || imageInput.length > 500) {
      const approxBytes = Math.round((imageInput.length * 3) / 4);
      if (approxBytes > MAX_BYTES * 1.5) {
        console.warn('Category image data exceeds max limit');
        return '';
      }
    }

    // Handle Blob URL (blob:http...)
    if (imageInput.startsWith('blob:')) {
      try {
        const res = await fetch(imageInput);
        const blob = await res.blob();
        if (blob.size > MAX_BYTES) {
          console.warn('Category blob exceeds limit');
          return '';
        }
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const ext = blob.type ? blob.type.split('/')[1] || 'png' : 'png';
        const storageRef = ref(storage, `${folderPath}/img_${timestamp}_${randomStr}.${ext}`);
        await withTimeout(uploadBytes(storageRef, blob));
        return await withTimeout(getDownloadURL(storageRef));
      } catch (blobErr) {
        console.warn('Failed to upload blob URL to Firebase Storage, compressing fallback:', blobErr);
        return await compressDataUrl(imageInput, 600, 600, 0.8);
      }
    }

    // Handle Data URL (data:image/...)
    if (imageInput.startsWith('data:')) {
      try {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const formatMatch = imageInput.match(/data:image\/([a-zA-Z0-9\+\-]+);base64,/);
        const ext = formatMatch ? formatMatch[1].replace('svg+xml', 'svg') : 'jpg';
        const storageRef = ref(storage, `${folderPath}/img_${timestamp}_${randomStr}.${ext}`);
        
        await withTimeout(uploadString(storageRef, imageInput, 'data_url'));
        return await withTimeout(getDownloadURL(storageRef));
      } catch (err) {
        console.warn('Failed to upload base64 image to Firebase Storage, compressing fallback for Firestore:', err);
        return await compressDataUrl(imageInput, 600, 600, 0.8);
      }
    }

    // Handle raw base64 string (without prefix)
    if (imageInput.length > 500 && !imageInput.startsWith('http')) {
      try {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const dataUrl = imageInput.includes(';base64,') ? imageInput : `data:image/png;base64,${imageInput}`;
        const storageRef = ref(storage, `${folderPath}/img_${timestamp}_${randomStr}.jpg`);
        await withTimeout(uploadString(storageRef, dataUrl, 'data_url'));
        return await withTimeout(getDownloadURL(storageRef));
      } catch (err) {
        console.warn('Failed to upload raw base64 to Firebase Storage, compressing fallback:', err);
        const dataUrl = imageInput.includes(';base64,') ? imageInput : `data:image/png;base64,${imageInput}`;
        return await compressDataUrl(dataUrl, 600, 600, 0.8);
      }
    }

    return imageInput;
  }

  // Handle File or Blob object
  if (imageInput instanceof File || imageInput instanceof Blob) {
    if (imageInput.size > MAX_BYTES) {
      console.warn('Category image file exceeds limit');
      return '';
    }
    try {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const ext = (imageInput as File).name ? (imageInput as File).name.split('.').pop() || 'jpg' : 'jpg';
      const storageRef = ref(storage, `${folderPath}/file_${timestamp}_${randomStr}.${ext}`);
      await withTimeout(uploadBytes(storageRef, imageInput));
      return await withTimeout(getDownloadURL(storageRef));
    } catch (err) {
      console.warn('Failed to upload image file to Firebase Storage, converting to compressed data URL:', err);
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const res = reader.result as string;
          resolve(await compressDataUrl(res, 600, 600, 0.8));
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(imageInput);
      });
    }
  }

  return '';
}

/**
 * Recursively scans a category document and its subcategories,
 * uploading base64 images to Firebase Storage (or compressing them to tiny data URLs),
 * replacing them with Storage/compressed URLs, and stripping out embedded product arrays to keep Firestore document size small.
 */
export async function sanitizeAndUploadCategoryDoc(
  category: Partial<Category>
): Promise<Partial<Category>> {
  const catId = category.id || 'category_' + Date.now();
  
  // Shallow copy object
  const cleaned: any = { ...category };

  // 1. Remove embedded product arrays/objects if present
  delete cleaned.products;
  delete cleaned.productItems;
  delete cleaned.items;
  delete cleaned.productList;

  // 2. Process root category image fields
  if (isBase64OrDataUrl(cleaned.image)) {
    cleaned.image = await uploadCategoryImageToStorage(cleaned.image, `categories/${catId}`);
  }
  if (isBase64OrDataUrl(cleaned.icon)) {
    cleaned.icon = await uploadCategoryImageToStorage(cleaned.icon, `categories/${catId}`);
  }
  if (isBase64OrDataUrl(cleaned.iconImage)) {
    cleaned.iconImage = await uploadCategoryImageToStorage(cleaned.iconImage, `categories/${catId}`);
  }
  if (isBase64OrDataUrl(cleaned.banner)) {
    cleaned.banner = await uploadCategoryImageToStorage(cleaned.banner, `categories/${catId}`);
  }

  // 3. Process subcategories recursively
  if (Array.isArray(cleaned.subcategories)) {
    const updatedSubs = await Promise.all(
      cleaned.subcategories.map(async (sub: SubCategory) => {
        const subClean: any = { ...sub };
        delete subClean.products;
        delete subClean.productItems;

        if (isBase64OrDataUrl(subClean.image)) {
          subClean.image = await uploadCategoryImageToStorage(subClean.image, `categories/${catId}/subs`);
        }
        if (isBase64OrDataUrl(subClean.icon)) {
          subClean.icon = await uploadCategoryImageToStorage(subClean.icon, `categories/${catId}/subs`);
        }

        if (Array.isArray(subClean.subcategories)) {
          subClean.subcategories = await Promise.all(
            subClean.subcategories.map(async (nested: SubCategory) => {
              const nestedClean: any = { ...nested };
              delete nestedClean.products;
              delete nestedClean.productItems;

              if (isBase64OrDataUrl(nestedClean.image)) {
                nestedClean.image = await uploadCategoryImageToStorage(nestedClean.image, `categories/${catId}/nested`);
              }
              if (isBase64OrDataUrl(nestedClean.icon)) {
                nestedClean.icon = await uploadCategoryImageToStorage(nestedClean.icon, `categories/${catId}/nested`);
              }
              return nestedClean;
            })
          );
        }

        return subClean;
      })
    );
    cleaned.subcategories = updatedSubs;
  }

  // 4. Remove undefined fields
  let finalCleaned = cleanForFirestore(cleaned);

  // 5. Size check and aggressive second-pass compression if still large
  let encodedLength = new TextEncoder().encode(JSON.stringify(finalCleaned)).length;
  if (encodedLength > 500000) {
    // Secondary aggressive compression pass
    if (isBase64OrDataUrl(finalCleaned.image)) {
      finalCleaned.image = await compressDataUrl(finalCleaned.image, 300, 300, 0.7);
    }
    if (isBase64OrDataUrl(finalCleaned.icon)) {
      finalCleaned.icon = await compressDataUrl(finalCleaned.icon, 200, 200, 0.7);
    }
    if (Array.isArray(finalCleaned.subcategories)) {
      for (const sub of finalCleaned.subcategories) {
        if (isBase64OrDataUrl(sub.image)) {
          sub.image = await compressDataUrl(sub.image, 300, 300, 0.7);
        }
        if (isBase64OrDataUrl(sub.icon)) {
          sub.icon = await compressDataUrl(sub.icon, 200, 200, 0.7);
        }
        if (Array.isArray(sub.subcategories)) {
          for (const nested of sub.subcategories) {
            if (isBase64OrDataUrl(nested.image)) {
              nested.image = await compressDataUrl(nested.image, 300, 300, 0.7);
            }
            if (isBase64OrDataUrl(nested.icon)) {
              nested.icon = await compressDataUrl(nested.icon, 200, 200, 0.7);
            }
          }
        }
      }
    }
    finalCleaned = cleanForFirestore(finalCleaned);
    encodedLength = new TextEncoder().encode(JSON.stringify(finalCleaned)).length;
  }

  if (encodedLength > 1000000) {
    console.warn(`Category document ${catId} size is ${encodedLength} bytes, approaching 1 MiB limit.`);
    if (encodedLength > 1048000) {
      throw new Error(`Category document "${cleaned.name || catId}" size (${encodedLength} bytes) exceeds Firestore 1 MiB limit.`);
    }
  }

  return finalCleaned;
}

// Track migrated doc IDs in memory to avoid redundant migrations in single session
const migratedCategoryIds = new Set<string>();

/**
 * Migrates existing category Firestore document if it contains base64 image strings.
 */
export async function migrateCategoryDocIfNeeded(catDoc: Category): Promise<Category> {
  if (migratedCategoryIds.has(catDoc.id)) {
    return catDoc;
  }

  const hasEmbeddedProducts = (catDoc as any).products !== undefined || (catDoc as any).productItems !== undefined;

  const needsMigration = 
    hasEmbeddedProducts ||
    isBase64OrDataUrl(catDoc.image) ||
    isBase64OrDataUrl(catDoc.icon) ||
    isBase64OrDataUrl(catDoc.iconImage) ||
    isBase64OrDataUrl((catDoc as any).banner) ||
    (catDoc.subcategories || []).some(sub => 
      isBase64OrDataUrl(sub.image) || 
      isBase64OrDataUrl(sub.icon) ||
      (sub.subcategories || []).some(n => isBase64OrDataUrl(n.image) || isBase64OrDataUrl(n.icon))
    );

  if (!needsMigration) {
    return catDoc;
  }

  migratedCategoryIds.add(catDoc.id);
  console.log(`Migrating category document ${catDoc.id} to Storage URLs...`);
  try {
    const sanitized = await sanitizeAndUploadCategoryDoc(catDoc);
    const catRef = doc(db, 'categories', catDoc.id);
    await setDoc(catRef, sanitized, { merge: true });
    return { ...catDoc, ...sanitized } as Category;
  } catch (err) {
    console.error(`Failed to migrate category document ${catDoc.id}:`, err);
    return catDoc;
  }
}
