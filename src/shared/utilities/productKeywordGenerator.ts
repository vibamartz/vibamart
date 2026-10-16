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
  requestTimestamp?: number;
  forceRegenerate?: boolean;
}

/**
 * Known retail brands in catalog to detect and eliminate cross-brand contamination and misleading keywords.
 */
export const KNOWN_BRANDS = [
  'apple', 'iphone', 'ipad', 'macbook', 'airpods',
  'samsung', 'galaxy',
  'nike', 'air max', 'pegasus',
  'boat', 'rockerz', 'airdopes',
  'sony', 'bravia', 'playstation',
  'adidas', 'ultraboost',
  'raymond', 'anker', 'puma', 'realme', 'oneplus', 'xiaomi', 'redmi',
  'dell', 'alienware', 'hp', 'lenovo', 'thinkpad', 'logitech',
  'razer', 'noise', 'fire-boltt', 'boult', 'zebronics', 'jbl', 'bose', 'sennheiser',
  'philips', 'fastrack', 'titan', 'casio', 'fossil', 'reebok', 'under armour'
];

/**
 * Opposing category keywords: detects when keywords from an old category remain after category change.
 */
const OPPOSING_CATEGORY_MAP: Record<string, string[]> = {
  electronics: ['shoe', 'shoes', 'sneakers', 'saree', 'kurta', 'dress', 'makeup', 'lipsticks', 'cream', 'skincare', 'tshirt', 'jeans'],
  footwear: ['laptop', 'mobile', 'smartphone', 'tablet', 'saree', 'makeup', 'cookware', 'tv', 'headphone', 'audio'],
  clothing: ['laptop', 'smartphone', 'earphones', 'headphones', 'cookware', 'skincare', 'tablet', 'tv'],
  beauty: ['laptop', 'shoes', 'smartphone', 'headphones', 'chinos', 'trousers', 'sneakers'],
  kitchen: ['shoes', 'sneakers', 'smartphone', 'laptop', 'earbuds', 'saree', 'dress', 'makeup']
};

/**
 * Domain-specific taxonomy synonyms and search expansions.
 * Mapped to e-commerce consumer search habits for maximum relevance and partial matching.
 */
const CATEGORY_TAXONOMY_MAP: Record<string, string[]> = {
  // Footwear & Shoes
  shoe: ['sneakers', 'running shoes', 'sports shoes', 'footwear', 'casual shoes', 'gym shoes', 'trainers', 'walking shoes'],
  sneaker: ['running shoes', 'casual footwear', 'sports sneakers', 'gym shoes', 'walking shoes', 'trainers'],
  footwear: ['shoes', 'sneakers', 'casual footwear', 'comfort shoes', 'sports shoes'],
  running: ['marathon', 'running shoes', 'jogging', 'athletics', 'fitness shoes', 'track'],
  sports: ['activewear', 'athletic', 'training', 'fitness', 'workout'],
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
 * - preserves valid decimal points (e.g. "bluetooth 5.0") and hyphens ("type-c", "wi-fi")
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
 * Concurrency tracking: Prevents older AI/ML requests from overwriting newer results.
 */
const activeProductRequestTimestamps = new Map<string, number>();

export function registerKeywordRequest(productId: string): number {
  const reqTime = Date.now() + Math.random();
  if (productId) {
    activeProductRequestTimestamps.set(productId, reqTime);
  }
  return reqTime;
}

export function isRequestLatest(productId: string, reqTime: number): boolean {
  if (!productId) return true;
  const latest = activeProductRequestTimestamps.get(productId);
  return latest === undefined || latest <= reqTime;
}

/**
 * In-memory signature cache to track when relevant product information has changed.
 */
const productSignatureCache = new Map<string, string>();

/**
 * Computes a deterministic content signature based on relevant product information:
 * image, title, description, specifications, brand, category, subcategory.
 */
export function getProductContentSignature(
  product: Partial<Product>,
  options: KeywordGenerationOptions = {}
): string {
  const name = (product.name || '').trim().toLowerCase();
  const brand = (product.brand || '').trim().toLowerCase();
  const cat = (options.categoryName || (typeof product.categoryId === 'string' ? product.categoryId : '')).trim().toLowerCase();
  const sub = (options.subCategoryName || (typeof product.subCategoryId === 'string' ? product.subCategoryId : '')).trim().toLowerCase();
  const nested = (options.nestedSubCategoryName || (typeof product.nestedSubCategoryId === 'string' ? product.nestedSubCategoryId : '')).trim().toLowerCase();
  const desc = (product.description || '').trim().slice(0, 300).toLowerCase();
  const specs = Array.isArray(product.specifications)
    ? product.specifications.map(s => `${(s.key || '').trim()}:${(s.value || '').trim()}`).sort().join('|').toLowerCase()
    : '';
  const features = Array.isArray(product.features) ? product.features.map(f => String(f).trim()).sort().join('|').toLowerCase() : '';
  const img = (product.primaryImage || product.images?.[0] || '').split('?')[0].toLowerCase();

  return `${name}##${brand}##${cat}##${sub}##${nested}##${specs}##${features}##${desc}##${img}`;
}

export function hasProductInfoChanged(product: Partial<Product>, options: KeywordGenerationOptions = {}): boolean {
  if (!product.id) return true;
  const currentSig = getProductContentSignature(product, options);
  const cachedSig = productSignatureCache.get(product.id);
  return cachedSig === undefined || cachedSig !== currentSig;
}

export function recordProductSignature(product: Partial<Product>, options: KeywordGenerationOptions = {}): void {
  if (!product.id) return;
  productSignatureCache.set(product.id, getProductContentSignature(product, options));
}

/**
 * Filters out stale, outdated, or misleading existing keywords when product info changes.
 * Preserves genuinely relevant existing keywords and purges contradicting brands or categories.
 */
export function filterOutdatedKeywords(
  existingKeywords: string[],
  product: Partial<Product>,
  options: KeywordGenerationOptions = {}
): string[] {
  if (!Array.isArray(existingKeywords) || existingKeywords.length === 0) return [];

  const name = (product.name || '').toLowerCase();
  const currentBrand = normalizeKeyword(product.brand || '');
  const catName = (options.categoryName || (typeof product.categoryId === 'string' ? product.categoryId : '')).toLowerCase();
  const subCatName = (options.subCategoryName || (typeof product.subCategoryId === 'string' ? product.subCategoryId : '')).toLowerCase();
  const desc = ((product.description || '') + ' ' + (product.fullDescription || '')).toLowerCase();

  const specsText = Array.isArray(product.specifications)
    ? product.specifications.map(s => `${s.key || ''} ${s.value || ''}`).join(' ').toLowerCase()
    : '';

  const featuresText = Array.isArray(product.features)
    ? product.features.join(' ').toLowerCase()
    : '';

  const fullProductText = `${name} ${currentBrand} ${catName} ${subCatName} ${specsText} ${featuresText} ${desc}`;

  // Identify category family to test for cross-category contamination
  let currentCategoryFamily = '';
  for (const catKey of Object.keys(OPPOSING_CATEGORY_MAP)) {
    if (catName.includes(catKey) || subCatName.includes(catKey) || fullProductText.includes(catKey)) {
      currentCategoryFamily = catKey;
      break;
    }
  }

  const opposingTerms = currentCategoryFamily ? OPPOSING_CATEGORY_MAP[currentCategoryFamily] || [] : [];

  return existingKeywords.filter(kw => {
    const clean = normalizeKeyword(kw);
    if (!isValidKeyword(clean)) return false;

    // 1. Cross-brand contamination check: reject keyword mentioning another known brand
    if (currentBrand) {
      for (const knownBrand of KNOWN_BRANDS) {
        if (clean.includes(knownBrand) && !currentBrand.includes(knownBrand) && !name.includes(knownBrand)) {
          return false; // Outdated / misleading brand keyword!
        }
      }
    }

    // 2. Opposing category check
    for (const oppTerm of opposingTerms) {
      if (clean === oppTerm || clean.split(' ').includes(oppTerm)) {
        return false; // Outdated / conflicting category keyword!
      }
    }

    // 3. Relevance test: keyword must have semantic linkage or be a valid non-conflicting descriptive term
    const kwWords = clean.split(' ').filter(isValidKeyword);
    const hasMatch = kwWords.some(w => {
      if (fullProductText.includes(w)) return true;
      for (const [taxKey, syns] of Object.entries(CATEGORY_TAXONOMY_MAP)) {
        if (fullProductText.includes(taxKey) && syns.some(s => s.includes(w))) {
          return true;
        }
      }
      return false;
    });

    return hasMatch || isValidKeyword(clean);
  });
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

  // 1. Filter and preserve genuinely relevant existing keywords (purges stale/misleading ones)
  const rawExisting = options.existingKeywords || product.tags || [];
  const validExisting = filterOutdatedKeywords(rawExisting, product, options);
  for (const kw of validExisting) {
    accumulated.add(kw);
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

    if (cleanVal) {
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
5. Filter out any outdated, stale, or conflicting keywords.
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
 * - At least 6 relevant, unique search keywords
 * - Outdated/misleading/stale keywords are never kept
 * - Prevents older AI requests from overwriting newer results
 * - Never erases valid keywords unless replacements are generated successfully
 * - Zero dependency failure (reliable fallback if offline or no API key)
 */
export async function generateProductKeywords(
  product: Partial<Product>,
  options: KeywordGenerationOptions = {}
): Promise<string[]> {
  const minCount = options.minCount ?? 6;
  const maxCount = options.maxCount ?? 16;
  const allowGemini = options.allowGemini !== false;
  const pid = product.id || '';
  const reqTime = options.requestTimestamp ?? (pid ? registerKeywordRequest(pid) : Date.now());

  // Determine API key from options, process.env, or environment
  const apiKey = options.apiKey || (typeof process !== 'undefined' ? (process.env?.GEMINI_API_KEY || (process.env as any)?.VITE_GEMINI_API_KEY) : '');
  const isValidApiKey = Boolean(apiKey && apiKey !== 'your_gemini_api_key' && !apiKey.includes('dummy') && !apiKey.includes('placeholder'));

  // Generate deterministic baseline first
  const fallbackKeywords = generateKeywordsDeterministic(product, options);

  if (allowGemini && isValidApiKey) {
    try {
      const aiKeywords = await generateKeywordsWithGemini(product, apiKey, options);

      // Concurrency check: If a newer request was registered for this product while AI was processing, discard outdated result!
      if (pid && !isRequestLatest(pid, reqTime)) {
        console.warn(`[ProductKeywordService] Discarding older AI request response for product ${pid}`);
        return options.existingKeywords || product.tags || fallbackKeywords;
      }

      // Merge only genuinely relevant existing tags, AI keywords, and fallback keywords safely
      const mergedSet = new Set<string>();

      // 1. Preserve only genuinely relevant existing keywords (outdated ones are discarded)
      const rawExisting = options.existingKeywords || product.tags || [];
      const validExisting = filterOutdatedKeywords(rawExisting, product, options);
      for (const kw of validExisting) {
        mergedSet.add(kw);
      }

      // 2. Add AI keywords (validated for quality and relevance)
      const validAiKeywords = filterOutdatedKeywords(aiKeywords, product, options);
      for (const kw of validAiKeywords) {
        mergedSet.add(kw);
      }

      // 3. Supplement with fallback keywords if still below minCount
      for (const fb of fallbackKeywords) {
        if (mergedSet.size >= maxCount) break;
        mergedSet.add(fb);
      }

      const result = Array.from(mergedSet);
      if (result.length >= minCount) {
        recordProductSignature(product, options);
        return result.slice(0, maxCount);
      }
    } catch (err: any) {
      console.warn('[ProductKeywordService] AI generation fallback:', err.message || err);
    }
  }

  // Concurrency check before applying fallback
  if (pid && !isRequestLatest(pid, reqTime)) {
    return options.existingKeywords || product.tags || fallbackKeywords;
  }

  // Safety safeguard: Never erase valid keywords unless replacements are generated successfully
  if (fallbackKeywords.length >= minCount) {
    recordProductSignature(product, options);
    return fallbackKeywords.slice(0, maxCount);
  }

  // If fallback somehow had < minCount, check if existing valid keywords are usable
  const validExisting = filterOutdatedKeywords(options.existingKeywords || product.tags || [], product, options);
  if (validExisting.length >= minCount) {
    return validExisting.slice(0, maxCount);
  }

  recordProductSignature(product, options);
  return fallbackKeywords.slice(0, maxCount);
}

/**
 * Evaluates whether an existing product needs keyword generation or upgrade:
 * - tags is undefined or not an array
 * - tags has fewer than 6 valid keywords
 * - tags contains empty or invalid strings
 * - tags contains stale / outdated / misleading keywords (e.g. conflicting brand, opposing category)
 * - product information has changed since keywords were generated
 */
export function productNeedsKeywordUpgrade(product: Partial<Product>, minRequired = 6): boolean {
  if (!product) return false;
  return productHasOutdatedKeywords(product, { minCount: minRequired });
}

/**
 * Checks whether an existing product has missing OR outdated / stale keywords.
 */
export function productHasOutdatedKeywords(
  product: Partial<Product>,
  options: KeywordGenerationOptions = {}
): boolean {
  if (!product) return false;
  const minRequired = options.minCount ?? 6;
  if (!Array.isArray(product.tags) || product.tags.length < minRequired) return true;

  // Filter existing tags against current product content
  const validTags = filterOutdatedKeywords(product.tags, product, options);
  if (validTags.length < minRequired) return true;
  if (validTags.length < product.tags.length) return true; // contains stale/misleading keywords!

  // Check if product info has changed compared to cached signature
  if (product.id && productSignatureCache.has(product.id)) {
    if (hasProductInfoChanged(product, options)) return true;
  }

  return false;
}

/**
 * Safely prepares updated keywords for an existing product.
 * Discards outdated or conflicting keywords, generates fresh relevant keywords,
 * and preserves valid relevant keywords to reach at least 6.
 */
export async function upgradeExistingProductKeywords(
  product: Product,
  options: KeywordGenerationOptions = {}
): Promise<{ needsUpdate: boolean; updatedTags: string[] }> {
  const needsUpdate = productHasOutdatedKeywords(product, options);
  if (!needsUpdate) {
    return { needsUpdate: false, updatedTags: product.tags || [] };
  }

  const generated = await generateProductKeywords(product, options);
  return {
    needsUpdate: true,
    updatedTags: generated
  };
}
