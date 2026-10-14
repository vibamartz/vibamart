import { ViBaSearchEngine } from '../searchEngine';
import { Product } from '../../../shared/types';
import { SearchParams, SearchResult } from '../searchTypes';
import { SearchCache } from '../searchCache';
import { searchCurationManager } from '../searchCuration';
import { recordSearchAnalytics, getInMemoryAnalytics } from '../searchAnalytics';
import { parseIntentRuleBased, parseQueryIntent, getSemanticSearchStatus } from '../semanticSearch';
import { sanitizeSearchParams, sanitizeSearchString } from '../searchSanitization';
import { requireSearchAdmin } from '../searchAuth';


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
  const recoveryResult = recoveryEngine.search({ q: 'headfone' });
  assert(
    recoveryResult.recovery !== undefined &&
    recoveryResult.recovery.suggestedQuery === 'headphones' &&
    recoveryResult.correctedQuery === 'headphones',
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
  assert(authDenied, 'Security: requireSearchAdmin rejects unauthenticated requests in production environment');

  console.log('\n----------------------------------------------------');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('----------------------------------------------------\n');

  return failed === 0;
}


