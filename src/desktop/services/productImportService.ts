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

    const rawText = await response.text();
    let result: any = null;

    try {
      result = JSON.parse(rawText);
    } catch {
      // The server returned plain text or HTML error (e.g. Vercel serverless FUNCTION_INVOCATION_FAILED)
      console.warn('[ProductImport] Non-JSON response from server, triggering client-side fallback:', rawText);
      const fallbackResult = await clientSideImportFallback(trimmed, categories);
      if (fallbackResult.success) {
        return fallbackResult;
      }
      const cleanSnippet = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
      return {
        success: false,
        error: cleanSnippet || `Server returned invalid response (HTTP ${response.status}).`,
      };
    }

    if (!response.ok || !result.success || !result.data) {
      // If server route returned an error, try client-side direct fetch fallback
      const fallbackResult = await clientSideImportFallback(trimmed, categories);
      if (fallbackResult.success) {
        return fallbackResult;
      }
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

/**
 * Client-side browser fallback parser that extracts metadata and specifications using DOMParser
 * when the local server backend route is unreachable or returns a server error.
 */
async function clientSideImportFallback(
  targetUrl: string,
  categories: Category[]
): Promise<ImportProductResult> {
  try {
    // Attempt fetch via open CORS proxies if direct fetch is blocked by browser CORS
    const proxyUrls = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
    ];

    let html = '';
    for (const pUrl of proxyUrls) {
      try {
        const resp = await fetch(pUrl, { signal: AbortSignal.timeout(8000) });
        if (resp.ok) {
          const text = await resp.text();
          if (text && text.length > 200) {
            html = text;
            break;
          }
        }
      } catch {
        continue;
      }
    }

    if (!html) {
      return {
        success: false,
        error: 'Unable to reach or read product page via proxy.',
      };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 1. Title
    let title =
      doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
      doc.querySelector('title')?.textContent ||
      '';
    title = title.replace(/\s*[-–|:]\s*(Amazon|Flipkart|Myntra|eBay|Walmart|Shopify)[\w\s.]*$/i, '').trim();

    // 2. Brand
    let brand =
      doc.querySelector('meta[property="og:brand"]')?.getAttribute('content') ||
      doc.querySelector('meta[name="brand"]')?.getAttribute('content') ||
      '';

    // 3. Description
    let description =
      doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
      doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
      '';
    description = description.trim();

    // 4. Images
    const images: string[] = [];
    const ogImg = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (ogImg) images.push(ogImg);
    const twImg = doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
    if (twImg && !images.includes(twImg)) images.push(twImg);

    doc.querySelectorAll('img[src], img[data-src]').forEach((el) => {
      if (images.length >= 8) return;
      const src = el.getAttribute('data-src') || el.getAttribute('src');
      if (src && /^https?:\/\/.+/i.test(src) && !/logo|icon|badge|tracker|pixel/i.test(src)) {
        if (!images.includes(src)) images.push(src);
      }
    });

    // 5. Specs from tables
    const specs: { key: string; value: string }[] = [];
    doc.querySelectorAll('tr').forEach((row) => {
      const cells = row.querySelectorAll('th, td');
      if (cells.length === 2) {
        const k = (cells[0].textContent || '').trim().replace(/[:：]$/, '');
        const v = (cells[1].textContent || '').trim();
        if (k.length >= 2 && k.length <= 50 && v.length >= 1 && v.length <= 300) {
          specs.push({ key: k, value: v });
        }
      }
    });

    // 6. Price & MRP from meta and JSON-LD
    let price: number | undefined;
    let mrp: number | undefined;
    const ogPrice = doc.querySelector('meta[property="product:price:amount"]')?.getAttribute('content') ||
                    doc.querySelector('meta[property="og:price:amount"]')?.getAttribute('content');
    if (ogPrice) {
      const p = parseFloat(ogPrice);
      if (!isNaN(p) && p > 0) price = p;
    }

    // JSON-LD fallback
    doc.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        const json = JSON.parse(s.textContent || '');
        const items = Array.isArray(json) ? json : (json['@graph'] || [json]);
        for (const item of items) {
          if (item?.['@type'] === 'Product') {
            if (!title && item.name) title = item.name;
            if (!brand && item.brand) {
              brand = typeof item.brand === 'object' ? item.brand.name : item.brand;
            }
            if (!description && item.description) description = item.description;
            if (item.offers) {
              const off = Array.isArray(item.offers) ? item.offers[0] : item.offers;
              const p = parseFloat(off.price || off.lowPrice);
              if (!isNaN(p) && p > 0 && !price) price = p;
              const m = parseFloat(off.highPrice);
              if (!isNaN(m) && m > 0 && !mrp) mrp = m;
            }
          }
        }
      } catch {}
    });

    // Clean brand and title
    if (!brand && title) {
      const firstWord = title.split(' ')[0];
      if (firstWord && /^[A-Z][a-zA-Z0-9]+$/.test(firstWord) && firstWord.length > 2) {
        brand = firstWord;
      }
    }

    if (!title && !description && images.length === 0 && specs.length === 0) {
      return { success: false, error: 'No product information could be parsed from the page.' };
    }

    const payload: ExtractedProductPayload = {
      title: title || undefined,
      brand: brand || undefined,
      description: description ? description.slice(0, 197) + (description.length > 200 ? '...' : '') : undefined,
      fullDescription: description || undefined,
      price: price || undefined,
      mrp: mrp || price || undefined,
      images,
      specifications: specs.slice(0, 25),
      sourceUrl: targetUrl,
    };

    const matchedCategory = matchCategoryHeuristic(title, description, specs, categories);
    const inferredTags = generateLocalInferredTags(title, brand || '', specs);

    return {
      success: true,
      data: payload,
      matchedCategory,
      inferredTags,
    };
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || 'Fallback parsing failed.',
    };
  }
}

