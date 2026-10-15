import { ViBaSearchEngine } from '../searchEngine';
import { Product } from '../../../shared/types';
import { SearchParams, SearchResult } from '../searchTypes';
import { SearchCache } from '../searchCache';
import { searchCurationManager } from '../searchCuration';
import { recordSearchAnalytics, getInMemoryAnalytics } from '../searchAnalytics';
import { parseIntentRuleBased, parseQueryIntent, getSemanticSearchStatus } from '../semanticSearch';
import { sanitizeSearchParams, sanitizeSearchString } from '../searchSanitization';
import { requireSearchAdmin } from '../searchAuth';
import { SpellingCorrectionEngine, damerauLevenshtein } from '../spellingCorrection';
import { meiliSearchService } from '../meiliSearchService';
import {
  fuzzyRatio,
  partialRatio,
  tokenSortRatio,
  tokenSetRatio,
  rapidFuzzScore,
  generateNGrams,
  ngramSimilarity,
  LocalTfIdfIndex,
  LocalSentenceEmbedding
} from '../localScoring';
import { searchService } from '../searchService';
import { rankingFramework } from '../rankingFramework';
import { sessionRankingManager } from '../sessionRanking';
import { visualSearchService } from '../visualSearch';
import { searchBenchmarkSuite } from '../benchmark';


export async function runTests(): Promise<boolean> {
  console.log('====================================================');
  console.log('   ViBa Mart Search Engine — Automated Test Suite   ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // 1. Synthetic Catalog Data
  const sampleProducts: Product[] = [
    {
      id: 'prod-001',
      name: 'Samsung Galaxy S24 Ultra 5G (Titanium Black, 256GB)',
      brand: 'Samsung',
      productCode: '8900 0996 1001',
      sku: 'SAM-S24U-256',
      categoryId: 'cat-mobiles',
      subCategoryId: 'sub-smartphones',
      price: 129999,
      discountPrice: 119999,
      stock: 15,
      rating: 4.8,
      numReviews: 420,
      status: 'active',
      isVisible: true,
      tags: ['samsung', 'galaxy', 'smartphone', '5g', 'flagship'],
      vendorId: 'v-01',
      images: ['https://example.com/s24.jpg'],
      description: 'The latest Samsung flagship smartphone with AI features and titanium frame.',
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'prod-002',
      name: 'Apple iPhone 15 Pro Max (Natural Titanium, 256GB)',
      brand: 'Apple',
      productCode: '8900 0996 1002',
      sku: 'APL-IPH15PM-256',
      categoryId: 'cat-mobiles',
      subCategoryId: 'sub-smartphones',
      price: 159900,
      discountPrice: 149900,
      stock: 8,
      rating: 4.9,
      numReviews: 610,
      status: 'active',
      isVisible: true,
      tags: ['apple', 'iphone', 'ios', '5g'],
      vendorId: 'v-01',
      images: ['https://example.com/ip15.jpg'],
      description: 'Super-fast A17 Pro chip and aerospace-grade titanium design.',
      createdAt: '2026-01-02T00:00:00.000Z'
    },
    {
      id: 'prod-003',
      name: 'Nike Air Zoom Pegasus 40 Running Shoes for Men',
      brand: 'Nike',
      productCode: '8900 0996 2001',
      sku: 'NKE-PEG40-M',
      categoryId: 'cat-fashion',
      subCategoryId: 'sub-footwear',
      price: 11495,
      discountPrice: 7995,
      discountPercentage: 30,
      stock: 25,
      rating: 4.6,
      numReviews: 180,
      status: 'active',
      isVisible: true,
      color: 'Black',
      size: 'UK 9',
      sizes: ['UK 8', 'UK 9', 'UK 10'],
      tags: ['shoes', 'running shoes', 'sneakers', 'sports', 'footwear'],
      vendorId: 'v-02',
      images: ['https://example.com/nike.jpg'],
      description: 'Responsive cushioning in the Pegasus provides an energized ride for daily road running.',
      createdAt: '2026-01-03T00:00:00.000Z'
    },
    {
      id: 'prod-004',
      name: 'Men Slim Fit Pure Cotton Formal Shirt',
      brand: 'Raymond',
      productCode: '8900 0996 2002',
      sku: 'RAY-SHIRT-BLU',
      categoryId: 'cat-fashion',
      subCategoryId: 'sub-clothing',
      price: 2499,
      discountPrice: 1499,
      discountPercentage: 40,
      stock: 40,
      rating: 4.3,
      numReviews: 85,
      status: 'active',
      isVisible: true,
      color: 'Sky Blue',
      size: '40',
      sizes: ['38', '40', '42'],
      tags: ['shirt', 'formal', 'cotton', 'blue'],
      vendorId: 'v-02',
      images: ['https://example.com/shirt.jpg'],
      description: 'Pure breathable cotton woven fabric formal button-down shirt.',
      createdAt: '2026-01-04T00:00:00.000Z'
    },
    {
      id: 'prod-005',
      name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
      brand: 'Sony',
      productCode: '8900 0996 3001',
      sku: 'SNY-WH1000XM5',
      categoryId: 'cat-electronics',
      subCategoryId: 'sub-audio',
      price: 34990,
      discountPrice: 26990,
      stock: 0, // OUT OF STOCK
      inStock: false,
      rating: 4.7,
      numReviews: 290,
      status: 'active',
      isVisible: true,
      tags: ['headphones', 'earphones', 'wireless', 'noise cancelling', 'bluetooth', 'audio'],
      vendorId: 'v-03',
      images: ['https://example.com/sony.jpg'],
      description: 'Industry-leading noise cancellation with 8 microphones and Auto NC Optimizer.',
      createdAt: '2026-01-05T00:00:00.000Z'
    },
    {
      id: 'prod-006',
      name: 'Secret Internal Draft Product (Should Never Appear)',
      brand: 'Testing',
      productCode: '8900 0996 9999',
      sku: 'TST-DRAFT-01',
      categoryId: 'cat-mobiles',
      price: 999,
      stock: 10,
      rating: 5.0,
      numReviews: 0,
      status: 'draft', // DRAFT
      isVisible: true,
      tags: ['draft'],
      vendorId: 'v-01',
      images: [],
      description: 'Draft item under review.',
      createdAt: '2026-01-06T00:00:00.000Z'
    },
    {
      id: 'prod-007',
      name: 'Hidden Inactive Product (Should Never Appear)',
      brand: 'Testing',
      productCode: '8900 0996 8888',
      sku: 'TST-INACTIVE-01',
      categoryId: 'cat-mobiles',
      price: 999,
      stock: 10,
      rating: 5.0,
      numReviews: 0,
      status: 'active',
      isVisible: false, // HIDDEN
      tags: ['hidden'],
      vendorId: 'v-01',
      images: [],
      description: 'Hidden item by admin.',
      createdAt: '2026-01-07T00:00:00.000Z'
    }
  ];

  const categoryNames = {
    'cat-mobiles': 'Mobiles & Accessories',
    'cat-fashion': 'Fashion',
    'cat-electronics': 'Electronics'
  };

  const subCategoryNames = {
    'sub-smartphones': 'Smartphones',
    'sub-footwear': 'Footwear',
    'sub-clothing': 'Clothing',
    'sub-audio': 'Audio & Headphones'
  };

  const engine = new ViBaSearchEngine();
  engine.indexProducts(sampleProducts, categoryNames, subCategoryNames);

  // Test 1: Total Indexed Count
  assert(engine.getCount() === 7, 'Catalog Indexing', `Expected 7 indexed products, got ${engine.getCount()}`);

  // Test 2: Ineligible Product Exclusion (Drafts & Hidden)
  const allSearch = engine.search({});
  const hasDraft = allSearch.products.some(p => p.id === 'prod-006');
  const hasHidden = allSearch.products.some(p => p.id === 'prod-007');
  assert(!hasDraft && !hasHidden, 'Strict Publication Rules Exclusion', 'Draft or Hidden products appeared in search results');

  // Test 3: Exact 12-digit Product Code Match
  const codeSearch = engine.search({ q: '8900 0996 1001' });
  assert(codeSearch.products.length > 0 && codeSearch.products[0].id === 'prod-001', 'Exact 12-digit Formatted Product Code Search');

  const cleanCodeSearch = engine.search({ q: '890009961001' });
  assert(cleanCodeSearch.products.length > 0 && cleanCodeSearch.products[0].id === 'prod-001', 'Exact 12-digit Clean Numeric Product Code Search');

  // Test 4: Exact SKU Match
  const skuSearch = engine.search({ q: 'SAM-S24U-256' });
  assert(skuSearch.products.length > 0 && skuSearch.products[0].id === 'prod-001', 'Exact SKU Match Priority');

  // Test 5: Typo Tolerance (Conservative Fuzzy Matching)
  const typoSearch1 = engine.search({ q: 'samung' });
  assert(typoSearch1.products.length > 0 && typoSearch1.products[0].id === 'prod-001', 'Typo tolerance: "samung" -> Samsung');

  const typoSearch2 = engine.search({ q: 'sneekers' });
  assert(typoSearch2.products.some(p => p.id === 'prod-003'), 'Typo tolerance: "sneekers" -> sneakers');

  // Test 6: Multi-Term Query (AND matching)
  const multiTermSearch = engine.search({ q: 'blue cotton shirt' });
  assert(multiTermSearch.products.length === 1 && multiTermSearch.products[0].id === 'prod-004', 'Multi-term Query: "blue cotton shirt" matches shirt');

  // Test 7: Synonym Expansion
  const synonymSearch = engine.search({ q: 'sneakers' });
  assert(synonymSearch.products.some(p => p.id === 'prod-003'), 'Synonym Search: "sneakers" matches running shoes');

  const synonymSearch2 = engine.search({ q: 'earbuds' });
  assert(synonymSearch2.products.some(p => p.id === 'prod-005'), 'Synonym Search: "earbuds" matches headphones');

  // Test 8: Field-Weighted Relevance (Title match should rank above Description match)
  const titleVsDesc = engine.search({ q: 'titanium' });
  assert(titleVsDesc.products.length >= 2, 'Multi-product query returns multiple matches');
  assert(titleVsDesc.products[0].name.toLowerCase().includes('titanium'), 'Title match ranked above description match');

  // Test 9: Category & Brand Filters
  const brandFiltered = engine.search({ brand: 'Apple' });
  assert(brandFiltered.products.length === 1 && brandFiltered.products[0].id === 'prod-002', 'Brand Filter: "Apple" returns 1 product');

  const catFiltered = engine.search({ category: 'cat-mobiles' });
  assert(catFiltered.products.length === 2, 'Category Filter: "cat-mobiles" returns 2 active products');

  // Test 10: In-Stock Filter
  const inStockSearch = engine.search({ inStock: true });
  const hasOutOfStock = inStockSearch.products.some(p => p.id === 'prod-005');
  assert(!hasOutOfStock, 'In-Stock Filter: out of stock product excluded when inStock=true');

  // Test 11: Price Sorting (Ascending & Descending)
  const priceAsc = engine.search({ sortBy: 'price-asc' });
  const isAsc = priceAsc.products[0].discountPrice! <= priceAsc.products[priceAsc.products.length - 1].discountPrice!;
  assert(isAsc, 'Sort by Price Ascending');

  const priceDesc = engine.search({ sortBy: 'price-desc' });
  const isDesc = priceDesc.products[0].discountPrice! >= priceDesc.products[priceDesc.products.length - 1].discountPrice!;
  assert(isDesc, 'Sort by Price Descending');

  // Test 12: Facets Accuracy
  const facetResult = engine.search({});
  assert(facetResult.facets.brands.length >= 4, 'Facets: correct brand breakdown generated');
  assert(facetResult.facets.categories.length >= 3, 'Facets: correct category breakdown generated');
  assert(facetResult.facets.stockStatus.inStock === 4, 'Facets: accurate in-stock count');
  assert(facetResult.facets.stockStatus.outOfStock === 1, 'Facets: accurate out-of-stock count');

  // Test 13: Autocomplete Suggestions
  const suggestResult = engine.suggest('sam');
  assert(suggestResult.suggestions.length > 0, 'Autocomplete Suggest: "sam" returns suggestions');
  assert(suggestResult.suggestions.some(s => s.type === 'product' && s.title.includes('Samsung')), 'Product suggestion returned');

  // Test 14: Latency Benchmark
  const runs = 50;
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) {
    engine.search({ q: 'shoes', minPrice: 1000, maxPrice: 15000 });
  }
  const avgLatency = (performance.now() - t0) / runs;
  console.log(`\nAverage Query Latency over ${runs} executions: ${avgLatency.toFixed(3)} ms`);
  assert(avgLatency < 5.0, `Latency benchmark target (< 5ms), actual: ${avgLatency.toFixed(3)} ms`);

  // ==========================================
  // PHASE 2 TESTS: Cache, Curation & Analytics
  // ==========================================

  // Test 15: LRU Search Cache
  const testCache = new SearchCache(3, 60000); // capacity 3
  const dummyResult = (q: string): SearchResult => ({
    query: q,
    products: [],
    total: 0,
    page: 1,
    limit: 24,
    totalPages: 1,
    facets: {
      categories: [],
      subCategories: [],
      nestedSubCategories: [],
      brands: [],
      colors: [],
      sizes: [],
      priceRange: { min: 0, max: 0 },
      ratings: [],
      stockStatus: { inStock: 0, outOfStock: 0 }
    },
    executionTimeMs: 1
  });

  const kShoes = testCache.generateKey({ q: 'shoes' });
  const kPhones = testCache.generateKey({ q: 'phones' });
  const kTablets = testCache.generateKey({ q: 'tablets' });
  const kLaptops = testCache.generateKey({ q: 'laptops' });

  testCache.set(kShoes, dummyResult('shoes'));
  testCache.set(kPhones, dummyResult('phones'));
  assert(testCache.get(kShoes)?.query === 'shoes', 'LRU Cache: hit on stored query');
  assert(testCache.get(testCache.generateKey({ q: 'nonexistent' })) === null, 'LRU Cache: miss on unstored query');

  // Eviction test: capacity 3, add 2 more items
  testCache.set(kTablets, dummyResult('tablets'));
  testCache.set(kLaptops, dummyResult('laptops')); // should evict 'phones' since 'shoes' was accessed
  assert(testCache.get(kPhones) === null, 'LRU Cache: evicts least recently used item when capacity exceeded');
  assert(testCache.get(kShoes) !== null, 'LRU Cache: retains recently accessed item');

  // Invalidation test
  testCache.invalidate();
  assert(testCache.get(kShoes) === null, 'LRU Cache: invalidate clears all cached entries');

  // Test 16: Search Curation - Product Pinning
  searchCurationManager.saveConfig({
    pinnedRules: [{ query: 'smartphones', productIds: ['prod-002'] }],
    boostedRules: [],
    customSynonyms: []
  });
  const pinnedSearch = engine.search({ q: 'smartphones' });
  assert(pinnedSearch.products.length > 0 && pinnedSearch.products[0].id === 'prod-002', 'Curation: pinned product ranks #1');

  // Test 17: Search Curation - Custom Synonyms
  searchCurationManager.saveConfig({
    pinnedRules: [],
    boostedRules: [],
    customSynonyms: [['kicks', 'shoes', 'footwear']]
  });
  const synonymKicksSearch = engine.search({ q: 'kicks' });
  assert(synonymKicksSearch.products.some(p => p.id === 'prod-003'), 'Curation: custom synonym "kicks" matches shoes');

  // Test 18: Zero-Result Recovery
  const recoveryEngine = new ViBaSearchEngine();
  recoveryEngine.indexProducts(sampleProducts, categoryNames, subCategoryNames);
  const recoveryResult = recoveryEngine.search({ q: 'headfone', noAutoCorrect: true });
  assert(
    recoveryResult.recovery !== undefined &&
    recoveryResult.recovery.suggestedQuery === 'headphones',
    'Zero-Result Recovery: generates typo correction suggestion "headphones" for "headfone"'
  );

  // Test 19: Search Analytics Event Logging & Aggregation
  recordSearchAnalytics({
    query: 'test query analytics',
    resultCount: 5,
    isZeroResult: false,
    executionTimeMs: 1.2,
    type: 'search',
    platform: 'desktop'
  });
  recordSearchAnalytics({
    query: 'missing item test',
    resultCount: 0,
    isZeroResult: true,
    executionTimeMs: 0.8,
    type: 'search',
    platform: 'desktop'
  });
  const inMemory = getInMemoryAnalytics();
  assert(inMemory.some(e => e.query === 'test query analytics'), 'Analytics: search event captured in rolling buffer');
  assert(inMemory.some(e => e.query === 'missing item test' && e.isZeroResult), 'Analytics: zero-result event captured');

  // ==========================================
  // PHASE 3 TESTS: AI & Semantic Search
  // ==========================================

  // Test 20: Natural Language Intent Decomposition
  const intent1 = parseIntentRuleBased('blue cotton shirt for men under 2000');
  assert(intent1.isNaturalLanguage, 'AI Intent: recognizes natural language query pattern');
  assert(intent1.detectedFilters.maxPrice === 2000, 'AI Intent: extracts price ceiling (maxPrice: 2000)');
  assert(intent1.detectedFilters.color === 'blue', 'AI Intent: extracts color filter ("blue")');
  assert(intent1.detectedFilters.gender === 'men', 'AI Intent: extracts audience gender ("men")');
  assert(intent1.semanticTags.includes('cotton'), 'AI Intent: generates semantic tag ("cotton")');

  // Test 21: Pricing Bounds & Sorting Intent
  const intent2 = parseIntentRuleBased('shoes between 1500 and 6000');
  assert(intent2.detectedFilters.minPrice === 1500 && intent2.detectedFilters.maxPrice === 6000, 'AI Intent: extracts price range (1500 - 6000)');

  const intent3 = parseIntentRuleBased('cheapest wireless headphones in stock');
  assert(intent3.detectedFilters.sortBy === 'price-asc', 'AI Intent: extracts sorting intent ("cheapest" -> price-asc)');
  assert(intent3.detectedFilters.inStock === true, 'AI Intent: extracts stock availability constraint');
  assert(intent3.semanticTags.includes('wireless'), 'AI Intent: extracts semantic tag ("wireless")');

  // Test 22: Hybrid Search Execution with Conversational Query
  const hybridResult = engine.search({ q: 'blue shirt under 2000' });
  assert(hybridResult.products.length === 1 && hybridResult.products[0].id === 'prod-004', 'Hybrid Search: resolves conversational query to matching product (prod-004)');
  assert(hybridResult.semanticIntent !== undefined, 'Hybrid Search: attaches parsed semanticIntent to SearchResult');
  assert(hybridResult.semanticIntent?.detectedFilters.maxPrice === 2000, 'Hybrid Search: enforces extracted price ceiling dynamically');

  // Test 23: Semantic Engine Status & Async Intent Pipeline
  const aiStatus = getSemanticSearchStatus();
  assert(aiStatus.enabled === true, 'AI Engine: status reports enabled');
  assert(aiStatus.latencyBudgetMs === 350, 'AI Engine: enforces 350ms latency budget with fallback');

  const asyncParsed = await parseQueryIntent('casual jeans under 1000');
  assert(asyncParsed.isNaturalLanguage === true, 'AI Pipeline: async parseQueryIntent succeeds');
  assert(asyncParsed.detectedFilters.maxPrice === 1000, 'AI Pipeline: async parse correctly extracts maxPrice');

  // ==========================================
  // PHASE 4: SECURITY, RELIABILITY & CHAOS
  // ==========================================

  // Test 24: Sanitization & Malicious Script Defense
  const xssInput = '<script>alert("pwned")</script>samsung phone';
  const cleanStr = sanitizeSearchString(xssInput);
  assert(!cleanStr.includes('<script>') && !cleanStr.includes('</script>') && cleanStr.includes('samsung phone'), 'Security: strips malicious HTML/XSS script tags');

  // Test 25: Buffer Flood / Query Bomb Length Truncation
  const floodQuery = 'a'.repeat(5000);
  const truncatedQuery = sanitizeSearchString(floodQuery);
  assert(truncatedQuery.length === 120, `Security: truncates 5000-char buffer flood to exactly 120 chars (actual: ${truncatedQuery.length})`);

  // Test 26: Control Character & Null Byte Sanitization
  const controlCharsInput = 'sneakers\x00\x08\x1F\x7F running';
  const sanitizedControl = sanitizeSearchString(controlCharsInput);
  assert(sanitizedControl === 'sneakers running', `Security: strips null bytes and ASCII control characters (actual: "${sanitizedControl}")`);

  // Test 27: Parameter Clamping & Type Safety
  const maliciousParams = sanitizeSearchParams({
    q: '  iphone   15   ',
    page: '-5',
    limit: '999999',
    minPrice: '-500',
    maxPrice: 'invalid_price',
    minRating: '25',
    minDiscount: '150',
    sortBy: 'malicious_sql_injection; DROP TABLE products;'
  });
  assert(maliciousParams.page === 1, 'Sanitization: clamps negative page number to 1');
  assert(maliciousParams.limit === 100, `Sanitization: clamps excessive limit to 100 max (actual: ${maliciousParams.limit})`);
  assert(maliciousParams.minPrice === 0, 'Sanitization: clamps negative price to 0');
  assert(maliciousParams.maxPrice === undefined, 'Sanitization: safely discards non-numeric maxPrice');
  assert(maliciousParams.minRating === 5, 'Sanitization: clamps minRating exceeding 5 down to 5');
  assert(maliciousParams.minDiscount === 100, 'Sanitization: clamps minDiscount exceeding 100 down to 100');
  assert(maliciousParams.sortBy === undefined, 'Sanitization: rejects invalid or malicious sortBy values');
  assert(maliciousParams.q === 'iphone 15', 'Sanitization: collapses extra whitespace in query');

  // Test 28: Regex Special Characters / ReDoS Safety
  let regexSafeResult: SearchResult | null = null;
  try {
    regexSafeResult = engine.search({ q: 'samsung *+?()[]{}|^$\\.' });
  } catch (e) {
    regexSafeResult = null;
  }
  assert(regexSafeResult !== null && regexSafeResult.products.length > 0, 'Security: executes queries containing regex metacharacters (*+?()[]{}|^$) without crashing or ReDoS');

  // Test 29: Corrupted Product Ingestion - Missing ID & Undefined Fields
  const corruptedDocs: any[] = [
    null,
    undefined,
    {},
    { id: '', name: 'Broken Doc' },
    {
      id: 'corrupt-001',
      name: 'Corrupted Data Product',
      price: 'not_a_number',
      discountPrice: -50,
      rating: 'super_high',
      numReviews: -10,
      variants: [null, undefined, { color: 12345, size: false }],
      specifications: [null, { key: null, value: undefined }],
      tags: null
    }
  ];

  // Indexing should not throw an exception
  let corruptedIndexSuccess = false;
  try {
    const corruptEngine = new ViBaSearchEngine();
    corruptEngine.indexProducts(corruptedDocs as Product[]);
    corruptedIndexSuccess = true;
  } catch (err) {
    corruptedIndexSuccess = false;
  }
  assert(corruptedIndexSuccess, 'Reliability: safely indexes catalog containing nulls, missing IDs, and corrupted data types');

  // Test 30: Corrupted Document Value Normalization
  const transformedDoc = ViBaSearchEngine.toIndexedDoc(corruptedDocs[4] as Product);
  assert(transformedDoc.price === 0, 'Reliability: normalizes NaN price to 0');
  assert(transformedDoc.effectivePrice === 0, 'Reliability: normalizes negative discount price to 0 effectivePrice');
  assert(transformedDoc.rating === 0, 'Reliability: normalizes non-numeric rating to 0');
  assert(transformedDoc.numReviews === 0, 'Reliability: normalizes negative numReviews to 0');
  assert(Array.isArray(transformedDoc.colors), 'Reliability: sanitizes malformed variants array into clean colors');

  // Test 31: Query Execution Against Index with Corrupted Documents
  const corruptEngine = new ViBaSearchEngine();
  corruptEngine.indexProducts(corruptedDocs as Product[]);
  const corruptSearchRes = corruptEngine.search({ q: 'Corrupted Data Product' });
  assert(corruptSearchRes.total === 1 && corruptSearchRes.products[0].id === 'corrupt-001', 'Reliability: retrieves valid fields from corrupted document without crashing query pipeline');

  // Test 32: Incremental Upsert / Delete with Malformed Data
  let upsertDeleteSuccess = false;
  try {
    corruptEngine.upsertProduct(null as any);
    corruptEngine.upsertProduct({} as any);
    corruptEngine.removeProduct('');
    corruptEngine.removeProduct('non-existent-id');
    upsertDeleteSuccess = true;
  } catch (e) {
    upsertDeleteSuccess = false;
  }
  assert(upsertDeleteSuccess, 'Reliability: handles null upsert and missing ID removal without throwing');

  // Test 33: Admin Auth Middleware Simulation
  let authDenied = false;
  const mockReq: any = { headers: {} };
  const mockRes: any = {
    statusCode: 0,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.payload = payload;
      return this;
    }
  };
  const mockNext = () => {};

  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await requireSearchAdmin(mockReq, mockRes, mockNext);
    // In production without admin.apps or auth token, must return 503 or 401
    authDenied = mockRes.statusCode === 503 || mockRes.statusCode === 401;
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
  // Test 34: Natural-Language Query Matrix Verification
  const nlQuery1 = parseIntentRuleBased('kurti under 400');
  assert(nlQuery1.detectedFilters.maxPrice === 400 && nlQuery1.detectedFilters.category === 'kurtis', 'NL Intent: "kurti under 400" extracts maxPrice: 400 & category: kurtis');

  const nlQuery2 = parseIntentRuleBased('T-shirt for men');
  assert(nlQuery2.detectedFilters.gender === 'men' && nlQuery2.detectedFilters.category === 't-shirts', 'NL Intent: "T-shirt for men" extracts gender: men & category: t-shirts');

  const nlQuery3 = parseIntentRuleBased('black shirt under 500');
  assert(nlQuery3.detectedFilters.color === 'black' && nlQuery3.detectedFilters.maxPrice === 500 && nlQuery3.detectedFilters.category === 'shirts', 'NL Intent: "black shirt under 500" extracts color: black, maxPrice: 500, category: shirts');

  const nlQuery4 = parseIntentRuleBased("women's shoes size 7");
  assert(nlQuery4.detectedFilters.gender === 'women' && nlQuery4.detectedFilters.size === '7' && nlQuery4.detectedFilters.category === 'shoes', 'NL Intent: "women\'s shoes size 7" extracts gender: women, size: 7, category: shoes');

  const nlQuery5 = parseIntentRuleBased('mobile phones under 15000');
  assert(nlQuery5.detectedFilters.maxPrice === 15000 && nlQuery5.detectedFilters.category === 'mobile phones', 'NL Intent: "mobile phones under 15000" extracts maxPrice: 15000, category: mobile phones');

  const nlQuery6 = parseIntentRuleBased('Shoes between 500 and 1000');
  assert(nlQuery6.detectedFilters.minPrice === 500 && nlQuery6.detectedFilters.maxPrice === 1000 && nlQuery6.detectedFilters.category === 'shoes', 'NL Intent: "Shoes between 500 and 1000" extracts minPrice: 500, maxPrice: 1000, category: shoes');

  const nlQuery7 = parseIntentRuleBased("Women's kurti above 300");
  assert(nlQuery7.detectedFilters.gender === 'women' && nlQuery7.detectedFilters.minPrice === 300 && nlQuery7.detectedFilters.category === 'kurtis', 'NL Intent: "Women\'s kurti above 300" extracts gender: women, minPrice: 300, category: kurtis');

  const nlQuery8 = parseIntentRuleBased('smartwatch 30% off');
  assert(nlQuery8.detectedFilters.minDiscount === 30 && nlQuery8.detectedFilters.category === 'watches', 'NL Intent: "smartwatch 30% off" extracts minDiscount: 30, category: watches');

  const nlQuery10 = parseIntentRuleBased('kurti below ₹500');
  assert(nlQuery10.detectedFilters.maxPrice === 500 && nlQuery10.detectedFilters.category === 'kurtis', 'NL Intent: "kurti below ₹500" extracts maxPrice: 500 & category: kurtis');

  const nlQuery11 = parseIntentRuleBased("women's perfume above 300");
  assert(nlQuery11.detectedFilters.gender === 'women' && nlQuery11.detectedFilters.minPrice === 300 && nlQuery11.detectedFilters.category === 'perfume', 'NL Intent: "women\'s perfume above 300" extracts gender: women, minPrice: 300, category: perfume');

  const nlQuery12 = parseIntentRuleBased('tshrt for men');
  assert(nlQuery12.detectedFilters.gender === 'men' && nlQuery12.detectedFilters.category === 't-shirts', 'NL Intent: "tshrt for men" extracts gender: men & category: t-shirts');

  const nlQuery13 = parseIntentRuleBased('mobile under 15000');
  assert(nlQuery13.detectedFilters.maxPrice === 15000 && nlQuery13.detectedFilters.category === 'mobile phones', 'NL Intent: "mobile under 15000" extracts maxPrice: 15000, category: mobile phones');

  const nlQuery14 = parseIntentRuleBased('shoes between 1000 and 500');
  assert(nlQuery14.detectedFilters.invalidPriceRange === true, 'NL Intent: "shoes between 1000 and 500" flags invalid price range');

  const nlQuery15 = parseIntentRuleBased('T-shirt priced at ₹499');
  assert(nlQuery15.detectedFilters.exactPrice === 499, 'NL Intent: "T-shirt priced at ₹499" extracts exactPrice: 499');

  const nlQuery16 = parseIntentRuleBased('shoes between ₹500 and ₹1,500');
  assert(nlQuery16.detectedFilters.minPrice === 500 && nlQuery16.detectedFilters.maxPrice === 1500 && nlQuery16.detectedFilters.category === 'shoes', 'NL Intent: "shoes between ₹500 and ₹1,500" handles comma normalization (500-1500)');

  const nlQuery17 = parseIntentRuleBased('branded jeans under ₹1,000');
  assert(nlQuery17.detectedFilters.maxPrice === 1000 && nlQuery17.detectedFilters.category === 'jeans', 'NL Intent: "branded jeans under ₹1,000" extracts maxPrice: 1000 and category: jeans');

  const nlQuery18 = parseIntentRuleBased('discounted headphones');
  assert(nlQuery18.detectedFilters.minDiscount === 1 && nlQuery18.detectedFilters.category === 'audio', 'NL Intent: "discounted headphones" extracts minDiscount: 1 and category: audio');

  const nlQuery19 = parseIntentRuleBased('cotton kurti in blue');
  assert(nlQuery19.detectedFilters.color === 'blue' && nlQuery19.detectedFilters.category === 'kurtis' && nlQuery19.semanticTags.includes('cotton'), 'NL Intent: "cotton kurti in blue" extracts color: blue, tag: cotton, category: kurtis');

  const nlQuery20 = parseIntentRuleBased('perfume for women');
  assert(nlQuery20.detectedFilters.gender === 'women' && nlQuery20.detectedFilters.category === 'perfume', 'NL Intent: "perfume for women" extracts gender: women, category: perfume');

  const nlQuery21 = parseIntentRuleBased('formal shoes for men');
  assert(nlQuery21.detectedFilters.gender === 'men' && nlQuery21.detectedFilters.category === 'shoes' && nlQuery21.semanticTags.includes('formal'), 'NL Intent: "formal shoes for men" extracts gender: men, tag: formal, category: shoes');

  const nlQuery22 = parseIntentRuleBased('latest fashion accessories');
  assert(nlQuery22.detectedFilters.sortBy === 'newest' && nlQuery22.detectedFilters.category === 'accessories', 'NL Intent: "latest fashion accessories" extracts sortBy: newest, category: accessories');

  const nlQuery23 = parseIntentRuleBased('From ₹200 to ₹800');
  assert(nlQuery23.detectedFilters.minPrice === 200 && nlQuery23.detectedFilters.maxPrice === 800, 'NL Intent: "From ₹200 to ₹800" extracts 200 - 800 range');

  const nlQuery24 = parseIntentRuleBased('Maximum ₹1,000');
  assert(nlQuery24.detectedFilters.maxPrice === 1000, 'NL Intent: "Maximum ₹1,000" extracts maxPrice: 1000');

  const nlQuery25 = parseIntentRuleBased('Less than ₹999');
  assert(nlQuery25.detectedFilters.maxPrice === 999, 'NL Intent: "Less than ₹999" extracts maxPrice: 999');

  // Test 35: Empty Query & Unknown Product Name Recovery
  const emptyRes = engine.search({});
  assert(emptyRes.total > 0 && Array.isArray(emptyRes.products), 'Search: empty query returns catalog without throwing');

  const unknownRes = engine.search({ q: 'xyznonexistentquantumfluxdevice999' });
  assert(unknownRes.total === 0 && unknownRes.recovery !== undefined, 'Search: unknown product query triggers zero-result recovery suggestions');

  // ==========================================
  // PHASE 5: SECTION 15 - AUTOMATIC SPELLING CORRECTION & TYPO TOLERANCE
  // ==========================================

  // Test 36: Damerau-Levenshtein Transposition & Distance Accuracy
  const swapDist = damerauLevenshtein('shose', 'shoes');
  assert(swapDist === 1, `Typo Distance: adjacent transposition ('shose' -> 'shoes') is distance 1 (got: ${swapDist})`);
  const mobileSwapDist = damerauLevenshtein('moblie', 'mobile');
  assert(mobileSwapDist === 1, `Typo Distance: transposition ('moblie' -> 'mobile') is distance 1 (got: ${mobileSwapDist})`);
  const insertDist = damerauLevenshtein('jeens', 'jeans');
  assert(insertDist === 1, `Typo Distance: vowel typo ('jeens' -> 'jeans') is distance 1 (got: ${insertDist})`);

  // Test 37: Automatic Typo Detection & Correction for User-Specified Example Searches
  const allIndexedDocs = (engine as any).indexedDocs ? Array.from((engine as any).indexedDocs.values()) : [];

  const typo1 = SpellingCorrectionEngine.correct('kurtie', allIndexedDocs as any);
  assert(typo1.hasCorrection && (typo1.correctedQuery === 'kurti' || typo1.correctedQuery === 'kurtis'), `Typo Correction: "kurtie" -> "${typo1.correctedQuery}"`);

  const typo2 = SpellingCorrectionEngine.correct('kurty', allIndexedDocs as any);
  assert(typo2.hasCorrection && (typo2.correctedQuery === 'kurti' || typo2.correctedQuery === 'kurtis'), `Typo Correction: "kurty" -> "${typo2.correctedQuery}"`);

  const typo3 = SpellingCorrectionEngine.correct('tshrt for men', allIndexedDocs as any);
  assert(typo3.hasCorrection && typo3.correctedQuery.toLowerCase().includes('t-shirt'), `Typo Correction: "tshrt for men" -> "${typo3.correctedQuery}"`);

  const typo4 = SpellingCorrectionEngine.correct('shose', allIndexedDocs as any);
  assert(typo4.hasCorrection && typo4.correctedQuery === 'shoes', `Typo Correction: "shose" -> "${typo4.correctedQuery}"`);

  const typo5 = SpellingCorrectionEngine.correct('snikers', allIndexedDocs as any);
  assert(typo5.hasCorrection && typo5.correctedQuery === 'sneakers', `Typo Correction: "snikers" -> "${typo5.correctedQuery}"`);

  const typo6 = SpellingCorrectionEngine.correct('jeens', allIndexedDocs as any);
  assert(typo6.hasCorrection && typo6.correctedQuery === 'jeans', `Typo Correction: "jeens" -> "${typo6.correctedQuery}"`);

  const typo7 = SpellingCorrectionEngine.correct('womens dres', allIndexedDocs as any);
  assert(typo7.hasCorrection && typo7.correctedQuery.toLowerCase().includes('dress'), `Typo Correction: "womens dres" -> "${typo7.correctedQuery}"`);

  const typo8 = SpellingCorrectionEngine.correct('blu shirt', allIndexedDocs as any);
  assert(typo8.hasCorrection && typo8.correctedQuery.toLowerCase().includes('blue shirt'), `Typo Correction: "blu shirt" -> "${typo8.correctedQuery}"`);

  const typo9 = SpellingCorrectionEngine.correct('headfone', allIndexedDocs as any);
  assert(typo9.hasCorrection && typo9.correctedQuery === 'headphones', `Typo Correction: "headfone" -> "${typo9.correctedQuery}"`);

  const typo10 = SpellingCorrectionEngine.correct('moblie phone', allIndexedDocs as any);
  assert(typo10.hasCorrection && typo10.correctedQuery.toLowerCase().includes('mobile phone'), `Typo Correction: "moblie phone" -> "${typo10.correctedQuery}"`);

  // Test 38: Combined Spelling Correction with Natural-Language Price & Attribute Filters
  const combined1 = engine.search({ q: 'kurtie under 400' });
  assert(combined1.hasAutoCorrected && combined1.correctedQuery?.includes('kurti'), 'Combined Filters: "kurtie under 400" detects typo and corrects to kurti');
  assert(combined1.semanticIntent?.detectedFilters.maxPrice === 400, 'Combined Filters: "kurtie under 400" extracts maxPrice: 400');
  assert(combined1.semanticIntent?.detectedFilters.category === 'kurtis', 'Combined Filters: "kurtie under 400" extracts category: kurtis');

  const combined2 = engine.search({ q: 'mens tshrt below 500' });
  assert(combined2.hasAutoCorrected && combined2.correctedQuery?.includes('t-shirt'), 'Combined Filters: "mens tshrt below 500" corrects tshrt -> t-shirt');
  assert(combined2.semanticIntent?.detectedFilters.maxPrice === 500, 'Combined Filters: "mens tshrt below 500" extracts maxPrice: 500');
  assert(combined2.semanticIntent?.detectedFilters.gender === 'men', 'Combined Filters: "mens tshrt below 500" extracts gender: men');

  const combined3 = engine.search({ q: 'shose between 500 and 1000' });
  assert(combined3.hasAutoCorrected && combined3.correctedQuery?.includes('shoes'), 'Combined Filters: "shose between 500 and 1000" corrects shose -> shoes');
  assert(combined3.semanticIntent?.detectedFilters.minPrice === 500 && combined3.semanticIntent?.detectedFilters.maxPrice === 1000, 'Combined Filters: "shose between 500 and 1000" extracts price range (500 - 1000)');

  const combined4 = engine.search({ q: 'blak shirt under 700' });
  assert(combined4.hasAutoCorrected && combined4.correctedQuery?.includes('black'), 'Combined Filters: "blak shirt under 700" corrects blak -> black');
  assert(combined4.semanticIntent?.detectedFilters.maxPrice === 700, 'Combined Filters: "blak shirt under 700" extracts maxPrice: 700');
  assert(combined4.semanticIntent?.detectedFilters.color === 'black', 'Combined Filters: "blak shirt under 700" extracts color: black');

  // Test 39: Guardrails - Preserve SKUs, Product Codes, Valid Brands, and Numbers
  const skuCorrection = SpellingCorrectionEngine.correct('SAM-S24U-256', allIndexedDocs as any);
  assert(!skuCorrection.hasCorrection && skuCorrection.correctedQuery === 'SAM-S24U-256', 'Guardrails: SKU "SAM-S24U-256" is strictly preserved without mutation');

  const brandCorrection = SpellingCorrectionEngine.correct('Samsung', allIndexedDocs as any);
  assert(!brandCorrection.hasCorrection && brandCorrection.correctedQuery === 'Samsung', 'Guardrails: valid brand "Samsung" is preserved without mutation');

  const codeCorrection = SpellingCorrectionEngine.correct('8900 0996 1001', allIndexedDocs as any);
  assert(!codeCorrection.hasCorrection, 'Guardrails: 12-digit product code is preserved without mutation');

  const priceCorrection = SpellingCorrectionEngine.correct('15000', allIndexedDocs as any);
  assert(!priceCorrection.hasCorrection && priceCorrection.correctedQuery === '15000', 'Guardrails: numeric price "15000" is strictly preserved');

  // Test 40: End-to-End Search Resolution with Typo Correction
  const e2eHeadphone = engine.search({ q: 'headfone' });
  assert(e2eHeadphone.hasAutoCorrected === true, 'E2E Search: "headfone" sets hasAutoCorrected: true');
  assert(e2eHeadphone.originalQuery === 'headfone', 'E2E Search: preserves originalQuery ("headfone")');
  assert(e2eHeadphone.correctedQuery === 'headphones', 'E2E Search: correctedQuery is "headphones"');
  assert(e2eHeadphone.products.some(p => p.id === 'prod-005'), 'E2E Search: retrieves Sony Headphones (prod-005) for typo "headfone"');

  const e2eBluShirt = engine.search({ q: 'blu shirt' });
  assert(e2eBluShirt.hasAutoCorrected === true, 'E2E Search: "blu shirt" sets hasAutoCorrected: true');
  assert(e2eBluShirt.products.some(p => p.id === 'prod-004'), 'E2E Search: retrieves Blue Formal Shirt (prod-004) for "blu shirt"');

  const e2eSnikers = engine.search({ q: 'snikers' });
  assert(e2eSnikers.hasAutoCorrected === true, 'E2E Search: "snikers" sets hasAutoCorrected: true');
  assert(e2eSnikers.products.some(p => p.id === 'prod-003'), 'E2E Search: retrieves Nike Sneakers (prod-003) for "snikers"');

  // Test 41: User Undo / Explicit Override (noAutoCorrect=true)
  const overrideRes = engine.search({ q: 'headfone', noAutoCorrect: true });
  assert(overrideRes.hasAutoCorrected === false, 'Undo / Override: noAutoCorrect=true bypasses auto-correction');
  assert(overrideRes.correctedQuery === undefined, 'Undo / Override: correctedQuery is undefined when noAutoCorrect=true');

  // Test 42: Suggest / Autocomplete Fallback for Typos
  const typoSuggest = engine.suggest('shos');
  assert(typoSuggest.suggestions.length > 0 && typoSuggest.suggestions.some(s => s.title.toLowerCase().includes('shoe')), 'Suggestions: typo in prefix ("shos") retrieves corrected suggestions');

  // ==========================================
  // PHASE 6: INTELLIGENT SEARCH ARCHITECTURE FULL TEST SUITE
  // ==========================================

  // Additional Hardware & Peripherals for Testing Real Catalog Scenarios
  const hardwareProducts: Product[] = [
    {
      id: 'prod-008',
      name: 'HP Optical USB Wired Mouse (1000 DPI, Black)',
      brand: 'HP',
      productCode: '8900 0996 4001',
      sku: 'HP-MOU-USB-01',
      categoryId: 'cat-electronics',
      subCategoryId: 'sub-peripherals',
      price: 499,
      discountPrice: 349,
      discountPercentage: 30,
      stock: 45,
      inStock: true,
      rating: 4.5,
      numReviews: 320,
      status: 'active',
      isVisible: true,
      tags: ['mouse', 'optical mouse', 'wired mouse', 'usb', 'hp', 'peripherals', 'electronics'],
      vendorId: 'v-04',
      images: ['https://example.com/hp-mouse.jpg'],
      description: 'Reliable HP optical wired mouse with 1000 DPI precision tracking and comfortable ergonomic grip.',
      createdAt: '2026-01-08T00:00:00.000Z'
    },
    {
      id: 'prod-009',
      name: 'Dell WM126 Wireless Optical Mouse (Compact, Black)',
      brand: 'Dell',
      productCode: '8900 0996 4002',
      sku: 'DEL-WM126-BLK',
      categoryId: 'cat-electronics',
      subCategoryId: 'sub-peripherals',
      price: 799,
      discountPrice: 489,
      discountPercentage: 38,
      stock: 28,
      inStock: true,
      rating: 4.4,
      numReviews: 215,
      status: 'active',
      isVisible: true,
      tags: ['mouse', 'wireless mouse', 'optical mouse', 'dell', 'peripherals', 'wireless'],
      vendorId: 'v-04',
      images: ['https://example.com/dell-mouse.jpg'],
      description: 'Long battery life Dell wireless optical mouse with plug-and-play USB receiver.',
      createdAt: '2026-01-09T00:00:00.000Z'
    },
    {
      id: 'prod-010',
      name: 'Logitech MX Master 3S Wireless Performance Mouse',
      brand: 'Logitech',
      productCode: '8900 0996 4003',
      sku: 'LOG-MXM3S-01',
      categoryId: 'cat-electronics',
      subCategoryId: 'sub-peripherals',
      price: 9995,
      discountPrice: 8495,
      discountPercentage: 15,
      stock: 14,
      inStock: true,
      rating: 4.9,
      numReviews: 680,
      status: 'active',
      isVisible: true,
      tags: ['mouse', 'wireless mouse', 'logitech', 'mx master', 'ergonomic', 'peripherals'],
      vendorId: 'v-04',
      images: ['https://example.com/logitech-mouse.jpg'],
      description: 'Quiet clicks and 8K DPI track-on-glass sensor for elite ergonomics and power productivity.',
      createdAt: '2026-01-10T00:00:00.000Z'
    },
    {
      id: 'prod-011',
      name: 'HP Pavilion 15.6" FHD Laptop (Intel Core i5, 16GB RAM, 512GB SSD)',
      brand: 'HP',
      productCode: '8900 0996 4004',
      sku: 'HP-PAV-15-I5',
      categoryId: 'cat-electronics',
      subCategoryId: 'sub-laptops',
      price: 64990,
      discountPrice: 56990,
      discountPercentage: 12,
      stock: 10,
      inStock: true,
      rating: 4.6,
      numReviews: 140,
      status: 'active',
      isVisible: true,
      tags: ['laptop', 'hp', 'pavilion', 'intel', 'notebook', 'electronics'],
      vendorId: 'v-04',
      images: ['https://example.com/hp-laptop.jpg'],
      description: 'Versatile HP Pavilion laptop for multitasking and everyday entertainment.',
      createdAt: '2026-01-11T00:00:00.000Z'
    }
  ];

  // Test 43: Dynamic Incremental Product Indexing & Catalog Synchronization
  for (const hp of hardwareProducts) {
    const doc = engine.upsertProduct(hp, 'Electronics', 'Computer Peripherals');
    assert(doc !== null && doc.id === hp.id, `Dynamic Catalog Sync: upserted ${hp.name}`);
  }
  assert(engine.getCount() === 11, `Catalog Indexing: 11 total indexed products (got: ${engine.getCount()})`);

  // Test 44: Query Intelligence - Budget & Keyword Extraction for "mouse under 500"
  const mouseIntent = parseIntentRuleBased('mouse under 500');
  assert(mouseIntent.cleanKeyword === 'mouse', `Query Intelligence: "mouse under 500" extracted clean keyword "${mouseIntent.cleanKeyword}"`);
  assert(mouseIntent.detectedFilters.maxPrice === 500, `Query Intelligence: "mouse under 500" extracted maxPrice: ${mouseIntent.detectedFilters.maxPrice}`);
  assert(mouseIntent.detectedFilters.category === 'mouse', `Query Intelligence: "mouse under 500" detected category: ${mouseIntent.detectedFilters.category}`);
  assert(mouseIntent.isNaturalLanguage === true, 'Query Intelligence: marked as natural language');

  // Test 45: Search Retrieval - "mouse under 500" Price Enforcement & Precision
  const mouseUnder500Results = engine.search({
    q: mouseIntent.cleanKeyword,
    maxPrice: mouseIntent.detectedFilters.maxPrice
  });
  const hasHpMouse = mouseUnder500Results.products.some(p => p.id === 'prod-008');
  const hasDellMouse = mouseUnder500Results.products.some(p => p.id === 'prod-009');
  const hasExpensiveLogitech = mouseUnder500Results.products.some(p => p.id === 'prod-010');
  const allSub500 = mouseUnder500Results.products.every(p => (p.discountPrice || p.price) <= 500);

  assert(hasHpMouse, 'Search Retrieval: "mouse under 500" returns HP Optical Mouse (₹349)');
  assert(hasDellMouse, 'Search Retrieval: "mouse under 500" returns Dell WM126 Mouse (₹489)');
  assert(!hasExpensiveLogitech, 'Search Retrieval: "mouse under 500" strictly excludes Logitech MX Master (₹8495)');
  assert(allSub500, 'Search Retrieval: all returned products strictly satisfy maxPrice <= 500');

  // Test 46: Brand Searches - Exact and Query Retrieval across Brands
  const hpSearch = engine.search({ brand: 'HP' });
  assert(hpSearch.products.length === 2 && hpSearch.products.every(p => p.brand === 'HP'), 'Brand Search: filter brand="HP" returns all HP items');

  const dellSearch = engine.search({ q: 'Dell' });
  assert(dellSearch.products.length >= 1 && dellSearch.products[0].brand === 'Dell', 'Brand Search: query q="Dell" matches Dell brand products');

  const logitechSearch = engine.search({ q: 'Logitech' });
  assert(logitechSearch.products.length >= 1 && logitechSearch.products[0].brand === 'Logitech', 'Brand Search: query q="Logitech" matches Logitech brand products');

  const sonySearch = engine.search({ q: 'Sony' });
  assert(sonySearch.products.some(p => p.brand === 'Sony'), 'Brand Search: query q="Sony" matches Sony');

  const samsungSearch = engine.search({ q: 'Samsung' });
  assert(samsungSearch.products.some(p => p.brand === 'Samsung'), 'Brand Search: query q="Samsung" matches Samsung');

  const nikeSearch = engine.search({ q: 'Nike' });
  assert(nikeSearch.products.some(p => p.brand === 'Nike'), 'Brand Search: query q="Nike" matches Nike');

  // Test 47: Category Searches - Category Navigation & Natural Query
  const catElectronics = engine.search({ category: 'cat-electronics' });
  assert(catElectronics.products.length >= 4, `Category Search: "cat-electronics" returns all electronics items (got: ${catElectronics.products.length})`);

  const mouseCategoryQuery = engine.search({ q: 'mouse' });
  assert(mouseCategoryQuery.products.length === 3, `Category Search: q="mouse" returns all 3 mice in catalog (got: ${mouseCategoryQuery.products.length})`);

  const laptopIntent = parseIntentRuleBased('laptops');
  assert(laptopIntent.detectedFilters.category === 'laptops', 'Category Search: "laptops" detected category laptops');

  // Test 48: Combined Multi-Faceted Filters (Brand + Category + MaxPrice + InStock)
  const combinedFilterRes = engine.search({
    brand: 'HP',
    category: 'cat-electronics',
    maxPrice: 500,
    inStock: true
  });
  assert(combinedFilterRes.products.length === 1 && combinedFilterRes.products[0].id === 'prod-008', 'Combined Filters: brand="HP" + category="electronics" + maxPrice=500 + inStock=true isolates HP Optical Mouse');

  const electronicsInStockSub600 = engine.search({
    category: 'cat-electronics',
    maxPrice: 600,
    inStock: true
  });
  const noOutOfStockSony = !electronicsInStockSub600.products.some(p => p.id === 'prod-005');
  const noLogitech = !electronicsInStockSub600.products.some(p => p.id === 'prod-010');
  assert(noOutOfStockSony && noLogitech && electronicsInStockSub600.products.length === 2, 'Combined Filters: electronics + maxPrice 600 + inStock isolates HP and Dell mice');

  // Test 49: Conversational Query Intelligence + Combined Filter
  const wirelessMouseIntent = parseIntentRuleBased('wireless mouse under 1000');
  assert(wirelessMouseIntent.detectedFilters.maxPrice === 1000, 'Conversational Query: "wireless mouse under 1000" extracted maxPrice: 1000');
  assert(wirelessMouseIntent.semanticTags.includes('wireless'), 'Conversational Query: extracted semantic tag "wireless"');
  
  const wirelessMouseResults = engine.search({
    q: wirelessMouseIntent.cleanKeyword,
    maxPrice: wirelessMouseIntent.detectedFilters.maxPrice
  });
  assert(wirelessMouseResults.products.some(p => p.id === 'prod-009'), 'Conversational Query: returns Dell WM126 Wireless Mouse');
  assert(!wirelessMouseResults.products.some(p => p.id === 'prod-010'), 'Conversational Query: excludes Logitech MX Master (price > 1000)');

  // Test 50: ViBa Ranking Engine - Availability Boost
  const rankingWeights = searchCurationManager.getRankingWeights();
  assert(rankingWeights.textRelevanceWeight > 0 && rankingWeights.availabilityWeight > 0, 'ViBa Ranking Engine: weights are configured and active');
  assert(rankingWeights.qualityWeight > 0 && rankingWeights.popularityWeight > 0, 'ViBa Ranking Engine: quality and popularity weights configured');

  // Test 51: Dynamic Suggestion Engine - Popular Searches without Hard-coding
  const popularRes = engine.getPopularSearches(6);
  assert(Array.isArray(popularRes.suggestions) && popularRes.suggestions.length > 0, `Suggestion Engine: generated ${popularRes.suggestions.length} dynamic popular searches`);
  assert(popularRes.suggestions.every(item => typeof item.title === 'string' && item.title.length > 0), 'Suggestion Engine: all popular searches have valid titles');
  assert(popularRes.suggestions.some(item => item.type === 'category' || item.type === 'brand' || item.type === 'popular'), 'Suggestion Engine: suggestions have valid catalog types');

  // Test 52: Suggestion Engine - Multi-category Buckets
  const mouSuggestions = engine.suggest('mou');
  assert(mouSuggestions.products.length > 0 && mouSuggestions.products.some(p => p.title.toLowerCase().includes('mouse')), 'Suggestion Engine: suggests matching products for "mou"');

  // Test 53: Retrieval Engine - Meilisearch Service Status & Schema Contract
  const meiliStatus = meiliSearchService.getStatus();
  assert(meiliStatus.isEnabled === true, 'Retrieval Engine: Meilisearch integration is enabled');
  assert(typeof meiliStatus.isAvailable === 'boolean', 'Retrieval Engine: Meilisearch availability is tracked');
  assert(meiliStatus.indexName === 'viba_products', `Retrieval Engine: configured index is "${meiliStatus.indexName}"`);

  // Test 54: Retrieval Engine - Document Schema Conversion for Meilisearch
  const allDocsForMeili = engine.getAllDocs();
  assert(allDocsForMeili.length === 11, `Retrieval Engine: getAllDocs() returns 11 documents (got: ${allDocsForMeili.length})`);
  const hpDoc = allDocsForMeili.find(d => d.id === 'prod-008');
  assert(hpDoc !== undefined && hpDoc.effectivePrice === 349 && hpDoc.inStock === true, 'Retrieval Engine: document has required Meilisearch attributes (effectivePrice, inStock)');

  // Test 55: Retrieval Engine - Resilient Fallback Handling
  const syncResult = await meiliSearchService.syncAll(allDocsForMeili);
  assert(typeof syncResult === 'number', 'Retrieval Engine: syncAll returns numeric count without throwing unhandled error');

  // Test 56: Product Synchronization - Real-time Upsert and Deletion
  const tempProduct: Product = {
    id: 'prod-temp-999',
    name: 'Temporary Test Wireless Bluetooth Earphone',
    brand: 'TestBrand',
    productCode: '8900 0996 9999',
    sku: 'TST-TMP-EAR',
    categoryId: 'cat-electronics',
    price: 999,
    discountPrice: 799,
    stock: 5,
    inStock: true,
    rating: 4.0,
    numReviews: 10,
    status: 'active',
    isVisible: true,
    tags: ['earphones', 'wireless', 'bluetooth'],
    vendorId: 'v-01',
    images: [],
    description: 'Temporary item for real-time synchronization test',
    createdAt: '2026-01-12T00:00:00.000Z'
  };

  const upserted = engine.upsertProduct(tempProduct, 'Electronics');
  assert(upserted !== null && engine.getCount() === 12, 'Product Sync: dynamically upserted product into search index');
  
  const searchTemp = engine.search({ q: 'Temporary Test' });
  assert(searchTemp.products.some(p => p.id === 'prod-temp-999'), 'Product Sync: newly upserted product is immediately searchable');

  const removed = engine.removeProduct('prod-temp-999');
  assert(removed === true && engine.getCount() === 11, 'Product Sync: removed temporary product from search index');

  const searchTempAfterRemove = engine.search({ q: 'Temporary Test' });
  assert(!searchTempAfterRemove.products.some(p => p.id === 'prod-temp-999'), 'Product Sync: removed product no longer appears in search');

  // Test 57: Zero-Result Recovery & Typo Suggestion on Peripherals
  const typoPeripheral = engine.search({ q: 'logtech mose' });
  assert(typoPeripheral.hasAutoCorrected || (typoPeripheral.recovery && Boolean(typoPeripheral.recovery.suggestedQuery)) || typoPeripheral.products.length > 0, 'Zero-Result Recovery: handles peripheral typo ("logtech mose")');

  // Test 58: Zero-Result Analytics Telemetry
  const zeroRes = engine.search({ q: 'zyxquantumcorenonexistent777' });
  assert(zeroRes.recovery !== undefined && Array.isArray(zeroRes.recovery.suggestedCategories), 'Zero-Result Recovery: returns recovery recommendations');

  // Test 59: Phase 3 Scenario — Price Range Boundaries: "headphones between 1000 and 2000"
  const midTierHeadphones: Product = {
    id: 'prod-012',
    name: 'boAt Rockerz 450 Bluetooth On-Ear Headphones with Mic',
    brand: 'boAt',
    productCode: '8900 0996 3002',
    sku: 'BOAT-ROC450-BLK',
    categoryId: 'cat-electronics',
    subCategoryId: 'sub-audio',
    price: 3990,
    discountPrice: 1499,
    stock: 35,
    inStock: true,
    rating: 4.4,
    numReviews: 520,
    status: 'active',
    isVisible: true,
    tags: ['headphones', 'earphones', 'wireless', 'bluetooth', 'audio', 'boat'],
    vendorId: 'v-03',
    images: ['https://example.com/boat450.jpg'],
    description: 'boAt Rockerz 450 wireless on-ear headphones with 15 hours battery.',
    createdAt: '2026-01-12T00:00:00.000Z'
  };
  engine.upsertProduct(midTierHeadphones, 'Electronics', 'Audio & Headphones');

  const headphoneRangeIntent = parseIntentRuleBased('headphones between 1000 and 2000');
  assert(headphoneRangeIntent.detectedFilters.minPrice === 1000, 'Price Range: "headphones between 1000 and 2000" extracted minPrice: 1000');
  assert(headphoneRangeIntent.detectedFilters.maxPrice === 2000, 'Price Range: "headphones between 1000 and 2000" extracted maxPrice: 2000');
  
  const headphoneRangeSearch = engine.search({
    q: headphoneRangeIntent.cleanKeyword,
    minPrice: headphoneRangeIntent.detectedFilters.minPrice,
    maxPrice: headphoneRangeIntent.detectedFilters.maxPrice
  });
  assert(headphoneRangeSearch.products.some(p => p.id === 'prod-012'), 'Price Range: returns boAt Rockerz 450 (₹1499) within 1000-2000 range');
  assert(!headphoneRangeSearch.products.some(p => p.id === 'prod-005'), 'Price Range: strictly excludes Sony WH-1000XM5 (₹26990)');

  // Test 60: Phase 3 Scenario — Attribute Search: "wireless mouse under 500"
  const wirelessMouse500Intent = parseIntentRuleBased('wireless mouse under 500');
  assert(wirelessMouse500Intent.detectedFilters.maxPrice === 500, 'Attribute Search: "wireless mouse under 500" extracted maxPrice: 500');
  assert(wirelessMouse500Intent.semanticTags.includes('wireless'), 'Attribute Search: extracted semantic tag "wireless"');

  const wirelessMouse500Search = engine.search({
    q: 'wireless mouse',
    maxPrice: 500
  });
  assert(wirelessMouse500Search.products.some(p => p.id === 'prod-009'), 'Attribute Search: returns Dell WM126 Wireless Mouse (₹489)');
  assert(!wirelessMouse500Search.products.some(p => p.id === 'prod-008'), 'Attribute Search: excludes HP Wired Optical Mouse (not wireless)');
  assert(!wirelessMouse500Search.products.some(p => p.id === 'prod-010'), 'Attribute Search: excludes Logitech MX Master (₹8495 above ₹500)');

  // Test 61: Phase 3 Scenario — Sorting: "mouse under 500", price low to high
  const sortedMouseSearch = engine.search({
    q: 'mouse',
    maxPrice: 500,
    sortBy: 'price-asc'
  });
  assert(sortedMouseSearch.products.length >= 2, 'Sorting: "mouse under 500" returns eligible products');
  assert(sortedMouseSearch.products[0].id === 'prod-008', 'Sorting: HP Optical Mouse (₹349) is ranked first in price-asc');
  assert(sortedMouseSearch.products[1].id === 'prod-009', 'Sorting: Dell WM126 Mouse (₹489) is ranked second in price-asc');
  const isAscending = (sortedMouseSearch.products[0].discountPrice || sortedMouseSearch.products[0].price) <=
                      (sortedMouseSearch.products[1].discountPrice || sortedMouseSearch.products[1].price);
  assert(isAscending, 'Sorting: effective prices are in strictly ascending order');

  // Test 62: Phase 3 Scenario — Spelling Correction: "wirless mose"
  const typoCorrection = SpellingCorrectionEngine.correct('wirless mose', engine.getAllDocs());
  assert(typoCorrection.hasCorrection === true, 'Spelling Correction: "wirless mose" flags hasCorrection: true');
  assert(typoCorrection.correctedQuery === 'wireless mouse', `Spelling Correction: "wirless mose" corrects to "wireless mouse" (got: "${typoCorrection.correctedQuery}")`);

  const typoSearch = engine.search({ q: 'wirless mose' });
  assert(typoSearch.hasAutoCorrected === true, 'Spelling Correction: search automatically sets hasAutoCorrected: true');
  assert(typoSearch.products.some(p => p.id === 'prod-009'), 'Spelling Correction: search retrieves Dell Wireless Mouse for "wirless mose"');

  // Test 63: Phase 3 Scenario — No Results with Strict Budget: "gaming mouse under 10"
  const zeroBudgetSearch = engine.search({
    q: 'gaming mouse',
    maxPrice: 10
  });
  assert(zeroBudgetSearch.products.length === 0, 'No Results: "gaming mouse under 10" returns 0 matching products');
  assert(zeroBudgetSearch.total === 0, 'No Results: total count is strictly 0 without ignoring budget');
  assert(zeroBudgetSearch.recovery !== undefined, 'No Results: returns genuine recovery suggestions');

  // Test 64: Phase 3 Scenario — Hindi / Hinglish Query Intelligence
  const hinglishIntent1 = parseIntentRuleBased('sasta mouse');
  assert(hinglishIntent1.detectedFilters.sortBy === 'price-asc', 'Hinglish Intent: "sasta mouse" extracts sortBy: price-asc');
  assert(hinglishIntent1.cleanKeyword === 'mouse', `Hinglish Intent: cleanKeyword is "mouse" (got: "${hinglishIntent1.cleanKeyword}")`);

  const hinglishIntent2 = parseIntentRuleBased('ladko ke joote');
  assert(hinglishIntent2.detectedFilters.gender === 'men', 'Hinglish Intent: "ladko ke joote" extracts gender: men');
  assert(hinglishIntent2.detectedFilters.category === 'shoes', 'Hinglish Intent: "ladko ke joote" extracts category: shoes');

  // Test 65: Dynamic Budget-Aware Autocomplete Suggestions for "mou"
  const mouSuggestionsDynamic = engine.suggest('mou');
  assert(mouSuggestionsDynamic.suggestions.length > 0, 'Autocomplete: "mou" returns suggestions');
  const hasBudgetSuggestion = mouSuggestionsDynamic.suggestions.some(s => s.title.toLowerCase().includes('mouse under'));
  assert(hasBudgetSuggestion, 'Autocomplete: "mou" includes dynamic budget-aware suggestion (e.g. "Mouse under ₹500")');

  // Test 66: Security Guardrails — Malformed queries, boundary limits & drafts
  const hugeQuery = 'a'.repeat(500);
  const sanitizedHuge = sanitizeSearchString(hugeQuery);
  assert(sanitizedHuge.length <= 200, 'Security: query length is sanitized and capped at 200 characters');

  const draftSearch = engine.search({ q: 'Secret Internal Draft Product' });
  assert(!draftSearch.products.some(p => p.id === 'prod-006'), 'Security: draft products are never exposed to standard customer searches');

  const hiddenSearch = engine.search({ q: 'Hidden Inactive Product' });
  assert(!hiddenSearch.products.some(p => p.id === 'prod-007'), 'Security: inactive/hidden products are never exposed to customers');

  // Test 67 & 68: Performance Benchmarks — Latency Targets (Phase 4)
  const suggestLatencies: number[] = [];
  const testQueries = ['m', 'mo', 'mou', 'mous', 'mouse', 'wir', 'wire', 'wireless', 'head', 'lap', 'sh', 'sho', 'kur'];
  for (let i = 0; i < 50; i++) {
    const q = testQueries[i % testQueries.length];
    const t0 = performance.now();
    engine.suggest(q, 8);
    suggestLatencies.push(performance.now() - t0);
  }
  suggestLatencies.sort((a, b) => a - b);
  const p95Suggest = suggestLatencies[Math.floor(suggestLatencies.length * 0.95)];
  assert(p95Suggest < 200, `Performance: Autocomplete p95 latency is ${p95Suggest.toFixed(2)}ms (target < 200ms)`);

  const searchLatencies: number[] = [];
  const searchQueries = [
    'mouse under 500', 'wireless mouse under 500', 'headphones between 1000 and 2000',
    'wirless mose', 'blue cotton shirt for men', 'sasta mouse', 'shoes', 'kurti under 400'
  ];
  for (let i = 0; i < 50; i++) {
    const sq = searchQueries[i % searchQueries.length];
    const t0 = performance.now();
    engine.search({ q: sq });
    searchLatencies.push(performance.now() - t0);
  }
  searchLatencies.sort((a, b) => a - b);
  const p95Search = searchLatencies[Math.floor(searchLatencies.length * 0.95)];
  assert(p95Search < 400, `Performance: Search retrieval p95 latency is ${p95Search.toFixed(2)}ms (target < 400ms)`);

  // Test 69: Character N-Grams — Substring and Partial Word Generation & Dice Coefficient
  const ngrams = generateNGrams('headphones', 3);
  assert(ngrams.size > 5, 'Character N-Grams: generates 3-grams with boundary padding');
  const simTypo = ngramSimilarity('headfone', 'headphones');
  assert(simTypo > 0.40, `Character N-Grams: "headfone" vs "headphones" yields high Dice overlap (${simTypo.toFixed(2)})`);
  const simInfix = ngramSimilarity('1000xm', 'Sony WH-1000XM5');
  assert(simInfix > 0.65, `Character N-Grams: detects partial infix "1000xm" in "Sony WH-1000XM5" (${simInfix.toFixed(2)})`);

  // Test 70: RapidFuzz-style Fuzzy Matching (Ratio, Partial Ratio, Token Sort, Token Set)
  const fRatio = fuzzyRatio('samsung', 'samsong');
  assert(fRatio >= 0.85, `RapidFuzz: fuzzyRatio detects single-character vowel typo (${fRatio.toFixed(2)})`);
  const pRatioVal = partialRatio('galaxy', 'Samsung Galaxy S24 Ultra');
  assert(pRatioVal === 1.0, 'RapidFuzz: partialRatio matches exact substring with 1.0 score');
  const sortRatioVal = tokenSortRatio('men shoes nike', 'Nike Shoes Men');
  assert(sortRatioVal === 1.0, 'RapidFuzz: tokenSortRatio achieves 1.0 regardless of word order');
  const setRatioVal = tokenSetRatio('running shoes nike blue premium', 'Nike Shoes');
  assert(setRatioVal === 1.0, 'RapidFuzz: tokenSetRatio matches subset of tokens with 1.0 score');
  const compositeFuzz = rapidFuzzScore('shoes running', 'Nike Air Zoom Pegasus 40 Running Shoes for Men');
  assert(compositeFuzz >= 0.80, `RapidFuzz: composite rapidFuzzScore achieves high match (${compositeFuzz.toFixed(2)})`);

  // Test 71: Local TF-IDF Vector Indexing and Scoring
  const localTfIdf = new LocalTfIdfIndex();
  localTfIdf.addDocument('d1', 'samsung galaxy smartphone flagship titanium camera');
  localTfIdf.addDocument('d2', 'nike running shoes lightweight foam cushioning');
  localTfIdf.addDocument('d3', 'sony wireless headphones noise cancelling audio');
  const tfidfScore1 = localTfIdf.score('d1', ['samsung', 'camera']);
  const tfidfScore2 = localTfIdf.score('d2', ['samsung', 'camera']);
  assert(tfidfScore1 > 0 && tfidfScore2 === 0, 'Local TF-IDF: scores salient term "samsung" high on d1 and 0 on d2');
  localTfIdf.removeDocument('d1');
  assert(localTfIdf.score('d1', ['samsung']) === 0, 'Local TF-IDF: document removal correctly cleans term frequencies');

  // Test 72: Local Sentence / Semantic Vector Embeddings & Cosine Similarity
  const v1 = LocalSentenceEmbedding.embed('wireless bluetooth earbuds');
  const v2 = LocalSentenceEmbedding.embed('boAt Rockerz 450 wireless on-ear headphones');
  const v3 = LocalSentenceEmbedding.embed('pure silk wedding saree for women');
  assert(v1.length === 64, 'Local Semantic Embeddings: produces normalized 64-dimensional dense vector');
  const selfSim = LocalSentenceEmbedding.cosineSimilarity(v1, v1);
  assert(Math.abs(selfSim - 1.0) < 0.001, 'Local Semantic Embeddings: self-similarity is strictly 1.0');
  const audioSim = LocalSentenceEmbedding.cosineSimilarity(v1, v2);
  const crossCatSim = LocalSentenceEmbedding.cosineSimilarity(v1, v3);
  assert(audioSim > crossCatSim, `Local Semantic Embeddings: related audio queries (${audioSim.toFixed(2)}) score higher than saree (${crossCatSim.toFixed(2)})`);

  // Test 73: Multi-Token Reordered & Non-Exact Title Search (Exact Title NOT Required)
  const reorderedSearch = engine.search({ q: 'shoes men nike' });
  assert(reorderedSearch.products.some(p => p.id === 'prod-003'), 'Non-Exact Search: "shoes men nike" retrieves Nike Pegasus without exact title match');
  const wirelessDellSearch = engine.search({ q: 'wireless dell mouse' });
  assert(wirelessDellSearch.products.some(p => p.id === 'prod-009'), 'Non-Exact Search: "wireless dell mouse" retrieves Dell Wireless Mouse');

  // Test 74: Partial-Word Infix and Substring Matching across Titles and SKUs
  const infixSearch = engine.search({ q: '1000xm' });
  assert(infixSearch.products.some(p => p.id === 'prod-005'), 'Partial-Word Infix: "1000xm" retrieves Sony WH-1000XM5');
  const skuPartialSearch = engine.search({ q: 's24u' });
  assert(skuPartialSearch.products.some(p => p.id === 'prod-001'), 'Partial SKU: "s24u" retrieves Samsung Galaxy S24 Ultra');

  // Test 75: Configurable Ranking Weights
  const currentWeights = searchCurationManager.getRankingWeights();
  assert(typeof currentWeights.fuzzyWeight === 'number' && currentWeights.fuzzyWeight > 0, 'Ranking Weights: fuzzyWeight is configured');
  assert(typeof currentWeights.ngramWeight === 'number' && currentWeights.ngramWeight > 0, 'Ranking Weights: ngramWeight is configured');
  assert(typeof currentWeights.semanticWeight === 'number' && currentWeights.semanticWeight > 0, 'Ranking Weights: semanticWeight is configured');

  // Test 76: Search Service Incremental Index Synchronization
  await searchService.initialize();
  const testSyncProd: Product = {
    id: 'prod-sync-test',
    name: 'Anker Soundcore Space One Wireless Headphones',
    brand: 'Anker',
    productCode: '8900 9999 0001',
    sku: 'ANK-SPACE1-BLK',
    categoryId: 'cat-electronics',
    subCategoryId: 'sub-audio',
    price: 9999,
    discountPrice: 7999,
    stock: 20,
    inStock: true,
    rating: 4.7,
    numReviews: 120,
    status: 'active',
    isVisible: true,
    tags: ['anker', 'soundcore', 'headphones', 'wireless', 'noise cancelling'],
    vendorId: 'v-test',
    images: ['https://example.com/anker.jpg'],
    description: 'Active noise cancelling wireless headphones with 40-hour playtime.',
    createdAt: new Date().toISOString()
  };
  searchService.upsertProduct(testSyncProd);
  const syncLookup = await searchService.search({ q: 'Soundcore Space One' });
  assert(syncLookup.products.some(p => p.id === 'prod-sync-test'), 'SearchService Sync: newly upserted product is immediately searchable');
  searchService.removeProduct('prod-sync-test');
  const syncAfterRemove = await searchService.search({ q: 'Soundcore Space One' });
  assert(!syncAfterRemove.products.some(p => p.id === 'prod-sync-test'), 'SearchService Sync: removed product is immediately evicted from index');

  // ==========================================
  // PHASE 6: ADVANCED AI/ML & MULTI-SIGNAL SEARCH CAPABILITIES
  // ==========================================

  // Test 77: Extensible Ranking Framework — 200+ Signals Architecture & Active Signals
  const totalSigCount = rankingFramework.getTotalSignalsCount();
  const activeSigCount = rankingFramework.getActiveSignalsCount();
  assert(totalSigCount >= 200, `Ranking Framework: registry supports 200+ signals architecture (got: ${totalSigCount})`);
  assert(activeSigCount === 24, `Ranking Framework: exactly 24 active validated signals implemented (got: ${activeSigCount})`);
  const activeSignals = rankingFramework.getActiveSignals();
  assert(activeSignals.every(s => s.min === 0 && s.max === 1), 'Ranking Framework: all active signals normalized to [0, 1]');

  // Test 78: Relevance Guardrail — Business Signals cannot override Query Relevance
  const dummyDoc = (engine as any).indexedDocs.get('prod-001')!;
  const guardedBreakdown = rankingFramework.evaluate({
    query: 'somethingcompletelyunrelated',
    cleanQuery: 'somethingcompletelyunrelated',
    queryTokens: ['somethingcompletelyunrelated'],
    doc: dummyDoc,
    baseScore: 0.1
  });
  assert(guardedBreakdown.relevanceGuardrailApplied === true, 'Relevance Guardrail: applied when query relevance is near zero');

  // Test 79: Session-Aware Ranking — Affinity Tracking, Bounded Influence, and Reset
  const testSessionId = 'sess-test-999';
  sessionRankingManager.recordEvent(testSessionId, {
    type: 'click',
    categoryId: 'cat-electronics',
    brand: 'Sony',
    price: 25000
  });
  const sessionCtx = sessionRankingManager.getSessionContext(testSessionId);
  assert(sessionCtx !== undefined && sessionCtx.brandWeights['sony'] > 0, 'Session Ranking: records brand interaction');
  assert(sessionCtx !== undefined && sessionCtx.categoryWeights['cat-electronics'] > 0, 'Session Ranking: records category interaction');

  const sonyDoc = (engine as any).indexedDocs.get('prod-005')!;
  const sessionMultiplier = sessionRankingManager.computeSessionMultiplier(sonyDoc, testSessionId);
  assert(sessionMultiplier > 1.0 && sessionMultiplier <= 1.15, `Session Ranking: session multiplier strictly bounded within [1.0, 1.15] (got: ${sessionMultiplier.toFixed(3)})`);

  const anonymousMultiplier = sessionRankingManager.computeSessionMultiplier(sonyDoc, undefined);
  assert(anonymousMultiplier === 1.0, 'Session Ranking: anonymous user receives neutral 1.0 multiplier without penalty');

  const resetOk = sessionRankingManager.resetSession(testSessionId);
  assert(resetOk === true && sessionRankingManager.getSessionContext(testSessionId) === undefined, 'Session Ranking: resets context cleanly');

  // Test 80: Visual Search — Input Format Validation & Security
  let rejectedEmpty = false;
  try {
    visualSearchService.validateImageInput(Buffer.from([]));
  } catch {
    rejectedEmpty = true;
  }
  assert(rejectedEmpty, 'Visual Search: strictly rejects empty image payloads');

  let rejectedFormat = false;
  try {
    visualSearchService.validateImageInput(Buffer.from('this is not an image file'));
  } catch {
    rejectedFormat = true;
  }
  assert(rejectedFormat, 'Visual Search: strictly rejects invalid non-image formats');

  // Valid JPEG header test
  const sampleJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const validatedJpeg = visualSearchService.validateImageInput(sampleJpeg);
  assert(validatedJpeg.mimeType === 'image/jpeg', 'Visual Search: correctly validates JPEG magic bytes');

  // Test 81: Visual Search — 128D Dense Visual Vector Extraction & In-Memory Matching
  const visualVec = visualSearchService.extractVisualVector(sampleJpeg);
  assert(visualVec.length === 128, 'Visual Search: produces normalized 128-dimensional dense visual feature vector');

  // Initialize visual search with catalog products
  visualSearchService.initialize(engine.getAllDocs().map(d => d.raw));
  const visStatus = visualSearchService.getStatus();
  assert(visStatus.indexedVisualCount > 0, `Visual Search: indexed ${visStatus.indexedVisualCount} catalog images into memory`);

  const visualMatches = visualSearchService.searchByImage(sampleJpeg, {}, 5);
  assert(visualMatches.success && visualMatches.results.length > 0, 'Visual Search: matches query image against catalog embeddings');
  assert(visualMatches.results[0].visualSimilarity > 0, `Visual Search: computes valid visual similarity (${visualMatches.results[0].visualSimilarity})`);

  // Test 82: Visual Search with Catalog Filters
  const filteredVisual = visualSearchService.searchByImage(sampleJpeg, { maxPrice: 1000 }, 10);
  assert(filteredVisual.success, 'Visual Search: combines visual similarity with price constraints');

  // Test 83: Visual Index Incremental Synchronization
  visualSearchService.upsertProduct(testSyncProd);
  assert(visualSearchService.getStatus().indexedVisualCount >= visStatus.indexedVisualCount, 'Visual Search: incrementally updates when product is added');
  visualSearchService.removeProduct('prod-sync-test');

  // Test 84: Two-Stage Search Latency Telemetry Breakdown
  const telemSearch = engine.search({ q: 'wireless mouse' });
  assert(telemSearch.telemetry !== undefined, 'Two-Stage Search: emits latency telemetry breakdown');
  assert(typeof telemSearch.telemetry?.candidateRetrievalMs === 'number', 'Telemetry: candidateRetrievalMs is tracked');
  assert(typeof telemSearch.telemetry?.modelInferenceMs === 'number', 'Telemetry: modelInferenceMs is tracked');
  assert(typeof telemSearch.telemetry?.rerankingMs === 'number', 'Telemetry: rerankingMs is tracked');
  assert(typeof telemSearch.telemetry?.totalExecutionMs === 'number', 'Telemetry: totalExecutionMs is tracked');

  // Test 85: Benchmark Suite Execution & Sub-60 ms Latency Compliance
  const benchReport = searchBenchmarkSuite.runBenchmark(engine, 2);
  assert(benchReport.metrics.totalExecution.p50 < 60, `Performance Target: p50 total latency is ${benchReport.metrics.totalExecution.p50}ms (Target: < 60ms)`);
  assert(benchReport.metrics.candidateRetrieval.p50 < 20, `Performance Target: candidate retrieval p50 is ${benchReport.metrics.candidateRetrieval.p50}ms`);
  assert(benchReport.sub60msComplianceRate > 90, `Performance Target: sub-60ms compliance rate is ${benchReport.sub60msComplianceRate}%`);

  console.log('\n----------------------------------------------------');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('----------------------------------------------------\n');

  return failed === 0;
}


