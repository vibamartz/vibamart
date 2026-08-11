export interface ZipcodeInfo {
  city: string;
  state: string;
  country: string;
}

/**
 * Looks up address details (City, State, Country) by Zipcode / Pincode.
 * Supports Indian pincodes (via postalpincode.in) and International zipcodes (via zippopotam.us).
 */
export async function lookupZipcode(zip: string, countryCode: string = 'in'): Promise<ZipcodeInfo> {
  const cleanZip = zip.trim();
  if (!cleanZip) {
    throw new Error('Zipcode is required');
  }

  // Normalize countryCode to lowercase
  const cc = countryCode.toLowerCase();

  // If country is India or 6-digit numeric, try postalpincode.in first
  if (cc === 'in' || (cc === 'india' || (/^\d{6}$/.test(cleanZip)))) {
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${cleanZip}`);
      if (!response.ok) {
        throw new Error('Failed to fetch from postalpincode.in');
      }
      const data = await response.json();
      if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
        const postOffice = data[0].PostOffice[0];
        return {
          city: postOffice.District || postOffice.Block || postOffice.Name,
          state: postOffice.State,
          country: 'India',
        };
      }
    } catch (error) {
      console.warn('Failed Indian pincode lookup, trying fallback:', error);
    }
  }

  // Fallback / International lookup using zippopotam.us
  // Maps common country selections to 2-letter codes for zippopotam
  let zippoCountry = cc;
  if (cc === 'india') zippoCountry = 'in';
  else if (cc === 'united states' || cc === 'usa' || cc === 'us') zippoCountry = 'us';
  else if (cc === 'canada' || cc === 'ca') zippoCountry = 'ca';
  else if (cc === 'united kingdom' || cc === 'uk' || cc === 'gb') zippoCountry = 'gb';
  else if (cc === 'australia' || cc === 'au') zippoCountry = 'au';
  else if (cc === 'germany' || cc === 'de') zippoCountry = 'de';
  else if (cc === 'france' || cc === 'fr') zippoCountry = 'fr';
  else if (cc === 'spain' || cc === 'es') zippoCountry = 'es';
  else if (cc === 'italy' || cc === 'it') zippoCountry = 'it';
  
  // If no specific country or fallback matches, default to 'us' or if length is 5 digits, default to 'us'
  if (!zippoCountry || zippoCountry.length > 2) {
    zippoCountry = /^\d{5}$/.test(cleanZip) ? 'us' : 'in';
  }

  try {
    const response = await fetch(`https://api.zippopotam.us/${zippoCountry}/${cleanZip}`);
    if (!response.ok) {
      throw new Error(`Zipcode not found for country code ${zippoCountry}`);
    }
    const data = await response.json();
    if (data && data.places && data.places.length > 0) {
      const place = data.places[0];
      return {
        city: place['place name'],
        state: place['state'] || place['state abbreviation'] || '',
        country: data['country'] || zippoCountry.toUpperCase(),
      };
    }
  } catch (error) {
    console.warn('Failed zippopotam.us lookup:', error);
  }

  // Final attempt: If it looks like zippo failed but we didn't try the other of (in/us), try it
  if (zippoCountry !== 'us' && /^\d{5}$/.test(cleanZip)) {
    try {
      const response = await fetch(`https://api.zippopotam.us/us/${cleanZip}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.places && data.places.length > 0) {
          const place = data.places[0];
          return {
            city: place['place name'],
            state: place['state'] || place['state abbreviation'] || '',
            country: data['country'] || 'United States',
          };
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  throw new Error('Invalid zipcode or could not auto-detect address. Please enter manually.');
}
