import { Category } from '../types';
import { createSlug } from './slug';

// High-quality curated category logo pools mapped by department keywords
const LOGO_POOLS: Record<string, { images: string[]; icon: string }> = {
  mobile: {
    images: [
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1546868881-d8ec61af6f8c?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1544244015-0cd4b3ff3f9d?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=400&h=400&fit=crop',
    ],
    icon: 'smartphone',
  },
  fashion: {
    images: [
      'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400&h=400&fit=crop',
    ],
    icon: 'shirt',
  },
  electronics: {
    images: [
      'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=400&fit=crop',
    ],
    icon: 'laptop',
  },
  home: {
    images: [
      'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=400&fit=crop',
    ],
    icon: 'home',
  },
  beauty: {
    images: [
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1527799822367-a2da39db36f3?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=400&fit=crop',
    ],
    icon: 'sparkles',
  },
  appliances: {
    images: [
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=400&h=400&fit=crop',
    ],
    icon: 'tv',
  },
  toys: {
    images: [
      'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1558060370-d644479be6f7?w=400&h=400&fit=crop',
    ],
    icon: 'sparkles',
  },
  food: {
    images: [
      'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=400&h=400&fit=crop',
    ],
    icon: 'sparkles',
  },
  sports: {
    images: [
      'https://images.unsplash.com/photo-1517649763962-0c6232662000?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=400&h=400&fit=crop',
    ],
    icon: 'sparkles',
  },
  general: {
    images: [
      'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1526178613552-2b45c6c302f0?w=400&h=400&fit=crop',
    ],
    icon: 'layers',
  },
};

/**
 * Collect all category and subcategory logo URLs currently used in the store
 */
export function getAllUsedCategoryLogos(categories: Category[]): Set<string> {
  const used = new Set<string>();
  categories.forEach((cat) => {
    if (cat.image) used.add(cat.image);
    if (cat.iconImage) used.add(cat.iconImage);
    cat.subcategories?.forEach((sub) => {
      if (sub.image) used.add(sub.image);
      sub.subcategories?.forEach((nested) => {
        if (nested.image) used.add(nested.image);
      });
    });
  });
  return used;
}

/**
 * Automatically generates a unique Category Logo based on category name.
 * Checks existing category logos in database to prevent assigning duplicates.
 */
export function generateCategoryLogo(
  categoryName: string,
  existingCategories: Category[] = []
): { image: string; icon: string } {
  const lowerName = (categoryName || '').toLowerCase();
  const usedLogos = getAllUsedCategoryLogos(existingCategories);

  // Identify matching pool key by keyword
  let poolKey = 'general';
  if (lowerName.includes('mobile') || lowerName.includes('phone') || lowerName.includes('smartphone') || lowerName.includes('tablet')) {
    poolKey = 'mobile';
  } else if (lowerName.includes('fashion') || lowerName.includes('cloth') || lowerName.includes('shirt') || lowerName.includes('wear') || lowerName.includes('men') || lowerName.includes('women') || lowerName.includes('kid')) {
    poolKey = 'fashion';
  } else if (lowerName.includes('electron') || lowerName.includes('laptop') || lowerName.includes('audio') || lowerName.includes('camera') || lowerName.includes('gaming')) {
    poolKey = 'electronics';
  } else if (lowerName.includes('home') || lowerName.includes('decor') || lowerName.includes('furnit') || lowerName.includes('kitchen')) {
    poolKey = 'home';
  } else if (lowerName.includes('beauty') || lowerName.includes('skin') || lowerName.includes('makeup') || lowerName.includes('hair')) {
    poolKey = 'beauty';
  } else if (lowerName.includes('appliance') || lowerName.includes('tv') || lowerName.includes('fridge') || lowerName.includes('wash')) {
    poolKey = 'appliances';
  } else if (lowerName.includes('toy') || lowerName.includes('game')) {
    poolKey = 'toys';
  } else if (lowerName.includes('food') || lowerName.includes('health') || lowerName.includes('grocery')) {
    poolKey = 'food';
  } else if (lowerName.includes('sport') || lowerName.includes('fit') || lowerName.includes('outdoor')) {
    poolKey = 'sports';
  }

  const pool = LOGO_POOLS[poolKey] || LOGO_POOLS.general;

  // Find a logo image in pool that is NOT already in use
  const unusedImage = pool.images.find((img) => !usedLogos.has(img));

  if (unusedImage) {
    return { image: unusedImage, icon: pool.icon };
  }

  // Fallback to general pool unused image
  const generalUnused = LOGO_POOLS.general.images.find((img) => !usedLogos.has(img));
  if (generalUnused) {
    return { image: generalUnused, icon: pool.icon };
  }

  // If all pool images are taken, return first image in matching pool
  return { image: pool.images[0], icon: pool.icon };
}

/**
 * Checks whether a category with the same name or slug already exists in the database
 */
export function isDuplicateCategory(
  categoryName: string,
  existingCategories: Category[],
  excludeId?: string
): boolean {
  const cleanName = (categoryName || '').trim().toLowerCase();
  const cleanSlug = createSlug(categoryName);

  return existingCategories.some((cat) => {
    if (excludeId && cat.id === excludeId) return false;
    const catName = cat.name.trim().toLowerCase();
    const catSlug = cat.slug || cat.seoSlug || createSlug(cat.name);
    return catName === cleanName || catSlug === cleanSlug;
  });
}
