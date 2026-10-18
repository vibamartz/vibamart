import { Request, Response } from 'express';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';

export interface ExtractedProductInfo {
  name?: string;
  brand?: string;
  description?: string;
  fullDescription?: string;
  price?: number;
  mrp?: number;
  images: string[];
  specifications: { key: string; value: string }[];
  features?: string[];
  stock?: number;
  categorySuggestion?: string;
  color?: string;
  size?: string;
  sourceUrl?: string;
}

/**
 * Normalizes and extracts domain origin or parent page candidate from a URL.
 */
function getCandidatePageUrls(inputUrl: string): string[] {
  const candidates: string[] = [];
  try {
    const parsed = new URL(inputUrl);
    // If it's directly a webpage (html or no typical image extension), prioritize it
    const isImageFile = /\.(jpe?g|png|webp|gif|svg|avif)($|\?)/i.test(parsed.pathname);

    if (!isImageFile) {
      candidates.push(inputUrl);
    } else {
      // It's a direct image URL. Check referrer/origin or search params
      const refParam = parsed.searchParams.get('url') || parsed.searchParams.get('src') || parsed.searchParams.get('ref');
      if (refParam && refParam.startsWith('http')) {
        candidates.push(refParam);
      }
      // Add origin as lowest priority fallback
      candidates.push(parsed.origin);
    }
  } catch {
    // If invalid URL, return empty
  }
  return candidates;
}

/**
 * Safely fetches public HTML content from a given URL with timeout and browser-like user agent.
 */
async function fetchPublicPageHtml(pageUrl: string): Promise<string | null> {
  try {
    const response = await axios.get(pageUrl, {
      timeout: 6000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      maxRedirects: 5,
      responseType: 'text',
      validateStatus: (status) => status >= 200 && status < 400,
    });

    if (typeof response.data === 'string' && response.data.trim().length > 100) {
      return response.data;
    }
  } catch (err: any) {
    // Page retrieval may fail due to anti-bot, CORS, network or invalid URL - gracefully return null
    console.warn(`[AI Import] Could not fetch public webpage for ${pageUrl}:`, err.message || err);
  }
  return null;
}

/**
 * Extracts structured metadata (OpenGraph, schema.org JSON-LD, standard meta tags, image tags)
 * from HTML string without heavy external DOM dependencies.
 */
function extractHtmlMetadata(html: string, baseUrl: string) {
  const meta: Record<string, string> = {};
  const images: string[] = [];
  let jsonLdData: any[] = [];

  try {
    // 1. JSON-LD scripts
    const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (Array.isArray(parsed)) {
          jsonLdData.push(...parsed);
        } else if (parsed && typeof parsed === 'object') {
          jsonLdData.push(parsed);
        }
      } catch {
        // ignore parse errors in LD+JSON blocks
      }
    }

    // 2. OpenGraph & Meta tags
    const metaTagRegex = /<meta\b[^>]*>/gi;
    while ((match = metaTagRegex.exec(html)) !== null) {
      const tag = match[0];
      const property = /property=["']([^"']+)["']/i.exec(tag)?.[1] || /name=["']([^"']+)["']/i.exec(tag)?.[1];
      const content = /content=["']([^"']+)["']/i.exec(tag)?.[1];
      if (property && content) {
        meta[property.toLowerCase()] = content;
      }
    }

    // 3. Title tag
    const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (titleMatch && titleMatch[1]) {
      meta['title'] = titleMatch[1].replace(/[\r\n\t]+/g, ' ').trim();
    }

    // 4. Candidate Images (og:image, twitter:image, and product gallery images)
    if (meta['og:image']) images.push(meta['og:image']);
    if (meta['twitter:image'] && !images.includes(meta['twitter:image'])) images.push(meta['twitter:image']);

    // Find other high-res image candidates
    const imgRegex = /<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
    while ((match = imgRegex.exec(html)) !== null && images.length < 10) {
      const src = match[1];
      if (
        src &&
        !src.includes('avatar') &&
        !src.includes('logo') &&
        !src.includes('icon') &&
        !src.includes('banner') &&
        !src.includes('pixel') &&
        (src.endsWith('.jpg') || src.endsWith('.jpeg') || src.endsWith('.png') || src.endsWith('.webp') || src.includes('/products/'))
      ) {
        try {
          const resolved = new URL(src, baseUrl).href;
          if (!images.includes(resolved)) {
            images.push(resolved);
          }
        } catch {
          // ignore invalid relative URLs
        }
      }
    }
  } catch (e) {
    console.warn('[AI Import] Error during HTML metadata parsing:', e);
  }

  return { meta, images, jsonLdData };
}

/**
 * Uses Gemini LLM to synthesize high-precision product information from raw webpage text/metadata.
 */
async function extractWithGemini(
  contentSnippet: string,
  targetUrl: string,
  apiKey: string
): Promise<Partial<ExtractedProductInfo> | null> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are an expert e-commerce catalog assistant extracting product information from a publicly accessible web page or image URL.
Source URL: ${targetUrl}

Extracted Content / Metadata Snippet:
"""
${contentSnippet.slice(0, 4000)}
"""

Extract all available product details into a clean JSON object.
CRITICAL RULES:
1. ONLY extract information that is explicitly present or clearly identifiable in the snippet.
2. NEVER guess or fabricate stock quantities. If an exact numeric inventory stock count is explicitly mentioned in the source (e.g. "Only 5 left in stock"), set stock to that number. Otherwise, leave stock as null or undefined.
3. Extract accurate numeric price and MRP (if discounted). In Indian e-commerce context (INR/Rs), provide plain numbers.
4. Extract specifications as an array of objects: [{"key": "Material", "value": "100% Cotton"}, ...].
5. Extract key features as an array of strings.
6. Return a valid JSON object matching this schema:
{
  "name": "Product Name",
  "brand": "Brand / Manufacturer Name",
  "description": "Short 1-2 sentence overview",
  "fullDescription": "Detailed product description and specs",
  "price": 999,
  "mrp": 1499,
  "stock": 5, // ONLY if reliably available, otherwise null
  "categorySuggestion": "Clothing / Electronics / etc.",
  "color": "Primary Color",
  "size": "Standard Size",
  "features": ["Feature 1", "Feature 2"],
  "specifications": [
    { "key": "Specification Name", "value": "Specification Value" }
  ]
}

Return ONLY the JSON object. Do not include markdown code block syntax if possible, or wrap in \`\`\`json.`;

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini product extraction timeout')), 4500)
    );

    const requestPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const response = await Promise.race([requestPromise, timeoutPromise]);
    const rawText = response.text || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    }
  } catch (err: any) {
    console.warn('[AI Import] Gemini extraction failed or timed out:', err.message || err);
  }

  return null;
}

/**
 * Express handler for POST /api/products/ai-import
 */
export async function aiProductImportHandler(req: Request, res: Response) {
  try {
    const { url, sourceUrl } = req.body;
    const inputUrl = (url || sourceUrl || '').trim();

    if (!inputUrl) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid product URL or image URL.',
      });
    }

    // Validate URL syntax
    try {
      new URL(inputUrl);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format.',
      });
    }

    const collectedImages: string[] = [];
    const isDirectImage = /^https?:\/\/.*\.(jpe?g|png|webp|gif|svg|avif)($|\?)/i.test(inputUrl);
    if (isDirectImage) {
      collectedImages.push(inputUrl);
    }

    // Determine candidate webpage URLs to inspect
    const candidates = getCandidatePageUrls(inputUrl);
    let pageHtml: string | null = null;
    let accessedPageUrl = inputUrl;

    for (const cand of candidates) {
      const html = await fetchPublicPageHtml(cand);
      if (html) {
        pageHtml = html;
        accessedPageUrl = cand;
        break;
      }
    }

    let extracted: ExtractedProductInfo = {
      images: collectedImages,
      specifications: [],
      features: [],
      sourceUrl: accessedPageUrl,
    };

    let textSnippetForAI = '';

    if (pageHtml) {
      const { meta, images: pageImages, jsonLdData } = extractHtmlMetadata(pageHtml, accessedPageUrl);

      // Merge unique images
      for (const img of pageImages) {
        if (!collectedImages.includes(img)) {
          collectedImages.push(img);
        }
      }

      // Check Schema.org JSON-LD for rich product data
      for (const item of jsonLdData) {
        const itemType = item['@type'];
        if (itemType === 'Product' || (Array.isArray(itemType) && itemType.includes('Product'))) {
          if (item.name && !extracted.name) extracted.name = item.name;
          if (item.description && !extracted.description) extracted.description = item.description;
          if (item.brand) {
            extracted.brand = typeof item.brand === 'object' ? item.brand.name : item.brand;
          }
          if (item.image) {
            const ldImgs = Array.isArray(item.image) ? item.image : [item.image];
            for (const li of ldImgs) {
              const u = typeof li === 'object' ? li.url : li;
              if (u && typeof u === 'string' && !collectedImages.includes(u)) {
                collectedImages.unshift(u); // Prioritize official product schema images
              }
            }
          }
          if (item.offers) {
            const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            if (offer) {
              const p = parseFloat(offer.price || offer.highPrice || offer.lowPrice);
              if (!isNaN(p) && p > 0) extracted.price = p;
              // Only reliably extract stock if explicit availability quantity is specified
              if (offer.offerCount || offer.inventoryLevel?.value) {
                const s = parseInt(offer.offerCount || offer.inventoryLevel?.value, 10);
                if (!isNaN(s) && s >= 0) extracted.stock = s;
              }
            }
          }
        }
      }

      // Fallback from standard OpenGraph / meta if not yet populated
      if (!extracted.name && (meta['og:title'] || meta['title'])) {
        extracted.name = (meta['og:title'] || meta['title'] || '').split(/[-|–]/)[0].trim();
      }
      if (!extracted.description && (meta['og:description'] || meta['description'])) {
        extracted.description = meta['og:description'] || meta['description'];
      }

      // Prepare text snippet for Gemini enrichment
      const cleanedBodyText = pageHtml
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      textSnippetForAI = `Title: ${extracted.name || meta['title'] || ''}
Meta Description: ${extracted.description || ''}
Page Text: ${cleanedBodyText.slice(0, 3000)}`;
    } else {
      // Direct image URL without accessible HTML webpage
      textSnippetForAI = `Target Image URL: ${inputUrl}`;
    }

    // AI Enrichment via Gemini if available
    const apiKey = process.env.GEMINI_API_KEY || (process.env as any)?.VITE_GEMINI_API_KEY;
    const isValidApiKey = Boolean(apiKey && apiKey !== 'your_gemini_api_key' && !apiKey.includes('dummy'));

    if (isValidApiKey && textSnippetForAI.length > 20) {
      const aiResult = await extractWithGemini(textSnippetForAI, inputUrl, apiKey);
      if (aiResult) {
        if (aiResult.name && !extracted.name) extracted.name = aiResult.name;
        if (aiResult.brand && !extracted.brand) extracted.brand = aiResult.brand;
        if (aiResult.description && !extracted.description) extracted.description = aiResult.description;
        if (aiResult.fullDescription && !extracted.fullDescription) extracted.fullDescription = aiResult.fullDescription;
        if (aiResult.price && !extracted.price) extracted.price = aiResult.price;
        if (aiResult.mrp && !extracted.mrp) extracted.mrp = aiResult.mrp;
        if (aiResult.categorySuggestion && !extracted.categorySuggestion) extracted.categorySuggestion = aiResult.categorySuggestion;
        if (aiResult.color && !extracted.color) extracted.color = aiResult.color;
        if (aiResult.size && !extracted.size) extracted.size = aiResult.size;

        if (Array.isArray(aiResult.features) && aiResult.features.length > 0) {
          extracted.features = Array.from(new Set([...(extracted.features || []), ...aiResult.features]));
        }

        if (Array.isArray(aiResult.specifications) && aiResult.specifications.length > 0) {
          extracted.specifications = aiResult.specifications.filter(s => s && s.key && s.value);
        }

        // Only accept stock if AI found explicit stock number
        if (typeof aiResult.stock === 'number' && !isNaN(aiResult.stock) && aiResult.stock >= 0) {
          extracted.stock = aiResult.stock;
        }
      }
    }

    // Clean image URLs (max 10, valid format)
    const validImages = collectedImages
      .filter(img => typeof img === 'string' && /^https?:\/\//i.test(img))
      .slice(0, 10);

    extracted.images = validImages;

    return res.json({
      success: true,
      extracted,
      hasWebpageAccess: Boolean(pageHtml),
      message: validImages.length > 0 || extracted.name
        ? 'Product details successfully extracted.'
        : 'Could not extract product details from this URL, manual entry available.',
    });
  } catch (error: any) {
    console.error('[AI Import] Error during product import:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while importing product information.',
    });
  }
}
