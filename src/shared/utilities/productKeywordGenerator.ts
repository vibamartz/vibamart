import { GoogleGenAI } from '@google/genai';
import { Product } from '../types';

export interface KeywordGenerationOptions {
  existingKeywords?: string[];
  previousKeywords?: string[];
  minCount?: number;
  maxCount?: number;
  allowGemini?: boolean;
  apiKey?: string;
  categoryName?: string;
  subCategoryName?: string;
  nestedSubCategoryName?: string;
  isAlternative?: boolean;
  replaceOutdated?: boolean;
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
  'pack', 'combo', 'piece', 'pieces', 'free', 'shipping', 'offer', 'brand', 'price', 'low', 'high', 'rated',
  'official', 'authentic', 'collection', 'deal', 'deals'
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
export function isValidKeyword(kw: string): boolean {
  if (!kw) return false;
  if (kw.length < 2) return false;
  if (STOP_WORDS.has(kw)) return false;
  // If pure digits, skip unless it's a known model year/number
  if (/^\d+$/.test(kw) && kw.length < 3) return false;
  return true;
}

/**
 * Extracts high-relevance search phrases and descriptive terms directly from product descriptions.
 * Uses 2-word, 3-word customer search phrases and salient descriptive attributes.
 */
export function extractDescriptionKeywords(desc: string, maxPhrases = 12): string[] {
  if (!desc || typeof desc !== 'string') return [];
  const clean = normalizeKeyword(desc);
  if (!clean) return [];

  const rawWords = clean.split(' ').filter(w => w.length > 1);
  const phrases = new Set<string>();

  // 1. Extract 2-word collocations where both words are valid keywords
  for (let i = 0; i < rawWords.length - 1; i++) {
    const w1 = rawWords[i];
    const w2 = rawWords[i + 1];
    if (isValidKeyword(w1) && isValidKeyword(w2)) {
      phrases.add(`${w1} ${w2}`);
      if (phrases.size >= maxPhrases) break;
    }
  }

  // 2. Extract 3-word customer search queries (e.g. "active noise cancellation", "built in mic")
  for (let i = 0; i < rawWords.length - 2; i++) {
    const w1 = rawWords[i];
    const w2 = rawWords[i + 1];
    const w3 = rawWords[i + 2];
    if (isValidKeyword(w1) && isValidKeyword(w3) && (isValidKeyword(w2) || ['in', 'with', 'for'].includes(w2))) {
      phrases.add(`${w1} ${w2} ${w3}`);
      if (phrases.size >= maxPhrases + 4) break;
    }
  }

  // 3. Significant descriptive single words (length >= 4, not stop words)
  const singleWords = rawWords.filter(w => isValidKeyword(w) && w.length >= 4);
  for (const sw of singleWords) {
    phrases.add(sw);
    if (phrases.size >= maxPhrases + 8) break;
  }

  return Array.from(phrases);
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
 * Computes a deterministic signature of product information relevant to keyword generation.
 * Any change to title, description, specifications, brand, category, or subcategory changes this signature.
 */
export function computeProductKeywordSignature(product: Partial<Product>): string {
  if (!product) return '';
  const name = (product.name || '').trim().toLowerCase();
  const brand = (product.brand || '').trim().toLowerCase();
  const categoryId = (product.categoryId || '').trim().toLowerCase();
  const subCategoryId = (product.subCategoryId || '').trim().toLowerCase();
  const nestedSubCategoryId = (product.nestedSubCategoryId || '').trim().toLowerCase();
  const desc = ((product.description || '') + ' ' + (product.fullDescription || '')).trim().toLowerCase().slice(0, 600);
  const specs = Array.isArray(product.specifications)
    ? product.specifications.map(s => `${(s.key || '').trim().toLowerCase()}:${(s.value || '').trim().toLowerCase()}`).sort().join(';')
    : '';
  return `${name}::${brand}::${categoryId}::${subCategoryId}::${nestedSubCategoryId}::${desc}::${specs}`;
}

/**
 * Checks whether relevant product information (title, description, specifications, brand, category)
 * has changed between original and current versions.
 */
export function hasProductRelevantInfoChanged(
  current: Partial<Product>,
  original?: Partial<Product> | null
): boolean {
  if (!original) return true;
  return computeProductKeywordSignature(current) !== computeProductKeywordSignature(original);
}

/**
 * Evaluates whether an existing product's keywords are missing, insufficient (< 6),
 * outdated, or contain invalid/hardcoded placeholder keywords.
 */
export function isKeywordOutdatedOrMissing(product: Partial<Product>, minRequired = 6): boolean {
  if (!product) return true;
  if (!Array.isArray(product.tags) || product.tags.length < minRequired) return true;

  const validTags = product.tags
    .map(normalizeKeyword)
    .filter(isValidKeyword);

  if (validTags.length < minRequired) return true;

  // Check for forbidden generic or hardcoded filler keywords
  const FORBIDDEN_JUNK = new Set(['official product', 'authentic', 'collection', 'item', 'best online', 'product']);
  if (validTags.some(t => FORBIDDEN_JUNK.has(t))) {
    return true;
  }

  // Check for semantic alignment with current product:
  // If ALL tags are completely disconnected from the product title, brand, category, and description,
  // the tags are outdated from a previous product version/edit and must be regenerated.
  const fullText = normalizeKeyword(
    `${product.name || ''} ${product.brand || ''} ${product.categoryId || ''} ${product.subCategoryId || ''} ${product.description || ''}`
  );
  const contextWords = new Set(fullText.split(' ').filter(isValidKeyword));

  if (contextWords.size > 0) {
    let matchCount = 0;
    for (const tag of validTags) {
      const tagWords = tag.split(' ').filter(isValidKeyword);
      if (tagWords.some(tw => contextWords.has(tw))) {
        matchCount++;
      }
    }
    if (matchCount === 0) {
      return true;
    }
  }

  return false;
}

/**
 * Backward compatibility alias for productNeedsKeywordUpgrade.
 */
export function productNeedsKeywordUpgrade(product: Partial<Product>, minRequired = 6): boolean {
  return isKeywordOutdatedOrMissing(product, minRequired);
}

/**
 * Deterministic ML/NLP Keyword Extraction Fallback Engine.
 * Operates purely locally with 0ms network latency.
 * Guarantees at least 6 high-relevance search keywords for any product using title,
 * description, specifications, brand, category, and subcategory.
 */
export function generateKeywordsDeterministic(
  product: Partial<Product>,
  options: KeywordGenerationOptions = {}
): string[] {
  const minCount = options.minCount ?? 6;
  const maxCount = options.maxCount ?? 16;
  const isAlternative = Boolean(options.isAlternative);
  const replaceOutdated = Boolean(options.replaceOutdated || options.isAlternative);
  const accumulated = new Set<string>();

  const previousList = options.previousKeywords || (Array.isArray(product.tags) ? product.tags : []);
  const previousSet = new Set(previousList.map(normalizeKeyword).filter(isValidKeyword));

  // If NOT replacing outdated / NOT alternative mode, preserve existing valid keywords first
  if (!replaceOutdated) {
    const existing = options.existingKeywords || product.tags || [];
    if (Array.isArray(existing)) {
      for (const kw of existing) {
        const clean = normalizeKeyword(kw);
        if (isValidKeyword(clean)) {
          accumulated.add(clean);
        }
      }
    }
  }

  const name = (product.name || '').trim();
  const brand = (product.brand || '').trim();
  const desc = ((product.description || '') + ' ' + (product.fullDescription || '')).trim();
  const catName = options.categoryName || (typeof product.categoryId === 'string' ? product.categoryId : '');
  const subCatName = options.subCategoryName || (typeof product.subCategoryId === 'string' ? product.subCategoryId : '');
  const nestedCatName = options.nestedSubCategoryName || (typeof product.nestedSubCategoryId === 'string' ? product.nestedSubCategoryId : '');

  // 1. Brand Keywords
  const brandList: string[] = [];
  if (brand) {
    const cleanBrand = normalizeKeyword(brand);
    if (isValidKeyword(cleanBrand)) {
      brandList.push(cleanBrand);
      if (catName) brandList.push(normalizeKeyword(`${cleanBrand} ${catName}`));
      if (subCatName) brandList.push(normalizeKeyword(`${cleanBrand} ${subCatName}`));
    }
  }

  // 2. Title Terms
  const titleList: string[] = [];
  if (name) {
    const cleanTitle = normalizeKeyword(name);
    const titleWords = cleanTitle.split(' ').filter(isValidKeyword);

    if (titleWords.length > 0 && titleWords.length <= 4) {
      titleList.push(cleanTitle);
    }
    // Title unigrams
    for (const word of titleWords) {
      titleList.push(word);
    }
    // Bigrams
    for (let i = 0; i < titleWords.length - 1; i++) {
      titleList.push(`${titleWords[i]} ${titleWords[i + 1]}`);
    }
    // 3-word phrase if >= 3 words
    if (titleWords.length >= 3) {
      titleList.push(`${titleWords[0]} ${titleWords[1]} ${titleWords[2]}`);
    }
    // Brand + primary title noun
    if (brand && titleWords.length > 0) {
      const primaryTitleNoun = titleWords.find(w => w !== brand.toLowerCase()) || titleWords[0];
      if (primaryTitleNoun) {
        titleList.push(normalizeKeyword(`${brand} ${primaryTitleNoun}`));
      }
    }
  }

  // 3. Category & Hierarchy terms
  const catList: string[] = [];
  const hierarchyTerms = [catName, subCatName, nestedCatName].filter(Boolean);
  for (const hTerm of hierarchyTerms) {
    const cleanH = normalizeKeyword(hTerm);
    if (isValidKeyword(cleanH)) {
      catList.push(cleanH);
      cleanH.split(' ').filter(isValidKeyword).forEach(w => catList.push(w));
    }
  }

  // 4. Description Key Phrases & Salient Noun Collocations
  const descList: string[] = [];
  if (desc) {
    const descKeywords = extractDescriptionKeywords(desc, 14);
    for (const dk of descKeywords) {
      const cleanDk = normalizeKeyword(dk);
      if (isValidKeyword(cleanDk)) {
        if (isAlternative && previousSet.has(cleanDk) && descKeywords.length > 6) {
          continue;
        }
        descList.push(cleanDk);
      }
    }
  }

  // 5. Taxonomy Synonyms & Search Intents
  const taxonomyList: string[] = [];
  const fullContextText = `${name} ${brand} ${catName} ${subCatName} ${nestedCatName} ${desc}`.toLowerCase();
  for (const [key, synonyms] of Object.entries(CATEGORY_TAXONOMY_MAP)) {
    const keyRegex = new RegExp(`\\b${key}\\b`, 'i');
    if (keyRegex.test(fullContextText)) {
      const synList = isAlternative ? [...synonyms].reverse() : synonyms;
      for (const syn of synList) {
        const cleanSyn = normalizeKeyword(syn);
        if (isValidKeyword(cleanSyn)) {
          if (isAlternative && previousSet.has(cleanSyn)) {
            continue;
          }
          taxonomyList.push(cleanSyn);
        }
      }
    }
  }

  // 6. Specifications Key-Value Attributes
  const specList: string[] = [];
  const specs = Array.isArray(product.specifications) ? product.specifications : [];
  for (const spec of specs) {
    if (!spec || !spec.value) continue;
    const cleanVal = normalizeKeyword(spec.value);
    const cleanKey = normalizeKeyword(spec.key || '');

    if (cleanVal && cleanVal.length <= 25) {
      specList.push(cleanVal);
      if (cleanKey && cleanVal.length <= 15) {
        specList.push(normalizeKeyword(`${cleanVal} ${cleanKey}`));
      }
    }
  }

  // Interleave sources into accumulated set so that Description and Specifications
  // are never crowded out by long titles
  for (const b of brandList.slice(0, 2)) accumulated.add(b);
  for (const t of titleList.slice(0, 4)) accumulated.add(t);
  for (const d of descList.slice(0, 4)) accumulated.add(d);
  for (const syn of taxonomyList.slice(0, 3)) accumulated.add(syn);
  for (const s of specList.slice(0, 3)) accumulated.add(s);
  for (const c of catList.slice(0, 2)) accumulated.add(c);

  // Fill remaining slots
  for (const d of descList) { if (accumulated.size >= maxCount) break; accumulated.add(d); }
  for (const t of titleList) { if (accumulated.size >= maxCount) break; accumulated.add(t); }
  for (const syn of taxonomyList) { if (accumulated.size >= maxCount) break; accumulated.add(syn); }
  for (const s of specList) { if (accumulated.size >= maxCount) break; accumulated.add(s); }
  for (const b of brandList) { if (accumulated.size >= maxCount) break; accumulated.add(b); }
  for (const c of catList) { if (accumulated.size >= maxCount) break; accumulated.add(c); }

  // Variant specifications
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

  // 10. Filter and format final keywords
  let finalKeywords = Array.from(accumulated).filter(isValidKeyword);

  // If in alternative mode, prioritize keywords that differ from previousKeywords
  if (isAlternative && previousSet.size > 0) {
    const novel = finalKeywords.filter(k => !previousSet.has(k));
    const repeated = finalKeywords.filter(k => previousSet.has(k));
    finalKeywords = [...novel, ...repeated];
  }

  // 11. Ensure guaranteed minimum of at least 6 relevant search keywords
  // NEVER use hardcoded marketing filler like 'official product' or 'authentic'.
  // Combine genuine product attributes from title, description, brand, category, specs.
  if (finalKeywords.length < minCount) {
    const titleWords = name ? normalizeKeyword(name).split(' ').filter(isValidKeyword) : [];
    const descWords = desc ? normalizeKeyword(desc).split(' ').filter(isValidKeyword) : [];

    const organicFallbacks: string[] = [];

    if (brand && catName) organicFallbacks.push(`${brand} ${catName}`);
    if (brand && subCatName) organicFallbacks.push(`${brand} ${subCatName}`);
    if (titleWords.length > 0 && catName) organicFallbacks.push(`${titleWords[0]} ${catName}`);
    if (titleWords.length > 1) organicFallbacks.push(`${titleWords[0]} ${titleWords[1]}`);
    if (brand && titleWords.length > 0) organicFallbacks.push(`${brand} ${titleWords[0]}`);
    if (descWords.length > 0 && catName) organicFallbacks.push(`${descWords[0]} ${catName}`);
    if (descWords.length > 1) organicFallbacks.push(`${descWords[0]} ${descWords[1]}`);

    for (const fb of organicFallbacks.map(normalizeKeyword).filter(isValidKeyword)) {
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
  const descText = ((product.description || '') + ' ' + (product.fullDescription || '')).slice(0, 600);
  const previousList = options.previousKeywords || (Array.isArray(product.tags) ? product.tags : []);

  let taskInstruction = `Generate at least 8 to 14 highly relevant, unique customer-friendly search keywords and search phrases for this product.
Carefully use both the product title AND product description to identify what real customers type into an e-commerce search bar.`;

  if (options.isAlternative) {
    taskInstruction = `The store administrator requested NEW ALTERNATIVE keywords for this product.
Generate a fresh, alternative set of at least 8 to 14 high-relevance search keywords, customer search queries, and feature phrases based on the latest title, description, specifications, brand, and category.
Provide alternative synonyms, descriptive angles, and phrasing distinct from or improving upon the previous keywords: [${previousList.slice(0, 15).join(', ')}].`;
  }

  const prompt = `You are an expert e-commerce search engine keyword optimizer for an online retail platform.
${taskInstruction}

Product Information:
- Title: ${product.name || 'N/A'}
- Brand: ${product.brand || 'N/A'}
- Category: ${options.categoryName || product.categoryId || 'N/A'}
- Subcategory: ${options.subCategoryName || product.subCategoryId || 'N/A'}
- Specifications: ${specsText || 'N/A'}
- Features: ${featuresText || 'N/A'}
- Description: ${descText || 'N/A'}
- Previous Keywords: ${previousList.join(', ') || 'None'}

Strict Guidelines:
1. Include core product synonyms and shopper intent queries (e.g. "running shoes", "sneakers", "sports footwear").
2. Include brand + item combinations (e.g. "boat headphones", "nike running shoes").
3. Include salient attributes and features from the description and specifications (e.g. "wireless earphones", "active noise cancellation", "fast charging", "cotton blend").
4. NEVER invent fake brands, unmentioned specifications, or unrelated categories.
5. NEVER include generic marketing filler or hardcoded placeholder words (e.g. "official product", "item", "authentic", "best online").
6. Return ONLY a valid JSON array of lowercase strings, for example:
["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6", "keyword 7", "keyword 8"]`;

  // 3500ms timeout safeguard
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini keyword generation timeout (3500ms exceeded)')), 3500)
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
 * - Uses Title, Description, Specifications, Brand, Category, Subcategory
 * - When clicking "AI Auto Keyword" or regenerating: replaces outdated keywords with fresh alternatives
 * - Never generates irrelevant, misleading, hardcoded, or duplicate keywords
 * - Reliable title-and-description-based fallback on AI failure
 * - Never erases valid keywords unless replacements are generated successfully
 */
export async function generateProductKeywords(
  product: Partial<Product>,
  options: KeywordGenerationOptions = {}
): Promise<string[]> {
  const minCount = options.minCount ?? 6;
  const maxCount = options.maxCount ?? 16;
  const allowGemini = options.allowGemini !== false;
  const isAlternative = Boolean(options.isAlternative);
  const replaceOutdated = Boolean(options.replaceOutdated || options.isAlternative);

  const apiKey = options.apiKey || (typeof process !== 'undefined' ? (process.env?.GEMINI_API_KEY || (process.env as any)?.VITE_GEMINI_API_KEY) : '');
  const isValidApiKey = Boolean(apiKey && apiKey !== 'your_gemini_api_key' && !apiKey.includes('dummy') && !apiKey.includes('placeholder'));

  // Always compute deterministic fallback keywords (based on title, description, brand, category, specs)
  const fallbackKeywords = generateKeywordsDeterministic(product, options);

  if (allowGemini && isValidApiKey) {
    try {
      const aiKeywords = await generateKeywordsWithGemini(product, apiKey, options);

      const mergedSet = new Set<string>();

      // In alternative or replaceOutdated mode, replace outdated keywords with newly generated ones
      if (!replaceOutdated) {
        const existing = options.existingKeywords || product.tags || [];
        if (Array.isArray(existing)) {
          for (const kw of existing) {
            const clean = normalizeKeyword(kw);
            if (isValidKeyword(clean)) mergedSet.add(clean);
          }
        }
      }

      // Add AI generated keywords
      for (const kw of aiKeywords) {
        if (isValidKeyword(kw)) mergedSet.add(kw);
      }

      // Supplement with fallback keywords if still below minCount
      for (const fb of fallbackKeywords) {
        if (mergedSet.size >= maxCount) break;
        mergedSet.add(fb);
      }

      const result = Array.from(mergedSet);
      if (result.length >= minCount) {
        return result.slice(0, maxCount);
      }
    } catch (err: any) {
      const errMsg = err?.message || (typeof err === 'string' ? err : 'AI service unavailable');
      console.warn('[ProductKeywordService] AI generation fallback:', errMsg.length > 120 ? errMsg.slice(0, 120) + '...' : errMsg);
    }
  }

  // AI failed or disabled — use the reliable title-and-description-based fallback
  if (fallbackKeywords.length >= minCount) {
    return fallbackKeywords.slice(0, maxCount);
  }

  // Safety: Never erase valid keywords unless replacements are generated successfully
  const previousList = options.previousKeywords || (Array.isArray(product.tags) ? product.tags : []);
  const validPrevious = previousList.map(normalizeKeyword).filter(isValidKeyword);
  if (validPrevious.length >= minCount) {
    return validPrevious.slice(0, maxCount);
  }

  return fallbackKeywords.slice(0, maxCount);
}

/**
 * Safely prepares updated keywords for an existing product.
 * If product has missing or outdated keywords, generates fresh keywords replacing outdated ones.
 */
export async function upgradeExistingProductKeywords(
  product: Product,
  options: KeywordGenerationOptions = {}
): Promise<{ needsUpdate: boolean; updatedTags: string[] }> {
  const needsUpdate = isKeywordOutdatedOrMissing(product, options.minCount ?? 6);
  if (!needsUpdate) {
    return { needsUpdate: false, updatedTags: product.tags || [] };
  }

  const generated = await generateProductKeywords(product, {
    ...options,
    replaceOutdated: true,
    previousKeywords: product.tags || []
  });

  if (generated.length >= (options.minCount ?? 6)) {
    return {
      needsUpdate: true,
      updatedTags: generated
    };
  }

  return {
    needsUpdate: false,
    updatedTags: product.tags || []
  };
}
