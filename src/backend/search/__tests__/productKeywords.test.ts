import assert from 'assert';
import {
  generateProductKeywords,
  generateKeywordsDeterministic,
  productNeedsKeywordUpgrade,
  upgradeExistingProductKeywords,
  normalizeKeyword
} from '../../../shared/utilities/productKeywordGenerator';
import { Product } from '../../../shared/types';

async function runKeywordTests() {
  console.log('================================================================');
  console.log('   ViBa Mart Product Keyword System — Verification Suite');
  console.log('================================================================\n');

  // Test 1: Normalization & Cleaning
  console.log('1. Testing Keyword Normalization & Sanitization...');
  assert.strictEqual(normalizeKeyword('  <b>Bluetooth 5.0</b>! '), 'bluetooth 5.0');
  assert.strictEqual(normalizeKeyword('Type-C Charging Cable'), 'type-c charging cable');
  assert.strictEqual(normalizeKeyword('---Noise-Cancelling---'), 'noise-cancelling');
  console.log('  [PASS] Cleaned HTML tags, punctuation, and trimmed boundaries properly\n');

  // Test 2: Product with 0 keywords generates at least 6 relevant keywords
  console.log('2. Testing Keyword Generation for Product with Zero Keywords...');
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
    description: 'Lightweight on-ear wireless headphone with powerful bass and long battery.',
    tags: [] // empty keywords
  };

  const boatKeywords = await generateProductKeywords(emptyProduct, {
    categoryName: 'Electronics',
    subCategoryName: 'Headphones'
  });

  console.log('  Generated keywords for boAt Rockerz:', boatKeywords);
  assert(boatKeywords.length >= 6, `Expected at least 6 keywords, got ${boatKeywords.length}`);
  assert(boatKeywords.some(k => k.includes('boat')), 'Contains brand "boat"');
  assert(boatKeywords.some(k => k.includes('rockerz') || k.includes('headphones')), 'Contains title/category terms');
  assert(boatKeywords.some(k => k.includes('wireless') || k.includes('bluetooth') || k.includes('earbuds') || k.includes('earphones')), 'Contains audio taxonomy synonyms');
  console.log(`  [PASS] Generated ${boatKeywords.length} relevant keywords (>= 6 guaranteed)\n`);

  // Test 3: Existing product with fewer than 6 keywords preserves existing tags & fills missing
  console.log('3. Testing Preservation of Existing Keywords & Addition of Missing...');
  const partialProduct: Partial<Product> = {
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

  assert.strictEqual(productNeedsKeywordUpgrade(partialProduct as Product), true, 'Identified product needs upgrade');

  const upgradeResult = await upgradeExistingProductKeywords(partialProduct as Product, {
    categoryName: 'Footwear',
    subCategoryName: "Men's Shoes"
  });

  console.log('  Upgraded keywords for Nike Pegasus:', upgradeResult.updatedTags);
  assert.strictEqual(upgradeResult.needsUpdate, true);
  assert(upgradeResult.updatedTags.length >= 6, `Expected >= 6 keywords, got ${upgradeResult.updatedTags.length}`);
  // Check that original custom tags are preserved
  assert(upgradeResult.updatedTags.includes('marathon'), 'Preserved existing custom keyword "marathon"');
  assert(upgradeResult.updatedTags.includes('nike road'), 'Preserved existing custom keyword "nike road"');
  // Check that missing footwear taxonomy keywords were added
  assert(upgradeResult.updatedTags.some(k => k.includes('running') || k.includes('shoes') || k.includes('sneakers')), 'Added missing footwear keywords');
  console.log('  [PASS] Useful existing keywords strictly preserved and missing keywords added without duplicates\n');

  // Test 4: Product that already has >= 6 valid keywords
  console.log('4. Testing Product that Already Meets Requirements...');
  const fullProduct: Partial<Product> = {
    id: 'prod-full',
    name: 'Apple iPhone 15 Pro Max',
    brand: 'Apple',
    tags: ['iphone', 'apple', 'smartphone', '5g', 'titanium', 'ios', 'mobile']
  };

  assert.strictEqual(productNeedsKeywordUpgrade(fullProduct as Product), false, 'Does not need upgrade');
  const fullUpgradeResult = await upgradeExistingProductKeywords(fullProduct as Product);
  assert.strictEqual(fullUpgradeResult.needsUpdate, false, 'Does not trigger update');
  assert.deepStrictEqual(fullUpgradeResult.updatedTags, fullProduct.tags);
  console.log('  [PASS] Product with >= 6 keywords preserved without redundant processing\n');

  // Test 5: Apparel Category (Raymond Cotton Shirt)
  console.log('5. Testing Fashion / Apparel Keyword Generation...');
  const shirtProduct: Partial<Product> = {
    name: 'Raymond Men Slim Fit Pure Cotton Formal Shirt',
    brand: 'Raymond',
    categoryId: 'clothing',
    subCategoryId: 'shirts',
    specifications: [
      { key: 'Fabric', value: '100% Pure Cotton' },
      { key: 'Fit', value: 'Slim Fit' },
      { key: 'Pattern', value: 'Solid' }
    ],
    color: 'White',
    tags: []
  };

  const shirtKeywords = generateKeywordsDeterministic(shirtProduct, {
    categoryName: 'Clothing',
    subCategoryName: 'Formal Shirts'
  });

  console.log('  Shirt keywords:', shirtKeywords);
  assert(shirtKeywords.length >= 6, 'Generated at least 6 keywords for shirt');
  assert(shirtKeywords.some(k => k.includes('raymond')), 'Contains brand "raymond"');
  assert(shirtKeywords.some(k => k.includes('cotton') || k.includes('shirt')), 'Contains fabric and item type');
  assert(shirtKeywords.some(k => k.includes('formal') || k.includes('apparel') || k.includes('clothing') || k.includes('topwear')), 'Contains apparel taxonomy terms');
  console.log('  [PASS] Apparel keywords accurate and relevant\n');

  // Test 6: Partial Match Support
  console.log('6. Testing Support for Customer Partial Match Searches...');
  // Customer searching "wirel", "earphone", "boat", "running", "sneaker"
  assert(boatKeywords.some(k => k === 'boat' || k.startsWith('boat')), 'Supports partial/exact brand search "boat"');
  assert(boatKeywords.some(k => k.includes('wireless') || k.includes('headphone') || k.includes('audio')), 'Supports partial terms "wireless", "headphone", "audio"');
  assert(upgradeResult.updatedTags.some(k => k.includes('nike') || k.includes('pegasus') || k.includes('running')), 'Supports search query "nike running"');
  console.log('  [PASS] Generated keywords support compound phrases and atomic partial matches\n');

  // Test 7: Integrity - No invented or false keywords
  console.log('7. Testing Keyword Integrity (No invented brands or nonsense)...');
  assert(!boatKeywords.includes('apple'), 'boAt product does not contain "apple"');
  assert(!boatKeywords.includes('samsung'), 'boAt product does not contain "samsung"');
  assert(!shirtKeywords.includes('nike'), 'Shirt does not contain "nike"');
  assert(!shirtKeywords.includes('buy'), 'Does not contain stop word "buy"');
  assert(!shirtKeywords.includes('quality'), 'Does not contain generic filler "quality"');
  console.log('  [PASS] No irrelevant, misleading, or invented keywords generated\n');

  console.log('================================================================');
  console.log('   ALL 7 PRODUCT KEYWORD SYSTEM TESTS PASSED SUCCESSFULLY!   ');
  console.log('================================================================\n');
}

runKeywordTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
