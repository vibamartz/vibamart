export interface ZipcodeInfo {
  area?: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  postOffices?: Array<{ name: string; district: string; state: string }>;
}

/**
 * Looks up address details (Area, City, State, Country, Pincode) by Zipcode / Pincode.
 * Supports Indian pincodes (via postalpincode.in) and International zipcodes (via zippopotam.us).
 */
export async function lookupZipcode(zip: string, countryCode: string = 'in'): Promise<ZipcodeInfo> {
  const cleanZip = zip.trim().replace(/\s+/g, '');
  if (!cleanZip) {
    throw new Error('Pincode is required');
  }

  const cc = countryCode.toLowerCase();
  const isIndianFormat = cc === 'in' || cc === 'india' || /^\d{6}$/.test(cleanZip);

  if (isIndianFormat) {
    if (cleanZip.length < 6) {
      throw new Error('Enter a 6-digit pincode');
    }
    if (!/^\d{6}$/.test(cleanZip)) {
      throw new Error('Invalid pincode');
    }

    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${cleanZip}`);
      if (!response.ok) {
        throw new Error('Unable to fetch address. Please try again.');
      }
      const data = await response.json();
      if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
        const postOffices = data[0].PostOffice;
        const mainPostOffice = postOffices[0];

        // District is the City, Name/Block is the Area/Locality
        const city = mainPostOffice.District || mainPostOffice.Block || mainPostOffice.Circle || 'Unknown City';
        const area = mainPostOffice.Name || mainPostOffice.Block || city;
        const state = mainPostOffice.State || '';

        return {
          area,
          city,
          state,
          country: 'India',
          pincode: cleanZip,
          postOffices: postOffices.map((po: any) => ({
            name: po.Name,
            district: po.District,
            state: po.State
          }))
        };
      } else if (data && data[0] && data[0].Status === 'Error') {
        throw new Error('Invalid pincode');
      }
    } catch (error: any) {
      if (error.message && !error.message.includes('fetch')) {
        throw error;
      }
      console.warn('Indian pincode lookup failed, trying fallback:', error);
    }
  }

  // Fallback / International lookup using zippopotam.us
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
  
  if (!zippoCountry || zippoCountry.length > 2) {
    zippoCountry = /^\d{5}$/.test(cleanZip) ? 'us' : 'in';
  }

  try {
    const response = await fetch(`https://api.zippopotam.us/${zippoCountry}/${cleanZip}`);
    if (!response.ok) {
      throw new Error(`No location found for pincode ${cleanZip}`);
    }
    const data = await response.json();
    if (data && data.places && data.places.length > 0) {
      const place = data.places[0];
      return {
        area: place['place name'],
        city: place['place name'],
        state: place['state'] || place['state abbreviation'] || '',
        country: data['country'] || zippoCountry.toUpperCase(),
        pincode: cleanZip,
      };
    }
  } catch (error: any) {
    if (error.message && !error.message.includes('fetch')) {
      throw error;
    }
    console.warn('Failed zippopotam.us lookup:', error);
  }

  throw new Error(`Invalid pincode or no matching location found for ${cleanZip}.`);
}
