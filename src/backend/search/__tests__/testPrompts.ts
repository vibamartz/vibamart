import fetch from 'node-fetch';

const testQueries = [
  'kurta',
  'kurtis',
  'kurti under 400',
  'T-shirt for men',
  'black shirt under 500',
  "women's shoes size 7",
  'mobile phones under 15000',
  'Shoes between 500 and 1000',
  "Women's kurti above 300"
];

async function run() {
  for (const q of testQueries) {
    const res: any = await fetch('http://localhost:3000/api/search?q=' + encodeURIComponent(q)).then(r => r.json());
    console.log('-------------------------------------------');
    console.log('Query:', q);
    console.log('CleanKeyword:', res.semanticIntent?.cleanKeyword);
    console.log('DetectedFilters:', JSON.stringify(res.semanticIntent?.detectedFilters || {}));
    console.log('Total Results:', res.total);
    if (res.products && res.products.length > 0) {
      console.log('Sample matches:', res.products.slice(0, 2).map((p: any) => `${p.name} (₹${p.discountPrice || p.price})`));
    }
  }
}

run().catch(console.error);
