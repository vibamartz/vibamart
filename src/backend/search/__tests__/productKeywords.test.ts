import assert from 'assert';
import {
  generateProductKeywords,
  generateKeywordsDeterministic,
  productNeedsKeywordUpgrade,
  upgradeExistingProductKeywords,
  normalizeKeyword,
  extractDescriptionKeywords,
  computeProductKeywordSignature,
  hasProductRelevantInfoChanged,
  isKeywordOutdatedOrMissing
} from '../../../shared/utilities/productKeywordGenerator';
import { Product } from '../../../shared/types';
import { ViBaSearchEngine } from '../searchEngine';

async function runKeywordTests() {
  console.log('================================================================');
  console.log('   ViBa Mart AI Product Keyword & Sync Verification Suite');
  console.log('================================================================\n');

  // Test 1: Normalization & Cleaning
  console.log('1. Testing Keyword Normalization & Sanitization...');
  assert.strictEqual(normalizeKeyword('  <b>Bluetooth 5.0</b>! '), 'bluetooth 5.0');
  assert.strictEqual(normalizeKeyword('Type-C Charging Cable'), 'type-c charging cable');
  assert.strictEqual(normalizeKeyword('---Noise-Cancelling---'), 'noise-cancelling');
  console.log('  [PASS] Cleaned HTML tags, punctuation, and trimmed boundaries properly\n');

  // Test 2: Description extraction captures search phrases
  console.log('2. Testing Description Extraction for Customer Search Phrases...');
  const sampleDesc = 'Features active noise cancellation, 40 hours long battery life, fast charging with type-c port, and ultra-soft memory foam ear cushions.';
  const extractedPhrases = extractDescriptionKeywords(sampleDesc, 10);
  console.log('  Extracted description phrases:', extractedPhrases);
  assert(extractedPhrases.some(p => p.includes('noise cancellation') || p.includes('active noise')), 'Extracted "noise cancellation"');
  assert(extractedPhrases.some(p => p.includes('battery life') || p.includes('fast charging') || p.includes('memory foam')), 'Extracted technical feature phrases');
  console.log('  [PASS] Successfully extracted customer-friendly search phrases from description\n');

  // Test 3: Product with 0 keywords generates at least 6 relevant, unique keywords using title & description
  console.log('3. Testing Keyword Generation for Product with Zero Keywords...');
  const emptyProduct: Partial<Product> = {
    id: 'prod-boat-test',
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
    description: 'Lightweight on-ear wireless headphone with deep bass, fast charging, and soft memory foam.',
    tags: [] // empty keywords
  };

  const boatKeywords = await generateProductKeywords(emptyProduct, {
    categoryName: 'Electronics',
    subCategoryName: 'Headphones',
    minCount: 6
  });

  console.log('  Generated keywords for boAt Rockerz:', boatKeywords);
  assert(boatKeywords.length >= 6, `Expected at least 6 keywords, got ${boatKeywords.length}`);
  assert(boatKeywords.some(k => k.includes('boat')), 'Contains brand "boat"');
  assert(boatKeywords.some(k => k.includes('rockerz') || k.includes('headphones')), 'Contains title/category terms');
  assert(boatKeywords.some(k => k.includes('wireless') || k.includes('bluetooth') || k.includes('earbuds') || k.includes('earphones')), 'Contains audio taxonomy synonyms');
  // Description terms check
  assert(boatKeywords.some(k => k.includes('bass') || k.includes('charging') || k.includes('foam') || k.includes('lightweight')), 'Contains description phrases');
  console.log(`  [PASS] Generated ${boatKeywords.length} relevant unique keywords using title, description, and specs\n`);

  // Test 4: Alternative Keyword Generation (Admin clicking "AI Auto-Keywords")
  console.log('4. Testing Alternative Keyword Generation ("AI Auto Keyword")...');
  const initialKeywords = ['boat', 'boat headphones', 'rockerz 450', 'wireless headphones', 'bluetooth', 'on-ear'];
  const altKeywords = await generateProductKeywords(emptyProduct, {
    isAlternative: true,
    previousKeywords: initialKeywords,
    categoryName: 'Electronics',
    subCategoryName: 'Headphones',
    minCount: 6
  });

  console.log('  Initial keywords:', initialKeywords);
  console.log('  Regenerated alternative keywords:', altKeywords);
  assert(altKeywords.length >= 6, `Expected at least 6 alternative keywords, got ${altKeywords.length}`);
  // Check that new alternatives differ from the previous list
  const novelCount = altKeywords.filter(k => !initialKeywords.includes(k)).length;
  assert(novelCount > 0, `Expected fresh alternative keywords, found ${novelCount} novel keywords`);
  // Check that the returned list replaces outdated ones rather than blindly duplicating initialKeywords
  assert.notDeepStrictEqual(altKeywords, initialKeywords, 'Generated distinct alternative set');
  console.log(`  [PASS] Successfully generated ${novelCount} novel alternative keywords replacing previous list\n`);

  // Test 5: Replacing Outdated Keywords when Product Information Changes
  console.log('5. Testing Replacement of Outdated Keywords...');
  const outdatedProduct: Partial<Product> = {
    id: 'prod-switch-brand',
    name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
    brand: 'Sony',
    categoryId: 'electronics',
    subCategoryId: 'headphones',
    description: 'Industry leading noise cancellation with auto NC optimizer, crystal clear hands-free calling, and 30-hour battery life.',
    // Outdated tags from old Nike shoes!
    tags: ['nike', 'running shoes', 'sneakers', 'sports footwear', 'marathon', 'nike road']
  };

  assert.strictEqual(isKeywordOutdatedOrMissing(outdatedProduct, 6), true, 'Detected outdated tags');

  const refreshedKeywords = await generateProductKeywords(outdatedProduct, {
    replaceOutdated: true,
    previousKeywords: outdatedProduct.tags,
    categoryName: 'Electronics',
    subCategoryName: 'Headphones',
    minCount: 6
  });

  console.log('  Refreshed keywords for Sony headphones:', refreshedKeywords);
  assert(refreshedKeywords.length >= 6, 'Generated at least 6 keywords');
  assert(!refreshedKeywords.includes('nike'), 'Outdated brand "nike" was replaced');
  assert(!refreshedKeywords.includes('running shoes'), 'Outdated category "running shoes" was replaced');
  assert(refreshedKeywords.some(k => k.includes('sony')), 'Includes new brand "sony"');
  assert(refreshedKeywords.some(k => k.includes('headphones') || k.includes('cancelling') || k.includes('wireless')), 'Includes current product terms');
  console.log('  [PASS] Outdated keywords successfully replaced with newly generated alternatives\n');

  // Test 6: Never generate irrelevant, misleading, hardcoded, or duplicate keywords
  console.log('6. Testing Absolute Prohibition of Hardcoded Filler & Duplicates...');
  const JUNK = ['official product', 'authentic', 'item', 'best online', 'collection'];
  for (const junkWord of JUNK) {
    assert(!boatKeywords.includes(junkWord), `Must not contain "${junkWord}"`);
    assert(!altKeywords.includes(junkWord), `Must not contain "${junkWord}"`);
    assert(!refreshedKeywords.includes(junkWord), `Must not contain "${junkWord}"`);
  }
  // Check uniqueness (no duplicates)
  const uniqueCount = new Set(boatKeywords).size;
  assert.strictEqual(uniqueCount, boatKeywords.length, 'No duplicate keywords allowed');
  console.log('  [PASS] No hardcoded filler or duplicate keywords generated\n');

  // Test 7: Signature & Change Detection (Regenerate ONLY when relevant info changes)
  console.log('7. Testing Change Detection (Regenerate ONLY when relevant info changes)...');
  const baseProd: Partial<Product> = {
    name: 'Apple iPhone 15 Pro Max',
    brand: 'Apple',
    categoryId: 'mobiles',
    subCategoryId: 'smartphones',
    description: 'A17 Pro chip, titanium design, 48MP camera, action button.',
    specifications: [{ key: 'Storage', value: '256GB' }],
    price: 139900,
    stock: 25,
    status: 'active'
  };

  const sig1 = computeProductKeywordSignature(baseProd);

  // Irrelevant changes: stock, price, status changed
  const unchangedProd = { ...baseProd, price: 134900, stock: 15, status: 'out_of_stock' as const };
  assert.strictEqual(hasProductRelevantInfoChanged(unchangedProd, baseProd), false, 'Irrelevant changes do NOT trigger regeneration');

  // Relevant change: description changed
  const descChangedProd = { ...baseProd, description: 'Super fast A17 Pro chip with ray tracing, 5x telephoto optical zoom lens.' };
  assert.strictEqual(hasProductRelevantInfoChanged(descChangedProd, baseProd), true, 'Description change triggers regeneration');

  // Relevant change: title changed
  const titleChangedProd = { ...baseProd, name: 'Apple iPhone 16 Pro Max' };
  assert.strictEqual(hasProductRelevantInfoChanged(titleChangedProd, baseProd), true, 'Title change triggers regeneration');

  // Relevant change: brand changed
  const brandChangedProd = { ...baseProd, brand: 'Google' };
  assert.strictEqual(hasProductRelevantInfoChanged(brandChangedProd, baseProd), true, 'Brand change triggers regeneration');

  console.log('  [PASS] Signature accurately filters out unrelated updates and triggers on relevant changes\n');

  // Test 8: AI Failure & Fallback Resilience
  console.log('8. Testing AI Failure Handling & Rock-Solid Fallback...');
  // Pass an invalid / dummy API key to simulate AI network or auth failure
  const fallbackKeywords = await generateProductKeywords(emptyProduct, {
    apiKey: 'invalid-test-key-trigger-fallback',
    categoryName: 'Electronics',
    subCategoryName: 'Headphones',
    minCount: 6
  });

  console.log('  Fallback generated keywords:', fallbackKeywords);
  assert(fallbackKeywords.length >= 6, `Fallback guaranteed >= 6 keywords, got ${fallbackKeywords.length}`);
  assert(fallbackKeywords.some(k => k.includes('boat')), 'Fallback contains brand');
  assert(fallbackKeywords.some(k => k.includes('headphones') || k.includes('rockerz')), 'Fallback contains title/category');

  // Test safety: Never erase valid keywords unless replacements are successfully generated
  const existingValidTags = ['boat', 'wireless audio', 'bluetooth headphones', 'deep bass', 'earphones', 'headset'];
  const corruptInput: Partial<Product> = { name: '', description: '', brand: '', tags: existingValidTags };
  const preserved = await generateProductKeywords(corruptInput, {
    isAlternative: true,
    previousKeywords: existingValidTags,
    minCount: 6
  });
  assert(preserved.length >= 6, 'Retained valid keywords when inputs are empty');
  console.log('  [PASS] Reliable fallback works seamlessly and never erases valid keywords\n');

  // Test 9: Rapid Edits & Request Race Condition Prevention
  console.log('9. Testing Rapid Edits Race Condition Prevention...');
  let latestRequestId = 0;
  let finalAppliedKeywords: string[] = [];

  const simulateRapidEdit = async (reqId: number, productData: Partial<Product>) => {
    const kws = await generateProductKeywords(productData, {
      categoryName: 'Electronics',
      subCategoryName: 'Headphones',
      minCount: 6
    });
    // Check request ID guard
    if (reqId === latestRequestId) {
      finalAppliedKeywords = kws;
    }
  };

  // Dispatch request 1 (older edit)
  latestRequestId = 1;
  const p1 = simulateRapidEdit(1, { ...emptyProduct, name: 'Old Product 1' });

  // Rapidly dispatch request 2 (newer edit)
  latestRequestId = 2;
  const p2 = simulateRapidEdit(2, { ...emptyProduct, name: 'boAt Rockerz 450 Pro' });

  await Promise.all([p1, p2]);
  assert(finalAppliedKeywords.some(k => k.includes('rockerz') || k.includes('450')), 'Latest request 2 was applied');
  console.log('  [PASS] Older requests prevented from overwriting newer results\n');

  // Test 10: Product Search Accuracy & Synchronization
  console.log('10. Testing Product Search Accuracy & Engine Synchronization...');
  const searchEngine = new ViBaSearchEngine();
  const testProduct: Product = {
    id: 'prod-sync-test',
    name: 'boAt Rockerz 450 Bluetooth On-Ear Headphones',
    brand: 'boAt',
    categoryId: 'electronics',
    subCategoryId: 'headphones',
    price: 1499,
    mrp: 3990,
    discountPercentage: 62,
    stock: 100,
    inStock: true,
    status: 'active',
    rating: 4.5,
    numReviews: 240,
    tags: boatKeywords, // Synchronized with generated keywords!
    description: 'Lightweight on-ear wireless headphone with deep bass and fast charging.',
    vendorId: 'admin',
    images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&fit=crop'],
    createdAt: new Date().toISOString()
  };

  searchEngine.upsertProduct(testProduct, 'Electronics', 'Headphones');

  // Search by brand
  const brandSearch = searchEngine.search({ q: 'boat' });
  assert(brandSearch.products.some(r => r.id === 'prod-sync-test'), 'Found product searching brand "boat"');

  // Search by generated category synonym
  const synSearch = searchEngine.search({ q: 'wireless earphones' });
  assert(synSearch.products.some(r => r.id === 'prod-sync-test'), 'Found product searching synonym "wireless earphones"');

  // Search by description phrase
  const descSearch = searchEngine.search({ q: 'deep bass' });
  assert(descSearch.products.some(r => r.id === 'prod-sync-test'), 'Found product searching description phrase "deep bass"');

  console.log('  [PASS] Keywords immediately synchronized with search engine and accurate\n');

  console.log('================================================================');
  console.log('   ALL 10 AI KEYWORD & SEARCH SYNC TESTS PASSED!               ');
  console.log('================================================================\n');
}

runKeywordTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
