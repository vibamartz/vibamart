import { Product } from '../../../shared/types';
import { ViBaSearchEngine, normalizeText, stemWord, computeDamerauLevenshtein } from '../searchEngine';
import { SearchRequest } from '../types';

// Sample authoritative mock catalog representing diverse real-world ViBa Mart inventory
export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prod_1',
    name: 'Apple iPhone 15 Pro Max',
    brand: 'Apple',
    description: 'Flagship smartphone with titanium design, A17 Pro chip, and 48MP camera system.',
    price: 159900,
    discountPrice: 149900,
    categoryId: 'mobiles',
    subCategoryId: 'smartphones',
    sku: 'IPHONE15PM-256',
    productCode: '8900 0996 1001',
    stock: 25,
    status: 'active',
    isVisible: true,
    rating: 4.8,
    numReviews: 120,
    tags: ['iphone', 'apple', 'smartphone', '5g', 'titanium'],
    createdAt: '2026-01-01T10:00:00Z',
    vendorId: 'v1',
    images: ['https://example.com/iphone.jpg'],
  },
  {
    id: 'prod_2',
    name: 'Samsung Galaxy S24 Ultra',
    brand: 'Samsung',
    description: 'Galaxy AI smartphone with 200MP camera, Snapdragon 8 Gen 3, and built-in S Pen.',
    price: 134999,
    discountPrice: 129999,
    categoryId: 'mobiles',
    subCategoryId: 'smartphones',
    sku: 'SAMS24U-256',
    productCode: '8900 0996 1002',
    stock: 18,
    status: 'active',
    isVisible: true,
    rating: 4.7,
    numReviews: 95,
    tags: ['samsung', 'galaxy', 'smartphone', 'ai', '5g'],
    createdAt: '2026-01-05T10:00:00Z',
    vendorId: 'v1',
    images: ['https://example.com/s24.jpg'],
  },
  {
    id: 'prod_3',
    name: 'Clear Case Compatible with Apple iPhone 15 Pro Max',
    brand: 'Spigen',
    description: 'Shockproof slim protective bumper case for Apple iPhone 15 series.',
    price: 1999,
    discountPrice: 1299,
    categoryId: 'mobile-accessories',
    subCategoryId: 'cases-covers',
    sku: 'SPG-IP15-CASE',
    productCode: '8900 0996 1003',
    stock: 150,
    status: 'active',
    isVisible: true,
    rating: 4.4,
    numReviews: 400,
    tags: ['case', 'cover', 'iphone case'],
    createdAt: '2026-01-02T10:00:00Z',
    vendorId: 'v2',
    images: ['https://example.com/case.jpg'],
  },
  {
    id: 'prod_4',
    name: 'Nike Air Zoom Pegasus Running Shoes',
    brand: 'Nike',
    description: 'Lightweight responsive breathable running shoes for men and women.',
    price: 10495,
    discountPrice: 8495,
    categoryId: 'footwear',
    subCategoryId: 'running-shoes',
    sku: 'NIKE-PEGASUS-40',
    productCode: '8900 0996 1004',
    stock: 40,
    status: 'active',
    isVisible: true,
    rating: 4.6,
    numReviews: 85,
    tags: ['nike', 'running shoes', 'sneakers', 'sports'],
    createdAt: '2026-01-08T10:00:00Z',
    vendorId: 'v3',
    images: ['https://example.com/nike.jpg'],
  },
  {
    id: 'prod_5',
    name: 'Adidas Pureboost Running Shoes',
    brand: 'Adidas',
    description: 'Comfortable boost cushioning everyday trainers and running shoes.',
    price: 8999,
    discountPrice: 5999,
    categoryId: 'footwear',
    subCategoryId: 'running-shoes',
    sku: 'ADIDAS-PUREBOOST',
    productCode: '8900 0996 1005',
    stock: 0, // OUT OF STOCK
    status: 'out_of_stock',
    isVisible: true,
    rating: 4.3,
    numReviews: 60,
    tags: ['adidas', 'shoes', 'boost'],
    createdAt: '2026-01-09T10:00:00Z',
    vendorId: 'v3',
    images: ['https://example.com/adidas.jpg'],
  },
  {
    id: 'prod_6',
    name: 'Secret Inactive Test Phone',
    brand: 'Generic',
    description: 'This is an inactive product that must never be visible.',
    price: 9999,
    categoryId: 'mobiles',
    sku: 'INACTIVE-PHONE',
    productCode: '8900 0996 1006',
    stock: 10,
    status: 'inactive', // MUST BE EXCLUDED
    isVisible: true,
    rating: 1.0,
    numReviews: 1,
    createdAt: '2026-01-10T10:00:00Z',
    vendorId: 'v1',
    images: [],
  },
  {
    id: 'prod_7',
    name: 'Admin Hidden Mobile Device',
    brand: 'Generic',
    description: 'This product has isVisible set to false and must be excluded.',
    price: 15000,
    categoryId: 'mobiles',
    sku: 'HIDDEN-PHONE',
    productCode: '8900 0996 1007',
    stock: 10,
    status: 'active',
    isVisible: false, // MUST BE EXCLUDED
    rating: 3.5,
    numReviews: 5,
    createdAt: '2026-01-11T10:00:00Z',
    vendorId: 'v1',
    images: [],
  },
  {
    id: 'prod_8_reward',
    name: 'Loyalty Reward Exclusive Gold Earbuds',
    brand: 'ViBa Rewards',
    description: 'Exclusive earbuds obtainable only via reward coins.',
    price: 2999,
    categoryId: 'electronics',
    sku: 'REWARD-EARBUD',
    productCode: '8900 0996 1008',
    stock: 100,
    status: 'active',
    isVisible: true,
    rating: 5.0,
    numReviews: 10,
    createdAt: '2026-01-12T10:00:00Z',
    vendorId: 'v1',
    images: [],
  },
  {
    id: 'prod_9_deal259',
    name: 'Deal 259 Exclusive Cotton T-Shirt',
    brand: 'ViBa Fashion',
    description: 'Special ₹259 collection t-shirt not meant for general catalog.',
    price: 799,
    discountPrice: 259,
    categoryId: 'fashion',
    sku: 'DEAL259-TSHIRT',
    productCode: '8900 0996 1009',
    stock: 50,
    status: 'active',
    isVisible: true,
    isDeal259: true,
    showInGeneralStore: false, // MUST BE EXCLUDED FROM GENERAL SEARCH
    rating: 4.2,
    numReviews: 20,
    createdAt: '2026-01-13T10:00:00Z',
    vendorId: 'v4',
    images: [],
  }
];

export function runSearchEngineTests(): { passed: number; failed: number; errors: string[] } {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, testName: string) {
    if (condition) {
      passed++;
      console.log(`  ✓ ${testName}`);
    } else {
      failed++;
      errors.push(testName);
      console.error(`  ✗ FAIL: ${testName}`);
    }
  }

  console.log('\n--- Running ViBa Mart Search Engine Evaluation Tests ---');

  // Test 1: Exact SKU & 12-Digit Product Code Match
  {
    const req: SearchRequest = {
      query: '8900 0996 1001',
      rewardProductIds: ['prod_8_reward'],
    };
    const res = ViBaSearchEngine.executeSearch(MOCK_PRODUCTS, req);
    assert(res.hits.length > 0, 'Exact product code should return hits');
    assert(res.hits[0].product.id === 'prod_1', 'Exact 12-digit product code match must rank #1');
    assert(res.hits[0].scoreBreakdown.identifierScore === 1000, 'Exact product code gives Tier 1 identifierScore of 1000');
  }

  // Test 2: Exact SKU string match
  {
    const req: SearchRequest = {
      query: 'NIKE-PEGASUS-40',
      rewardProductIds: ['prod_8_reward'],
    };
    const res = ViBaSearchEngine.executeSearch(MOCK_PRODUCTS, req);
    assert(res.hits.length > 0 && res.hits[0].product.sku === 'NIKE-PEGASUS-40', 'Exact SKU match must rank #1');
  }

  // Test 3: Exact Title vs Accessory Occurrence
  // Searching "Apple iPhone 15 Pro Max" should rank the actual iPhone #1 above the iPhone case
  {
    const req: SearchRequest = {
      query: 'Apple iPhone 15 Pro Max',
      rewardProductIds: ['prod_8_reward'],
    };
    const res = ViBaSearchEngine.executeSearch(MOCK_PRODUCTS, req);
    assert(res.hits.length >= 2, 'Query matches both the phone and its case');
    assert(res.hits[0].product.id === 'prod_1', 'Actual iPhone must outrank the case in title search');
    assert(res.hits[1].product.id === 'prod_3', 'The case ranks second');
  }

  // Test 4: Varied Word Order & Multi-term Match
  // "running shoes nike" should match "Nike Air Zoom Pegasus Running Shoes"
  {
    const req: SearchRequest = {
      query: 'running shoes nike',
      rewardProductIds: ['prod_8_reward'],
    };
    const res = ViBaSearchEngine.executeSearch(MOCK_PRODUCTS, req);
    assert(res.hits.length > 0 && res.hits[0].product.id === 'prod_4', 'Multi-term varied word order matches product');
  }

  // Test 5: Typo Tolerance
  // "samung" should discover Samsung Galaxy
  {
    const req: SearchRequest = {
      query: 'samung',
      rewardProductIds: ['prod_8_reward'],
      enableFuzzy: true,
    };
    const res = ViBaSearchEngine.executeSearch(MOCK_PRODUCTS, req);
    assert(res.hits.length > 0, 'Typo query "samung" discovers products');
    assert(res.hits[0].product.id === 'prod_2', '"samung" fuzzy matches Samsung Galaxy S24 Ultra');
    assert(res.hits[0].scoreBreakdown.fuzzyScore > 0, 'Fuzzy score is awarded for typo');
  }

  // Test 6: Typo Tolerance on Footwear
  // "shose" should discover Nike running shoes
  {
    const req: SearchRequest = {
      query: 'shose',
      rewardProductIds: ['prod_8_reward'],
      enableFuzzy: true,
    };
    const res = ViBaSearchEngine.executeSearch(MOCK_PRODUCTS, req);
    assert(res.hits.some(h => h.product.id === 'prod_4'), 'Typo query "shose" discovers running shoes');
  }

  // Test 7: Strict Storefront Eligibility Guardrails
  // Inactive (prod_6), hidden (prod_7), reward (prod_8), and general Deal259 (prod_9) MUST be excluded
  {
    const req: SearchRequest = {
      query: '', // Browse all
      rewardProductIds: ['prod_8_reward'],
    };
    const res = ViBaSearchEngine.executeSearch(MOCK_PRODUCTS, req);
    const returnedIds = new Set(res.hits.map(h => h.product.id));

    assert(!returnedIds.has('prod_6'), 'Inactive products (status: inactive) must be 100% excluded');
    assert(!returnedIds.has('prod_7'), 'Hidden products (isVisible: false) must be 100% excluded');
    assert(!returnedIds.has('prod_8_reward'), 'Reward products must be 100% excluded from public search');
    assert(!returnedIds.has('prod_9_deal259'), 'Non-general Deal 259 products must be excluded from general search');
  }

  // Test 8: Combined Multi-Facet Filtering
  {
    const req: SearchRequest = {
      query: 'shoes',
      filters: {
        brand: 'Nike',
        minPrice: 5000,
        maxPrice: 15000,
        inStockOnly: true,
      },
      rewardProductIds: ['prod_8_reward'],
    };
    const res = ViBaSearchEngine.executeSearch(MOCK_PRODUCTS, req);
    assert(res.hits.length === 1 && res.hits[0].product.id === 'prod_4', 'Combined filters (Brand + Price + InStock) accurately filter');
  }

  // Test 9: In-Stock Filter excludes out-of-stock items
  {
    const req: SearchRequest = {
      query: 'running',
      filters: {
        inStockOnly: true,
      },
      rewardProductIds: ['prod_8_reward'],
    };
    const res = ViBaSearchEngine.executeSearch(MOCK_PRODUCTS, req);
    const returnedIds = new Set(res.hits.map(h => h.product.id));
    assert(!returnedIds.has('prod_5'), 'inStockOnly: true strictly excludes out-of-stock items');
  }

  // Test 10: Facet Computation Accuracy
  {
    const req: SearchRequest = {
      query: '',
      rewardProductIds: ['prod_8_reward'],
    };
    const res = ViBaSearchEngine.executeSearch(MOCK_PRODUCTS, req);
    assert(res.facets.brands.length > 0, 'Facets compute brand buckets');
    assert(res.facets.categories.length > 0, 'Facets compute category buckets');
    assert(res.facets.availability.inStock > 0, 'Facets compute inStock count');
  }

  // Test 11: Sorting Options
  {
    const resPriceAsc = ViBaSearchEngine.executeSearch(MOCK_PRODUCTS, { query: '', sortBy: 'price-asc', rewardProductIds: ['prod_8_reward'] });
    const prices = resPriceAsc.hits.map(h => h.product.discountPrice || h.product.price);
    let isAsc = true;
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] < prices[i - 1]) isAsc = false;
    }
    assert(isAsc, 'price-asc sorts products in ascending price order');

    const resRating = ViBaSearchEngine.executeSearch(MOCK_PRODUCTS, { query: '', sortBy: 'rating', rewardProductIds: ['prod_8_reward'] });
    const ratings = resRating.hits.map(h => h.product.rating || 0);
    let isRatingDesc = true;
    for (let i = 1; i < ratings.length; i++) {
      if (ratings[i] > ratings[i - 1]) isRatingDesc = false;
    }
    assert(isRatingDesc, 'rating sorts products in descending rating order');
  }

  // Test 12: Natural Language Query — Price Constraint Extraction
  {
    const req: SearchRequest = {
      query: 'running shoes under 10000',
      rewardProductIds: ['prod_8_reward'],
    };
    const res = ViBaSearchEngine.executeSearch(MOCK_PRODUCTS, req);
    assert(res.parsedIntent?.isNaturalLanguage === true, 'NLU detects conversational query');
    assert(res.parsedIntent?.detectedFilters.maxPrice === 10000, 'NLU extracts maxPrice of 10000 from "under 10000"');
    assert(res.hits.length > 0 && res.hits[0].product.id === 'prod_4', 'Finds Nike Pegasus (8999 <= 10000)');
    for (const h of res.hits) {
      const p = h.product.discountPrice || h.product.price;
      assert(p <= 10000, `Product price ${p} must be <= 10000`);
    }
  }

  // Test 13: Natural Language Query — Discount Extraction
  {
    const req: SearchRequest = {
      query: 'electronics with 20% off',
      rewardProductIds: ['prod_8_reward'],
    };
    const res = ViBaSearchEngine.executeSearch(MOCK_PRODUCTS, req);
    assert(res.parsedIntent?.detectedFilters.minDiscount === 20, 'NLU extracts minDiscount of 20%');
  }

  // Test 14: Natural Language Query — In-Stock Extraction
  {
    const req: SearchRequest = {
      query: 'keyboard in stock',
      rewardProductIds: ['prod_8_reward'],
    };
    const res = ViBaSearchEngine.executeSearch(MOCK_PRODUCTS, req);
    assert(res.parsedIntent?.detectedFilters.inStockOnly === true, 'NLU extracts inStockOnly from "in stock"');
    const returnedIds = new Set(res.hits.map(h => h.product.id));
    assert(!returnedIds.has('prod_5'), 'NLU inStock constraint excludes out-of-stock items');
  }

  console.log(`\nEvaluation completed: ${passed} passed, ${failed} failed.\n`);
  return { passed, failed, errors };
}
