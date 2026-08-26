export interface GeocodedAddress {
  fullAddress: string;
  house: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  lat: number;
  lng: number;
}

export async function reverseGeocodeCoords(
  pos: { lat: number; lng: number },
  geocodingLib?: any
): Promise<GeocodedAddress> {
  const result: GeocodedAddress = {
    fullAddress: '',
    house: '',
    street: '',
    city: '',
    state: '',
    country: 'India',
    zip: '',
    lat: pos.lat,
    lng: pos.lng
  };

  // 1. Try Google Maps Geocoder if loaded
  try {
    const GeocoderClass = geocodingLib ? geocodingLib.Geocoder : (typeof google !== 'undefined' && google.maps ? google.maps.Geocoder : null);
    if (GeocoderClass) {
      const geocoder = new GeocoderClass();
      const response = await geocoder.geocode({ location: pos });
      if (response.results && response.results.length > 0) {
        const res = response.results[0];
        result.fullAddress = res.formatted_address || '';

        res.address_components.forEach((comp: any) => {
          const types: string[] = comp.types || [];
          if (types.includes('street_number') || types.includes('premise') || types.includes('subpremise')) {
            result.house = result.house ? `${result.house}, ${comp.long_name}` : comp.long_name;
          }
          if (types.includes('route') || types.includes('neighborhood') || types.includes('sublocality')) {
            result.street = result.street ? `${result.street}, ${comp.long_name}` : comp.long_name;
          }
          if (types.includes('locality') || types.includes('sublocality_level_1') || types.includes('administrative_area_level_2')) {
            if (!result.city) result.city = comp.long_name;
          }
          if (types.includes('administrative_area_level_1')) {
            result.state = comp.long_name;
          }
          if (types.includes('country')) {
            result.country = comp.long_name;
          }
          if (types.includes('postal_code')) {
            result.zip = comp.long_name;
          }
        });

        // Fallback for zip if missing in first result
        if (!result.zip) {
          const zipComp = response.results
            .flatMap((r: any) => r.address_components || [])
            .find((c: any) => (c.types || []).includes('postal_code'));
          if (zipComp) result.zip = zipComp.long_name;
        }

        if (result.fullAddress) {
          return result;
        }
      }
    }
  } catch (err) {
    console.warn('Google Maps geocoding failed, trying fallback:', err);
  }

  // 2. Fallback to OpenStreetMap Nominatim API
  try {
    const nomResponse = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.lat}&lon=${pos.lng}&zoom=18&addressdetails=1`
    );
    if (nomResponse.ok) {
      const data = await nomResponse.json();
      if (data && data.address) {
        const addr = data.address;
        result.fullAddress = data.display_name || '';
        result.house = addr.house_number || addr.building || addr.amenity || '';
        result.street = addr.road || addr.suburb || addr.neighbourhood || addr.residential || '';
        result.city = addr.city || addr.town || addr.village || addr.county || addr.district || '';
        result.state = addr.state || addr.state_district || '';
        result.country = addr.country || 'India';
        result.zip = (addr.postcode || '').replace(/\D/g, '').slice(0, 6);

        if (!result.fullAddress) {
          result.fullAddress = [result.house, result.street, result.city, result.state, result.country, result.zip]
            .filter(Boolean)
            .join(', ');
        }
        return result;
      }
    }
  } catch (err) {
    console.warn('Nominatim reverse geocode failed:', err);
  }

  // 3. Fallback to BigDataCloud
  try {
    const bdcResponse = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.lat}&longitude=${pos.lng}&localityLanguage=en`
    );
    if (bdcResponse.ok) {
      const bdcData = await bdcResponse.json();
      if (bdcData) {
        result.city = bdcData.city || bdcData.locality || bdcData.principalSubdivision || '';
        result.state = bdcData.principalSubdivision || '';
        result.country = bdcData.countryName || 'India';
        result.zip = (bdcData.postcode || '').replace(/\D/g, '').slice(0, 6);
        result.fullAddress = `${result.city}, ${result.state}, ${result.country}`;
        return result;
      }
    }
  } catch (err) {
    console.warn('BigDataCloud reverse geocode failed:', err);
  }

  result.fullAddress = `Lat: ${pos.lat.toFixed(4)}, Lng: ${pos.lng.toFixed(4)}`;
  return result;
}
