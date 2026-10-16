import assert from 'assert';
import {
  generateProductKeywords,
  generateKeywordsDeterministic,
  productNeedsKeywordUpgrade,
  productHasOutdatedKeywords,
  upgradeExistingProductKeywords,
  filterOutdatedKeywords,
  registerKeywordRequest,
  isRequestLatest,
  normalizeKeyword,
  getProductContentSignature,
  hasProductInfoChanged
} from '../../../shared/utilities/productKeywordGenerator';
import { ViBaSearchEngine } from '../searchEngine';
import { Product } from '../../../shared/types';

async function runComprehensiveKeywordTests() {
  console.log('================================================================');
  console.log('   ViBa Mart Product Keyword System — Verification Suite');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // Test 1: Normalization, Sanitization & Stop Word Filtering
  // -------------------------------------------------------------------------
  console.log('1. Testing Keyword Normalization & Sanitization...');
  assert.strictEqual(normalizeKeyword('  <b>Bluetooth 5.0</b>! '), 'bluetooth 5.0');
  assert.strictEqual(normalizeKeyword('Type-C Charging Cable'), 'type-c charging cable');
  assert.strictEqual(normalizeKeyword('---Noise-Cancelling---'), 'noise-cancelling');
  assert.strictEqual(normalizeKeyword('  Wi-Fi 6E Wireless  '), 'wi-fi 6e wireless');
  console.log('  [PASS] Cleaned HTML tags, punctuation, and trimmed boundaries properly\n');

  // -------------------------------------------------------------------------
  // Test 2: New Product with 0 Keywords (Guarantees >= 6 Unique, Relevant Keywords)
  // -------------------------------------------------------------------------
  console.log('2. Testing Keyword Generation for New Product with 0 Keywords...');
  const newBoatProduct: Partial<Product> = {
    id: 'prod-boat-450-new',
    name: 'boAt Rockerz 450 Bluetooth On-Ear Headphones with Mic',
    brand: 'boAt',
    categoryId: 'electronics',
    subCategoryId: 'headphones',
    specifications: [
      { key: 'Connectivity', value: 'Bluetooth 5.0' },
      { key: 'Playtime', value: '15 Hours Playback' },
      { key: 'Driver Size', value: '40mm Drivers' }
    ],
    features: ['Instant Voice Assistant', 'Adaptive Earcups', 'HD Immersive Audio'],
    description: 'Lightweight on-ear wireless headphone with powerful bass and long battery.',
    tags: [] // empty
  };

  const boatKeywords = await generateProductKeywords(newBoatProduct, {
    categoryName: 'Electronics',
    subCategoryName: 'Headphones',
    minCount: 6
  });

  console.log('  Generated keywords for boAt Rockerz:', boatKeywords);
  assert(boatKeywords.length >= 6, `Expected at least 6 keywords, got ${boatKeywords.length}`);
  // Check uniqueness
  const uniqueBoatKws = new Set(boatKeywords);
  assert.strictEqual(uniqueBoatKws.size, boatKeywords.length, 'All generated keywords must be unique');
  // Check relevance to brand, title, category, audio taxonomy
  assert(boatKeywords.some(k => k.includes('boat')), 'Contains brand "boat"');
  assert(boatKeywords.some(k => k.includes('rockerz') || k.includes('headphones')), 'Contains title/category terms');
  assert(boatKeywords.some(k => k.includes('wireless') || k.includes('bluetooth') || k.includes('earbuds') || k.includes('earphones')), 'Contains audio taxonomy terms');
  console.log(`  [PASS] Generated ${boatKeywords.length} unique, relevant keywords for new product (>= 6 guaranteed)\n`);

  // -------------------------------------------------------------------------
  // Test 3: Existing Product with Missing / Partial Keywords (< 6)
  // -------------------------------------------------------------------------
  console.log('3. Testing Backfill of Existing Product with Fewer Than 6 Keywords...');
  const partialFootwear: Partial<Product> = {
    id: 'prod-nike-pegasus',
    name: 'Nike Air Zoom Pegasus 40 Running Shoes',
    brand: 'Nike',
    categoryId: 'footwear',
    subCategoryId: 'mens_shoes',
    specifications: [
      { key: 'Ideal For', value: 'Men' },
      { key: 'Closure', value: 'Lace-Up' },
      { key: 'Sole Material', value: 'Rubber' }
    ],
    description: 'Responsive road running shoe with engineered mesh upper and Zoom Air cushioning.',
    tags: ['marathon', 'nike road'] // only 2 custom tags
  };

  assert.strictEqual(productNeedsKeywordUpgrade(partialFootwear as Product), true, 'Identified product needs upgrade (< 6 keywords)');

  const upgradeResult = await upgradeExistingProductKeywords(partialFootwear as Product, {
    categoryName: 'Footwear',
    subCategoryName: "Men's Shoes",
    minCount: 6
  });

  console.log('  Backfilled keywords for Nike Pegasus:', upgradeResult.updatedTags);
  assert.strictEqual(upgradeResult.needsUpdate, true);
  assert(upgradeResult.updatedTags.length >= 6, `Expected >= 6 keywords, got ${upgradeResult.updatedTags.length}`);
  // Original valid custom tags preserved
  assert(upgradeResult.updatedTags.includes('marathon'), 'Preserved existing custom keyword "marathon"');
  assert(upgradeResult.updatedTags.includes('nike road'), 'Preserved existing custom keyword "nike road"');
  // Missing footwear taxonomy added
  assert(upgradeResult.updatedTags.some(k => k.includes('running') || k.includes('shoes') || k.includes('sneakers')), 'Added missing footwear keywords');
  console.log('  [PASS] Preserved existing custom tags and backfilled to >= 6 keywords\n');

  // -------------------------------------------------------------------------
  // Test 4: Stale & Outdated Keyword Purging on Product Information Change
  // -------------------------------------------------------------------------
  console.log('4. Testing Outdated & Misleading Keyword Purging when Product Info Changes...');

  // 4a: Brand changed from Samsung to Apple
  const editedPhoneProduct: Partial<Product> = {
    id: 'prod-edited-mobile',
    name: 'Apple iPhone 15 Pro 128GB',
    brand: 'Apple',
    categoryId: 'electronics',
    subCategoryId: 'smartphones',
    description: 'Super Retina XDR display with ProMotion and A17 Pro chip.',
    tags: ['samsung', 'galaxy', 'smartphone', '5g', 'android', 'touchscreen'] // outdated tags from old Samsung model!
  };

  const filteredPhoneTags = filterOutdatedKeywords(editedPhoneProduct.tags || [], editedPhoneProduct, {
    categoryName: 'Electronics',
    subCategoryName: 'Smartphones'
  });

  console.log('  Original outdated tags:', editedPhoneProduct.tags);
  console.log('  Filtered tags (stale brands removed):', filteredPhoneTags);
  assert(!filteredPhoneTags.includes('samsung'), 'Purged stale brand "samsung"');
  assert(!filteredPhoneTags.includes('galaxy'), 'Purged stale model "galaxy"');
  assert(filteredPhoneTags.includes('smartphone'), 'Kept generic valid term "smartphone"');
  assert(filteredPhoneTags.includes('5g'), 'Kept generic valid term "5g"');

  // Check that productHasOutdatedKeywords flags this product for regeneration
  assert.strictEqual(
    productHasOutdatedKeywords(editedPhoneProduct, { categoryName: 'Electronics', subCategoryName: 'Smartphones' }),
    true,
    'productHasOutdatedKeywords flagged product containing conflicting brand'
  );

  // Full regeneration on edited product
  const refreshedPhoneKeywords = await generateProductKeywords(editedPhoneProduct, {
    categoryName: 'Electronics',
    subCategoryName: 'Smartphones',
    minCount: 6
  });

  console.log('  Regenerated keywords for edited Apple product:', refreshedPhoneKeywords);
  assert(refreshedPhoneKeywords.length >= 6);
  assert(!refreshedPhoneKeywords.includes('samsung'), 'Regenerated keywords do not contain old brand "samsung"');
  assert(refreshedPhoneKeywords.some(k => k.includes('apple')), 'Regenerated keywords contain new brand "apple"');
  assert(refreshedPhoneKeywords.some(k => k.includes('iphone')), 'Regenerated keywords contain "iphone"');

  // 4b: Category changed from Footwear to Electronics
  const categoryShiftProduct: Partial<Product> = {
    id: 'prod-shifted-cat',
    name: 'Sony WH-1000XM5 Wireless Headphones',
    brand: 'Sony',
    categoryId: 'electronics',
    subCategoryId: 'headphones',
    description: 'Industry-leading noise cancellation with auto NC optimizer.',
    tags: ['shoes', 'sneakers', 'running', 'comfort', 'sony', 'wireless'] // old footwear tags mistakenly lingering
  };

  const purgedCategoryTags = filterOutdatedKeywords(categoryShiftProduct.tags || [], categoryShiftProduct, {
    categoryName: 'Electronics',
    subCategoryName: 'Headphones'
  });

  console.log('  Cross-category tags before filter:', categoryShiftProduct.tags);
  console.log('  Cross-category tags after filter:', purgedCategoryTags);
  assert(!purgedCategoryTags.includes('shoes'), 'Purged opposing category keyword "shoes"');
  assert(!purgedCategoryTags.includes('sneakers'), 'Purged opposing category keyword "sneakers"');
  assert(purgedCategoryTags.includes('sony'), 'Preserved relevant brand keyword "sony"');
  assert(purgedCategoryTags.includes('wireless'), 'Preserved relevant audio keyword "wireless"');
  console.log('  [PASS] Stale and cross-category outdated keywords purged cleanly\n');

  // -------------------------------------------------------------------------
  // Test 5: Rapid Edits & Concurrency Race Condition Protection
  // -------------------------------------------------------------------------
  console.log('5. Testing Concurrency Protection Against Slower Older AI Requests Overwriting Newer Results...');

  const rapidEditProductId = 'prod-rapid-edit-123';

  // Step 1: User saves edit #1 -> registers request timestamp 1
  const reqTime1 = registerKeywordRequest(rapidEditProductId);
  assert.strictEqual(isRequestLatest(rapidEditProductId, reqTime1), true, 'Request 1 is initially latest');

  // Step 2: 100ms later, user rapidly makes edit #2 -> registers request timestamp 2
  await new Promise(r => setTimeout(r, 20));
  const reqTime2 = registerKeywordRequest(rapidEditProductId);
  assert.strictEqual(isRequestLatest(rapidEditProductId, reqTime2), true, 'Request 2 is now the latest');

  // Step 3: Check if Request 1 would be allowed to overwrite: MUST BE FALSE!
  assert.strictEqual(
    isRequestLatest(rapidEditProductId, reqTime1),
    false,
    'Slower/older request 1 is detected as outdated and discarded'
  );

  // Test full generateProductKeywords with older timestamp
  const productSnapshot1: Partial<Product> = {
    id: rapidEditProductId,
    name: 'Old Version Title 1',
    brand: 'BrandOne',
    tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6']
  };

  const productSnapshot2: Partial<Product> = {
    id: rapidEditProductId,
    name: 'Newest Version Title 2',
    brand: 'BrandTwo',
    tags: []
  };

  // Run generation for snapshot 1 using the OLD timestamp (simulating a slow API response finishing late)
  const resultFromOldRequest = await generateProductKeywords(productSnapshot1, {
    requestTimestamp: reqTime1
  });

  // Because reqTime1 is older than the current latest request for rapidEditProductId,
  // it MUST NOT overwrite with the old snapshot's newly generated tags
  assert.deepStrictEqual(resultFromOldRequest, productSnapshot1.tags, 'Older request did not overwrite with new calculation');
  console.log('  [PASS] Monotonic timestamp registration successfully prevents slow older requests from overwriting newer edits\n');

  // -------------------------------------------------------------------------
  // Test 6: AI-Service Failure Handling & Reliable Fallback Engine
  // -------------------------------------------------------------------------
  console.log('6. Testing AI Service Failure Handling & Reliable Fallback Engine...');

  const offlineProduct: Partial<Product> = {
    id: 'prod-fallback-test',
    name: 'Puma Velocity Nitro 3 Men Running Shoes',
    brand: 'Puma',
    categoryId: 'footwear',
    subCategoryId: 'running_shoes',
    specifications: [
      { key: 'Cushioning', value: 'Nitro Foam' },
      { key: 'Weight', value: '260g' }
    ],
    description: 'High-cushion responsive everyday road running shoe with durable rubber grip.',
    tags: ['velocity', 'nitro']
  };

  // 6a: Force AI service failure with invalid API key or allowGemini: false
  const fallbackKeywords = await generateProductKeywords(offlineProduct, {
    categoryName: 'Footwear',
    subCategoryName: 'Running Shoes',
    apiKey: 'invalid_dummy_key_simulate_failure',
    allowGemini: false, // forces local deterministic ML/NLP fallback
    minCount: 6
  });

  console.log('  Fallback generated keywords:', fallbackKeywords);
  assert(fallbackKeywords.length >= 6, `Fallback must guarantee >= 6 keywords, got ${fallbackKeywords.length}`);
  assert(fallbackKeywords.some(k => k.includes('puma')), 'Fallback includes brand "puma"');
  assert(fallbackKeywords.some(k => k.includes('running') || k.includes('shoes') || k.includes('sneakers')), 'Fallback includes category terms');
  assert(fallbackKeywords.includes('velocity'), 'Preserved valid custom tag "velocity"');

  // 6b: Safety Guarantee: Never erase valid keywords unless replacements are generated successfully
  const safetyProduct: Partial<Product> = {
    id: 'prod-safety-test',
    name: 'Adidas Ultraboost Light Running Shoes',
    brand: 'Adidas',
    tags: ['ultraboost', 'boost', 'adidas running', 'sneakers', 'marathon', 'cushioned']
  };

  const safeResult = await generateProductKeywords(safetyProduct, {
    allowGemini: false,
    minCount: 6
  });

  assert(safeResult.length >= 6, 'Valid existing keywords preserved and met minCount');
  assert(safeResult.includes('ultraboost'), 'Did not erase existing valid keyword "ultraboost"');
  assert(safeResult.includes('marathon'), 'Did not erase existing valid keyword "marathon"');
  console.log('  [PASS] Zero downtime: deterministic fallback produced >= 6 keywords and never erased valid existing keywords\n');

  // -------------------------------------------------------------------------
  // Test 7: Search Engine Integration & Partial Match Accuracy
  // -------------------------------------------------------------------------
  console.log('7. Testing ViBaSearchEngine Search Accuracy with Auto-Generated Keywords...');

  const engine = new ViBaSearchEngine();

  const laptopProduct: Product = {
    id: 'prod-dell-xps-13',
    name: 'Dell XPS 13 Plus 9320 Intel Core i7 16GB RAM 512GB SSD',
    brand: 'Dell',
    categoryId: 'computers',
    subCategoryId: 'laptops',
    price: 139990,
    discountPrice: 129990,
    discountPercentage: 7,
    productCode: 'DELL-XPS-9320',
    sku: 'DELL-XPS-13-PLUS',
    rating: 4.7,
    numReviews: 88,
    stock: 12,
    inStock: true,
    color: 'Platinum',
    specifications: [
      { key: 'Processor', value: 'Intel Core i7-1360P' },
      { key: 'RAM', value: '16GB LPDDR5' },
      { key: 'Storage', value: '512GB NVMe SSD' },
      { key: 'Display', value: '13.4 inch OLED 3.5K Touch' }
    ],
    features: ['Zero-lattice keyboard', 'Capacitive touch function row', 'Seamless glass touchpad'],
    description: 'Ultra-thin, premium performance laptop designed for power users and creators.',
    tags: [] // will be generated
  };

  // Generate keywords for laptop
  const dellKeywords = await generateProductKeywords(laptopProduct, {
    categoryName: 'Computers & Laptops',
    subCategoryName: 'Laptops',
    minCount: 6
  });

  laptopProduct.tags = dellKeywords;
  console.log('  Generated Dell XPS keywords:', dellKeywords);

  // Index product into ViBaSearchEngine
  engine.upsertProduct(laptopProduct, 'Computers & Laptops', 'Laptops');

  // Query 1: Exact brand + product title term
  const query1 = engine.search({ query: 'dell xps' });
  assert(query1.products.length > 0, 'Found product for query "dell xps"');
  assert.strictEqual(query1.products[0].id, 'prod-dell-xps-13');

  // Query 2: Partial category match ("ultrabook" or "notebook" from taxonomy)
  const query2 = engine.search({ query: 'ultrabook' });
  const foundByUltrabook = query2.products.some(p => p.id === 'prod-dell-xps-13');
  assert(foundByUltrabook, 'Found Dell XPS via taxonomy keyword "ultrabook"');

  // Query 3: Partial spec term ("16gb")
  const query3 = engine.search({ query: '16gb ram' });
  const foundByRam = query3.products.some(p => p.id === 'prod-dell-xps-13');
  assert(foundByRam, 'Found Dell XPS via spec keyword "16gb ram"');

  // Query 4: Prefix / partial match ("dell xp")
  const query4 = engine.search({ query: 'dell xp' });
  assert(query4.products.length > 0, 'Found Dell XPS via prefix search "dell xp"');

  console.log('  [PASS] ViBaSearchEngine returns immediate high-accuracy matches across title, specs, and taxonomy keywords\n');

  // -------------------------------------------------------------------------
  // Test 8: Keyword Integrity & Anti-Hallucination
  // -------------------------------------------------------------------------
  console.log('8. Testing Keyword Integrity (No Hallucinated Brands or Stop Words)...');
  assert(!dellKeywords.includes('apple'), 'Dell product does not contain "apple"');
  assert(!dellKeywords.includes('hp'), 'Dell product does not contain "hp"');
  assert(!dellKeywords.includes('buy'), 'Does not contain stop word "buy"');
  assert(!dellKeywords.includes('quality'), 'Does not contain filler "quality"');
  assert(!dellKeywords.includes('best'), 'Does not contain marketing fluff "best"');
  console.log('  [PASS] Zero false brands, stop words, or generic filler keywords detected\n');

  console.log('================================================================');
  console.log('   ALL 8 PRODUCT KEYWORD SYSTEM TESTS PASSED SUCCESSFULLY!   ');
  console.log('================================================================\n');
}

runComprehensiveKeywordTests().catch(err => {
  console.error('\n[TEST FAILED]:', err);
  process.exit(1);
});
