import React, { useState } from 'react';
import { LocationAvailabilityRule } from '../../shared/types';
import { 
  getStates, 
  getDistricts, 
  getCities, 
  getPincodes 
} from '../../shared/utilities/indiaLocations';
import { validateNewLocationRule } from '../../shared/utilities/locationAvailability';
import { MapPin, Plus, Trash2, CheckCircle2, AlertCircle, Globe, ToggleLeft, ToggleRight, Sparkles, X, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProductLocationManagerProps {
  rules: LocationAvailabilityRule[];
  onChange: (updatedRules: LocationAvailabilityRule[]) => void;
}

export default function ProductLocationManager({ rules = [], onChange }: ProductLocationManagerProps) {
  const [scopeType, setScopeType] = useState<'state' | 'district_all' | 'district_pincodes' | 'city' | 'pincode'>('state');
  const [selectedState, setSelectedState] = useState<string>('Odisha');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedPincodes, setSelectedPincodes] = useState<string[]>([]);
  const [customPincodeInput, setCustomPincodeInput] = useState<string>('');

  const states = getStates();
  const districts = getDistricts(selectedState);
  const cities = getCities(selectedState, selectedDistrict);
  const availablePincodes = getPincodes(selectedState, selectedDistrict, selectedCity);

  // Handle State Change
  const handleStateChange = (stateName: string) => {
    setSelectedState(stateName);
    const dists = getDistricts(stateName);
    setSelectedDistrict(dists[0] || '');
    const cits = getCities(stateName, dists[0] || '');
    setSelectedCity(cits[0] || '');
    setSelectedPincodes([]);
  };

  // Handle District Change
  const handleDistrictChange = (districtName: string) => {
    setSelectedDistrict(districtName);
    const cits = getCities(selectedState, districtName);
    setSelectedCity(cits[0] || '');
    const pins = getPincodes(selectedState, districtName, cits[0] || '');
    setSelectedPincodes(pins);
  };

  // Add Custom Pincode Chip
  const handleAddCustomPincode = () => {
    const cleanPin = customPincodeInput.trim().replace(/\D/g, '').slice(0, 6);
    if (cleanPin.length !== 6) {
      toast.error('Enter a valid 6-digit Indian PIN code');
      return;
    }
    if (selectedPincodes.includes(cleanPin)) {
      toast.error(`PIN code ${cleanPin} is already added`);
      return;
    }
    setSelectedPincodes(prev => [...prev, cleanPin]);
    setCustomPincodeInput('');
  };

  // Toggle Pincode Chip
  const handleTogglePincode = (pin: string) => {
    if (selectedPincodes.includes(pin)) {
      setSelectedPincodes(prev => prev.filter(p => p !== pin));
    } else {
      setSelectedPincodes(prev => [...prev, pin]);
    }
  };

  // Add Location Availability Rule
  const handleAddRule = () => {
    if (!selectedState) {
      toast.error('Please select a State');
      return;
    }

    if (scopeType === 'city' && !selectedCity) {
      toast.error('Please select a City');
      return;
    }

    if ((scopeType === 'district_all' || scopeType === 'district_pincodes') && !selectedDistrict) {
      toast.error('Please select a District');
      return;
    }

    if ((scopeType === 'district_pincodes' || scopeType === 'pincode') && selectedPincodes.length === 0) {
      toast.error('Please select or add at least one PIN Code');
      return;
    }

    const newRulePayload: Omit<LocationAvailabilityRule, 'id'> = {
      type: scopeType,
      state: selectedState,
      district: (scopeType === 'district_all' || scopeType === 'district_pincodes') ? selectedDistrict : undefined,
      city: scopeType === 'city' ? selectedCity : undefined,
      pincodes: (scopeType === 'district_pincodes' || scopeType === 'pincode') ? [...selectedPincodes] : undefined,
      enabled: true,
      createdAt: new Date().toISOString()
    };

    const valResult = validateNewLocationRule(rules, newRulePayload);
    if (!valResult.valid) {
      toast.error(valResult.error || 'Duplicate or redundant location rule');
      return;
    }

    const newRule: LocationAvailabilityRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...newRulePayload
    };

    onChange([...rules, newRule]);
    toast.success('Location availability rule added!');

    // Reset selection input
    setSelectedPincodes([]);
    setCustomPincodeInput('');
  };

  // Toggle Rule Active/Inactive Status
  const handleToggleRuleEnabled = (ruleId: string) => {
    const updated = rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r);
    onChange(updated);
  };

  // Remove Rule
  const handleRemoveRule = (ruleId: string) => {
    const updated = rules.filter(r => r.id !== ruleId);
    onChange(updated);
    toast.success('Location rule removed');
  };

  // Reset / Make Available Nationwide
  const handleResetToNationwide = () => {
    onChange([]);
    toast.success('Product set to Nationwide Availability');
  };

  const activeRulesCount = rules.filter(r => r.enabled !== false).length;

  return (
    <div className="space-y-6 bg-white rounded-3xl p-5 sm:p-7 border border-gray-200/80 shadow-xs">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
              <MapPin className="w-5 h-5 stroke-[2.5]" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
              Stock Availability Location Management
            </h3>
          </div>
          <p className="text-xs text-gray-500 font-semibold mt-1">
            Configure delivery rules by State, District, City, or PIN Codes for desktop & mobile customers.
          </p>
        </div>

        {/* STATUS BADGE */}
        <div className="flex items-center gap-2 shrink-0">
          {rules.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black uppercase tracking-wider">
              <Globe className="w-4 h-4 text-emerald-600" /> Available Nationwide
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs font-black uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-amber-600" /> {activeRulesCount} Active Location Rule(s)
              </span>
              <button
                type="button"
                onClick={handleResetToNationwide}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                title="Remove all rules and make product deliverable everywhere"
              >
                Make Nationwide
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RULE CREATOR CARD */}
      <div className="bg-gray-50/80 rounded-2xl p-4 sm:p-6 border border-gray-200 space-y-4">
        <span className="text-xs font-black text-gray-400 uppercase tracking-widest block">
          ＋ Add Location Availability Rule
        </span>

        {/* STEP 1: SCOPE TYPE SELECTION */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { id: 'state', label: 'Entire State', desc: 'All PIN Codes in State' },
            { id: 'city', label: 'City Level', desc: 'All PIN Codes in City' },
            { id: 'district_all', label: 'District (All PINs)', desc: 'All PINs in District' },
            { id: 'district_pincodes', label: 'District (Selected PINs)', desc: 'Choose PINs in District' },
            { id: 'pincode', label: 'Individual PIN Code', desc: 'Custom PIN Codes' },
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setScopeType(opt.id as any);
                if ((opt.id === 'district_all' || opt.id === 'district_pincodes') && !selectedDistrict) {
                  const dists = getDistricts(selectedState);
                  setSelectedDistrict(dists[0] || '');
                }
              }}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                scopeType === opt.id
                  ? 'border-emerald-600 bg-white ring-2 ring-emerald-600/20 shadow-xs'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span className={`text-xs font-black block ${scopeType === opt.id ? 'text-emerald-700' : 'text-gray-900'}`}>
                {opt.label}
              </span>
              <span className="text-[10px] text-gray-400 font-medium block mt-0.5">
                {opt.desc}
              </span>
            </button>
          ))}
        </div>

        {/* STEP 2: CASCADING LOCATION DROPDOWNS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          
          {/* COUNTRY & STATE */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
              State (India) *
            </label>
            <select
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs"
            >
              {states.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* DISTRICT (IF NEEDED OR CITY) */}
          {(scopeType === 'district_all' || scopeType === 'district_pincodes' || scopeType === 'city') && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
                District *
              </label>
              <select
                value={selectedDistrict}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs"
              >
                <option value="">Select District</option>
                {districts.map(dt => (
                  <option key={dt} value={dt}>{dt}</option>
                ))}
              </select>
            </div>
          )}

          {/* CITY (IF CITY SCOPE) */}
          {scopeType === 'city' && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">
                City *
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs"
              >
                <option value="">Select City</option>
                {cities.map(ct => (
                  <option key={ct} value={ct}>{ct}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* STEP 3: PIN CODE MANAGEMENT SECTION */}
        {(scopeType === 'district_pincodes' || scopeType === 'pincode') && (
          <div className="space-y-3 pt-3 border-t border-gray-200/70">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-gray-800">
                Select PIN Codes ({selectedPincodes.length} selected)
              </span>
              
              <div className="flex items-center gap-2">
                {availablePincodes.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedPincodes([...availablePincodes])}
                      className="text-[11px] font-bold text-emerald-700 hover:underline"
                    >
                      Select All District PINs
                    </button>
                    <span className="text-gray-300">•</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedPincodes([])}
                  className="text-[11px] font-bold text-rose-600 hover:underline"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {/* PRE-MAPPED DISTRICT PINCODES QUICK SELECT CHIPS */}
            {availablePincodes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-3 bg-white rounded-xl border border-gray-200 max-h-32 overflow-y-auto">
                {availablePincodes.map(pin => {
                  const isSelected = selectedPincodes.includes(pin);
                  return (
                    <button
                      key={pin}
                      type="button"
                      onClick={() => handleTogglePincode(pin)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all border ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-emerald-300'
                      }`}
                    >
                      {pin} {isSelected && '✓'}
                    </button>
                  );
                })}
              </div>
            )}

            {/* CUSTOM PINCODE INPUT */}
            <div className="flex items-center gap-2 max-w-md">
              <input
                type="text"
                maxLength={6}
                value={customPincodeInput}
                onChange={(e) => setCustomPincodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomPincode(); } }}
                placeholder="Enter 6-digit PIN Code"
                className="flex-1 bg-white border border-gray-200 h-9 rounded-xl px-3 text-xs font-bold focus:border-emerald-600 outline-none shadow-2xs"
              />
              <button
                type="button"
                onClick={handleAddCustomPincode}
                className="px-3.5 py-2 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black transition-colors"
              >
                + Add PIN
              </button>
            </div>

            {/* CURRENT SELECTED PINCODES LIST */}
            {selectedPincodes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedPincodes.map(pin => (
                  <span
                    key={pin}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg text-xs font-extrabold"
                  >
                    {pin}
                    <button
                      type="button"
                      onClick={() => handleTogglePincode(pin)}
                      className="text-emerald-700 hover:text-rose-600 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADD RULE BUTTON */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleAddRule}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:bg-emerald-700 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Add Location Rule
          </button>
        </div>
      </div>

      {/* ACTIVE RULES LIST */}
      <div className="space-y-3">
        <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">
          Configured Location Availability Rules ({rules.length})
        </h4>

        {rules.length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5">
            {rules.map((rule) => {
              const isEnabled = rule.enabled !== false;
              let scopeLabel = 'State';
              let hierarchyText = `India > ${rule.state}`;

              if (rule.type === 'city') {
                scopeLabel = 'City';
                hierarchyText = `India > ${rule.state} > ${rule.city}`;
              } else if (rule.type === 'district_all') {
                scopeLabel = 'District (All PINs)';
                hierarchyText = `India > ${rule.state} > ${rule.district} (All Valid PINs)`;
              } else if (rule.type === 'district_pincodes' || rule.type === 'pincode') {
                scopeLabel = rule.type === 'district_pincodes' ? 'District (Selected PINs)' : 'Individual PINs';
                hierarchyText = `India > ${rule.state}${rule.district ? ' > ' + rule.district : ''} [${(rule.pincodes || []).length} PINs]`;
              }

              return (
                <div
                  key={rule.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isEnabled
                      ? 'bg-white border-emerald-200/90 shadow-2xs'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black uppercase rounded-full">
                        {scopeLabel}
                      </span>
                      <span className="text-xs font-extrabold text-gray-900">
                        {hierarchyText}
                      </span>
                    </div>

                    {rule.pincodes && rule.pincodes.length > 0 && (
                      <p className="text-[11px] font-bold text-gray-500 line-clamp-1">
                        PIN Codes: <span className="text-emerald-700 font-extrabold">{rule.pincodes.join(', ')}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleToggleRuleEnabled(rule.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black uppercase transition-all ${
                        isEnabled
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-200 text-gray-600 border border-gray-300'
                      }`}
                    >
                      {isEnabled ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                      {isEnabled ? 'Active' : 'Disabled'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveRule(rule.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-emerald-50/50 rounded-2xl p-6 text-center border border-dashed border-emerald-200 space-y-1.5">
            <Globe className="w-6 h-6 text-emerald-600 mx-auto" />
            <p className="text-xs font-black text-emerald-950 uppercase tracking-wider">
              No Location Restrictions Applied
            </p>
            <p className="text-xs text-gray-500 font-medium">
              This product is currently available for delivery across **ALL PIN Codes in India** (Nationwide). Add location rules above if you wish to restrict availability.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
