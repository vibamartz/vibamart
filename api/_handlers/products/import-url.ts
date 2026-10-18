import { Request, Response } from "express";
import http from "http";
import https from "https";
import { URL } from "url";

function setCorsHeaders(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

interface ExtractedProductData {
  title?: string;
  brand?: string;
  description?: string;
  fullDescription?: string;
  price?: number;
  mrp?: number;
  currency?: string;
  images: string[];
  specifications: { key: string; value: string }[];
  sku?: string;
  sourceUrl: string;
}

/**
 * Fetch HTML with redirect handling and browser-like user agent
 */
function fetchUrlHtml(targetUrl: string, maxRedirects = 5): Promise<{ html: string; finalUrl: string }> {
  return new Promise((resolve, reject) => {
    let redirectsCount = 0;

    function doRequest(currentUrl: string) {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(currentUrl);
      } catch (err: any) {
        return reject(new Error(`Invalid URL format: ${err?.message || currentUrl}`));
      }

      const client = parsedUrl.protocol === "https:" ? https : http;
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      };

      const req = client.get(
        parsedUrl,
        {
          headers,
          timeout: 12000,
        },
        (res) => {
          // Handle redirects
          if (
            res.statusCode &&
            [301, 302, 303, 307, 308].includes(res.statusCode) &&
            res.headers.location
          ) {
            redirectsCount++;
            if (redirectsCount > maxRedirects) {
              return reject(new Error("Too many redirects encountered while fetching product page."));
            }
            const nextUrl = new URL(res.headers.location, currentUrl).toString();
            return doRequest(nextUrl);
          }

          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 400)) {
            return reject(new Error(`Server responded with HTTP status ${res.statusCode}`));
          }

          let data = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            data += chunk;
            // Cap at 5MB to prevent memory issues with massive pages
            if (data.length > 5 * 1024 * 1024) {
              req.destroy();
              resolve({ html: data, finalUrl: currentUrl });
            }
          });
          res.on("end", () => {
            resolve({ html: data, finalUrl: currentUrl });
          });
        }
      );

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timed out while connecting to the product URL."));
      });

      req.on("error", (err) => {
        reject(new Error(`Network error while fetching product URL: ${err.message}`));
      });
    }

    doRequest(targetUrl);
  });
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return "";
      }
    })
    .trim();
}

/**
 * Strip HTML tags and normalize whitespace
 */
function cleanText(html: string): string {
  if (!html) return "";
  const noTags = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                     .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
                     .replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(noTags).replace(/\s+/g, " ").trim();
}

/**
 * Extract OpenGraph / Meta tags
 */
function extractMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const metaRegex = /<meta\s+([^>]+)>/gi;
  let match;

  while ((match = metaRegex.exec(html)) !== null) {
    const attrs = match[1];
    const nameMatch = attrs.match(/(?:name|property|itemprop)=["']([^"']+)["']/i);
    const contentMatch = attrs.match(/content=["']([^"']*)["']/i);
    if (nameMatch && contentMatch) {
      const key = nameMatch[1].toLowerCase().trim();
      const val = decodeHtmlEntities(contentMatch[1]);
      if (val && !meta[key]) {
        meta[key] = val;
      }
    }
  }

  // Also extract <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    meta["page_title"] = decodeHtmlEntities(titleMatch[1]);
  }

  return meta;
}

/**
 * Extract JSON-LD script blocks
 */
function extractJsonLd(html: string): any[] {
  const objects: any[] = [];
  const scriptRegex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const rawContent = match[1].trim();
    if (!rawContent) continue;
    try {
      const parsed = JSON.parse(rawContent);
      if (Array.isArray(parsed)) {
        objects.push(...parsed);
      } else if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed["@graph"])) {
          objects.push(...parsed["@graph"]);
        } else {
          objects.push(parsed);
        }
      }
    } catch {
      // Ignore invalid JSON-LD scripts
    }
  }

  return objects;
}

/**
 * Extract specifications from HTML tables and definition lists
 */
function extractHtmlSpecifications(html: string): { key: string; value: string }[] {
  const specs: { key: string; value: string }[] = [];
  const seenKeys = new Set<string>();

  const addSpec = (rawK: string, rawV: string) => {
    const key = cleanText(rawK).replace(/[:：]$/, "").trim();
    const value = cleanText(rawV).trim();
    if (
      key.length >= 2 &&
      key.length <= 60 &&
      value.length >= 1 &&
      value.length <= 400 &&
      !seenKeys.has(key.toLowerCase()) &&
      !/^(login|cookie|privacy|copyright|terms|search|cart|menu|nav)/i.test(key)
    ) {
      seenKeys.add(key.toLowerCase());
      specs.push({ key, value });
    }
  };

  // 1. Table rows: <tr><th>Key</th><td>Value</td></tr> or <tr><td>Key</td><td>Value</td></tr>
  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const trContent = trMatch[1];
    const cellRegex = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    const cells: string[] = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(trContent)) !== null) {
      cells.push(cellMatch[1]);
    }
    if (cells.length === 2) {
      addSpec(cells[0], cells[1]);
    }
  }

  // 2. Definition lists: <dt>Key</dt><dd>Value</dd>
  const dlRegex = /<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi;
  let dlMatch;
  while ((dlMatch = dlRegex.exec(html)) !== null) {
    addSpec(dlMatch[1], dlMatch[2]);
  }

  // 3. Key-value spec items commonly styled with class/div
  const kvRegex = /<(?:li|div)\b[^>]*(?:spec|attribute|feature|param|detail)[^>]*>([\s\S]*?)<\/(?:li|div)>/gi;
  let kvMatch;
  while ((kvMatch = kvRegex.exec(html)) !== null) {
    const content = cleanText(kvMatch[1]);
    const colonIdx = content.indexOf(":");
    if (colonIdx > 1 && colonIdx < 50) {
      const k = content.substring(0, colonIdx);
      const v = content.substring(colonIdx + 1);
      addSpec(k, v);
    }
  }

  return specs.slice(0, 30);
}

/**
 * Filter and qualify image URLs
 */
function qualifyAndFilterImages(rawUrls: string[], baseUrl: string): string[] {
  const validImages: string[] = [];
  const seen = new Set<string>();

  for (const raw of rawUrls) {
    if (!raw || typeof raw !== "string") continue;
    let trimmed = raw.trim();
    if (trimmed.startsWith("//")) {
      trimmed = "https:" + trimmed;
    }
    let absUrl = trimmed;
    try {
      absUrl = new URL(trimmed, baseUrl).toString();
    } catch {
      continue;
    }

    if (!absUrl.startsWith("http://") && !absUrl.startsWith("https://")) {
      continue;
    }

    // Skip tiny icons, tracking pixels, badges, logos
    if (
      /\b(logo|icon|badge|sprite|tracker|pixel|avatar|favicon|placeholder|rating|spinner|loader|arrow|button|payment|footer)\b/i.test(
        absUrl
      )
    ) {
      continue;
    }

    // Filter by file extension or standard image cdn patterns
    const isImageFile = /\.(jpe?g|png|webp|avif)($|\?)/i.test(absUrl);
    const isImageCdn = /(images|img|photos|products|media|assets|cdn)/i.test(absUrl);
    if (!isImageFile && !isImageCdn) {
      continue;
    }

    const key = absUrl.toLowerCase().split("?")[0];
    if (!seen.has(key)) {
      seen.add(key);
      validImages.push(absUrl);
    }
    if (validImages.length >= 10) break;
  }

  return validImages;
}

/**
 * Main parser logic extracting structured product details
 */
export function parseProductFromHtml(html: string, sourceUrl: string): ExtractedProductData {
  const meta = extractMetaTags(html);
  const jsonLdBlocks = extractJsonLd(html);
  const specs = extractHtmlSpecifications(html);

  // Find Product schema in JSON-LD
  let productJson: any = null;
  for (const block of jsonLdBlocks) {
    const type = block?.["@type"];
    if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) {
      productJson = block;
      break;
    }
  }

  // 1. Title extraction
  let title =
    productJson?.name ||
    meta["og:title"] ||
    meta["twitter:title"] ||
    meta["title"] ||
    meta["page_title"] ||
    "";

  // Clean title suffix like " | Amazon", " - Flipkart", " | Official Store"
  if (title) {
    title = title
      .replace(/\s*[-–|:]\s*(Amazon|Flipkart|Myntra|eBay|Walmart|AliExpress|Shopify|Etsy|ViBa Mart)[\w\s.]*$/i, "")
      .replace(/\s*\|\s*[\w\s.-]+$/i, "")
      .trim();
  }

  // 2. Brand extraction
  let brand = "";
  if (productJson?.brand) {
    if (typeof productJson.brand === "string") {
      brand = productJson.brand;
    } else if (typeof productJson.brand === "object" && productJson.brand.name) {
      brand = productJson.brand.name;
    }
  }
  if (!brand) {
    brand = meta["og:brand"] || meta["product:brand"] || meta["brand"] || "";
  }
  // Try finding brand from title (e.g. "Apple iPhone 15 Pro" -> brand: "Apple")
  if (!brand && title) {
    const firstWord = title.split(" ")[0];
    if (firstWord && firstWord.length > 2 && /^[A-Z][a-zA-Z0-9]+$/.test(firstWord)) {
      // Candidates like Samsung, Nike, Sony, Apple, Adidas, Xiaomi, Boat
      const commonBrands = [
        "Apple", "Samsung", "Sony", "Nike", "Adidas", "Puma", "Boat", "OnePlus",
        "Xiaomi", "Realme", "Oppo", "Vivo", "Asus", "Dell", "HP", "Lenovo", "Acer",
        "Philips", "Canon", "Nikon", "JBL", "LG", "Whirlpool", "Bosch", "Zara", "H&M"
      ];
      const found = commonBrands.find(b => b.toLowerCase() === firstWord.toLowerCase());
      if (found) brand = found;
    }
  }

  // 3. Description extraction
  let description =
    productJson?.description ||
    meta["og:description"] ||
    meta["twitter:description"] ||
    meta["description"] ||
    "";
  description = cleanText(description);

  // If full description can be pulled from JSON-LD or meta, store it
  let fullDescription = "";
  if (productJson?.disambiguatingDescription || productJson?.articleBody) {
    fullDescription = cleanText(productJson.disambiguatingDescription || productJson.articleBody);
  } else if (description.length > 200) {
    fullDescription = description;
    description = description.slice(0, 197) + "...";
  }

  // 4. Price and MRP extraction
  let price: number | undefined;
  let mrp: number | undefined;
  let currency = "INR";

  if (productJson?.offers) {
    const offers = Array.isArray(productJson.offers) ? productJson.offers[0] : productJson.offers;
    if (offers) {
      const p = parseFloat(offers.price || offers.lowPrice);
      if (!isNaN(p) && p > 0) {
        price = p;
      }
      const m = parseFloat(offers.highPrice);
      if (!isNaN(m) && m > 0) {
        mrp = m;
      }
      if (offers.priceCurrency) {
        currency = offers.priceCurrency;
      }
    }
  }

  if (price === undefined && meta["product:price:amount"]) {
    const p = parseFloat(meta["product:price:amount"]);
    if (!isNaN(p) && p > 0) price = p;
  }
  if (price === undefined && meta["og:price:amount"]) {
    const p = parseFloat(meta["og:price:amount"]);
    if (!isNaN(p) && p > 0) price = p;
  }

  // Fallback price regex on body if not found in metadata
  if (price === undefined) {
    const priceRegex = /(?:₹|Rs\.?|INR|\$)\s*([\d,]+(?:\.\d{2})?)/gi;
    const priceMatches: number[] = [];
    let pMatch;
    let count = 0;
    while ((pMatch = priceRegex.exec(html)) !== null && count < 10) {
      count++;
      const num = parseFloat(pMatch[1].replace(/,/g, ""));
      if (!isNaN(num) && num > 10 && num < 1000000) {
        priceMatches.push(num);
      }
    }
    if (priceMatches.length > 0) {
      // Pick first reasonable price
      price = priceMatches[0];
      if (priceMatches.length > 1 && priceMatches[1] > price) {
        mrp = priceMatches[1];
      }
    }
  }

  // If MRP is lower than price or undefined, align them logically
  if (price !== undefined && mrp === undefined) {
    mrp = price;
  } else if (price !== undefined && mrp !== undefined && mrp < price) {
    const temp = mrp;
    mrp = price;
    price = temp;
  }

  // 5. Image extraction
  const rawImages: string[] = [];
  if (productJson?.image) {
    if (Array.isArray(productJson.image)) {
      for (const item of productJson.image) {
        if (typeof item === "string") rawImages.push(item);
        else if (item && typeof item === "object" && item.url) rawImages.push(item.url);
      }
    } else if (typeof productJson.image === "string") {
      rawImages.push(productJson.image);
    } else if (productJson.image.url) {
      rawImages.push(productJson.image.url);
    }
  }

  if (meta["og:image"]) rawImages.push(meta["og:image"]);
  if (meta["og:image:secure_url"]) rawImages.push(meta["og:image:secure_url"]);
  if (meta["twitter:image"]) rawImages.push(meta["twitter:image"]);

  // Extract from <img> tags matching high-resolution product image attributes
  const imgTagRegex = /<img\b[^>]*?(?:data-old-hires|data-zoom-image|data-large|data-src|src)=["']([^"']+)["'][^>]*>/gi;
  let imgMatch;
  let imgCount = 0;
  while ((imgMatch = imgTagRegex.exec(html)) !== null && imgCount < 20) {
    imgCount++;
    rawImages.push(imgMatch[1]);
  }

  const qualifiedImages = qualifyAndFilterImages(rawImages, sourceUrl);

  // 6. Additional Specs from JSON-LD
  if (productJson?.additionalProperty && Array.isArray(productJson.additionalProperty)) {
    for (const prop of productJson.additionalProperty) {
      if (prop.name && prop.value) {
        const k = cleanText(String(prop.name));
        const v = cleanText(String(prop.value));
        if (k && v && !specs.some(s => s.key.toLowerCase() === k.toLowerCase())) {
          specs.push({ key: k, value: v });
        }
      }
    }
  }

  // SKU / Model / Color
  let sku = "";
  if (productJson?.sku) sku = String(productJson.sku);
  else if (productJson?.model) sku = String(productJson.model);
  else if (meta["product:retailer_item_id"]) sku = meta["product:retailer_item_id"];

  return {
    title: title || undefined,
    brand: brand || undefined,
    description: description || undefined,
    fullDescription: fullDescription || undefined,
    price: price || undefined,
    mrp: mrp || undefined,
    currency,
    images: qualifiedImages,
    specifications: specs,
    sku: sku || undefined,
    sourceUrl,
  };
}

/**
 * Express handler for POST /api/products/import-url
 */
export default async function importProductUrlHandler(req: Request, res: Response) {
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { url } = req.body || {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        success: false,
        error: "Product URL is required.",
      });
    }

    const trimmedUrl = url.trim();

    // Validate URL protocol
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid HTTP or HTTPS URL.",
      });
    }

    // Fetch page HTML
    const { html, finalUrl } = await fetchUrlHtml(trimmedUrl);

    if (!html || html.trim().length === 0) {
      return res.status(422).json({
        success: false,
        error: "Unable to retrieve HTML content from the provided product URL.",
      });
    }

    // Extract product data
    const extractedData = parseProductFromHtml(html, finalUrl);

    // Check if at least minimal viable product information was extracted
    const hasData = Boolean(
      extractedData.title ||
      extractedData.description ||
      extractedData.images.length > 0 ||
      extractedData.specifications.length > 0 ||
      extractedData.price
    );

    if (!hasData) {
      return res.status(422).json({
        success: false,
        error: "Could not identify any product details or metadata from the given URL.",
      });
    }

    return res.status(200).json({
      success: true,
      data: extractedData,
    });
  } catch (error: any) {
    console.error("[ProductImportURL] Extraction error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to import product details from URL.",
    });
  }
}
