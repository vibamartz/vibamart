export interface LocationState {
  name: string;
  districts: LocationDistrict[];
}

export interface LocationDistrict {
  name: string;
  cities: string[];
  pincodes?: string[];
}

export interface PincodeLookupInfo {
  pincode: string;
  district: string;
  city: string;
  state: string;
}

// Complete India States & Union Territories Dataset with Major Districts and Cities
export const INDIA_LOCATION_DATA: LocationState[] = [
  {
    name: "Odisha",
    districts: [
      { name: "Khurda", cities: ["Bhubaneswar", "Jatni", "Khordha", "Banapur", "Tangi"], pincodes: ["751001", "751002", "751003", "751010", "751012", "751015", "751020", "751024", "752050"] },
      { name: "Cuttack", cities: ["Cuttack", "Choudwar", "Athagarh", "Banki", "Salipur"], pincodes: ["753001", "753002", "753003", "753004", "753010", "753012"] },
      { name: "Puri", cities: ["Puri", "Konark", "Pipili", "Nimapada", "Sakhigopal"], pincodes: ["752001", "752002", "752011", "752104"] },
      { name: "Sundargarh", cities: ["Rourkela", "Sundargarh", "Rajgangpur", "Biramitrapur"], pincodes: ["769001", "769002", "769004", "769012", "770001"] },
      { name: "Ganjam", cities: ["Berhampur", "Chhatrapur", "Hinjilicut", "Bhanjanagar", "Aska"], pincodes: ["760001", "760002", "760005", "761020"] },
      { name: "Sambalpur", cities: ["Sambalpur", "Burla", "Hirakud", "Rairakhol"], pincodes: ["768001", "768002", "768020"] },
      { name: "Balasore", cities: ["Balasore", "Jaleswar", "Soro", "Nilagiri"], pincodes: ["756001", "756002", "756086"] },
      { name: "Bhadrak", cities: ["Bhadrak", "Dhamnagar", "Basudevpur"], pincodes: ["756100", "756101"] },
      { name: "Mayurbhanj", cities: ["Baripada", "Rairangpur", "Karanjia"], pincodes: ["757001", "757043"] },
      { name: "Jharsuguda", cities: ["Jharsuguda", "Brarajnagar", "Belpahar"], pincodes: ["768201", "768211"] },
      { name: "Anugul", cities: ["Angul", "Talcher", "Athmallik"], pincodes: ["759122", "759100"] },
      { name: "Dhenkanal", cities: ["Dhenkanal", "Bhuban", "Kamakhyanagar"], pincodes: ["759001", "759013"] },
      { name: "Koraput", cities: ["Koraput", "Jeypore", "Sunabeda"], pincodes: ["764001", "764002", "764020"] }
    ]
  },
  {
    name: "Karnataka",
    districts: [
      { name: "Bengaluru Urban", cities: ["Bengaluru", "Electronic City", "Whitefield", "Koramangala", "Yelahanka", "HSR Layout", "Indiranagar", "Jayanagar"], pincodes: ["560001", "560002", "560004", "560034", "560037", "560064", "560066", "560100"] },
      { name: "Bengaluru Rural", cities: ["Devanahalli", "Nelamangala", "Doddaballapura", "Hoskote"], pincodes: ["562110", "562123", "562114"] },
      { name: "Mysuru", cities: ["Mysuru", "Nanjangud", "Hunsur", "KR Nagara"], pincodes: ["570001", "570002", "570020"] },
      { name: "Dakshina Kannada", cities: ["Mangaluru", "Puttur", "Bantwal", "Belthangady"], pincodes: ["575001", "575002", "575003"] },
      { name: "Belagavi", cities: ["Belagavi", "Gokak", "Chikkodi", "Bailhongal"], pincodes: ["590001", "590002"] },
      { name: "Dharwad", cities: ["Hubballi", "Dharwad", "Kalghatgi"], pincodes: ["580001", "580020", "580009"] },
      { name: "Udupi", cities: ["Udupi", "Manipal", "Kundapura", "Karkala"], pincodes: ["576101", "576104", "576201"] },
      { name: "Tumakuru", cities: ["Tumakuru", "Sira", "Tiptur", "Gubbi"], pincodes: ["572101", "572102"] }
    ]
  },
  {
    name: "Maharashtra",
    districts: [
      { name: "Mumbai City", cities: ["Mumbai", "Colaba", "Dadar", "Fort", "Nariman Point"], pincodes: ["400001", "400005", "400014", "400020"] },
      { name: "Mumbai Suburban", cities: ["Andheri", "Bandra", "Borivali", "Juhu", "Goregaon", "Powai", "Kurla"], pincodes: ["400050", "400053", "400058", "400076", "400092"] },
      { name: "Thane", cities: ["Thane", "Navi Mumbai", "Kalyan", "Dombivli", "Mira-Bhayandar", "Bhiwandi"], pincodes: ["400601", "400614", "400703", "421301"] },
      { name: "Pune", cities: ["Pune", "Pimpri-Chinchwad", "Hinjawadi", "Hadapsar", "Kothrud", "Baramati"], pincodes: ["411001", "411002", "411014", "411028", "411057"] },
      { name: "Nagpur", cities: ["Nagpur", "Kamptee", "Hingna", "Umred"], pincodes: ["440001", "440002", "440010"] },
      { name: "Nashik", cities: ["Nashik", "Malegaon", "Sinnar", "Igatpuri"], pincodes: ["422001", "422002", "423203"] },
      { name: "Aurangabad (Chhatrapati Sambhajinagar)", cities: ["Aurangabad", "Paithan", "Gangapur"], pincodes: ["431001", "431005"] },
      { name: "Kolhapur", cities: ["Kolhapur", "Ichalkaranji", "Kagal"], pincodes: ["416001", "416003"] }
    ]
  },
  {
    name: "Delhi",
    districts: [
      { name: "Central Delhi", cities: ["Connaught Place", "Karol Bagh", "Paharganj", "Daryaganj"], pincodes: ["110001", "110002", "110005", "110055"] },
      { name: "New Delhi", cities: ["Chanakyapuri", "Vasant Vihar", "Lodhi Road", "Barakhamba"], pincodes: ["110003", "110011", "110021", "110057"] },
      { name: "South Delhi", cities: ["Saket", "Hauz Khas", "Greater Kailash", "Green Park", "Mehrauli"], pincodes: ["110016", "110017", "110030", "110048"] },
      { name: "South West Delhi", cities: ["Dwarka", "Vasant Kunj", "Janakpuri", "Najafgarh"], pincodes: ["110058", "110070", "110075", "110078"] },
      { name: "North Delhi", cities: ["Civil Lines", "Subzi Mandi", "Sadar Bazar", "Model Town"], pincodes: ["110006", "110007", "110009"] },
      { name: "East Delhi", cities: ["Preet Vihar", "Mayur Vihar", "Laxmi Nagar", "Shahdara"], pincodes: ["110091", "110092", "110095"] }
    ]
  },
  {
    name: "Tamil Nadu",
    districts: [
      { name: "Chennai", cities: ["Chennai", "Adyar", "Anna Nagar", "T. Nagar", "Velachery", "Mylapore", "Tambaram"], pincodes: ["600001", "600017", "600020", "600040", "600042"] },
      { name: "Coimbatore", cities: ["Coimbatore", "Pollachi", "Mettupalayam", "Sulur"], pincodes: ["641001", "641002", "641004", "641018"] },
      { name: "Madurai", cities: ["Madurai", "Melur", "Thirumangalam", "Vadipatti"], pincodes: ["625001", "625002", "625020"] },
      { name: "Tiruchirappalli", cities: ["Tiruchirappalli", "Srirangam", "Lalgudi", "Manapparai"], pincodes: ["620001", "620002", "620006"] },
      { name: "Salem", cities: ["Salem", "Attur", "Mettur", "Omalur"], pincodes: ["636001", "636004"] },
      { name: "Chengalpattu", cities: ["Kanchipuram", "Chengalpattu", "Maraimalai Nagar", "Mahabalipuram"], pincodes: ["603001", "603103", "631501"] }
    ]
  },
  {
    name: "Telangana",
    districts: [
      { name: "Hyderabad", cities: ["Hyderabad", "Banjara Hills", "Jubilee Hills", "Begumpet", "Secunderabad", "Gachibowli", "Madhapur", "Kukatpally"], pincodes: ["500001", "500003", "500032", "500033", "500034", "500072", "500081"] },
      { name: "Medchal-Malkajgiri", cities: ["Malkajgiri", "Kompally", "Uppal", "Alwal"], pincodes: ["500010", "500039", "500047", "500100"] },
      { name: "Rangareddy", cities: ["Shamshabad", "Manikonda", "LB Nagar", "Rajendranagar"], pincodes: ["500068", "500074", "500089", "501218"] },
      { name: "Warangal", cities: ["Warangal", "Hanamkonda", "Kazipet"], pincodes: ["506001", "506002", "506003"] }
    ]
  },
  {
    name: "West Bengal",
    districts: [
      { name: "Kolkata", cities: ["Kolkata", "Park Street", "Salt Lake", "Bhowanipore", "Alipore", "Dum Dum"], pincodes: ["700001", "700016", "700019", "700027", "700064", "700091"] },
      { name: "North 24 Parganas", cities: ["Rajarhat", "New Town", "Barasat", "Barrackpore", "Bidhannagar"], pincodes: ["700135", "700156", "700120"] },
      { name: "Howrah", cities: ["Howrah", "Bally", "Uluberia"], pincodes: ["711101", "711102", "711106"] },
      { name: "Darjeeling", cities: ["Darjeeling", "Siliguri", "Kurseong"], pincodes: ["734001", "734005", "734101"] }
    ]
  },
  {
    name: "Gujarat",
    districts: [
      { name: "Ahmedabad", cities: ["Ahmedabad", "Navrangpura", "Satellite", "SG Highway", "Maninagar", "Bhadra"], pincodes: ["380001", "380009", "380015", "380054"] },
      { name: "Surat", cities: ["Surat", "Adajan", "Varachha", "Udhna", "Vesu"], pincodes: ["395001", "395003", "395007", "395009"] },
      { name: "Vadodara", cities: ["Vadodara", "Alkapuri", "Fatehgunj", "Makarpura"], pincodes: ["390001", "390002", "390007"] },
      { name: "Rajkot", cities: ["Rajkot", "Morbi", "Jetpur"], pincodes: ["360001", "360002", "363641"] }
    ]
  },
  {
    name: "Uttar Pradesh",
    districts: [
      { name: "Gautam Buddha Nagar", cities: ["Noida", "Greater Noida", "Dadri"], pincodes: ["201301", "201303", "201306", "201308", "201310"] },
      { name: "Ghaziabad", cities: ["Ghaziabad", "Indirapuram", "Vaishali", "Vasundhara", "Loni"], pincodes: ["201001", "201010", "201012", "201014"] },
      { name: "Lucknow", cities: ["Lucknow", "Hazratganj", "Gomti Nagar", "Alambagh", "Indira Nagar"], pincodes: ["226001", "226010", "226016", "226024"] },
      { name: "Kanpur Nagar", cities: ["Kanpur", "Civil Lines", "Swaroop Nagar", "Kidwai Nagar"], pincodes: ["208001", "208002", "208011"] },
      { name: "Varanasi", cities: ["Varanasi", "Sarnath", "Lanka", "Sigra"], pincodes: ["221001", "221002", "221005"] },
      { name: "Agra", cities: ["Agra", "Tajganj", "Sanjay Place", "Shahganj"], pincodes: ["282001", "282002", "282005"] }
    ]
  },
  {
    name: "Haryana",
    districts: [
      { name: "Gurugram", cities: ["Gurugram", "DLF Phase 1", "Cyber City", "Sohna", "Manesar"], pincodes: ["122001", "122002", "122018", "122050", "122051"] },
      { name: "Faridabad", cities: ["Faridabad", "Ballabgarh", "NIT Faridabad"], pincodes: ["121001", "121002", "121004"] },
      { name: "Panchkula", cities: ["Panchkula", "Pinjore", "Kalka"], pincodes: ["134109", "134112", "134102"] },
      { name: "Ambala", cities: ["Ambala", "Ambala Cantt", "Barara"], pincodes: ["133001", "133004"] }
    ]
  },
  {
    name: "Punjab",
    districts: [
      { name: "SAS Nagar (Mohali)", cities: ["Mohali", "Kharar", "Zirakpur", "Dera Bassi"], pincodes: ["140301", "140308", "140603"] },
      { name: "Ludhiana", cities: ["Ludhiana", "Model Town", "Civil Lines", "Khanna"], pincodes: ["141001", "141002", "141401"] },
      { name: "Amritsar", cities: ["Amritsar", "Golden Temple Area", "Ranjit Avenue"], pincodes: ["143001", "143006"] },
      { name: "Jalandhar", cities: ["Jalandhar", "Model Town", "Cantt"], pincodes: ["144001", "144003"] }
    ]
  },
  {
    name: "Kerala",
    districts: [
      { name: "Thiruvananthapuram", cities: ["Thiruvananthapuram", "Technopark", "Neyyattinkara", "Varkala"], pincodes: ["695001", "695002", "695581"] },
      { name: "Ernakulam", cities: ["Kochi", "Kakkanad", "Aluva", "Fort Kochi", "Tripunithura"], pincodes: ["682001", "682016", "682030", "683101"] },
      { name: "Kozhikode", cities: ["Kozhikode", "Vadakara", "Koyilandy"], pincodes: ["673001", "673002", "673101"] }
    ]
  },
  {
    name: "Rajasthan",
    districts: [
      { name: "Jaipur", cities: ["Jaipur", "Malviya Nagar", "Vaishali Nagar", "C-Scheme", "Mansarovar", "Amer"], pincodes: ["302001", "302004", "302017", "302020"] },
      { name: "Jodhpur", cities: ["Jodhpur", "Ratanada", "Shastri Nagar", "Mandore"], pincodes: ["342001", "342003", "342011"] },
      { name: "Udaipur", cities: ["Udaipur", "Hiran Magri", "Panchwati"], pincodes: ["313001", "313002"] },
      { name: "Kota", cities: ["Kota", "Vigyan Nagar", "Dadabari"], pincodes: ["324001", "324005"] }
    ]
  },
  {
    name: "Andhra Pradesh",
    districts: [
      { name: "Visakhapatnam", cities: ["Visakhapatnam", "Gajuwaka", "MVP Colony", "Anakapalle"], pincodes: ["530001", "530017", "530026"] },
      { name: "NTR (Vijayawada)", cities: ["Vijayawada", "Benz Circle", "One Town", "Governorpet"], pincodes: ["520001", "520002", "520010"] },
      { name: "Tirupati", cities: ["Tirupati", "Srikalahasti", "Chandragiri"], pincodes: ["517501", "517502", "517644"] },
      { name: "Guntur", cities: ["Guntur", "Tenali", "Mangalagiri"], pincodes: ["522001", "522002", "522503"] }
    ]
  },
  {
    name: "Assam",
    districts: [
      { name: "Kamrup Metropolitan", cities: ["Guwahati", "Dispur", "GS Road", "Zoo Road", "Jalukbari"], pincodes: ["781001", "781005", "781006", "781014"] },
      { name: "Dibrugarh", cities: ["Dibrugarh", "Tinsukia", "Chabua"], pincodes: ["786001", "786003"] },
      { name: "Silchar (Cachar)", cities: ["Silchar", "Lakhipur"], pincodes: ["788001", "788002"] }
    ]
  },
  {
    name: "Bihar",
    districts: [
      { name: "Patna", cities: ["Patna", "Kankarbagh", "Boring Road", "Danapur", "Patna Sahib"], pincodes: ["800001", "800004", "800013", "800020"] },
      { name: "Gaya", cities: ["Gaya", "Bodh Gaya"], pincodes: ["823001", "824231"] },
      { name: "Muzaffarpur", cities: ["Muzaffarpur", "Kanti"], pincodes: ["842001", "842002"] }
    ]
  },
  {
    name: "Chhattisgarh",
    districts: [
      { name: "Raipur", cities: ["Raipur", "Naya Raipur", "Tatibandh"], pincodes: ["492001", "492002", "492015"] },
      { name: "Durg", cities: ["Bhilai", "Durg"], pincodes: ["490001", "490006", "491001"] },
      { name: "Bilaspur", cities: ["Bilaspur", "Kota"], pincodes: ["495001", "495004"] }
    ]
  },
  {
    name: "Goa",
    districts: [
      { name: "North Goa", cities: ["Panaji", "Mapusa", "Calangute", "Candolim", "Porvorim"], pincodes: ["403001", "403507", "403516"] },
      { name: "South Goa", cities: ["Margao", "Vasco da Gama", "Ponda", "Colva"], pincodes: ["403601", "403802", "403401"] }
    ]
  },
  {
    name: "Himachal Pradesh",
    districts: [
      { name: "Shimla", cities: ["Shimla", "Kufri", "Mashobra"], pincodes: ["171001", "171002", "171012"] },
      { name: "Kangra", cities: ["Dharamshala", "McLeod Ganj", "Palampur", "Kangra"], pincodes: ["176215", "176061", "176001"] },
      { name: "Kullu", cities: ["Manali", "Kullu", "Bhuntar"], pincodes: ["175131", "175101"] }
    ]
  },
  {
    name: "Jharkhand",
    districts: [
      { name: "Ranchi", cities: ["Ranchi", "DORANDA", "Kanke", "Hatia"], pincodes: ["834001", "834002", "834003"] },
      { name: "East Singhbhum", cities: ["Jamshedpur", "Bistupur", "Sakchi", "Tatanagar"], pincodes: ["831001", "831002", "831009"] },
      { name: "Dhanbad", cities: ["Dhanbad", "Jharia", "Katras"], pincodes: ["826001", "826004"] }
    ]
  },
  {
    name: "Madhya Pradesh",
    districts: [
      { name: "Indore", cities: ["Indore", "Vijay Nagar", "Palasia", "Rau"], pincodes: ["452001", "452010", "452012"] },
      { name: "Bhopal", cities: ["Bhopal", "MP Nagar", "Arera Colony", "Bairagarh"], pincodes: ["462001", "462011", "462030"] },
      { name: "Gwalior", cities: ["Gwalior", "Lashkar", "Morar"], pincodes: ["474001", "474006"] },
      { name: "Jabalpur", cities: ["Jabalpur", "Civil Lines", "Wright Town"], pincodes: ["482001", "482002"] }
    ]
  },
  {
    name: "Uttarakhand",
    districts: [
      { name: "Dehradun", cities: ["Dehradun", "Mussoorie", "Rishikesh", "Clement Town"], pincodes: ["248001", "248002", "248179", "249201"] },
      { name: "Haridwar", cities: ["Haridwar", "Roorkee"], pincodes: ["249401", "247667"] },
      { name: "Nainital", cities: ["Nainital", "Haldwani"], pincodes: ["263001", "263139"] }
    ]
  },
  {
    name: "Chandigarh",
    districts: [
      { name: "Chandigarh", cities: ["Chandigarh", "Sector 17", "Sector 35", "Manimajra"], pincodes: ["160017", "160022", "160035", "160101"] }
    ]
  },
  {
    name: "Jammu and Kashmir",
    districts: [
      { name: "Srinagar", cities: ["Srinagar", "Lal Chowk", "Karan Nagar"], pincodes: ["190001", "190010"] },
      { name: "Jammu", cities: ["Jammu", "Gandhi Nagar", "Trikuta Nagar"], pincodes: ["180001", "180004", "180012"] }
    ]
  },
  {
    name: "Puducherry",
    districts: [
      { name: "Puducherry", cities: ["Puducherry", "Auroville", "Karaikal"], pincodes: ["605001", "605008", "609602"] }
    ]
  }
];

// Helper Functions
export function getStates(): string[] {
  return INDIA_LOCATION_DATA.map(s => s.name).sort();
}

export function getDistricts(stateName: string): string[] {
  const state = INDIA_LOCATION_DATA.find(s => s.name.toLowerCase() === stateName.toLowerCase().trim());
  if (!state) return [];
  return state.districts.map(d => d.name).sort();
}

export function getCities(stateName: string, districtName?: string): string[] {
  const state = INDIA_LOCATION_DATA.find(s => s.name.toLowerCase() === stateName.toLowerCase().trim());
  if (!state) return [];

  if (districtName) {
    const dist = state.districts.find(d => d.name.toLowerCase() === districtName.toLowerCase().trim());
    return dist ? [...dist.cities].sort() : [];
  }

  const allCities = state.districts.flatMap(d => d.cities);
  return Array.from(new Set(allCities)).sort();
}

export function getPincodes(stateName: string, districtName?: string, cityName?: string): string[] {
  const state = INDIA_LOCATION_DATA.find(s => s.name.toLowerCase() === stateName.toLowerCase().trim());
  if (!state) return [];

  if (districtName) {
    const dist = state.districts.find(d => d.name.toLowerCase() === districtName.toLowerCase().trim());
    if (dist && dist.pincodes) return dist.pincodes;
  }

  const allPins = state.districts.flatMap(d => d.pincodes || []);
  return Array.from(new Set(allPins)).sort();
}

export function getPincodeDetails(pincode: string): PincodeLookupInfo | null {
  const cleanPin = pincode.trim().replace(/\D/g, '').slice(0, 6);
  if (cleanPin.length < 6) return null;

  for (const state of INDIA_LOCATION_DATA) {
    for (const dist of state.districts) {
      if (dist.pincodes && dist.pincodes.includes(cleanPin)) {
        return {
          pincode: cleanPin,
          district: dist.name,
          city: dist.cities[0] || dist.name,
          state: state.name
        };
      }
    }
  }

  return null;
}
