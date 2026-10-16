/**
 * ViBa Mart — Comprehensive Automated Search Engine Test Suite
 * 
 * Tests:
 * 1. Exact and partial keyword searches
 * 2. Misspelled queries and correction suggestions (e.g. iphon, samsng mobile, blu tooth hedphone)
 * 3. Brand, category, SKU, and barcode attribute searches
 * 4. Synonyms and related terminology (e.g. fast charging cable, kicks)
 * 5. Natural-language and semantic queries (e.g. running shoes for men, mouse under 500, red shirt)
 * 6. Irrelevant queries and Zero-Result Recovery
 * 7. Live autocomplete suggestions (products, brands, categories, budget phrases)
 * 8. Spelling correction engine and distance evaluation
 * 9. Catalog synchronization (incremental upsert & delete)
 * 10. Latency performance measurement (< 200ms)
 * 11. Security sanitization and XSS prevention
 */

import { ViBaSearchEngine } from '../searchEngine';
import { SpellingCorrectionEngine } from '../spellingCorrection';
import { sanitizeSearchParams, sanitizeSearchString } from '../searchSanitization';
import { Product } from '../../../shared/types';
import { visualSearchService } from '../visualSearch';
import { sessionRankingManager } from '../sessionRanking';
import { rankingFramework } from '../rankingFramework';
import { searchBenchmarkSuite } from '../benchmark';

// Mock catalog representing actual e-commerce categories and products
const mockProducts: Product[] = [
  {
    id: 'prod-iphone-15',
    name: 'Apple iPhone 15 Pro 128GB Titanium',
    brand: 'Apple',
    categoryId: 'mobiles',
    subCategoryId: 'smartphones',
    price: 119900,
    discountPrice: 114900,
    discountPercentage: 4,
    productCode: '890123456789',
    sku: 'APL-IP15P-128',
    rating: 4.8,
    numReviews: 450,
    stock: 25,
    inStock: true,
    color: 'Titanium',
    vendorId: 'vendor-apple',
    images: ['https://example.com/iphone15.jpg'],
    tags: ['5g', 'smartphone', 'flagship', 'apple', 'ios', 'titanium', 'black'],
    description: 'Latest Apple iPhone with A17 Pro chip and Titanium aerospace design',
    createdAt: new Date().toISOString(),
    status: 'active',
    isVisible: true
  },
  {
    id: 'prod-s24-ultra',
    name: 'Samsung Galaxy S24 Ultra 5G AI Smartphone',
    brand: 'Samsung',
    categoryId: 'mobiles',
    subCategoryId: 'smartphones',
    price: 129999,
    discountPrice: 124999,
    discountPercentage: 4,
    productCode: '890123456790',
    sku: 'SAM-S24U-256',
    rating: 4.7,
    numReviews: 380,
    stock: 18,
    inStock: true,
    color: 'Gray',
    vendorId: 'vendor-samsung',
    images: ['https://example.com/s24u.jpg'],
    tags: ['5g', 'smartphone', 'samsung', 'galaxy', 'ai', 'mobile', 'gray', 'black'],
    description: 'Samsung Galaxy S24 Ultra with Galaxy AI and Snapdragon 8 Gen 3',
    createdAt: new Date().toISOString(),
    status: 'active',
    isVisible: true
  },
  {
    id: 'prod-sony-wh1000xm5',
    name: 'Sony WH-1000XM5 Wireless Bluetooth Noise Canceling Headphones',
    brand: 'Sony',
    categoryId: 'audio',
    subCategoryId: 'headphones',
    price: 29990,
    discountPrice: 26990,
    discountPercentage: 10,
    productCode: '890123456791',
    sku: 'SNY-WH1000-BLK',
    rating: 4.9,
    numReviews: 820,
    stock: 15,
    inStock: true,
    color: 'Black',
    vendorId: 'vendor-sony',
    images: ['https://example.com/sony-wh.jpg'],
    tags: ['bluetooth', 'wireless', 'headphones', 'audio', 'anc', 'sony', 'black', 'silver'],
    description: 'Industry leading noise canceling bluetooth headphones with premium audio',
    createdAt: new Date().toISOString(),
    status: 'active',
    isVisible: true
  },
  {
    id: 'prod-boat-rockerz',
    name: 'boAt Rockerz 450 Bluetooth On-Ear Headphone with Mic',
    brand: 'boAt',
    categoryId: 'audio',
    subCategoryId: 'headphones',
    price: 3990,
    discountPrice: 1499,
    discountPercentage: 62,
    productCode: '890123456792',
    sku: 'BOAT-RCK-450',
    rating: 4.3,
    numReviews: 1250,
    stock: 45,
    inStock: true,
    color: 'Blue',
    vendorId: 'vendor-boat',
    images: ['https://example.com/boat.jpg'],
    tags: ['bluetooth', 'headphones', 'boat', 'wireless', 'earphones', 'blue', 'black'],
    description: 'Affordable wireless bluetooth on-ear headphone with 15 hour playback',
    createdAt: new Date().toISOString(),
    status: 'active',
    isVisible: true
  },
  {
    id: 'prod-nike-pegasus-men',
    name: 'Nike Air Zoom Pegasus 40 Running Shoes for Men',
    brand: 'Nike',
    categoryId: 'footwear',
    subCategoryId: 'shoes',
    price: 8995,
    discountPrice: 7995,
    discountPercentage: 11,
    productCode: '890123456793',
    sku: 'NKE-PEG40-MEN',
    rating: 4.6,
    numReviews: 210,
    stock: 30,
    inStock: true,
    color: 'Black',
    vendorId: 'vendor-nike',
    images: ['https://example.com/pegasus.jpg'],
    tags: ['running', 'shoes', 'men', 'nike', 'sports', 'footwear', 'black', 'white'],
    description: 'Responsive running shoe for road running and training for men',
    createdAt: new Date().toISOString(),
    status: 'active',
    isVisible: true
  },
  {
    id: 'prod-nike-rev6-women',
    name: 'Nike Revolution 6 Running Shoes for Women',
    brand: 'Nike',
    categoryId: 'footwear',
    subCategoryId: 'shoes',
    price: 3995,
    discountPrice: 3495,
    discountPercentage: 12,
    productCode: '890123456794',
    sku: 'NKE-REV6-WMN',
    rating: 4.5,
    numReviews: 190,
    stock: 22,
    inStock: true,
    color: 'Pink',
    vendorId: 'vendor-nike',
    images: ['https://example.com/rev6.jpg'],
    tags: ['running', 'shoes', 'women', 'ladies', 'nike', 'sports', 'pink', 'white'],
    description: 'Lightweight cushioned athletic running shoes for women',
    createdAt: new Date().toISOString(),
    status: 'active',
    isVisible: true
  },
  {
    id: 'prod-anker-cable',
    name: 'Anker PowerLine III 60W USB-C Fast Charging Cable 6ft',
    brand: 'Anker',
    categoryId: 'accessories',
    subCategoryId: 'cables',
    price: 1499,
    discountPrice: 999,
    discountPercentage: 33,
    productCode: '890123456795',
    sku: 'ANK-CB-60W',
    rating: 4.7,
    numReviews: 310,
    stock: 50,
    inStock: true,
    color: 'White',
    vendorId: 'vendor-anker',
    images: ['https://example.com/anker-cable.jpg'],
    tags: ['fast charging', 'type-c', 'cable', 'charger', 'usb cable', 'data cable', 'white', 'black'],
    description: 'Ultra durable fast charging cable with 60W power delivery for smartphones and laptops',
    createdAt: new Date().toISOString(),
    status: 'active',
    isVisible: true
  },
  {
    id: 'prod-portronics-charger',
    name: 'Portronics 65W GaN Fast Charger Power Adapter',
    brand: 'Portronics',
    categoryId: 'accessories',
    subCategoryId: 'chargers',
    price: 2499,
    discountPrice: 1499,
    discountPercentage: 40,
    productCode: '890123456796',
    sku: 'PRT-AD-65W',
    rating: 4.4,
    numReviews: 140,
    stock: 35,
    inStock: true,
    color: 'White',
    vendorId: 'vendor-portronics',
    images: ['https://example.com/portronics.jpg'],
    tags: ['fast charger', 'adapter', 'charging', 'power brick', 'white'],
    description: 'Compact high-speed 65W GaN adapter fast charger for phones and laptops',
    createdAt: new Date().toISOString(),
    status: 'active',
    isVisible: true
  },
  {
    id: 'prod-raymond-red-shirt',
    name: 'Raymond Casual Pure Cotton Red Shirt for Men',
    brand: 'Raymond',
    categoryId: 'fashion',
    subCategoryId: 'shirts',
    price: 1999,
    discountPrice: 1299,
    discountPercentage: 35,
    productCode: '890123456797',
    sku: 'RYM-SH-RED',
    rating: 4.3,
    numReviews: 95,
    stock: 16,
    inStock: true,
    color: 'Red',
    vendorId: 'vendor-raymond',
    images: ['https://example.com/red-shirt.jpg'],
    tags: ['shirt', 'cotton', 'men', 'casual', 'red'],
    description: 'Breathable pure cotton red shirt with button-down collar for men',
    createdAt: new Date().toISOString(),
    status: 'active',
    isVisible: true
  },
  {
    id: 'prod-raymond-blue-shirt',
    name: 'Raymond Formal Oxford Blue Shirt for Men',
    brand: 'Raymond',
    categoryId: 'fashion',
    subCategoryId: 'shirts',
    price: 2199,
    discountPrice: 1499,
    discountPercentage: 32,
    productCode: '890123456798',
    sku: 'RYM-SH-BLU',
    rating: 4.5,
    numReviews: 160,
    stock: 20,
    inStock: true,
    color: 'Blue',
    vendorId: 'vendor-raymond',
    images: ['https://example.com/blue-shirt.jpg'],
    tags: ['shirt', 'formal', 'men', 'blue', 'cotton'],
    description: 'Classic formal office blue shirt for men with premium cotton finish',
    createdAt: new Date().toISOString(),
    status: 'active',
    isVisible: true
  },
  {
    id: 'prod-logitech-mouse',
    name: 'Logitech B170 Optical Wireless Mouse',
    brand: 'Logitech',
    categoryId: 'electronics',
    subCategoryId: 'mouse',
    price: 895,
    discountPrice: 499,
    discountPercentage: 44,
    productCode: '890123456799',
    sku: 'LOG-M-B170',
    rating: 4.4,
    numReviews: 1800,
    stock: 80,
    inStock: true,
    color: 'Black',
    vendorId: 'vendor-logitech',
    images: ['https://example.com/b170.jpg'],
    tags: ['wireless', 'mouse', 'optical', 'logitech', 'computer', 'black'],
    description: 'Reliable 2.4GHz wireless mouse with 12 month battery life',
    createdAt: new Date().toISOString(),
    status: 'active',
    isVisible: true
  },
  {
    id: 'prod-razer-gaming-mouse',
    name: 'Razer DeathAdder Essential Gaming Mouse 6400 DPI',
    brand: 'Razer',
    categoryId: 'electronics',
    subCategoryId: 'mouse',
    price: 2499,
    discountPrice: 1499,
    discountPercentage: 40,
    productCode: '890123456800',
    sku: 'RZR-M-DADD',
    rating: 4.6,
    numReviews: 620,
    stock: 25,
    inStock: true,
    color: 'Black',
    vendorId: 'vendor-razer',
    images: ['https://example.com/razer.jpg'],
    tags: ['gaming', 'mouse', 'razer', 'rgb', '6400dpi', 'black'],
    description: 'High precision ergonomic wired gaming mouse for esports',
    createdAt: new Date().toISOString(),
    status: 'active',
    isVisible: true
  }
];

const categoryMap: Record<string, string> = {
  mobiles: 'Mobiles',
  audio: 'Audio & Sound',
  footwear: 'Footwear',
  accessories: 'Accessories',
  fashion: 'Fashion',
  electronics: 'Electronics'
};

const subCategoryMap: Record<string, string> = {
  smartphones: 'Smartphones',
  headphones: 'Headphones',
  shoes: 'Shoes',
  cables: 'Cables',
  chargers: 'Chargers',
  shirts: 'Shirts',
  mouse: 'Mouse'
};

async function runTestSuite() {
  console.log('================================================================');
  console.log('   ViBa Mart Search Engine — Automated Test & Validation Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. Initialize Engine and Index Mock Products
  console.log('1. Initializing ViBaSearchEngine with Catalog Index...');
  const engine = new ViBaSearchEngine();
  engine.indexProducts(mockProducts, categoryMap, subCategoryMap);
  assert(engine.getCount() === mockProducts.length, `Indexed all ${mockProducts.length} catalog products`);

  // 2. Exact and Partial Keyword Searches
  console.log('\n2. Testing Exact & Partial Keyword Search...');
  const resIphoneExact = engine.search({ q: 'iPhone' });
  assert(resIphoneExact.products.length > 0 && resIphoneExact.products[0].id === 'prod-iphone-15',
    'Exact search "iPhone" returns Apple iPhone 15 as top product');

  const resPartial = engine.search({ q: 'wirel' });
  assert(resPartial.products.length >= 2,
    `Partial search "wirel" matches wireless products (found ${resPartial.products.length})`);

  // 3. Typo-Tolerant Searches from Master Prompt Test Cases
  console.log('\n3. Testing Typo Tolerance & Spelling Error Detection...');
  
  // Test case 3a: "iphon" -> iPhone
  const resIphon = engine.search({ q: 'iphon' });
  assert(resIphon.products.length > 0 && resIphon.products[0].id === 'prod-iphone-15',
    'Typo query "iphon" returns iPhone 15 as top product');

  // Test case 3b: "samsng mobile" -> Samsung mobile
  const resSamsng = engine.search({ q: 'samsng mobile' });
  assert(resSamsng.products.length > 0 && resSamsng.products[0].brand === 'Samsung',
    'Typo query "samsng mobile" returns Samsung Galaxy S24 Ultra');

  // Test case 3c: "blu tooth hedphone" -> Bluetooth headphones
  const resBluTooth = engine.search({ q: 'blu tooth hedphone' });
  assert(resBluTooth.products.length > 0 && resBluTooth.products.some(p => p.id === 'prod-sony-wh1000xm5' || p.id === 'prod-boat-rockerz'),
    'Multi-typo query "blu tooth hedphone" returns Bluetooth headphones');

  // 4. Natural Language Queries & Semantic Prioritization
  console.log('\n4. Testing Natural Language & Semantic Intent...');
  
  // Test case 4a: "running shoes for men" -> men's running shoes
  const resMenShoes = engine.search({ q: 'running shoes for men' });
  assert(resMenShoes.products.length > 0 && resMenShoes.products[0].id === 'prod-nike-pegasus-men',
    'Natural-language query "running shoes for men" prioritizes men\'s Pegasus 40');
  // Women's shoe should be filtered or ranked lower
  const womenShoeIndex = resMenShoes.products.findIndex(p => p.id === 'prod-nike-rev6-women');
  assert(womenShoeIndex === -1 || womenShoeIndex > 0,
    'Women\'s running shoe is not prioritized for "running shoes for men"');

  // Test case 4b: "fast charging cable" -> products using equivalent terminology
  const resCable = engine.search({ q: 'fast charging cable' });
  assert(resCable.products.length > 0 && resCable.products[0].id === 'prod-anker-cable',
    'Terminology query "fast charging cable" returns Anker 60W cable');

  // Test case 4c: "red shirt" -> prioritize relevant red shirts over unrelated shirts
  const resRedShirt = engine.search({ q: 'red shirt' });
  assert(resRedShirt.products.length > 0 && resRedShirt.products[0].id === 'prod-raymond-red-shirt',
    'Query "red shirt" prioritizes Raymond Red Shirt at #1 position');
  const blueShirtIndex = resRedShirt.products.findIndex(p => p.id === 'prod-raymond-blue-shirt');
  assert(blueShirtIndex === -1 || blueShirtIndex > 0,
    'Red shirt is ranked above blue shirt for "red shirt"');

  // Test case 4d: Budget extraction "mouse under 500"
  const resBudget = engine.search({ q: 'mouse under 500' });
  assert(resBudget.products.length > 0 && resBudget.products.every(p => (p.discountPrice || p.price) <= 500),
    'Budget query "mouse under 500" enforces max price filter <= 500');

  // 5. SKU & Barcode Product Code Searches
  console.log('\n5. Testing SKU & Product Code Searches...');
  const resSku = engine.search({ q: 'APL-IP15P-128' });
  assert(resSku.exactMatch === true && resSku.products[0].id === 'prod-iphone-15',
    'Exact SKU search "APL-IP15P-128" marks exactMatch=true and returns iPhone');

  const resBarcode = engine.search({ q: '890123456792' });
  assert(resBarcode.exactMatch === true && resBarcode.products[0].id === 'prod-boat-rockerz',
    'Exact 12-digit Barcode search "890123456792" returns boAt Rockerz 450');

  // 6. Live Autocomplete Suggestions
  console.log('\n6. Testing Real-Time Autocomplete Suggestions...');
  const suggestions = engine.suggest('mou', 8);
  assert(suggestions.suggestions.length > 0,
    `Autocomplete for "mou" returned ${suggestions.suggestions.length} suggestions`);
  const hasMouseQuery = suggestions.suggestions.some(s => s.title.toLowerCase().includes('mouse'));
  assert(hasMouseQuery, 'Autocomplete contains "Mouse" query/product suggestion');
  assert(Boolean(suggestions.products && suggestions.products.length > 0), 'Autocomplete returned product cards');

  // Popular searches on empty query
  const popular = engine.suggest('', 6);
  assert(popular.suggestions.length > 0, 'Empty query autocomplete returns dynamic popular/trending suggestions');

  // 7. Standalone Spelling Correction Engine
  console.log('\n7. Testing Standalone Spelling Correction Engine...');
  const allDocs = engine.getAllDocs();
  const corr1 = SpellingCorrectionEngine.correct('samsng', allDocs);
  assert(corr1.hasCorrection && corr1.correctedQuery.toLowerCase() === 'samsung',
    'Spelling correction corrects "samsng" -> "samsung"');

  const corr2 = SpellingCorrectionEngine.correct('hedphone', allDocs);
  assert(corr2.hasCorrection && corr2.correctedQuery.toLowerCase() === 'headphones',
    'Spelling correction corrects "hedphone" -> "headphones"');

  // 8. Zero-Result Recovery
  console.log('\n8. Testing Zero-Result Recovery...');
  const resZero = engine.search({ q: 'xyzabcdefnonexistentproduct999' });
  assert(resZero.total === 0, 'Nonsense query returns 0 results');
  assert(resZero.recovery !== undefined && Array.isArray(resZero.recovery.suggestedCategories),
    'Zero-result recovery provides alternative category recommendations');

  // 9. Incremental Index Synchronization (Upsert & Delete)
  console.log('\n9. Testing Incremental Index Synchronization...');
  const newProduct: Product = {
    id: 'prod-new-tablet',
    name: 'Apple iPad Air M2 11-inch WiFi',
    brand: 'Apple',
    categoryId: 'electronics',
    subCategoryId: 'tablets',
    price: 59900,
    productCode: '890123456888',
    sku: 'APL-IPAD-M2',
    rating: 4.8,
    numReviews: 40,
    stock: 12,
    inStock: true,
    color: 'Space Gray',
    vendorId: 'vendor-apple',
    images: ['https://example.com/ipad.jpg'],
    tags: ['tablet', 'ipad', 'apple', 'm2', 'space gray'],
    description: 'Apple iPad Air powered by M2 chip',
    createdAt: new Date().toISOString(),
    status: 'active',
    isVisible: true
  };

  engine.upsertProduct(newProduct, 'Electronics', 'Tablets');
  assert(engine.getCount() === mockProducts.length + 1, 'Incremental upsert incremented index count by 1');
  const resAfterUpsert = engine.search({ q: 'iPad Air M2' });
  assert(resAfterUpsert.products.length > 0 && resAfterUpsert.products[0].id === 'prod-new-tablet',
    'Newly added product is immediately searchable');

  engine.removeProduct('prod-new-tablet');
  assert(engine.getCount() === mockProducts.length, 'Remove product restored index count');
  const resAfterDelete = engine.search({ q: 'iPad Air M2' });
  assert(!resAfterDelete.products.some(p => p.id === 'prod-new-tablet'),
    'Deleted product (prod-new-tablet) is no longer returned in search results');

  // Also test with a unique brand/model token
  const uniqueProduct: Product = {
    id: 'prod-unique-drone',
    name: 'CyberDrone Z9900 Ultra Quadcopter',
    brand: 'CyberDrone',
    categoryId: 'electronics',
    price: 49999,
    productCode: '890123456999',
    sku: 'CYB-DRN-Z99',
    rating: 5.0,
    numReviews: 10,
    stock: 5,
    inStock: true,
    color: 'Black',
    vendorId: 'vendor-cyber',
    images: ['https://example.com/drone.jpg'],
    tags: ['drone', 'quadcopter', 'cyberdrone', 'black'],
    description: 'Autonomous 4K camera drone',
    createdAt: new Date().toISOString(),
    status: 'active',
    isVisible: true
  };

  engine.upsertProduct(uniqueProduct, 'Electronics');
  assert(engine.search({ q: 'CyberDrone Z9900' }).products.length === 1,
    'Unique product CyberDrone is found after upsert');

  engine.removeProduct('prod-unique-drone');
  assert(engine.search({ q: 'CyberDrone Z9900' }).products.length === 0,
    'Unique product CyberDrone returns 0 results after removal');

  // 10. Security & Input Sanitization
  console.log('\n10. Testing Security & Input Sanitization...');
  const dirtyQuery = '<script>alert("xss")</script>phone';
  const cleanStr = sanitizeSearchString(dirtyQuery);
  assert(!cleanStr.includes('<script>') && !cleanStr.includes('alert'),
    `XSS script tags stripped: "${cleanStr}"`);

  const sanitizedParams = sanitizeSearchParams({
    q: '"><script>alert(1)</script>samsung',
    limit: '200',
    minPrice: '-50'
  });
  assert(sanitizedParams.limit === 100, 'Search limit clamped to max 100');
  assert(sanitizedParams.minPrice === 0, 'Negative price sanitized to 0');
  assert(!sanitizedParams.q?.includes('<script>'), 'Query in search params properly sanitized');

  // 11. Performance Benchmark (< 60ms target)
  console.log('\n11. Testing Search Latency & Performance...');
  const benchQueries = ['iphone', 'samsung mobile', 'bluetooth headphone', 'running shoes', 'cable', 'red shirt', 'mouse', 'shoes'];
  const latencies: number[] = [];

  for (let i = 0; i < 5; i++) {
    for (const q of benchQueries) {
      const t0 = performance.now();
      engine.search({ q });
      latencies.push(performance.now() - t0);
    }
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  console.log(`     Benchmark: p50 = ${p50.toFixed(2)}ms, p95 = ${p95.toFixed(2)}ms (Target: < 60ms)`);
  assert(p50 < 60 && p95 < 60, `Search latency meets target: p50 = ${p50.toFixed(2)}ms, p95 = ${p95.toFixed(2)}ms < 60ms`);

  // 12. Real-Time In-Session Adaptation & Context Isolation
  console.log('\n12. Testing In-Session Adaptation & Context Isolation...');
  const testSessionId1 = 'session-user-boat-fan';
  const testSessionId2 = 'session-user-sony-fan';

  // Record boAt interactions for user 1
  sessionRankingManager.recordEvent(testSessionId1, {
    type: 'click',
    productId: 'prod-boat-rockerz',
    brand: 'boAt',
    categoryId: 'audio',
    price: 1499
  });

  const sessionCtx1 = sessionRankingManager.getSessionContext(testSessionId1);
  assert(sessionCtx1 !== undefined && sessionCtx1.clickedProductIds.includes('prod-boat-rockerz'),
    'Session 1 accurately tracked clicked product ID prod-boat-rockerz');
  assert(sessionCtx1?.brandWeights['boat'] !== undefined && sessionCtx1.brandWeights['boat'] > 0,
    'Session 1 accumulated brand affinity for boAt');

  // Verify session multiplier is bounded <= 1.15
  const boatDoc = engine.getAllDocs().find(d => d.id === 'prod-boat-rockerz')!;
  const mult = sessionRankingManager.computeSessionMultiplier(boatDoc, testSessionId1);
  assert(mult >= 1.0 && mult <= 1.15,
    `Session multiplier (${mult.toFixed(3)}) is strictly bounded <= 1.15 (+15% max influence)`);

  // Search "bluetooth headphones" with Session 1 (boAt affinity)
  const resSession1 = engine.search({ q: 'bluetooth headphones', sessionId: testSessionId1 });
  assert(resSession1.products.length >= 2, 'Session 1 returned bluetooth headphones');

  // Verify session isolation: Session 2 should not have boAt affinity
  const sessionCtx2 = sessionRankingManager.getSessionContext(testSessionId2);
  assert(sessionCtx2 === undefined, 'Session 2 remains completely isolated with zero leaked state');

  // Test explicit session reset
  const resetSuccess = sessionRankingManager.resetSession(testSessionId1);
  assert(resetSuccess === true && sessionRankingManager.getSessionContext(testSessionId1) === undefined,
    'Explicit session reset successfully cleared session context');

  // 13. Baseline Mode & Extensible Ranking Framework
  console.log('\n13. Testing Baseline Mode & Ranking Signal Framework...');
  const totalSignals = rankingFramework.getTotalSignalsCount();
  const activeSignals = rankingFramework.getActiveSignalsCount();
  assert(totalSignals >= 200, `Ranking framework accommodates 200+ signals (total registered: ${totalSignals})`);
  assert(activeSignals === 24, `Accurately identifies exactly ${activeSignals} validated active signals`);

  // Test baseline search mode
  const resBaseline = engine.search({ q: 'iPhone 15', baselineOnly: true });
  assert(resBaseline.products.length > 0 && resBaseline.products[0].id === 'prod-iphone-15',
    'Baseline mode successfully retrieves exact matching product');

  // Verify baseline mode toggle
  rankingFramework.setBaselineMode(true);
  assert(rankingFramework.isBaselineMode() === true, 'Baseline mode toggle enabled');
  rankingFramework.enableAllActiveSignals();
  assert(rankingFramework.isBaselineMode() === false, 'Full multi-signal ranking re-enabled');

  // 14. Visual Product Search & Image Security
  console.log('\n14. Testing Visual Product Search & Image Security...');
  visualSearchService.initialize(mockProducts);
  const visualStatus = visualSearchService.getStatus();
  assert(visualStatus.isInitialized && visualStatus.indexedVisualCount === mockProducts.length,
    `Visual search initialized with ${visualStatus.indexedVisualCount} catalog image embeddings`);

  // Test valid JPEG validation
  const sampleJpeg = Buffer.alloc(1024);
  sampleJpeg[0] = 0xFF; sampleJpeg[1] = 0xD8; sampleJpeg[2] = 0xFF;
  const validJpegRes = visualSearchService.validateImageInput(sampleJpeg);
  assert(validJpegRes.mimeType === 'image/jpeg', 'Validated JPEG image via magic bytes (0xFF 0xD8 0xFF)');

  // Test valid PNG validation
  const samplePng = Buffer.alloc(1024);
  samplePng[0] = 0x89; samplePng[1] = 0x50; samplePng[2] = 0x4E; samplePng[3] = 0x47;
  const validPngRes = visualSearchService.validateImageInput(samplePng);
  assert(validPngRes.mimeType === 'image/png', 'Validated PNG image via magic bytes');

  // Test rejection of corrupted / invalid format
  let rejectedFormat = false;
  try {
    visualSearchService.validateImageInput(Buffer.from('this is not an image'));
  } catch (err: any) {
    rejectedFormat = err.message.includes('Unsupported image format');
  }
  assert(rejectedFormat, 'Unsupported/corrupt image formats are safely rejected');

  // Test rejection of oversized image (> 5MB)
  let rejectedSize = false;
  try {
    const hugeBuf = Buffer.alloc(6 * 1024 * 1024); // 6MB
    hugeBuf[0] = 0xFF; hugeBuf[1] = 0xD8; hugeBuf[2] = 0xFF;
    visualSearchService.validateImageInput(hugeBuf);
  } catch (err: any) {
    rejectedSize = err.message.includes('exceeds allowed limit of 5 MB');
  }
  assert(rejectedSize, 'Oversized image (> 5 MB) safely rejected');

  // Test end-to-end visual search retrieval & latency (< 3 seconds)
  const tVisualStart = performance.now();
  const visualSearchRes = visualSearchService.searchByImage(sampleJpeg, {}, 5);
  const visualLatency = performance.now() - tVisualStart;
  assert(visualSearchRes.success && visualSearchRes.results.length > 0,
    `Visual search retrieved ${visualSearchRes.results.length} similar catalog products`);
  assert(visualLatency < 3000, `Visual search response time ${visualLatency.toFixed(2)}ms well under 3-second target`);

  // 15. Synonyms & Alternative Terminology
  console.log('\n15. Testing Synonyms & Domain Terminology...');
  const resKicks = engine.search({ q: 'kicks' });
  assert(resKicks.products.length > 0 && resKicks.products.some(p => p.categoryId === 'footwear'),
    'Slang synonym "kicks" matches footwear / running shoes');

  const resDataCable = engine.search({ q: 'data cable' });
  assert(resDataCable.products.length > 0 && resDataCable.products[0].id === 'prod-anker-cable',
    'Terminology synonym "data cable" matches Anker USB-C cable');

  // 16. Preservation of Original Query (noAutoCorrect)
  console.log('\n16. Testing Query Preservation (noAutoCorrect)...');
  const resNoAuto = engine.search({ q: 'iphon', noAutoCorrect: true });
  assert(resNoAuto.hasAutoCorrected === false && resNoAuto.query === 'iphon',
    'Query with noAutoCorrect=true preserves original query text without forced correction');
  assert(resNoAuto.products.length > 0 && resNoAuto.products[0].id === 'prod-iphone-15',
    'Query with noAutoCorrect=true still finds relevant product via fuzzy/token matching');

  // 17. Visibility, Stock, and Draft Status Filtering
  console.log('\n17. Testing Visibility & Publication Rules...');
  const hiddenProduct: Product = {
    id: 'prod-hidden-draft',
    name: 'Secret Prototype Smartphone 2027',
    brand: 'FutureTech',
    categoryId: 'mobiles',
    price: 999999,
    productCode: '890123456701',
    sku: 'FUT-DRAFT-01',
    rating: 0,
    numReviews: 0,
    stock: 1,
    inStock: true,
    vendorId: 'vendor-future',
    description: 'Confidential prototype smartphone not for public listing',
    images: ['https://example.com/draft.jpg'],
    tags: ['smartphone', 'prototype'],
    createdAt: new Date().toISOString(),
    status: 'draft',
    isVisible: false
  };

  engine.upsertProduct(hiddenProduct, 'Mobiles');
  const publicSearch = engine.search({ q: 'Secret Prototype' });
  assert(publicSearch.products.length === 0, 'Draft/hidden product excluded from standard public search');

  const adminSearch = engine.search({ q: 'Secret Prototype', includeDrafts: true });
  assert(adminSearch.products.length === 1 && adminSearch.products[0].id === 'prod-hidden-draft',
    'Draft/hidden product returned when includeDrafts=true authorized');
  engine.removeProduct('prod-hidden-draft');

  // 18. Sorting and Pagination Validation
  console.log('\n18. Testing Sorting & Pagination...');
  const resPriceAsc = engine.search({ q: 'shoes', sortBy: 'price-asc' });
  if (resPriceAsc.products.length >= 2) {
    const p1 = resPriceAsc.products[0].discountPrice || resPriceAsc.products[0].price;
    const p2 = resPriceAsc.products[1].discountPrice || resPriceAsc.products[1].price;
    assert(p1 <= p2, `Sort "price-asc" properly ordered: ₹${p1} <= ₹${p2}`);
  }

  const resPriceDesc = engine.search({ q: 'shirt', sortBy: 'price-desc' });
  if (resPriceDesc.products.length >= 2) {
    const p1 = resPriceDesc.products[0].discountPrice || resPriceDesc.products[0].price;
    const p2 = resPriceDesc.products[1].discountPrice || resPriceDesc.products[1].price;
    assert(p1 >= p2, `Sort "price-desc" properly ordered: ₹${p1} >= ₹${p2}`);
  }

  const resPage1 = engine.search({ limit: 3, page: 1 });
  const resPage2 = engine.search({ limit: 3, page: 2 });
  assert(resPage1.products.length === 3, 'Pagination page 1 returns exactly limit=3 products');
  assert(resPage2.products.length === 3, 'Pagination page 2 returns limit=3 products');
  assert(resPage1.products[0].id !== resPage2.products[0].id, 'Page 1 and Page 2 contain distinct products');

  // 19. Comprehensive Multi-Stage Latency Benchmark (< 60ms target)
  console.log('\n19. Testing Comprehensive Performance Benchmark Suite (< 60ms text, < 3s visual)...');
  const benchmarkReport = searchBenchmarkSuite.runBenchmark(engine, 4);

  console.log(`     Candidate Retrieval: p50 = ${benchmarkReport.metrics.candidateRetrieval.p50}ms, p95 = ${benchmarkReport.metrics.candidateRetrieval.p95}ms, p99 = ${benchmarkReport.metrics.candidateRetrieval.p99}ms`);
  console.log(`     Model Inference:     p50 = ${benchmarkReport.metrics.modelInference.p50}ms, p95 = ${benchmarkReport.metrics.modelInference.p95}ms, p99 = ${benchmarkReport.metrics.modelInference.p99}ms`);
  console.log(`     Reranking:           p50 = ${benchmarkReport.metrics.reranking.p50}ms, p95 = ${benchmarkReport.metrics.reranking.p95}ms, p99 = ${benchmarkReport.metrics.reranking.p99}ms`);
  console.log(`     Total Search API:    p50 = ${benchmarkReport.metrics.totalExecution.p50}ms, p95 = ${benchmarkReport.metrics.totalExecution.p95}ms, p99 = ${benchmarkReport.metrics.totalExecution.p99}ms`);
  console.log(`     End-to-End (Sim):    p50 = ${benchmarkReport.metrics.endToEndSimulated.p50}ms, p95 = ${benchmarkReport.metrics.endToEndSimulated.p95}ms, p99 = ${benchmarkReport.metrics.endToEndSimulated.p99}ms`);
  console.log(`     Image Search:        p50 = ${benchmarkReport.metrics.imageSearchProcessing.p50}ms, p95 = ${benchmarkReport.metrics.imageSearchProcessing.p95}ms, p99 = ${benchmarkReport.metrics.imageSearchProcessing.p99}ms`);
  console.log(`     Sub-60ms Compliance: ${benchmarkReport.sub60msComplianceRate}%`);
  console.log(`     Sub-3s Image Rate:   ${benchmarkReport.sub3sImageComplianceRate}%`);

  assert(benchmarkReport.metrics.totalExecution.p50 < 60,
    `Text search p50 latency (${benchmarkReport.metrics.totalExecution.p50}ms) meets < 60ms target`);
  assert(benchmarkReport.metrics.totalExecution.p95 < 60,
    `Text search p95 latency (${benchmarkReport.metrics.totalExecution.p95}ms) meets < 60ms target`);
  assert(benchmarkReport.sub60msComplianceRate >= 95,
    `Sub-60ms text search compliance rate: ${benchmarkReport.sub60msComplianceRate}% >= 95%`);
  assert(benchmarkReport.metrics.imageSearchProcessing.p95 < 3000,
    `Image search p95 latency (${benchmarkReport.metrics.imageSearchProcessing.p95}ms) meets < 3000ms target`);
  assert(benchmarkReport.sub3sImageComplianceRate === 100,
    'Sub-3s image search compliance rate is 100%');

  console.log('\n================================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
