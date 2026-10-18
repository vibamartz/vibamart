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
 * Normalizes and extracts potential product landing page candidates from any URL or image link.
 */
function getCandidatePageUrls(inputUrl: string): string[] {
  const candidates: string[] = [];
  try {
    const parsed = new URL(inputUrl);
    const isImageFile = /\.(jpe?g|png|webp|gif|svg|avif)($|\?)/i.test(parsed.pathname);

    // 1. If it's a direct webpage (not pure image file extension), test it first
    if (!isImageFile) {
      candidates.push(inputUrl);
    }

    // 2. Query param redirects e.g. ?url=..., ?src=..., ?ref=..., ?target=...
    for (const p of ['url', 'src', 'ref', 'target', 'link', 'dest']) {
      const val = parsed.searchParams.get(p);
      if (val && /^https?:\/\//i.test(val)) {
        candidates.push(val);
      }
    }

    // 3. Amazon specific image URL pattern:
    // e.g. https://m.media-amazon.com/images/I/71yzJoE7WlL._SX679_.jpg
    // If an ASIN is embedded anywhere in query or path
    const asinMatch = inputUrl.match(/\b([B0-9][A-Z0-9]{9})\b/);
    if (asinMatch) {
      candidates.push(`https://www.amazon.in/dp/${asinMatch[1]}`);
      candidates.push(`https://www.amazon.com/dp/${asinMatch[1]}`);
    }

    // 4. Flipkart specific patterns:
    // e.g. /image/.../pid=XYZ123
    const fpidMatch = inputUrl.match(/pid=([A-Z0-9]+)/i);
    if (fpidMatch) {
      candidates.push(`https://www.flipkart.com/product/p/item?pid=${fpidMatch[1]}`);
    }

    // 5. If it's an image file with a descriptive path e.g. /products/nike-air-zoom-pegasus.jpg
    if (isImageFile) {
      // Path without file extension
      const cleanPath = parsed.pathname.replace(/\.(jpe?g|png|webp|gif|svg|avif)$/i, '');
      const parts = cleanPath.split('/').filter(Boolean);
      if (parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        // If lastPart contains words like 'nike-air-max'
        if (lastPart.includes('-') || lastPart.includes('_')) {
          candidates.push(`${parsed.origin}/products/${lastPart}`);
          candidates.push(`${parsed.origin}/product/${lastPart}`);
          candidates.push(`${parsed.origin}/p/${lastPart}`);
        }
      }
      candidates.push(inputUrl);
    }

  } catch {
    // If invalid URL, return empty
  }
  return Array.from(new Set(candidates));
}

/**
 * Safely fetches public HTML content from a given URL with timeout and browser-like user agent.
 */
async function fetchPublicPageHtml(pageUrl: string): Promise<string | null> {
  try {
    const response = await axios.get(pageUrl, {
      timeout: 7000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      maxRedirects: 5,
      responseType: 'text',
      validateStatus: (status) => status >= 200 && status < 400,
    });

    if (typeof response.data === 'string' && response.data.trim().length > 100) {
      return response.data;
    }
  } catch (err: any) {
    // Graceful fallback
  }
  return null;
}

/**
 * Extracts structured metadata (OpenGraph, schema.org JSON-LD, HTML tables, spec lists)
 * from HTML string.
 */
function extractHtmlMetadata(html: string, baseUrl: string) {
  const meta: Record<string, string> = {};
  const images: string[] = [];
  let jsonLdData: any[] = [];
  const specifications: { key: string; value: string }[] = [];
  const features: string[] = [];

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

    // 3. Title tag & H1 tag
    const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (titleMatch && titleMatch[1]) {
      meta['title'] = titleMatch[1].replace(/[\r\n\t]+/g, ' ').trim();
    }
    const h1Match = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    if (h1Match && h1Match[1]) {
      meta['h1'] = h1Match[1].replace(/<[^>]+>/g, '').replace(/[\r\n\t]+/g, ' ').trim();
    }

    // 4. Amazon specific title selector
    const amazonTitleMatch = /id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i.exec(html);
    if (amazonTitleMatch && amazonTitleMatch[1]) {
      meta['product_title'] = amazonTitleMatch[1].trim();
    }

    // 5. Amazon bullet features: #featurebullets_feature_div or #feature-bullets
    const bulletsMatch = /id=["']feature-bullets["'][\s\S]*?<\/ul>/i.exec(html);
    if (bulletsMatch) {
      const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
      let liM: RegExpExecArray | null;
      while ((liM = liRegex.exec(bulletsMatch[0])) !== null) {
        const text = liM[1].replace(/<[^>]+>/g, '').replace(/[\r\n\t]+/g, ' ').trim();
        if (text && text.length > 5 && !text.toLowerCase().includes('replacement') && !text.toLowerCase().includes('warranty')) {
          features.push(text);
        }
      }
    }

    // 6. Generic Table & Specifications Extraction (table rows with th/td or dt/dd)
    const rowRegex = /<tr[^>]*>[\s\S]*?<th[^>]*>([\s\S]*?)<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
    while ((match = rowRegex.exec(html)) !== null && specifications.length < 25) {
      const k = match[1].replace(/<[^>]+>/g, '').replace(/[\r\n\t]+/g, ' ').trim();
      const v = match[2].replace(/<[^>]+>/g, '').replace(/[\r\n\t]+/g, ' ').trim();
      if (k && v && k.length > 1 && k.length < 40 && v.length < 100 && !k.toLowerCase().includes('review') && !k.toLowerCase().includes('rating')) {
        specifications.push({ key: k, value: v });
      }
    }

    // 7. Definition lists (<dl><dt>...</dt><dd>...</dd></dl>)
    const dlRegex = /<dt[^>]*>([\s\S]*?)<\/dt>[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>/gi;
    while ((match = dlRegex.exec(html)) !== null && specifications.length < 25) {
      const k = match[1].replace(/<[^>]+>/g, '').replace(/[\r\n\t]+/g, ' ').trim();
      const v = match[2].replace(/<[^>]+>/g, '').replace(/[\r\n\t]+/g, ' ').trim();
      if (k && v && k.length > 1 && k.length < 40 && v.length < 100) {
        if (!specifications.some(s => s.key.toLowerCase() === k.toLowerCase())) {
          specifications.push({ key: k, value: v });
        }
      }
    }

    // 8. OpenGraph Images
    if (meta['og:image']) images.push(meta['og:image']);
    if (meta['twitter:image'] && !images.includes(meta['twitter:image'])) images.push(meta['twitter:image']);

  } catch (e) {
    console.warn('[AI Import] Error during HTML metadata parsing:', e);
  }

  return { meta, images, jsonLdData, specifications, features };
}

/**
 * Derives rich heuristic descriptions and specifications directly from clean URLs and metadata
 * (e.g. filename words, brand names, model patterns) when AI API key or network is offline.
 */
function deriveDeterministicProductInfo(inputUrl: string, meta: Record<string, string>): Partial<ExtractedProductInfo> {
  const result: Partial<ExtractedProductInfo> = {
    specifications: [],
    features: [],
  };

  try {
    const parsed = new URL(inputUrl);
    // Parse slug from pathname
    const cleanPath = parsed.pathname.replace(/\.(jpe?g|png|webp|gif|svg|avif)$/i, '');
    const segments = cleanPath.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || '';

    // Convert slug into title words
    const words = lastSegment
      .replace(/[_-]+/g, ' ')
      .replace(/\b(photo|image|img|pic|picture|catalog|media|asset|product|item)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (words && words.length > 3) {
      // Capitalize words
      const candidateTitle = words
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

      if (!result.name) result.name = candidateTitle;
    }

    // Detect popular brands
    const popularBrands = [
      'Nike', 'Adidas', 'Puma', 'Apple', 'Samsung', 'Sony', 'Boat', 'Noise', 'Dell', 'HP',
      'Lenovo', 'OnePlus', 'Xiaomi', 'Realme', 'Asus', 'Bose', 'JBL', 'Canon', 'Casio',
      'Levi\'s', 'Zara', 'H&M', 'Allen Solly', 'Peter England', 'Titan', 'Fastrack', 'Philips'
    ];

    const allText = `${inputUrl} ${meta['title'] || ''} ${meta['og:title'] || ''} ${result.name || ''}`;
    for (const b of popularBrands) {
      if (new RegExp(`\\b${b}\\b`, 'i').test(allText)) {
        result.brand = b;
        break;
      }
    }

    // Generate clean specifications from known patterns
    const specs: { key: string; value: string }[] = [];
    if (result.brand) {
      specs.push({ key: 'Brand', value: result.brand });
    }

    // Check color hints
    const colors = ['Black', 'White', 'Blue', 'Red', 'Green', 'Grey', 'Silver', 'Gold', 'Titanium', 'Yellow', 'Purple', 'Pink', 'Brown', 'Beige', 'Navy'];
    for (const c of colors) {
      if (new RegExp(`\\b${c}\\b`, 'i').test(allText)) {
        result.color = c;
        specs.push({ key: 'Color', value: c });
        break;
      }
    }

    // Check storage or RAM hints
    const storageMatch = allText.match(/\b(32|64|128|256|512|1024)\s*(gb|tb)\b/i);
    if (storageMatch) {
      specs.push({ key: 'Storage Capacity', value: `${storageMatch[1].toUpperCase()} ${storageMatch[2].toUpperCase()}` });
    }

    // Check sizes
    const sizeMatch = allText.match(/\b(xs|s|m|l|xl|xxl|2xl|3xl)\b/i);
    if (sizeMatch) {
      const sz = sizeMatch[1].toUpperCase();
      result.size = sz;
      specs.push({ key: 'Size', value: sz });
    }

    result.specifications = specs;

    if (!result.description && result.name) {
      result.description = `Premium quality ${result.name}${result.brand ? ` by ${result.brand}` : ''} crafted for everyday excellence and dependable performance.`;
      result.fullDescription = `${result.name} features an authentic design with durable materials, high standard craftsmanship, and seamless user comfort.\n\nIncluded Attributes:\n${specs.map(s => `• ${s.key}: ${s.value}`).join('\n')}`;
    }
  } catch {
    // ignore parsing errors
  }

  return result;
}

/**
 * Uses Gemini LLM to synthesize high-precision product descriptions and specifications.
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
1. ONLY extract descriptions, specifications, brand, name, and pricing.
2. NEVER guess or fabricate stock quantities. If an exact numeric inventory stock count is explicitly mentioned in the source (e.g. "Only 5 left in stock"), set stock to that number. Otherwise, leave stock as null or undefined.
3. Extract accurate numeric price and MRP (if discounted). In Indian e-commerce context (INR/Rs), provide plain numbers.
4. Extract specifications as an array of objects: [{"key": "Material", "value": "100% Cotton"}, ...].
5. Extract key features as an array of strings.
6. Provide an informative, appealing short description (1-2 sentences) and a comprehensive full description with bulleted attributes.
7. Return a valid JSON object matching this schema:
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
      images: [], // Images are NOT imported as requested by user
      specifications: [],
      features: [],
      sourceUrl: accessedPageUrl,
    };

    let textSnippetForAI = '';
    let scrapedMeta: Record<string, string> = {};

    if (pageHtml) {
      const { meta, jsonLdData, specifications: htmlSpecs, features: htmlFeats } = extractHtmlMetadata(pageHtml, accessedPageUrl);
      scrapedMeta = meta;

      // Assign extracted HTML specs & features
      if (htmlSpecs.length > 0) {
        extracted.specifications = htmlSpecs;
      }
      if (htmlFeats.length > 0) {
        extracted.features = htmlFeats;
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
          if (item.offers) {
            const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            if (offer) {
              const p = parseFloat(offer.price || offer.highPrice || offer.lowPrice);
              if (!isNaN(p) && p > 0) extracted.price = p;
              if (offer.offerCount || offer.inventoryLevel?.value) {
                const s = parseInt(offer.offerCount || offer.inventoryLevel?.value, 10);
                if (!isNaN(s) && s >= 0) extracted.stock = s;
              }
            }
          }
        }
      }

      // Fallback from standard OpenGraph / meta if not yet populated
      if (!extracted.name && (meta['product_title'] || meta['og:title'] || meta['title'] || meta['h1'])) {
        const rawTitle = meta['product_title'] || meta['og:title'] || meta['title'] || meta['h1'] || '';
        extracted.name = rawTitle.split(/[-|–]/)[0].trim();
      }
      if (!extracted.description && (meta['og:description'] || meta['description'])) {
        extracted.description = meta['og:description'] || meta['description'];
      }

      // Cleaned body text for AI prompt
      const cleanedBodyText = pageHtml
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      textSnippetForAI = `Title: ${extracted.name || meta['title'] || ''}
Brand: ${extracted.brand || ''}
Meta Description: ${extracted.description || ''}
Key Specifications: ${extracted.specifications.map(s => `${s.key}: ${s.value}`).join(', ')}
Key Features: ${extracted.features?.join('; ')}
Page Text: ${cleanedBodyText.slice(0, 3000)}`;
    } else {
      textSnippetForAI = `Target Product / Image URL: ${inputUrl}`;
    }

    // Deterministic extraction fallback for offline / no-API-key setups
    const deterministicData = deriveDeterministicProductInfo(inputUrl, scrapedMeta);
    if (!extracted.name && deterministicData.name) extracted.name = deterministicData.name;
    if (!extracted.brand && deterministicData.brand) extracted.brand = deterministicData.brand;
    if (!extracted.description && deterministicData.description) extracted.description = deterministicData.description;
    if (!extracted.fullDescription && deterministicData.fullDescription) extracted.fullDescription = deterministicData.fullDescription;
    if (extracted.specifications.length === 0 && deterministicData.specifications && deterministicData.specifications.length > 0) {
      extracted.specifications = deterministicData.specifications;
    }
    if (!extracted.color && deterministicData.color) extracted.color = deterministicData.color;
    if (!extracted.size && deterministicData.size) extracted.size = deterministicData.size;

    // AI Enrichment via Gemini if available
    const apiKey = process.env.GEMINI_API_KEY || (process.env as any)?.VITE_GEMINI_API_KEY;
    const isValidApiKey = Boolean(apiKey && apiKey !== 'your_gemini_api_key' && !apiKey.includes('dummy'));

    if (isValidApiKey && textSnippetForAI.length > 15) {
      const aiResult = await extractWithGemini(textSnippetForAI, inputUrl, apiKey);
      if (aiResult) {
        if (aiResult.name) extracted.name = aiResult.name;
        if (aiResult.brand) extracted.brand = aiResult.brand;
        if (aiResult.description) extracted.description = aiResult.description;
        if (aiResult.fullDescription) extracted.fullDescription = aiResult.fullDescription;
        if (aiResult.price && !extracted.price) extracted.price = aiResult.price;
        if (aiResult.mrp && !extracted.mrp) extracted.mrp = aiResult.mrp;
        if (aiResult.categorySuggestion && !extracted.categorySuggestion) extracted.categorySuggestion = aiResult.categorySuggestion;
        if (aiResult.color && !extracted.color) extracted.color = aiResult.color;
        if (aiResult.size && !extracted.size) extracted.size = aiResult.size;

        if (Array.isArray(aiResult.features) && aiResult.features.length > 0) {
          extracted.features = Array.from(new Set([...(extracted.features || []), ...aiResult.features]));
        }

        if (Array.isArray(aiResult.specifications) && aiResult.specifications.length > 0) {
          const specMap = new Map<string, string>();
          extracted.specifications.forEach(s => specMap.set(s.key.toLowerCase(), s.value));
          aiResult.specifications.forEach(s => {
            if (s && s.key && s.value && !specMap.has(s.key.toLowerCase())) {
              extracted.specifications.push(s);
              specMap.set(s.key.toLowerCase(), s.value);
            }
          });
        }

        // Only accept stock if AI found explicit stock number
        if (typeof aiResult.stock === 'number' && !isNaN(aiResult.stock) && aiResult.stock >= 0) {
          extracted.stock = aiResult.stock;
        }
      }
    }

    // Always ensure extracted.images is empty array as user requested NOT to import product images
    extracted.images = [];

    const hasExtractedData = Boolean(
      extracted.name ||
      extracted.description ||
      (extracted.specifications && extracted.specifications.length > 0)
    );

    return res.json({
      success: true,
      extracted,
      hasWebpageAccess: Boolean(pageHtml),
      message: hasExtractedData
        ? 'Product description and specifications successfully extracted.'
        : 'Could not automatically retrieve details from this URL, manual entry available.',
    });
  } catch (error: any) {
    console.error('[AI Import] Error during product import:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while importing product information.',
    });
  }
}
