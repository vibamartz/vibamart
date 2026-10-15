import { GoogleGenAI } from '@google/genai';
import { SemanticIntentData } from './searchTypes';

export interface ParsedSemanticIntent extends SemanticIntentData {
  originalQuery: string;
  isNaturalLanguage: boolean;
  confidence: number;
}

// In-memory cache for semantic query parsing results
const intentCache = new Map<string, ParsedSemanticIntent>();
const MAX_CACHE_SIZE = 300;

export const KNOWN_COLORS = [
  'black', 'white', 'blue', 'red', 'green', 'yellow',
  'pink', 'purple', 'grey', 'gray', 'silver', 'gold',
  'brown', 'orange', 'navy', 'beige', 'maroon', 'teal', 'olive'
];

/**
 * Fast Rule-Based Natural Language Intent Parser
 * Operates in < 0.2ms with zero external network dependencies.
 */
export function parseIntentRuleBased(query: string): ParsedSemanticIntent {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    return {
      originalQuery: query,
      cleanKeyword: '',
      detectedFilters: {},
      semanticTags: [],
      source: 'rule_based',
      isNaturalLanguage: false,
      confidence: 1.0
    };
  }

  // Normalize numbers with commas like "1,500" or "15,000" into "1500", "15000"
  let text = trimmed.toLowerCase().replace(/(?<=\d),(?=\d)/g, '');
  const detectedFilters: Record<string, any> = {};
  const semanticTags: string[] = [];
  let isNaturalLanguage = false;

  // 1. Price Range: "between X and Y", "from X to Y", "X to Y"
  const rangeMatch = text.match(/\b(?:between|from)\s+(?:₹|rs\.?|inr)?\s*(\d+)\s*(?:and|to|-)\s*(?:₹|rs\.?|inr)?\s*(\d+)\b/i) ||
                     text.match(/\b(?:₹|rs\.?|inr)?\s*(\d+)\s*(?:to|-)\s*(?:₹|rs\.?|inr)?\s*(\d+)\b/i);
  if (rangeMatch) {
    const p1 = Number(rangeMatch[1]);
    const p2 = Number(rangeMatch[2]);
    if (p1 <= p2) {
      detectedFilters.minPrice = p1;
      detectedFilters.maxPrice = p2;
    } else {
      // Reject contradictory range
      detectedFilters.invalidPriceRange = true;
    }
    text = text.replace(rangeMatch[0], ' ');
    isNaturalLanguage = true;
  } else {
    // Under / below / less than / up to / maximum / max / <= / < X
    const underMatch = text.match(/\b(?:under|below|less\s+than|up\s*to|upto|maximum|max|<=|<)\s*(?:₹|rs\.?|inr)?\s*(\d+)\b/i);
    if (underMatch) {
      detectedFilters.maxPrice = Number(underMatch[1]);
      text = text.replace(underMatch[0], ' ');
      isNaturalLanguage = true;
    }

    // Above / over / more than / at least / minimum / min / >= / > X
    const aboveMatch = text.match(/\b(?:above|over|more\s+than|at\s+least|minimum|min|>=|>)\s*(?:₹|rs\.?|inr)?\s*(\d+)\b/i);
    if (aboveMatch) {
      detectedFilters.minPrice = Number(aboveMatch[1]);
      text = text.replace(aboveMatch[0], ' ');
      isNaturalLanguage = true;
    }

    // Exact price: "priced at X", "price X", "at ₹X"
    const exactPriceMatch = text.match(/\b(?:priced\s+at|price\s+(?:is|=)?\s*(?:₹|rs\.?|inr)?|at\s+(?:₹|rs\.?|inr))\s*(\d+)\b/i);
    if (exactPriceMatch) {
      const targetPrice = Number(exactPriceMatch[1]);
      detectedFilters.minPrice = Math.max(0, Math.floor(targetPrice * 0.95));
      detectedFilters.maxPrice = Math.ceil(targetPrice * 1.05);
      detectedFilters.exactPrice = targetPrice;
      text = text.replace(exactPriceMatch[0], ' ');
      isNaturalLanguage = true;
    }
  }

  // 2. Discount Intent: "discounted", "on sale", "X% off", "above X% discount", "min X% discount"
  if (/\b(?:discounted|on\s+sale|with\s+discount)\b/i.test(text)) {
    detectedFilters.minDiscount = 1;
    text = text.replace(/\b(?:discounted|on\s+sale|with\s+discount)\b/gi, ' ');
    isNaturalLanguage = true;
  }
  const discountMatch = text.match(/\b(?:at\s+least|above|over|min(?:imum)?\s+)?(\d+)\s*%\s*(?:off|discount)?\b/i);
  if (discountMatch) {
    detectedFilters.minDiscount = Number(discountMatch[1]);
    text = text.replace(discountMatch[0], ' ');
    isNaturalLanguage = true;
  }

  // 3. Size Extraction: "size 7", "size M", "size XL", "sz 8"
  const sizeMatch = text.match(/\b(?:size|sz)\s*:?\s*([a-z0-9]+)\b/i);
  if (sizeMatch) {
    detectedFilters.size = sizeMatch[1].toLowerCase();
    text = text.replace(sizeMatch[0], ' ');
    isNaturalLanguage = true;
  }

  // 4. Rating Intent: "4 stars and above", "rating above 4"
  const ratingMatch = text.match(/\b(?:rated|rating)\s*(?:above|over|>=|>)?\s*(\d(?:\.\d)?)\b/i) ||
                      text.match(/\b(\d)\s*stars?(?:\s*(?:and\s+above|\+))?\b/i);
  if (ratingMatch) {
    detectedFilters.minRating = Number(ratingMatch[1]);
    text = text.replace(ratingMatch[0], ' ');
    isNaturalLanguage = true;
  }

  // 5. Sorting Intent
  if (/\b(?:cheapest|cheap|budget|lowest\s+price|affordable|sasta|saste|sabse\s+sasta|kam\s+daam|kam\s+budget)\b/i.test(text)) {
    detectedFilters.sortBy = 'price-asc';
    text = text.replace(/\b(?:cheapest|cheap|budget|lowest\s+price|affordable|sasta|saste|sabse\s+sasta|kam\s+daam|kam\s+budget)\b/gi, ' ');
    isNaturalLanguage = true;
  } else if (/\b(?:expensive|luxury|premium|high-end|mehenga|mehnge|badiya)\b/i.test(text)) {
    detectedFilters.sortBy = 'price-desc';
    text = text.replace(/\b(?:expensive|luxury|premium|high-end|mehenga|mehnge|badiya)\b/gi, ' ');
    isNaturalLanguage = true;
  } else if (/\b(?:best\s+rated|top\s+rated|highest\s+rated|popular)\b/i.test(text)) {
    detectedFilters.sortBy = 'rating';
    text = text.replace(/\b(?:best\s+rated|top\s+rated|highest\s+rated|popular)\b/gi, ' ');
    isNaturalLanguage = true;
  } else if (/\b(?:newest|latest|new\s+arrivals?)\b/i.test(text)) {
    detectedFilters.sortBy = 'newest';
    text = text.replace(/\b(?:newest|latest|new\s+arrivals?)\b/gi, ' ');
    isNaturalLanguage = true;
  }

  // 6. Stock Intent
  if (/\b(?:in\s*stock|available\s*now)\b/i.test(text)) {
    detectedFilters.inStock = true;
    text = text.replace(/\b(?:in\s*stock|available\s*now)\b/gi, ' ');
    isNaturalLanguage = true;
  }

  // 7. Color Extraction
  for (const c of KNOWN_COLORS) {
    const colorRegex = new RegExp(`\\b${c}\\b`, 'i');
    if (colorRegex.test(text)) {
      detectedFilters.color = c;
      semanticTags.push(c);
      text = text.replace(colorRegex, ' ');
      break;
    }
  }

  // 8. Gender / Target Audience
  if (/\b(?:for\s+men|men'?s|mens|ladko\s+(?:ke\s+liye|ke)?|purush)\b/i.test(text)) {
    detectedFilters.gender = 'men';
    semanticTags.push('men');
    text = text.replace(/\b(?:for\s+men|men'?s|mens|ladko\s+(?:ke\s+liye|ke)?|purush)\b/gi, ' ');
    isNaturalLanguage = true;
  } else if (/\b(?:for\s+women|women'?s|womens|ladies|ladkiyo\s+(?:ke\s+liye|ke)?|mahila|aurat)\b/i.test(text)) {
    detectedFilters.gender = 'women';
    semanticTags.push('women');
    text = text.replace(/\b(?:for\s+women|women'?s|womens|ladies|ladkiyo\s+(?:ke\s+liye|ke)?|mahila|aurat)\b/gi, ' ');
    isNaturalLanguage = true;
  } else if (/\b(?:for\s+kids?|children|boys?|girls?|bacho\s+(?:ke\s+liye|ke)?|chote\s+bacho\s+(?:ke\s+liye|ke)?)\b/i.test(text)) {
    detectedFilters.gender = 'kids';
    semanticTags.push('kids');
    text = text.replace(/\b(?:for\s+kids?|children|boys?|girls?|bacho\s+(?:ke\s+liye|ke)?|chote\s+bacho\s+(?:ke\s+liye|ke)?)\b/gi, ' ');
    isNaturalLanguage = true;
  }

  // 8b. Brand Detection
  const KNOWN_BRANDS = [
    'samsung', 'apple', 'nike', 'sony', 'dell', 'hp', 'boat', 'raymond',
    'xiaomi', 'redmi', 'puma', 'adidas', 'lenovo', 'asus', 'acer',
    'realme', 'oneplus', 'oppo', 'vivo', 'wow', 'jootiyapa'
  ];
  for (const b of KNOWN_BRANDS) {
    const brandRegex = new RegExp(`\\b${b}\\b`, 'i');
    if (brandRegex.test(text)) {
      detectedFilters.brand = b.charAt(0).toUpperCase() + b.slice(1);
      if (!semanticTags.includes(b)) semanticTags.push(b);
      break;
    }
  }

  // Handle Apple / iPhone specific binding
  if (/\b(?:iphones?)\b/i.test(text)) {
    detectedFilters.brand = 'Apple';
    if (!semanticTags.includes('iphone')) semanticTags.push('iphone');
    if (!semanticTags.includes('apple')) semanticTags.push('apple');
    detectedFilters.category = 'mobile phones';
  }

  // 9. Standard Category Intent Detection
  if (/\b(?:kurtis?|kurtas?|ladies\s+kurti)\b/i.test(text)) {
    detectedFilters.category = 'kurtis';
  } else if (/\b(?:t-?shirts?|tshrts?|tees?)\b/i.test(text)) {
    detectedFilters.category = 't-shirts';
  } else if (/\b(?:shirts?)\b/i.test(text)) {
    detectedFilters.category = 'shirts';
  } else if (/\b(?:shoes?|sneakers?|footwears?|joota|joote|chappal)\b/i.test(text)) {
    detectedFilters.category = 'shoes';
  } else if (/\b(?:mobile\s*phones?|smartphones?|mobiles?|cellphones?)\b/i.test(text)) {
    detectedFilters.category = 'mobile phones';
  } else if (/\b(?:dress(?:es)?|frocks?|gowns?)\b/i.test(text)) {
    detectedFilters.category = 'dresses';
  } else if (/\b(?:sarees?|saris?)\b/i.test(text)) {
    detectedFilters.category = 'sarees';
  } else if (/\b(?:smart\s*watch(?:es)?|watch(?:es)?)\b/i.test(text)) {
    detectedFilters.category = 'watches';
  } else if (/\b(?:headphones?|earbuds?|earphones?|audio)\b/i.test(text)) {
    detectedFilters.category = 'audio';
  } else if (/\b(?:perfumes?|fragrances?|deodorants?|deos?|colognes?)\b/i.test(text)) {
    detectedFilters.category = 'perfume';
  } else if (/\b(?:jeans|denims?|trousers?|pants?)\b/i.test(text)) {
    detectedFilters.category = 'jeans';
  } else if (/\b(?:accessories|fashion\s+accessories|handbags?|wallets?)\b/i.test(text)) {
    detectedFilters.category = 'accessories';
  } else if (/\b(?:mou(?:se|ses)|mice|optical\s+mouse|gaming\s+mouse|wireless\s+mouse)\b/i.test(text)) {
    detectedFilters.category = 'mouse';
  } else if (/\b(?:laptops?|notebooks?|macbooks?)\b/i.test(text)) {
    detectedFilters.category = 'laptops';
  } else if (/\b(?:keyboards?)\b/i.test(text)) {
    detectedFilters.category = 'keyboards';
  }

  // 10. Common Activity / Intent tags
  const intentKeywords: Record<string, string> = {
    running: 'running',
    jogging: 'running',
    gym: 'fitness',
    workout: 'fitness',
    gaming: 'gaming',
    formal: 'formal',
    office: 'formal',
    casual: 'casual',
    party: 'party',
    summer: 'summer',
    winter: 'winter',
    wireless: 'wireless',
    bluetooth: 'wireless',
    cotton: 'cotton',
    denim: 'denim',
    leather: 'leather'
  };

  for (const [kw, tag] of Object.entries(intentKeywords)) {
    const kwRegex = new RegExp(`\\b${kw}\\b`, 'i');
    if (kwRegex.test(text)) {
      if (!semanticTags.includes(tag)) semanticTags.push(tag);
      isNaturalLanguage = true;
    }
  }

  // 11. Clean residual keyword
  // Remove filler conversational words like: "i want", "looking for", "show me", "good", "best", "give me", "buy", "priced", "branded", "latest"
  const cleaned = text
    .replace(/\b(?:i\s+want|looking\s+for|show\s+me|find|search\s+for|give\s+me|buy|need|please|with|in|of|the|a|an|good|great|for|priced|costing|rated|branded|latest|discounted)\b/gi, ' ')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    originalQuery: query,
    cleanKeyword: cleaned || trimmed,
    detectedFilters,
    semanticTags,
    source: 'rule_based',
    isNaturalLanguage,
    confidence: isNaturalLanguage ? 0.9 : 0.6
  };
}

/**
 * Gemini LLM Intent Parser with strict 350ms timeout & instant rule-based fallback
 */
async function parseIntentWithGemini(query: string, apiKey: string): Promise<ParsedSemanticIntent> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are an e-commerce search intent parser.
Given the customer query: "${query}"
Extract search intent as clean JSON with these exact fields:
{
  "cleanKeyword": "core product keyword without price, colors, or conversational noise",
  "category": "category name or null",
  "maxPrice": number or null,
  "minPrice": number or null,
  "minDiscount": number or null,
  "size": "size string or null",
  "color": "color string or null",
  "brand": "brand name or null",
  "gender": "men|women|kids or null",
  "sortBy": "price-asc|price-desc|rating|newest or null",
  "semanticTags": ["array of 1-4 descriptive keywords"]
}
Only output the JSON object, nothing else.`;

  // Strict 350ms timeout
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini intent parsing timeout (350ms exceeded)')), 350)
  );

  const requestPromise = ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });

  const response = await Promise.race([requestPromise, timeoutPromise]);
  const rawText = response.text || '';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Gemini response did not contain valid JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const detectedFilters: Record<string, any> = {};

  if (typeof parsed.maxPrice === 'number') detectedFilters.maxPrice = parsed.maxPrice;
  if (typeof parsed.minPrice === 'number') detectedFilters.minPrice = parsed.minPrice;
  if (typeof parsed.minDiscount === 'number') detectedFilters.minDiscount = parsed.minDiscount;
  if (parsed.size) detectedFilters.size = String(parsed.size).toLowerCase();
  if (parsed.category) detectedFilters.category = String(parsed.category).toLowerCase();
  if (parsed.color) detectedFilters.color = String(parsed.color).toLowerCase();
  if (parsed.brand) detectedFilters.brand = String(parsed.brand);
  if (parsed.gender) detectedFilters.gender = String(parsed.gender).toLowerCase();
  if (parsed.sortBy) detectedFilters.sortBy = parsed.sortBy;

  return {
    originalQuery: query,
    cleanKeyword: parsed.cleanKeyword || query,
    detectedFilters,
    semanticTags: Array.isArray(parsed.semanticTags) ? parsed.semanticTags : [],
    source: 'gemini',
    isNaturalLanguage: true,
    confidence: 0.95
  };
}

/**
 * Main Semantic Query Intent Parser
 * Combines in-memory cache, optional Gemini AI with 350ms timeout, and instant rule-based fallback.
 */
export async function parseQueryIntent(query: string, allowGemini = true): Promise<ParsedSemanticIntent> {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    return parseIntentRuleBased(query);
  }

  const cacheKey = trimmed.toLowerCase();
  const cached = intentCache.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  // Fast check: is this a natural language query?
  const isConversational = /\b(?:under|below|above|between|for\s+(?:men|women|kids)|cheap|best|looking\s+for|with|in\s*stock)\b/i.test(trimmed);

  const apiKey = process.env.GEMINI_API_KEY;

  if (allowGemini && apiKey && isConversational) {
    try {
      const geminiResult = await parseIntentWithGemini(trimmed, apiKey);
      if (intentCache.size >= MAX_CACHE_SIZE) {
        intentCache.delete(intentCache.keys().next().value!);
      }
      intentCache.set(cacheKey, geminiResult);
      return geminiResult;
    } catch (err: any) {
      // Graceful instant fallback to rule-based engine
      // console.warn('[SemanticSearch] Gemini parsing fallback:', err.message);
    }
  }

  // Rule-based engine
  const ruleResult = parseIntentRuleBased(trimmed);
  if (intentCache.size >= MAX_CACHE_SIZE) {
    intentCache.delete(intentCache.keys().next().value!);
  }
  intentCache.set(cacheKey, ruleResult);
  return ruleResult;
}

/**
 * Get status of AI search engine
 */
export function getSemanticSearchStatus() {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  return {
    enabled: true,
    provider: hasGeminiKey ? 'Gemini 2.5 Flash + Rule-Based Hybrid' : 'Deterministic Rule-Based Natural Language Engine',
    hasApiKey: hasGeminiKey,
    cachedIntentsCount: intentCache.size,
    latencyBudgetMs: 350
  };
}
