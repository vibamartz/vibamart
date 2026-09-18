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
 * Uploads a base64 data URL, Blob, or File to Firebase Storage and returns the download URL.
 * If it's already an HTTP/HTTPS URL, returns it as-is.
 */
export async function uploadCategoryImageToStorage(
  imageInput: string | File | Blob | null | undefined,
  folderPath: string = 'categories'
): Promise<string> {
  if (!imageInput) return '';

  if (typeof imageInput === 'string') {
    // Return standard HTTP/HTTPS URLs directly
    if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
      return imageInput;
    }

    // Handle Blob URL (blob:http...)
    if (imageInput.startsWith('blob:')) {
      try {
        const res = await fetch(imageInput);
        const blob = await res.blob();
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const ext = blob.type ? blob.type.split('/')[1] || 'png' : 'png';
        const storageRef = ref(storage, `${folderPath}/img_${timestamp}_${randomStr}.${ext}`);
        await withTimeout(uploadBytes(storageRef, blob));
        return await withTimeout(getDownloadURL(storageRef));
      } catch (blobErr) {
        console.warn('Failed to upload blob URL to Firebase Storage, using fallback:', blobErr);
        return imageInput;
      }
    }

    // Handle Data URL (data:image/...)
    if (imageInput.startsWith('data:')) {
      try {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const formatMatch = imageInput.match(/data:image\/([a-zA-Z0-9]+);base64,/);
        const ext = formatMatch ? formatMatch[1] : 'png';
        const storageRef = ref(storage, `${folderPath}/img_${timestamp}_${randomStr}.${ext}`);
        
        await withTimeout(uploadString(storageRef, imageInput, 'data_url'));
        return await withTimeout(getDownloadURL(storageRef));
      } catch (err) {
        console.warn('Failed to upload base64 image to Firebase Storage, falling back to data URL:', err);
        return imageInput;
      }
    }

    // Handle raw base64 string (without prefix)
    if (imageInput.length > 500 && !imageInput.startsWith('http')) {
      try {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const dataUrl = imageInput.includes(';base64,') ? imageInput : `data:image/png;base64,${imageInput}`;
        const storageRef = ref(storage, `${folderPath}/img_${timestamp}_${randomStr}.png`);
        await withTimeout(uploadString(storageRef, dataUrl, 'data_url'));
        return await withTimeout(getDownloadURL(storageRef));
      } catch (err) {
        console.warn('Failed to upload raw base64 to Firebase Storage, falling back:', err);
        return imageInput;
      }
    }

    return imageInput;
  }

  // Handle File or Blob object
  if (imageInput instanceof File || imageInput instanceof Blob) {
    try {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const ext = (imageInput as File).name ? (imageInput as File).name.split('.').pop() || 'png' : 'png';
      const storageRef = ref(storage, `${folderPath}/file_${timestamp}_${randomStr}.${ext}`);
      await withTimeout(uploadBytes(storageRef, imageInput));
      return await withTimeout(getDownloadURL(storageRef));
    } catch (err) {
      console.warn('Failed to upload image file to Firebase Storage:', err);
      return '';
    }
  }

  return '';
}

/**
 * Recursively scans a category document and its subcategories,
 * uploading base64 images to Firebase Storage, replacing them with Storage URLs,
 * and stripping out embedded product arrays to keep Firestore document size small.
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
  const finalCleaned = cleanForFirestore(cleaned);

  // 5. Verify byte size stays under 1 MiB limit (1,048,576 bytes)
  const encodedLength = new TextEncoder().encode(JSON.stringify(finalCleaned)).length;
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
