import { ViBaSearchEngine } from '../searchEngine';
import { Product } from '../../../shared/types';
import { SearchLRUCache, createSearchCacheKey } from '../searchCache';
import { sanitizeSearchQuery } from '../searchAnalytics';
import { registerCustomSynonymGroups, getSynonymsForTerm } from '../searchSynonyms';
import { SearchRateLimiter } from '../searchRateLimiter';

// Fixture Products representing a realistic catalog
export const MOCK_CATALOG: Product[] = [
  {
    id: 'prod-iphone-15',
    name: 'Apple iPhone 15 Pro Max 256GB Natural Titanium',
    brand: 'Apple',
    productCode: '8900 0996 1001',
    sku: 'APL-IP15PM-256',
    categoryId: 'mobiles',
    subCategoryId: 'smartphones',
    nestedSubCategoryId: 'ios-phones',
    description: 'The ultimate iPhone with titanium design, A17 Pro chip, and 5x Telephoto camera.',
    price: 159900,
    discountPrice: 149900,
    discountPercentage: 6,
    stock: 25,
    status: 'active',
    rating: 4.8,
    numReviews: 450,
    vendorId: 'v-apple',
    images: ['https://example.com/iphone15.jpg'],
    color: 'Natural Titanium',
    tags: ['apple', 'iphone', '5g', 'flagship', 'mobile', 'smartphone', 'ios'],
    isVisible: true,
    createdAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'prod-case-iphone-15',
    name: 'Silicone Case Compatible with Apple iPhone 15 Pro Max',
    brand: 'Spigen',
    productCode: '8900 0996 1002',
    sku: 'SPG-IP15-CS',
    categoryId: 'accessories',
    subCategoryId: 'mobile-accessories',
    nestedSubCategoryId: 'covers',
    description: 'Slim protective shockproof cover compatible with Apple iPhone 15 Pro Max.',
    price: 1499,
    discountPrice: 999,
    discountPercentage: 33,
    stock: 80,
    status: 'active',
    rating: 4.4,
    numReviews: 120,
    vendorId: 'v-spigen',
    images: ['https://example.com/case.jpg'],
    color: 'Midnight Blue',
    tags: ['case', 'cover', 'silicone', 'iphone accessories'],
    isVisible: true,
    createdAt: '2026-09-05T10:00:00.000Z'
  },
  {
    id: 'prod-samsung-s24',
    name: 'Samsung Galaxy S24 Ultra 5G AI Smartphone',
    brand: 'Samsung',
    productCode: '8900 0996 2001',
    sku: 'SAM-S24U-512',
    categoryId: 'mobiles',
    subCategoryId: 'smartphones',
    nestedSubCategoryId: 'android-phones',
    description: 'Galaxy AI smartphone with 200MP camera and embedded S Pen stylus.',
    price: 129999,
    discountPrice: 119999,
    discountPercentage: 8,
    stock: 15,
    status: 'active',
    rating: 4.7,
    numReviews: 310,
    vendorId: 'v-samsung',
    images: ['https://example.com/s24.jpg'],
    color: 'Titanium Gray',
    tags: ['samsung', 'galaxy', 'ai', '5g', 'android', 'flagship', 'cellphone'],
    isVisible: true,
    createdAt: '2026-09-10T10:00:00.000Z'
  },
  {
    id: 'prod-nike-pegasus',
    name: 'Nike Air Zoom Pegasus 40 Mens Running Shoes',
    brand: 'Nike',
    productCode: '8900 0996 3001',
    sku: 'NK-PEG-40-BLK',
    categoryId: 'footwear',
    subCategoryId: 'sports-shoes',
    nestedSubCategoryId: 'running',
    description: 'Responsive everyday road running shoe with dual Zoom Air units and engineered mesh.',
    price: 10495,
    discountPrice: 7995,
    discountPercentage: 24,
    stock: 40,
    status: 'active',
    rating: 4.6,
    numReviews: 220,
    vendorId: 'v-nike',
    images: ['https://example.com/pegasus.jpg'],
    color: 'Black',
    size: 'UK 9',
    sizes: ['UK 8', 'UK 9', 'UK 10'],
    tags: ['nike', 'shoes', 'running', 'pegasus', 'sports', 'sneakers'],
    isVisible: true,
    createdAt: '2026-08-15T10:00:00.000Z'
  },
  {
    id: 'prod-adidas-ultraboost',
    name: 'Adidas Ultraboost Light Performance Sneaker',
    brand: 'Adidas',
    productCode: '8900 0996 3002',
    sku: 'AD-UB-LGT-WHT',
    categoryId: 'footwear',
    subCategoryId: 'sports-shoes',
    nestedSubCategoryId: 'running',
    description: 'Lightest Boost running footwear designed for maximum energy return.',
    price: 18999,
    discountPrice: 13999,
    discountPercentage: 26,
    stock: 18,
    status: 'active',
    rating: 4.5,
    numReviews: 180,
    vendorId: 'v-adidas',
    images: ['https://example.com/ultraboost.jpg'],
    color: 'Cloud White',
    size: 'UK 8',
    sizes: ['UK 8', 'UK 9', 'UK 10', 'UK 11'],
    tags: ['adidas', 'sneakers', 'boost', 'running shoes', 'trainers'],
    isVisible: true,
    createdAt: '2026-08-20T10:00:00.000Z'
  },
  {
    id: 'prod-macbook-air-m3',
    name: 'Apple MacBook Air 15-inch M3 Chip Laptop',
    brand: 'Apple',
    productCode: '8900 0996 4001',
    sku: 'APL-MBA15-M3',
    categoryId: 'laptops',
    subCategoryId: 'notebooks',
    nestedSubCategoryId: 'macbooks',
    description: 'Supercharged portable notebook with M3 chip and Liquid Retina display.',
    price: 134900,
    discountPrice: 124900,
    discountPercentage: 7,
    stock: 12,
    status: 'active',
    rating: 4.9,
    numReviews: 95,
    vendorId: 'v-apple',
    images: ['https://example.com/macbook.jpg'],
    color: 'Space Gray',
    tags: ['apple', 'macbook', 'laptop', 'notebook', 'm3', 'computer'],
    isVisible: true,
    createdAt: '2026-09-02T10:00:00.000Z'
  },
  {
    id: 'prod-inactive-item',
    name: 'Discontinued Old Model Phone',
    brand: 'Nokia',
    productCode: '8900 0996 9999',
    sku: 'NOK-OLD-01',
    categoryId: 'mobiles',
    subCategoryId: 'feature-phones',
    description: 'No longer sold.',
    price: 2999,
    stock: 0,
    status: 'inactive', // Inactive business status
    rating: 3.0,
    numReviews: 10,
    vendorId: 'v-nokia',
    images: [],
    isVisible: true,
    createdAt: '2025-01-01T10:00:00.000Z'
  },
  {
    id: 'prod-hidden-item',
    name: 'Private Secret VIP Smartphone Test',
    brand: 'SecretBrand',
    productCode: '8900 0996 8888',
    sku: 'SEC-PHONE-01',
    categoryId: 'mobiles',
    description: 'Internal testing only.',
    price: 9999,
    stock: 5,
    status: 'active',
    rating: 5.0,
    numReviews: 1,
    vendorId: 'v-secret',
    images: [],
    isVisible: false, // Hidden by admin toggle
    createdAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'prod-reward-item',
    name: 'Exclusive ViBa Reward Voucher Smartphone Coupon',
    brand: 'ViBa',
    productCode: '8900 0996 7777',
    sku: 'VIB-REW-01',
    categoryId: 'rewards',
    description: 'Special reward item.',
    price: 100,
    stock: 50,
    status: 'active',
    rating: 5.0,
    numReviews: 2,
    vendorId: 'v-viba',
    images: [],
    isVisible: true,
    createdAt: '2026-09-01T10:00:00.000Z'
  }
];

export function runAllTests(): { passed: number; failed: number; errors: string[] } {
  const engine = new ViBaSearchEngine();
  engine.setRewardProductIds(['prod-reward-item']);

  const categoryMap = new Map([
    ['mobiles', { cat: 'Mobiles & Tablets', sub: 'Smartphones' }],
    ['smartphones', { cat: 'Mobiles & Tablets', sub: 'Smartphones' }],
    ['ios-phones', { cat: 'Mobiles & Tablets', sub: 'Smartphones', nested: 'iOS Phones' }],
    ['android-phones', { cat: 'Mobiles & Tablets', sub: 'Smartphones', nested: 'Android Phones' }],
    ['accessories', { cat: 'Accessories', sub: 'Mobile Accessories' }],
    ['footwear', { cat: 'Footwear & Fashion', sub: 'Sports Shoes' }],
    ['sports-shoes', { cat: 'Footwear & Fashion', sub: 'Sports Shoes' }],
    ['laptops', { cat: 'Computers & Laptops', sub: 'Notebooks' }]
  ]);

  engine.indexProducts(MOCK_CATALOG, categoryMap);

  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(testName: string, condition: boolean, details?: string) {
    if (condition) {
      passed++;
      console.log(`  ✓ [PASS] ${testName}`);
    } else {
      failed++;
      const err = `  ✗ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`;
      console.error(err);
      errors.push(err);
    }
  }

  console.log('\n--- ViBa Mart Intelligent Search Engine Phase 1 Test Suite ---');

  // Test 1: Exact 12-digit Product Code lookup
  const res1 = engine.search({ q: '8900 0996 1001' });
  assert(
    'Exact 12-digit Product Code with spaces ranks target product #1',
    res1.items.length > 0 && res1.items[0].id === 'prod-iphone-15' && res1.exactIdentifierMatch === true
  );

  // Test 2: Clean 12-digit Product Code without spaces
  const res2 = engine.search({ q: '890009961001' });
  assert(
    'Cleaned unspaced 12-digit Product Code matches identical product',
    res2.items.length > 0 && res2.items[0].id === 'prod-iphone-15'
  );

  // Test 3: Exact SKU Lookup
  const res3 = engine.search({ q: 'NK-PEG-40-BLK' });
  assert(
    'Exact SKU lookup ranks product at #1',
    res3.items.length > 0 && res3.items[0].id === 'prod-nike-pegasus' && res3.exactIdentifierMatch === true
  );

  // Test 4: Relevance Ranking (iPhone product outranks iPhone case)
  const res4 = engine.search({ q: 'Apple iPhone 15 Pro Max' });
  assert(
    'Relevance ranking: Actual device outranks third-party protective case',
    res4.items.length >= 2 && res4.items[0].id === 'prod-iphone-15' && res4.items[1].id === 'prod-case-iphone-15',
    `First was ${res4.items[0]?.name}`
  );

  // Test 5: Typo Tolerance ("snikers" -> Nike/Adidas sneakers)
  const res5 = engine.search({ q: 'snikers' });
  const hasSneakers = res5.items.some(p => p.id === 'prod-nike-pegasus' || p.id === 'prod-adidas-ultraboost');
  assert(
    'Typo tolerance: Query "snikers" successfully retrieves sneaker/shoe products',
    hasSneakers,
    `Items returned: ${res5.items.map(i => i.name).join(', ')}`
  );

  // Test 6: Typo Tolerance ("iphne" -> Apple iPhone)
  const res6 = engine.search({ q: 'iphne' });
  assert(
    'Typo tolerance: Query "iphne" retrieves Apple iPhone',
    res6.items.some(p => p.id === 'prod-iphone-15')
  );

  // Test 7: Plural / Singular Stemming ("running shoe" matches "Running Shoes")
  const res7 = engine.search({ q: 'running shoe' });
  assert(
    'Stemming: Singular query "running shoe" matches plural "running shoes"',
    res7.items.some(p => p.id === 'prod-nike-pegasus')
  );

  // Test 8: Synonym Expansion ("smartphone" matches products categorized or tagged with "mobile")
  const res8 = engine.search({ q: 'cellphone' });
  assert(
    'Synonym expansion: Query "cellphone" returns Galaxy and iPhone smartphones',
    res8.items.some(p => p.id === 'prod-samsung-s24' || p.id === 'prod-iphone-15'),
    `Items returned: ${res8.items.map(i => i.name).join(', ')}`
  );

  // Test 9: Category & Price Filter Combined
  const res9 = engine.search({
    category: 'footwear',
    minPrice: 7000,
    maxPrice: 12000
  });
  assert(
    'Combined Category & Price filter returns only Nike Pegasus within price range',
    res9.items.length === 1 && res9.items[0].id === 'prod-nike-pegasus'
  );

  // Test 10: Brand Filter
  const res10 = engine.search({ brand: 'Apple' });
  assert(
    'Brand filter returns Apple products only',
    res10.items.length >= 2 && res10.items.every(p => p.brand === 'Apple')
  );

  // Test 11: Business Visibility Rules (Inactive, Hidden, Reward Exclusion)
  const res11 = engine.search({ q: 'phone' });
  const hasInactive = res11.items.some(p => p.id === 'prod-inactive-item');
  const hasHidden = res11.items.some(p => p.id === 'prod-hidden-item');
  const hasReward = res11.items.some(p => p.id === 'prod-reward-item');
  assert(
    'Business rules strictly exclude inactive, hidden, and reward products',
    !hasInactive && !hasHidden && !hasReward,
    `Inactive: ${hasInactive}, Hidden: ${hasHidden}, Reward: ${hasReward}`
  );

  // Test 12: Facet Calculation Accuracy
  const res12 = engine.search({ category: 'footwear' });
  const brandFacet = res12.facets.brands;
  const nikeFacet = brandFacet.find(b => b.name === 'Nike');
  const adidasFacet = brandFacet.find(b => b.name === 'Adidas');
  assert(
    'Facet computation accurately counts brands in footwear category',
    Boolean(nikeFacet && nikeFacet.count === 1 && adidasFacet && adidasFacet.count === 1),
    `Facets: ${JSON.stringify(brandFacet)}`
  );

  // Test 13: Sorting by Price Ascending
  const res13 = engine.search({ q: 'shoes', sortBy: 'price-asc' });
  assert(
    'Price ascending sort orders cheaper Nike Pegasus before Adidas Ultraboost',
    res13.items.length >= 2 &&
    (res13.items[0].discountPrice || res13.items[0].price) <= (res13.items[1].discountPrice || res13.items[1].price)
  );

  // Test 14: Server-Side Pagination
  const res14 = engine.search({ page: 1, limit: 2 });
  assert(
    'Pagination limit respects page=1 limit=2',
    res14.items.length === 2 && res14.limit === 2 && res14.page === 1 && res14.total > 2
  );

  // Test 15: Autocomplete Suggestion Prefix
  const suggestRes = engine.suggest('nik', 5);
  assert(
    'Autocomplete suggest for "nik" suggests Nike Pegasus product and Nike brand',
    suggestRes.suggestions.some(s => s.brand === 'Nike' || s.name.includes('Nike')) &&
    suggestRes.suggestedBrands.includes('Nike')
  );

  console.log('\n--- ViBa Mart Intelligent Search Engine Phase 2 Test Suite ---');

  // Test 16: LRU Cache - Set, Get, and Cache Hit
  const cache = new SearchLRUCache<any>(3, 1000);
  cache.set('query=iphone', { items: ['prod-iphone-15'] });
  const hit = cache.get('query=iphone');
  assert(
    'LRU Cache: Successfully stores and retrieves cached query results',
    hit !== null && hit.items[0] === 'prod-iphone-15'
  );

  // Test 17: LRU Cache - Capacity Eviction
  cache.set('key1', 1);
  cache.set('key2', 2);
  cache.set('key3', 3); // Cache now has key1, key2, key3 (capacity 3)
  // Access key1 to make key2 the oldest
  cache.get('key1');
  cache.set('key4', 4); // Should evict key2
  assert(
    'LRU Cache: Evicts least-recently-used entry when capacity limit is reached',
    cache.get('key2') === null && cache.get('key1') === 1 && cache.get('key4') === 4
  );

  // Test 18: LRU Cache - TTL Expiration
  const ttlCache = new SearchLRUCache<string>(5, 10); // 10ms TTL
  ttlCache.set('quickKey', 'quickVal');
  // Wait synchronously for 25ms to let entry expire
  const startWait = Date.now();
  while (Date.now() - startWait < 25) { /* busy wait */ }
  assert(
    'LRU Cache: Expired entry is automatically evicted and returns null',
    ttlCache.get('quickKey') === null
  );

  // Test 19: Deterministic Search Cache Key Creation
  const key1 = createSearchCacheKey({ q: 'iPhone', category: 'mobiles', minPrice: 10000 });
  const key2 = createSearchCacheKey({ minPrice: 10000, q: 'iphone', category: 'mobiles' });
  assert(
    'Cache Key: Deterministic normalization creates identical key regardless of parameter order or case',
    key1 === key2 && key1 === 'category=mobiles&minprice=10000&q=iphone'
  );

  // Test 20: Privacy-Conscious Query Sanitization - Email & Phone Redaction
  const dirtyQuery = 'Contact customer@example.com or call 9876543210 for iphone';
  const cleanQuery = sanitizeSearchQuery(dirtyQuery);
  assert(
    'Privacy Sanitization: Redacts user emails and arbitrary phone numbers from analytics queries',
    cleanQuery.includes('[REDACTED_EMAIL]') &&
    cleanQuery.includes('[REDACTED_NUMBER]') &&
    !cleanQuery.includes('customer@example.com') &&
    !cleanQuery.includes('9876543210')
  );

  // Test 21: Privacy-Conscious Query Sanitization - Preserve 12-digit ViBa Product Codes
  const vibaQuery = 'Check product 8900 0996 1001 and 890009962001 in stock';
  const cleanVibaQuery = sanitizeSearchQuery(vibaQuery);
  assert(
    'Privacy Sanitization: Correctly preserves ViBa 12-digit product codes',
    cleanVibaQuery.includes('8900 0996 1001') &&
    cleanVibaQuery.includes('890009962001')
  );

  // Test 22: Autocomplete suggestions structured response & limit capping
  const fullSuggest = engine.suggest('apple', 2);
  assert(
    'Autocomplete: Enforces maxItems limit and formats brand & category suggestions',
    fullSuggest.suggestions.length <= 2 &&
    fullSuggest.suggestedBrands.includes('Apple') &&
    typeof fullSuggest.executionTimeMs === 'number'
  );

  console.log('\n--- ViBa Mart Intelligent Search Engine Phase 3 Test Suite ---');

  // Test 23: Natural Language Price Constraint Extraction
  const res23 = engine.search({ q: 'running shoes under 12000' });
  assert(
    'AI Intent: Extracts "under 12000" as maxPrice filter, returns Nike Pegasus and excludes Adidas (₹13,999)',
    res23.items.length === 1 &&
    res23.items[0].id === 'prod-nike-pegasus' &&
    res23.aiParsedIntent?.extractedFilters.maxPrice === 12000
  );

  // Test 24: Natural Language Price Sentiment / Sorting ("cheap")
  const res24 = engine.search({ q: 'cheap shoes' });
  assert(
    'AI Intent: Extracts "cheap" sentiment to sort price ascending',
    res24.items.length >= 2 &&
    res24.aiParsedIntent?.extractedFilters.sortBy === 'price-asc' &&
    (res24.items[0].discountPrice || res24.items[0].price) <= (res24.items[1].discountPrice || res24.items[1].price)
  );

  // Test 25: Natural Language Rating Intent ("top rated")
  const res25 = engine.search({ q: 'top rated apple phone' });
  assert(
    'AI Intent: Extracts "top rated" as minRating 4 and retrieves iPhone',
    res25.items.some(p => p.id === 'prod-iphone-15') &&
    res25.aiParsedIntent?.extractedFilters.minRating === 4
  );

  // Test 26: Multi-Constraint Intent Extraction (Brand + Color + Price)
  const res26 = engine.search({ q: 'black nike shoes under 10000' });
  assert(
    'AI Intent: Simultaneously extracts brand (Nike), color (black), and price limit (10000)',
    res26.items.length === 1 &&
    res26.items[0].id === 'prod-nike-pegasus' &&
    res26.aiParsedIntent?.extractedFilters.brand?.toLowerCase() === 'nike' &&
    res26.aiParsedIntent?.extractedFilters.color === 'black' &&
    res26.aiParsedIntent?.extractedFilters.maxPrice === 10000
  );

  // Test 27: Semantic Vector Cosine Similarity & Hybrid Ranking
  const res27 = engine.search({ q: 'portable notebook computer' });
  assert(
    'Semantic Hybrid Ranking: Retrieves MacBook Air for semantic query "portable notebook computer"',
    res27.items.some(p => p.id === 'prod-macbook-air-m3')
  );

  // Test 28: Zero-Result Recovery with Filter Relaxation
  // Nike Pegasus is ₹7,995. Query for Nike shoes under ₹5,000 yields 0 strict matches.
  const res28 = engine.search({ q: 'nike shoes under 5000' });
  assert(
    'Zero-Result Recovery: Relaxes price constraint when no strict matches exist, returns available Nike shoes',
    res28.isAiRelaxed === true &&
    Boolean(res28.aiExplanation && res28.aiExplanation.includes('under ₹5000')) &&
    res28.items.some(p => p.id === 'prod-nike-pegasus')
  );

  // Test 29: AI Intent Autocomplete Suggestions
  const res29 = engine.suggest('shoes', 6);
  assert(
    'AI Autocomplete: Generates smart intent query suggestions (e.g. "shoes under ₹2,000")',
    res29.suggestions.some(s => s.type === 'query' && s.name.includes('shoes'))
  );

  console.log('\n--- ViBa Mart Intelligent Search Engine Phase 4 Test Suite ---');

  // Test 30: Admin Product Pinning (Forces specified product to Rank #1)
  engine.setPinnedRules([
    { query: 'shoes', productIds: ['prod-adidas-ultraboost'] }
  ]);
  const res30 = engine.search({ q: 'shoes' });
  assert(
    'Admin Curation: Successfully pins designated product (Adidas Ultraboost) to Rank #1 for query "shoes"',
    res30.items.length > 0 && res30.items[0].id === 'prod-adidas-ultraboost'
  );

  // Test 31: Admin Score Boosting (Boosts specific product score)
  // Clear pinning rule so boost takes effect naturally
  engine.setPinnedRules([]);
  engine.setBoostedRules([
    { query: 'shoes', productId: 'prod-adidas-ultraboost', boost: 200 }
  ]);
  const res31 = engine.search({ q: 'shoes' });
  assert(
    'Admin Curation: Custom boost (+200) elevates Adidas Ultraboost to top ranking above default relevance order',
    res31.items.length > 0 && res31.items[0].id === 'prod-adidas-ultraboost'
  );
  // Reset boosted rules
  engine.setBoostedRules([]);

  // Test 32: Dynamic Custom Synonyms Expansion
  registerCustomSynonymGroups([
    ['joggers', 'sweatpants', 'trackpants']
  ]);
  const syns = getSynonymsForTerm('joggers');
  assert(
    'Admin Synonyms: Dynamic synonym registration expands terms bidirectionally ("joggers" -> "sweatpants", "trackpants")',
    syns.includes('sweatpants') && syns.includes('trackpants')
  );

  // Test 33: Sliding-Window Search Rate Limiter Safeguard
  const testLimiter = new SearchRateLimiter(3, 2000); // 3 req per 2 sec
  const req1 = testLimiter.check('192.168.1.50');
  const req2 = testLimiter.check('192.168.1.50');
  const req3 = testLimiter.check('192.168.1.50');
  const req4Blocked = testLimiter.check('192.168.1.50');
  const reqOtherIp = testLimiter.check('192.168.1.99');
  assert(
    'Rate Limiting: Enforces sliding-window request cap, blocks 4th request from same IP, preserves quota for other IPs',
    req1.allowed === true &&
    req2.allowed === true &&
    req3.allowed === true &&
    req4Blocked.allowed === false &&
    req4Blocked.remaining === 0 &&
    req4Blocked.resetInSec >= 1 &&
    reqOtherIp.allowed === true
  );

  console.log('\n--- ViBa Mart Intelligent Search Engine Phase 5 Regression Tests ---');

  // Test 34: Leading/Trailing Whitespace & Mixed Case Normalization
  const res34 = engine.search({ q: '   nIKe   PeGaSus   ' });
  assert(
    'Regression: Query with excessive leading/trailing/inner whitespace and mixed casing successfully matches product',
    res34.total > 0 && res34.items[0].id === 'prod-nike-pegasus'
  );

  // Test 35: Partial Product Name Match
  const res35 = engine.search({ q: 'Air Zoom' });
  assert(
    'Regression: Partial product name "Air Zoom" matches "Nike Air Zoom Pegasus 40"',
    res35.total > 0 && res35.items.some(p => p.id === 'prod-nike-pegasus')
  );

  // Test 36: Genuinely Unmatched Query returns 0 products without throwing
  const res36 = engine.search({ q: 'zzzxxyyynonexistentquery999' });
  assert(
    'Regression: Completely unmatched query returns 0 items safely with didYouMean suggestion handling',
    res36.total === 0 && res36.items.length === 0
  );

  // Test 37: Empty Search Query Returns Catalog Products without crashing
  const res37 = engine.search({});
  assert(
    'Regression: Search with empty query string returns all active indexed catalog items',
    res37.total > 0 && res37.items.length > 0
  );

  console.log(`\nResults: ${passed} Passed, ${failed} Failed.`);
  return { passed, failed, errors };
}

