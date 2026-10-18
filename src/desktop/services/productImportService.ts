import { Category, SubCategory } from '../../shared/types';

export interface ExtractedProductPayload {
  title?: string;
  brand?: string;
  description?: string;
  fullDescription?: string;
  price?: number;
  mrp?: number;
  currency?: string;
  images: string[];
  specifications: { key: string; value: string }[];
  sku?: string;
  sourceUrl: string;
}

export interface ImportProductResult {
  success: boolean;
  data?: ExtractedProductPayload;
  matchedCategory?: {
    categoryId: string;
    subCategoryId?: string;
  };
  inferredTags?: string[];
  error?: string;
}

/**
 * Client-side service to fetch and process automatic product import from a URL.
 * Communicates with ViBa Mart's local backend /api/products/import-url.
 */
export async function importProductFromUrl(url: string, categories: Category[] = []): Promise<ImportProductResult> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { success: false, error: 'Product URL cannot be empty.' };
  }

  if (!/^https?:\/\/.+/i.test(trimmed)) {
    return { success: false, error: 'Please enter a valid HTTP or HTTPS product link.' };
  }

  try {
    const response = await fetch('/api/products/import-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: trimmed }),
    });

    const result = await response.json();

    if (!response.ok || !result.success || !result.data) {
      return {
        success: false,
        error: result?.error || `Failed to extract product from URL (HTTP ${response.status}).`,
      };
    }

    const data: ExtractedProductPayload = result.data;

    // Local heuristic/ML categorization matching using existing categories
    const matchedCategory = matchCategoryHeuristic(data.title || '', data.description || '', data.specifications || [], categories);

    // Inferred search tags from extracted keywords
    const inferredTags = generateLocalInferredTags(data.title || '', data.brand || '', data.specifications || []);

    return {
      success: true,
      data,
      matchedCategory,
      inferredTags,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error occurred while importing product from URL.',
    };
  }
}

/**
 * Intelligent category heuristic matcher using text & taxonomy similarity
 */
function matchCategoryHeuristic(
  title: string,
  desc: string,
  specs: { key: string; value: string }[],
  categories: Category[]
): { categoryId: string; subCategoryId?: string } | undefined {
  if (!categories || categories.length === 0) return undefined;

  const combinedText = `${title} ${desc} ${specs.map(s => `${s.key} ${s.value}`).join(' ')}`.toLowerCase();

  let bestCategory: Category | undefined;
  let bestSubCategory: SubCategory | undefined;
  let highestScore = 0;

  for (const cat of categories) {
    let catScore = 0;
    const catNameLower = cat.name.toLowerCase();

    // Check category name match
    if (combinedText.includes(catNameLower)) {
      catScore += 5;
    }

    // Check keywords or matching patterns
    if (cat.subcategories && cat.subcategories.length > 0) {
      for (const sub of cat.subcategories) {
        let subScore = catScore;
        const subNameLower = sub.name.toLowerCase();
        if (combinedText.includes(subNameLower)) {
          subScore += 10;
        }

        // Subcategory words matching
        const words = subNameLower.split(/[\s/&-]+/).filter(w => w.length > 2);
        for (const w of words) {
          if (combinedText.includes(w)) {
            subScore += 2;
          }
        }

        if (subScore > highestScore) {
          highestScore = subScore;
          bestCategory = cat;
          bestSubCategory = sub;
        }
      }
    } else {
      if (catScore > highestScore) {
        highestScore = catScore;
        bestCategory = cat;
        bestSubCategory = undefined;
      }
    }
  }

  if (bestCategory && highestScore >= 4) {
    return {
      categoryId: bestCategory.id,
      subCategoryId: bestSubCategory?.id,
    };
  }

  return undefined;
}

/**
 * Built-in local tag generator from title and brand tokens
 */
function generateLocalInferredTags(
  title: string,
  brand: string,
  specs: { key: string; value: string }[]
): string[] {
  const tags = new Set<string>();

  if (brand) {
    tags.add(brand.toLowerCase().trim());
  }

  if (title) {
    // Extract alphanumeric terms of length 3 to 18
    const words = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && w.length <= 18 && !/^(with|from|and|the|for|this|that|your|have|best)$/i.test(w));

    words.slice(0, 10).forEach(w => tags.add(w));
  }

  // Add important spec values if short
  for (const s of specs) {
    if (['color', 'colour', 'model', 'material', 'size', 'storage'].includes(s.key.toLowerCase())) {
      const val = s.value.trim().toLowerCase();
      if (val.length >= 2 && val.length <= 20) {
        tags.add(val);
      }
    }
  }

  return Array.from(tags).slice(0, 12);
}
