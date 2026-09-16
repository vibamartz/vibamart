import { Product, LocationAvailabilityRule, Address } from '../types';
import { getPincodeDetails } from './indiaLocations';

export interface TargetCustomerLocation {
  pincode?: string;
  zip?: string;
  city?: string;
  district?: string;
  state?: string;
}

/**
 * Determines whether a product is deliverable / available at a customer's location.
 *
 * Matching Priority & Rules:
 * 1. Nationwide default: If product has NO location rules and NO legacy pincodes, it is available nationwide.
 * 2. Enabled State-level rule: Available for any PIN code within that State.
 * 3. Enabled City-level rule: Available for any PIN code in that City.
 * 4. Enabled District "Select All PIN Codes" rule: Available for any PIN code in that District.
 * 5. Enabled District "Selected PIN Codes" or Individual PIN Code rule: Available if PIN code matches.
 * 6. Legacy `serviceablePincodes` list: Available if PIN code is included.
 */
export function isProductAvailableAtLocation(
  product: Product,
  customerLocation?: Address | TargetCustomerLocation | string | null
): { available: boolean; reason?: string } {
  if (!product) return { available: true };

  const rules = (product.availabilityRules || []).filter(r => r.enabled !== false);
  const legacyPins = product.serviceablePincodes || [];

  // If no location restrictions defined -> Nationwide delivery
  if (rules.length === 0 && legacyPins.length === 0) {
    return { available: true };
  }

  // If customer location is missing/empty, default to available until address is provided
  if (!customerLocation) {
    return { available: true };
  }

  // Normalize customer location fields
  let pin = '';
  let city = '';
  let state = '';
  let district = '';

  if (typeof customerLocation === 'string') {
    pin = customerLocation.trim().replace(/\D/g, '').slice(0, 6);
  } else if (customerLocation) {
    const locObj = customerLocation as TargetCustomerLocation & Partial<Address>;
    pin = (locObj.zip || locObj.pincode || '').trim().replace(/\D/g, '').slice(0, 6);
    city = (locObj.city || '').trim();
    state = (locObj.state || '').trim();
    district = locObj.district ? String(locObj.district).trim() : '';
  }

  if (!pin && !city && !state) {
    return { available: true };
  }

  // Fill in missing details using India location dataset if pincode is available
  if (pin.length === 6 && (!city || !state || !district)) {
    const locInfo = getPincodeDetails(pin);
    if (locInfo) {
      if (!city) city = locInfo.city;
      if (!state) state = locInfo.state;
      if (!district) district = locInfo.district;
    }
  }

  // 1. Check legacy pincodes list
  if (pin && legacyPins.length > 0 && legacyPins.includes(pin)) {
    return { available: true };
  }

  // 2. Evaluate active availability rules
  for (const rule of rules) {
    const rState = (rule.state || '').toLowerCase().trim();
    const rCity = (rule.city || '').toLowerCase().trim();
    const rDistrict = (rule.district || '').toLowerCase().trim();

    const cState = state.toLowerCase().trim();
    const cCity = city.toLowerCase().trim();
    const cDistrict = district.toLowerCase().trim();

    // A. Entire State rule
    if (rule.type === 'state') {
      if (rState && cState && (rState === cState || cState.includes(rState) || rState.includes(cState))) {
        return { available: true };
      }
    }

    // B. City-level rule
    else if (rule.type === 'city') {
      if (rCity && cCity && (rCity === cCity || cCity.includes(rCity) || rCity.includes(cCity))) {
        if (!rState || !cState || rState === cState || cState.includes(rState)) {
          return { available: true };
        }
      }
    }

    // C. District "All PIN Codes" rule
    else if (rule.type === 'district_all') {
      if (rDistrict && (rDistrict === cDistrict || rDistrict === cCity || cDistrict.includes(rDistrict))) {
        if (!rState || !cState || rState === cState || cState.includes(rState)) {
          return { available: true };
        }
      }
    }

    // D. District "Selected PIN Codes" or Individual PIN Code rule
    else if (rule.type === 'district_pincodes' || rule.type === 'pincode') {
      if (pin && rule.pincodes && rule.pincodes.includes(pin)) {
        return { available: true };
      }
    }
  }

  // If location rules exist but customer location didn't match any rule:
  const locationLabel = [city, state, pin].filter(Boolean).join(', ');
  return {
    available: false,
    reason: `Product is not deliverable to ${locationLabel || 'the selected location'}.`
  };
}

/**
 * Validates a new availability rule to prevent duplicates and redundant rule conflicts.
 */
export function validateNewLocationRule(
  existingRules: LocationAvailabilityRule[],
  newRule: Omit<LocationAvailabilityRule, 'id'>
): { valid: boolean; error?: string } {
  const normState = newRule.state.trim().toLowerCase();
  const normDistrict = (newRule.district || '').trim().toLowerCase();
  const normCity = (newRule.city || '').trim().toLowerCase();

  for (const rule of existingRules) {
    const eState = rule.state.trim().toLowerCase();
    const eDistrict = (rule.district || '').trim().toLowerCase();
    const eCity = (rule.city || '').trim().toLowerCase();

    // Duplicate State rule
    if (newRule.type === 'state' && rule.type === 'state' && normState === eState) {
      return { valid: false, error: `Rule for state "${newRule.state}" already exists.` };
    }

    // Redundant City/District rule under existing State rule
    if ((newRule.type === 'city' || newRule.type === 'district_all') && rule.type === 'state' && normState === eState) {
      return { valid: false, error: `Entire state "${newRule.state}" is already selected. District/City rule is redundant.` };
    }

    // Duplicate District All rule
    if (newRule.type === 'district_all' && rule.type === 'district_all' && normState === eState && normDistrict === eDistrict) {
      return { valid: false, error: `All PIN codes rule for district "${newRule.district}" already exists.` };
    }

    // Duplicate City rule
    if (newRule.type === 'city' && rule.type === 'city' && normState === eState && normCity === eCity) {
      return { valid: false, error: `City rule for "${newRule.city}" already exists.` };
    }
  }

  return { valid: true };
}
