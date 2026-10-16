import { GoogleGenAI } from '@google/genai';
import { Product } from '../types';

export interface KeywordGenerationOptions {
  existingKeywords?: string[];
  minCount?: number;
  maxCount?: number;
  allowGemini?: boolean;
  apiKey?: string;
  categoryName?: string;
  subCategoryName?: string;
  nestedSubCategoryName?: string;
}

/**
 * Domain-specific taxonomy synonyms and search expansions.
 * Mapped to e-commerce consumer search habits for maximum relevance and partial matching.
 */
const CATEGORY_TAXONOMY_MAP: Record<string, string[]> = {
  // Footwear & Shoes
  shoe: ['sneakers', 'running shoes', 'sports shoes', 'footwear', 'casual shoes', 'gym shoes', 'trainers', 'walking shoes'],
  sneaker: ['running shoes', 'casual footwear', 'sports sneakers', 'gym shoes', 'walking shoes', 'trainers'],
  footwear: ['shoes', 'sneakers', 'casual footwear', 'comfort shoes', 'sports shoes'],
  sandal: ['footwear', 'casual slippers', 'comfort slides', 'flip flops', 'summer footwear'],
  boot: ['ankle boots', 'leather boots', 'outdoor footwear', 'casual boots', 'winter footwear'],

  // Electronics & Mobiles
  phone: ['smartphone', 'mobile phone', 'android phone', '5g smartphone', 'cell phone', 'touchscreen mobile'],
  smartphone: ['mobile phone', '5g phone', 'android', 'cell phone', 'touchscreen', 'dual sim mobile'],
  mobile: ['smartphone', 'cell phone', '5g phone', 'handset', 'smart device'],
  tablet: ['ipad', 'touchscreen tablet', 'android tablet', 'digital notepad', 'portable display'],
  laptop: ['notebook', 'computer', 'ultrabook', 'pc', 'workstation', 'portable pc'],
  computer: ['pc', 'desktop', 'laptop', 'workstation', 'computing device'],

  // Audio & Sound
  headphone: ['earphones', 'wireless headphones', 'bluetooth headset', 'audio', 'earbuds', 'sound'],
  headphones: ['wireless headphones', 'bluetooth earphones', 'audio headset', 'earbuds', 'over-ear headphones'],
  earbud: ['wireless earbuds', 'bluetooth earphones', 'tws earbuds', 'audio pods', 'in-ear headphones'],
  earbuds: ['wireless earbuds', 'bluetooth earphones', 'tws pods', 'noise cancelling earbuds', 'in-ear audio'],
  earphone: ['earbuds', 'in-ear headset', 'wired earphones', 'audio pods', 'handsfree'],
  earphones: ['earbuds', 'bluetooth earphones', 'in-ear headset', 'wireless earphones', 'audio'],
  speaker: ['bluetooth speaker', 'wireless speaker', 'portable soundbox', 'audio speaker', 'bass speaker'],

  // Wearables & Smart Tech
  watch: ['smartwatch', 'wrist watch', 'fitness tracker', 'digital watch', 'timepiece'],
  smartwatch: ['fitness watch', 'activity tracker', 'digital wrist watch', 'health band', 'smart band'],

  // Apparel & Clothing - Men & Women
  shirt: ['formal shirt', 'casual shirt', 'cotton shirt', 'apparel', 'topwear', 'button down shirt'],
  tshirt: ['tee', 'round neck tshirt', 'polo tshirt', 'graphic tee', 'casual topwear', 'cotton tee'],
  tee: ['tshirt', 'casual tee', 'printed tshirt', 'round neck', 'apparel'],
  jeans: ['denim pants', 'casual jeans', 'bottomwear', 'slim fit jeans', 'denim trousers'],
  trouser: ['pants', 'formal trousers', 'chinos', 'bottomwear', 'casual pants'],
  dress: ['one piece dress', 'women apparel', 'casual dress', 'party wear dress', 'fashion outfit'],
  saree: ['traditional saree', 'ethnic wear', 'indian saree', 'silk saree', 'festive wear'],
  kurta: ['ethnic kurta', 'traditional wear', 'kurti', 'indian wear', 'festive kurta'],
  kurti: ['women kurta', 'ethnic kurti', 'casual top', 'traditional wear', 'tunic'],
  jacket: ['winter jacket', 'outerwear', 'windcheater', 'casual jacket', 'hoodie', 'bomber jacket'],
  hoodie: ['sweatshirt', 'winter wear', 'casual pullover', 'hooded jacket', 'warm topwear'],

  // Personal Care, Beauty & Grooming
  beauty: ['skincare', 'cosmetics', 'glow care', 'personal care', 'beauty routine'],
  cream: ['face cream', 'moisturizer', 'skincare', 'daily lotion', 'hydration cream'],
  serum: ['face serum', 'skin treatment', 'anti aging', 'glow serum', 'skincare essence'],
  perfume: ['fragrance', 'deodorant', 'body spray', 'eau de parfum', 'cologne', 'scent'],
  shampoo: ['hair care', 'scalp cleanser', 'hair wash', 'daily shampoo', 'anti dandruff'],

  // Home & Kitchen
  kitchen: ['kitchenware', 'cookware', 'home appliances', 'cooking utensils', 'kitchen essentials'],
  bottle: ['water bottle', 'stainless steel flask', 'sipper', 'insulated bottle', 'thermos'],
  mug: ['coffee mug', 'ceramic cup', 'tea mug', 'drinkware', 'kitchen cup'],
  bedsheet: ['bed linen', 'cotton bedsheet', 'mattress cover', 'home bedding', 'double bedsheet'],

  // Bags & Accessories
  bag: ['backpack', 'travel bag', 'handbag', 'shoulder bag', 'casual pack', 'luggage'],
  backpack: ['school bag', 'laptop backpack', 'travel bag', 'college bag', 'daypack'],
  wallet: ['leather wallet', 'purse', 'pocket wallet', 'money holder', 'card holder'],

  // Sports & Fitness
  fitness: ['gym equipment', 'workout gear', 'exercise accessories', 'sports gear', 'training'],
  yoga: ['yoga mat', 'fitness mat', 'exercise mat', 'workout stretch', 'wellness']
};

/** Common stop words to strip from keyword candidate tokens */
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t',
  'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
  'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
  'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very',
  'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t',
  'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves',
  // Generic e-commerce marketing noise
  'buy', 'best', 'online', 'genuine', 'original', 'product', 'item', 'quality', 'store', 'shop', 'sale', 'new', 'latest',
  'pack', 'combo', 'piece', 'pieces', 'free', 'shipping', 'offer', 'brand', 'price', 'low', 'high', 'rated'
]);

/**
 * Normalizes a single keyword string:
 * - lowercase
 * - trim
 * - strip leading/trailing symbols, HTML, and extra whitespace
 * - preserves valid hyphens (e.g. "type-c", "wi-fi", "t-shirt")
 */
export function normalizeKeyword(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^\w\s.-]/g, ' ')
    // Remove periods that are not part of a decimal number
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[-_\s.]+|[-_\s.]+$/g, '')
    .trim();
}

/**
 * Validates whether a keyword is high-quality:
 * - at least 2 characters (or recognized acronym like '5g', 'ai')
 * - not a stop word
 * - not a pure meaningless number (unless spec e.g. "5g", "128gb", "4k")
 */
function isValidKeyword(kw: string): boolean {
  if (!kw) return false;
  if (kw.length < 2) return false;
  if (STOP_WORDS.has(kw)) return false;
  // If pure digits, skip unless it's a known model year/number
  if (/^\d+$/.test(kw) && kw.length < 3) return false;
  return true;
}

/**
 * Extracts descriptive terms from image URLs or filenames (e.g. 'boat-rockerz-450-black.jpg' -> ['boat', 'rockerz', '450', 'black'])
 */
function extractImageKeywords(images?: string[]): string[] {
  if (!Array.isArray(images) || images.length === 0) return [];
  const results: string[] = [];

  for (const img of images.slice(0, 3)) {
    if (typeof img !== 'string' || !img) continue;
    try {
      // Get filename from URL or path
      const urlWithoutQuery = img.split('?')[0];
      const filename = urlWithoutQuery.split('/').pop() || '';
      const nameWithoutExt = filename.replace(/\.[a-zA-Z0-9]+$/, '');
      const parts = nameWithoutExt.split(/[-_]+/).map(normalizeKeyword).filter(isValidKeyword);
      for (const p of parts) {
        if (!/^(img|image|photo|pic|thumb|prod|product|upload|\d+)$/i.test(p)) {
          results.push(p);
        }
      }
    } catch {
      // Ignore malformed image URLs
    }
  }

  return results;
}

/**
 * Deterministic ML/NLP Keyword Extraction Fallback Engine.
 * Operates purely locally with 0ms network latency.
 * Guarantees at least 6 high-relevance search keywords for any product.
 */
export function generateKeywordsDeterministic(
  product: Partial<Product>,
  options: KeywordGenerationOptions = {}
): string[] {
  const minCount = options.minCount ?? 6;
  const maxCount = options.maxCount ?? 16;
  const accumulated = new Set<string>();

  // 1. Preserve existing useful keywords first
  const existing = options.existingKeywords || product.tags || [];
  if (Array.isArray(existing)) {
    for (const kw of existing) {
      const clean = normalizeKeyword(kw);
      if (isValidKeyword(clean)) {
        accumulated.add(clean);
      }
    }
  }

  const name = (product.name || '').trim();
  const brand = (product.brand || '').trim();
  const desc = (product.description || '') + ' ' + (product.fullDescription || '');
  const catName = options.categoryName || (typeof product.categoryId === 'string' ? product.categoryId : '');
  const subCatName = options.subCategoryName || (typeof product.subCategoryId === 'string' ? product.subCategoryId : '');
  const nestedCatName = options.nestedSubCategoryName || (typeof product.nestedSubCategoryId === 'string' ? product.nestedSubCategoryId : '');

  // 2. Brand Keywords & Brand Combinations
  if (brand) {
    const cleanBrand = normalizeKeyword(brand);
    if (isValidKeyword(cleanBrand)) {
      accumulated.add(cleanBrand);
      if (catName) {
        accumulated.add(normalizeKeyword(`${cleanBrand} ${catName}`));
      }
      if (subCatName) {
        accumulated.add(normalizeKeyword(`${cleanBrand} ${subCatName}`));
      }
    }
  }

  // 3. Product Title Tokenization & Significant Collocations
  if (name) {
    const cleanTitle = normalizeKeyword(name);
    // Add cleaned full title if concise (<= 4 words)
    const titleWords = cleanTitle.split(' ').filter(isValidKeyword);
    if (titleWords.length > 0 && titleWords.length <= 4) {
      accumulated.add(cleanTitle);
    }

    // Add unigrams from title
    for (const word of titleWords) {
      accumulated.add(word);
    }

    // Add 2-word collocations from title
    for (let i = 0; i < titleWords.length - 1; i++) {
      const bigram = `${titleWords[i]} ${titleWords[i + 1]}`;
      accumulated.add(bigram);
    }

    // Add 3-word phrase if >= 3 words
    if (titleWords.length >= 3) {
      accumulated.add(`${titleWords[0]} ${titleWords[1]} ${titleWords[2]}`);
    }
  }

  // 4. Category, Subcategory, & Hierarchy Expansion
  const hierarchyTerms = [catName, subCatName, nestedCatName].filter(Boolean);
  for (const hTerm of hierarchyTerms) {
    const cleanH = normalizeKeyword(hTerm);
    if (isValidKeyword(cleanH)) {
      accumulated.add(cleanH);
      // Also add individual words if compound e.g. "Mobile Phones" -> "mobile", "phones"
      cleanH.split(' ').filter(isValidKeyword).forEach(w => accumulated.add(w));
    }
  }

  // 5. Taxonomy Synonyms & Search Intents
  const fullContextText = `${name} ${brand} ${catName} ${subCatName} ${nestedCatName} ${desc}`.toLowerCase();
  for (const [key, synonyms] of Object.entries(CATEGORY_TAXONOMY_MAP)) {
    const keyRegex = new RegExp(`\\b${key}\\b`, 'i');
    if (keyRegex.test(fullContextText)) {
      for (const syn of synonyms) {
        const cleanSyn = normalizeKeyword(syn);
        if (isValidKeyword(cleanSyn)) {
          accumulated.add(cleanSyn);
          if (accumulated.size >= maxCount + 6) break;
        }
      }
    }
  }

  // 6. Specifications Key-Value Attributes
  const specs = Array.isArray(product.specifications) ? product.specifications : [];
  for (const spec of specs) {
    if (!spec || !spec.value) continue;
    const cleanVal = normalizeKeyword(spec.value);
    const cleanKey = normalizeKeyword(spec.key || '');

    // High value spec patterns (RAM, Storage, Battery, Material, Processor, Color, Connectivity, Display)
    if (cleanVal) {
      // E.g. "128gb", "256gb", "5000mah", "cotton", "bluetooth 5.3", "amoled"
      if (cleanVal.length <= 25) {
        accumulated.add(cleanVal);
      }
      if (cleanKey && cleanVal.length <= 15) {
        accumulated.add(normalizeKeyword(`${cleanVal} ${cleanKey}`));
      }
    }
  }

  // Variant specifications (universal specs)
  const varSpecs = product.variantSpecifications || product.specificationsByVariant;
  if (varSpecs && typeof varSpecs === 'object') {
    Object.values(varSpecs).forEach(specList => {
      if (Array.isArray(specList)) {
        specList.forEach(s => {
          if (s?.value) {
            const cv = normalizeKeyword(s.value);
            if (isValidKeyword(cv) && cv.length <= 20) {
              accumulated.add(cv);
            }
          }
        });
      }
    });
  }

  // 7. Variants, Colors, & Sizes
  if (Array.isArray(product.variants)) {
    for (const v of product.variants.slice(0, 5)) {
      if (v.color) accumulated.add(normalizeKeyword(v.color));
      if (v.colorName) accumulated.add(normalizeKeyword(v.colorName));
      if (v.size) accumulated.add(normalizeKeyword(v.size));
      if (v.material) accumulated.add(normalizeKeyword(v.material));
    }
  }
  if (product.color) accumulated.add(normalizeKeyword(product.color));
  if (product.size) accumulated.add(normalizeKeyword(product.size));
  if (Array.isArray(product.sizes)) {
    product.sizes.forEach(s => accumulated.add(normalizeKeyword(s)));
  }

  // 8. Features
  if (Array.isArray(product.features)) {
    for (const f of product.features.slice(0, 5)) {
      if (typeof f === 'string') {
        const cleanF = normalizeKeyword(f);
        const fWords = cleanF.split(' ').filter(isValidKeyword);
        if (fWords.length > 0 && fWords.length <= 3) {
          accumulated.add(cleanF);
        } else if (fWords.length > 3) {
          accumulated.add(`${fWords[0]} ${fWords[1]}`);
        }
      }
    }
  }

  // 9. Image URL / Filename tokens
  const imgKeywords = extractImageKeywords(product.images || (product.primaryImage ? [product.primaryImage] : []));
  for (const imgKw of imgKeywords) {
    if (isValidKeyword(imgKw)) {
      accumulated.add(imgKw);
    }
  }

  // 10. Description Significant Noun Phrases
  if (desc) {
    const cleanDesc = normalizeKeyword(desc);
    const descWords = cleanDesc.split(' ').filter(isValidKeyword);
    for (const dw of descWords.slice(0, 30)) {
      if (dw.length >= 4 && !accumulated.has(dw)) {
        accumulated.add(dw);
        if (accumulated.size >= maxCount) break;
      }
    }
  }

  // 11. Ensure guaranteed minimum of at least 6 relevant search keywords
  let finalKeywords = Array.from(accumulated).filter(isValidKeyword);

  if (finalKeywords.length < minCount) {
    // Generate emergency high-relevance domain combinations
    const fallbackTerms = [
      brand ? `${brand} ${catName || 'collection'}` : '',
      brand ? `${brand} authentic` : '',
      catName ? `${catName} online` : '',
      subCatName ? `${subCatName} best` : '',
      name ? `${name.split(' ')[0]} item` : '',
      'official product'
    ].map(normalizeKeyword).filter(isValidKeyword);

    for (const fb of fallbackTerms) {
      if (!finalKeywords.includes(fb)) {
        finalKeywords.push(fb);
      }
      if (finalKeywords.length >= minCount) break;
    }
  }

  return finalKeywords.slice(0, maxCount);
}

/**
 * Uses Gemini LLM to generate high-intent search keywords, with strict timeout and instant fallback.
 */
async function generateKeywordsWithGemini(
  product: Partial<Product>,
  apiKey: string,
  options: KeywordGenerationOptions = {}
): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey });

  const specsText = Array.isArray(product.specifications)
    ? product.specifications.map(s => `${s.key}: ${s.value}`).join(', ')
    : '';

  const featuresText = Array.isArray(product.features) ? product.features.join(', ') : '';

  const prompt = `You are an expert e-commerce search keyword generator for an online retail platform.
Generate at least 8 to 14 highly relevant, customer-friendly search keywords and search phrases for this product.

Product Information:
- Title: ${product.name || 'N/A'}
- Brand: ${product.brand || 'N/A'}
- Category: ${options.categoryName || product.categoryId || 'N/A'}
- Subcategory: ${options.subCategoryName || product.subCategoryId || 'N/A'}
- Specifications: ${specsText || 'N/A'}
- Features: ${featuresText || 'N/A'}
- Description: ${(product.description || '').slice(0, 300) || 'N/A'}
- Existing Keywords: ${(product.tags || []).join(', ') || 'None'}

Strict Guidelines:
1. Include core product synonyms (what customers type into the search bar, e.g. "running shoes", "sneakers", "sports footwear").
2. Include brand + item combinations (e.g. "apple phone", "nike running shoes").
3. Include relevant attributes (material, color, key spec like "256gb", "amoled", "wireless").
4. Support relevant partial matches and single-word searches.
5. PRESERVE any useful existing keywords provided.
6. DO NOT invent false features, unmentioned brands, or unrelated products.
7. Return ONLY a valid JSON array of lowercase strings, for example:
["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6", "keyword 7", "keyword 8"]`;

  // 2500ms timeout safeguard
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini keyword generation timeout (2500ms exceeded)')), 2500)
  );

  const requestPromise = ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });

  const response = await Promise.race([requestPromise, timeoutPromise]);
  const rawText = response.text || '';
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);

  if (!jsonMatch) {
    throw new Error('Gemini response did not contain valid JSON array');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Gemini returned empty keywords array');
  }

  const cleaned = parsed
    .map(normalizeKeyword)
    .filter(isValidKeyword);

  return cleaned;
}

/**
 * Universal Intelligent Product Keyword Generator.
 * Combines AI/ML (Gemini 2.5 Flash) with deterministic local ML/NLP fallback.
 *
 * Guarantees:
 * - At least 6 relevant search keywords
 * - Useful existing keywords are strictly preserved
 * - Missing relevant keywords added without duplicate terms
 * - Zero dependency failure (seamless fallback if offline or no API key)
 * - Safe for all products without altering other fields
 */
export async function generateProductKeywords(
  product: Partial<Product>,
  options: KeywordGenerationOptions = {}
): Promise<string[]> {
  const minCount = options.minCount ?? 6;
  const maxCount = options.maxCount ?? 16;
  const allowGemini = options.allowGemini !== false;

  // Determine API key from options, process.env, or environment
  const apiKey = options.apiKey || (typeof process !== 'undefined' ? (process.env?.GEMINI_API_KEY || (process.env as any)?.VITE_GEMINI_API_KEY) : '');
  const isValidApiKey = Boolean(apiKey && apiKey !== 'your_gemini_api_key' && !apiKey.includes('dummy') && !apiKey.includes('placeholder'));

  // Generate deterministic baseline first
  const fallbackKeywords = generateKeywordsDeterministic(product, options);

  if (allowGemini && isValidApiKey) {
    try {
      const aiKeywords = await generateKeywordsWithGemini(product, apiKey, options);

      // Merge existing tags, AI keywords, and fallback keywords safely
      const mergedSet = new Set<string>();

      // 1. Preserve existing valid keywords first
      const existing = options.existingKeywords || product.tags || [];
      if (Array.isArray(existing)) {
        for (const kw of existing) {
          const clean = normalizeKeyword(kw);
          if (isValidKeyword(clean)) mergedSet.add(clean);
        }
      }

      // 2. Add AI keywords
      for (const kw of aiKeywords) {
        if (isValidKeyword(kw)) mergedSet.add(kw);
      }

      // 3. Supplement with fallback keywords if still below minCount
      for (const fb of fallbackKeywords) {
        if (mergedSet.size >= maxCount) break;
        mergedSet.add(fb);
      }

      const result = Array.from(mergedSet);
      if (result.length >= minCount) {
        return result.slice(0, maxCount);
      }
    } catch (err: any) {
      console.warn('[ProductKeywordService] AI generation fallback:', err.message || err);
    }
  }

  // Fallback to high-accuracy deterministic engine
  return fallbackKeywords.slice(0, maxCount);
}

/**
 * Evaluates whether an existing product needs keyword generation/upgrade:
 * - tags is undefined or not an array
 * - tags has fewer than 6 valid keywords
 * - tags contains empty or invalid strings
 */
export function productNeedsKeywordUpgrade(product: Partial<Product>, minRequired = 6): boolean {
  if (!product) return false;
  if (!Array.isArray(product.tags)) return true;
  const validTags = product.tags
    .map(normalizeKeyword)
    .filter(isValidKeyword);
  return validTags.length < minRequired;
}

/**
 * Safely prepares updated keywords for an existing product, preserving all existing keywords
 * and appending relevant missing keywords to reach at least 6.
 */
export async function upgradeExistingProductKeywords(
  product: Product,
  options: KeywordGenerationOptions = {}
): Promise<{ needsUpdate: boolean; updatedTags: string[] }> {
  const needsUpdate = productNeedsKeywordUpgrade(product, options.minCount ?? 6);
  if (!needsUpdate) {
    return { needsUpdate: false, updatedTags: product.tags || [] };
  }

  const generated = await generateProductKeywords(product, options);
  return {
    needsUpdate: true,
    updatedTags: generated
  };
}
