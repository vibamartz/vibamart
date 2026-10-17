import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { Category, SubCategory } from '../../shared/types';
import { cleanForFirestore } from '../../shared/utilities/firestoreUtils';
import {
  uploadImageFileToStorage,
  isCleanImageUrl,
  isExistingUrl
} from '../../shared/utilities/cdnImageUtils';

/**
 * Checks if a string is a base64 Data URL, Blob URL, or raw base64 string.
 */
export function isBase64OrDataUrl(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  return str.startsWith('data:') || str.startsWith('blob:') || (str.length > 500 && !str.startsWith('http://') && !str.startsWith('https://'));
}

/**
 * Compresses a base64 Data URL or Blob URL to a lightweight data URL if needed for canvas processing.
 * Preserves high resolution and quality.
 */
export async function compressDataUrl(
  dataUrl: string,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.9
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
 * Uploads a Category, Subcategory, or Nested Subcategory image to Storage
 * and returns a SHORT, clean, permanent image URL (e.g. https://cdn.vibamart.com/images/subcategories/electronics-abc123.webp).
 *
 * Rules:
 * - Keeps original uploaded image quality unchanged.
 * - Generates a short clean permanent URL.
 * - Preserves existing valid HTTP/HTTPS URLs without duplication.
 */
export async function uploadCategoryImageToStorage(
  imageInput: string | File | Blob | null | undefined,
  folderPath: string = 'categories',
  entityName?: string
): Promise<string> {
  if (!imageInput) return '';

  // 1. Existing HTTP/HTTPS URLs require no re-upload
  if (typeof imageInput === 'string' && isExistingUrl(imageInput)) {
    return imageInput;
  }

  // 2. Derive target folder name
  let targetFolder = 'categories';
  if (folderPath.includes('subs') || folderPath.includes('subcategories') || folderPath.includes('nested')) {
    targetFolder = 'subcategories';
  }

  return await uploadImageFileToStorage(imageInput, {
    folder: targetFolder,
    entityName: entityName || (targetFolder === 'subcategories' ? 'subcategory' : 'category')
  });
}

/**
 * Recursively scans a category document and its subcategories,
 * uploading images to Firebase Storage with SHORT clean URLs,
 * and stripping out embedded product arrays to keep Firestore documents clean.
 */
export async function sanitizeAndUploadCategoryDoc(
  category: Partial<Category>
): Promise<Partial<Category>> {
  const catId = category.id || 'category_' + Date.now();
  const catName = category.name || 'category';
  
  // Shallow copy object
  const cleaned: any = { ...category };

  // 1. Remove embedded product arrays/objects if present
  delete cleaned.products;
  delete cleaned.productItems;
  delete cleaned.items;
  delete cleaned.productList;

  // 2. Process root category image fields
  if (isBase64OrDataUrl(cleaned.image)) {
    cleaned.image = await uploadCategoryImageToStorage(cleaned.image, 'categories', catName);
  }
  if (isBase64OrDataUrl(cleaned.icon)) {
    cleaned.icon = await uploadCategoryImageToStorage(cleaned.icon, 'categories', `${catName}-icon`);
  }
  if (isBase64OrDataUrl(cleaned.iconImage)) {
    cleaned.iconImage = await uploadCategoryImageToStorage(cleaned.iconImage, 'categories', `${catName}-icon`);
  }
  if (isBase64OrDataUrl(cleaned.banner)) {
    cleaned.banner = await uploadCategoryImageToStorage(cleaned.banner, 'categories', `${catName}-banner`);
  }

  // 3. Process subcategories recursively
  if (Array.isArray(cleaned.subcategories)) {
    const updatedSubs = await Promise.all(
      cleaned.subcategories.map(async (sub: SubCategory) => {
        const subClean: any = { ...sub };
        delete subClean.products;
        delete subClean.productItems;

        const subName = subClean.name || 'subcategory';
        if (isBase64OrDataUrl(subClean.image)) {
          subClean.image = await uploadCategoryImageToStorage(subClean.image, 'subcategories', subName);
        }
        if (isBase64OrDataUrl(subClean.icon)) {
          subClean.icon = await uploadCategoryImageToStorage(subClean.icon, 'subcategories', `${subName}-icon`);
        }

        if (Array.isArray(subClean.subcategories)) {
          subClean.subcategories = await Promise.all(
            subClean.subcategories.map(async (nested: SubCategory) => {
              const nestedClean: any = { ...nested };
              delete nestedClean.products;
              delete nestedClean.productItems;

              const nestedName = nestedClean.name || 'nested-subcategory';
              if (isBase64OrDataUrl(nestedClean.image)) {
                nestedClean.image = await uploadCategoryImageToStorage(nestedClean.image, 'subcategories', nestedName);
              }
              if (isBase64OrDataUrl(nestedClean.icon)) {
                nestedClean.icon = await uploadCategoryImageToStorage(nestedClean.icon, 'subcategories', `${nestedName}-icon`);
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

  // 4. Clean undefined fields for Firestore
  const finalCleaned = cleanForFirestore(cleaned);
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
  console.log(`Migrating category document ${catDoc.id} to clean Storage URLs...`);
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
