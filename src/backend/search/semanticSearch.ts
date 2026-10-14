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

const KNOWN_COLORS = [
  'black', 'white', 'blue', 'red', 'green', 'yellow',
  'pink', 'purple', 'grey', 'gray', 'silver', 'gold',
  'brown', 'orange', 'navy', 'beige', 'maroon'
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

  let text = trimmed.toLowerCase();
  const detectedFilters: Record<string, any> = {};
  const semanticTags: string[] = [];
  let isNaturalLanguage = false;

  // 1. Price Range: "between X and Y" or "X to Y"
  const rangeMatch = text.match(/\b(?:between\s+)?(?:₹|rs\.?|inr)?\s*(\d+)\s*(?:and|to|-)\s*(?:₹|rs\.?|inr)?\s*(\d+)\b/i);
  if (rangeMatch) {
    detectedFilters.minPrice = Number(rangeMatch[1]);
    detectedFilters.maxPrice = Number(rangeMatch[2]);
    text = text.replace(rangeMatch[0], ' ');
    isNaturalLanguage = true;
  } else {
    // Under / below / less than X
    const underMatch = text.match(/\b(?:under|below|less\s+than|<)\s*(?:₹|rs\.?|inr)?\s*(\d+)\b/i);
    if (underMatch) {
      detectedFilters.maxPrice = Number(underMatch[1]);
      text = text.replace(underMatch[0], ' ');
      isNaturalLanguage = true;
    }

    // Above / over / more than X
    const aboveMatch = text.match(/\b(?:above|over|more\s+than|>)\s*(?:₹|rs\.?|inr)?\s*(\d+)\b/i);
    if (aboveMatch) {
      detectedFilters.minPrice = Number(aboveMatch[1]);
      text = text.replace(aboveMatch[0], ' ');
      isNaturalLanguage = true;
    }
  }

  // 2. Sorting Intent
  if (/\b(?:cheapest|cheap|budget|lowest\s+price|affordable)\b/i.test(text)) {
    detectedFilters.sortBy = 'price-asc';
    text = text.replace(/\b(?:cheapest|cheap|budget|lowest\s+price|affordable)\b/gi, ' ');
    isNaturalLanguage = true;
  } else if (/\b(?:expensive|luxury|premium|high-end)\b/i.test(text)) {
    detectedFilters.sortBy = 'price-desc';
    text = text.replace(/\b(?:expensive|luxury|premium|high-end)\b/gi, ' ');
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

  // 3. Stock Intent
  if (/\b(?:in\s*stock|available\s*now)\b/i.test(text)) {
    detectedFilters.inStock = true;
    text = text.replace(/\b(?:in\s*stock|available\s*now)\b/gi, ' ');
    isNaturalLanguage = true;
  }

  // 4. Color Extraction
  for (const c of KNOWN_COLORS) {
    const colorRegex = new RegExp(`\\b${c}\\b`, 'i');
    if (colorRegex.test(text)) {
      detectedFilters.color = c;
      semanticTags.push(c);
      text = text.replace(colorRegex, ' ');
      break;
    }
  }

  // 5. Gender / Target Audience
  if (/\b(?:for\s+men|men'?s|mens)\b/i.test(text)) {
    detectedFilters.gender = 'men';
    semanticTags.push('men');
    text = text.replace(/\b(?:for\s+men|men'?s|mens)\b/gi, ' ');
    isNaturalLanguage = true;
  } else if (/\b(?:for\s+women|women'?s|womens|ladies)\b/i.test(text)) {
    detectedFilters.gender = 'women';
    semanticTags.push('women');
    text = text.replace(/\b(?:for\s+women|women'?s|womens|ladies)\b/gi, ' ');
    isNaturalLanguage = true;
  } else if (/\b(?:for\s+kids?|children|boys?|girls?)\b/i.test(text)) {
    detectedFilters.gender = 'kids';
    semanticTags.push('kids');
    text = text.replace(/\b(?:for\s+kids?|children|boys?|girls?)\b/gi, ' ');
    isNaturalLanguage = true;
  }

  // 6. Common Activity / Intent tags
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

  // 7. Clean residual keyword
  // Remove filler conversational words like: "i want", "looking for", "show me", "good", "best", "give me", "buy"
  const cleaned = text
    .replace(/\b(?:i\s+want|looking\s+for|show\s+me|find|search\s+for|give\s+me|buy|need|please|with|good|great)\b/gi, ' ')
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
  "maxPrice": number or null,
  "minPrice": number or null,
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
