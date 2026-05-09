/**
 * Comprehensive Indian location data with State -> District -> City hierarchy
 * This allows for cascading dropdowns where selecting a state filters districts,
 * and selecting a district filters cities.
 */

export interface City {
  name: string;
  district: string;
  state: string;
}

export interface District {
  name: string;
  state: string;
  cities: string[];
}

export interface State {
  name: string;
  districts: string[];
}

// Indian States and Union Territories
export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

// State -> Districts mapping (Major states with comprehensive data)
export const STATE_DISTRICTS: Record<string, string[]> = {
  'Gujarat': [
    'Ahmedabad',
    'Amreli',
    'Anand',
    'Aravalli',
    'Banaskantha',
    'Bharuch',
    'Bhavnagar',
    'Botad',
    'Chhota Udaipur',
    'Dahod',
    'Dang',
    'Devbhoomi Dwarka',
    'Gandhinagar',
    'Gir Somnath',
    'Jamnagar',
    'Junagadh',
    'Kheda',
    'Kutch',
    'Mahisagar',
    'Mehsana',
    'Morbi',
    'Narmada',
    'Navsari',
    'Panchmahal',
    'Patan',
    'Porbandar',
    'Rajkot',
    'Sabarkantha',
    'Surat',
    'Surendranagar',
    'Tapi',
    'Vadodara',
    'Valsad',
  ],
  'Maharashtra': [
    'Ahmednagar',
    'Akola',
    'Amravati',
    'Aurangabad',
    'Beed',
    'Bhandara',
    'Buldhana',
    'Chandrapur',
    'Dhule',
    'Gadchiroli',
    'Gondia',
    'Hingoli',
    'Jalgaon',
    'Jalna',
    'Kolhapur',
    'Latur',
    'Mumbai City',
    'Mumbai Suburban',
    'Nagpur',
    'Nanded',
    'Nandurbar',
    'Nashik',
    'Osmanabad',
    'Palghar',
    'Parbhani',
    'Pune',
    'Raigad',
    'Ratnagiri',
    'Sangli',
    'Satara',
    'Sindhudurg',
    'Solapur',
    'Thane',
    'Wardha',
    'Washim',
    'Yavatmal',
  ],
  'Karnataka': [
    'Bagalkot',
    'Ballari',
    'Belagavi',
    'Bengaluru Rural',
    'Bengaluru Urban',
    'Bidar',
    'Chamarajanagar',
    'Chikkaballapur',
    'Chikkamagaluru',
    'Chitradurga',
    'Dakshina Kannada',
    'Davanagere',
    'Dharwad',
    'Gadag',
    'Hassan',
    'Haveri',
    'Kalaburagi',
    'Kodagu',
    'Kolar',
    'Koppal',
    'Mandya',
    'Mysuru',
    'Raichur',
    'Ramanagara',
    'Shivamogga',
    'Tumakuru',
    'Udupi',
    'Uttara Kannada',
    'Vijayapura',
    'Yadgir',
  ],
  'Tamil Nadu': [
    'Ariyalur',
    'Chengalpattu',
    'Chennai',
    'Coimbatore',
    'Cuddalore',
    'Dharmapuri',
    'Dindigul',
    'Erode',
    'Kallakurichi',
    'Kanchipuram',
    'Kanyakumari',
    'Karur',
    'Krishnagiri',
    'Madurai',
    'Mayiladuthurai',
    'Nagapattinam',
    'Namakkal',
    'Nilgiris',
    'Perambalur',
    'Pudukkottai',
    'Ramanathapuram',
    'Ranipet',
    'Salem',
    'Sivaganga',
    'Tenkasi',
    'Thanjavur',
    'Theni',
    'Thoothukudi',
    'Tiruchirappalli',
    'Tirunelveli',
    'Tirupathur',
    'Tiruppur',
    'Tiruvallur',
    'Tiruvannamalai',
    'Tiruvarur',
    'Vellore',
    'Viluppuram',
    'Virudhunagar',
  ],
  'Rajasthan': [
    'Ajmer',
    'Alwar',
    'Banswara',
    'Baran',
    'Barmer',
    'Bharatpur',
    'Bhilwara',
    'Bikaner',
    'Bundi',
    'Chittorgarh',
    'Churu',
    'Dausa',
    'Dholpur',
    'Dungarpur',
    'Hanumangarh',
    'Jaipur',
    'Jaisalmer',
    'Jalore',
    'Jhalawar',
    'Jhunjhunu',
    'Jodhpur',
    'Karauli',
    'Kota',
    'Nagaur',
    'Pali',
    'Pratapgarh',
    'Rajsamand',
    'Sawai Madhopur',
    'Sikar',
    'Sirohi',
    'Sri Ganganagar',
    'Tonk',
    'Udaipur',
  ],
  'Uttar Pradesh': [
    'Agra',
    'Aligarh',
    'Ambedkar Nagar',
    'Amethi',
    'Amroha',
    'Auraiya',
    'Ayodhya',
    'Azamgarh',
    'Baghpat',
    'Bahraich',
    'Ballia',
    'Balrampur',
    'Banda',
    'Barabanki',
    'Bareilly',
    'Basti',
    'Bhadohi',
    'Bijnor',
    'Budaun',
    'Bulandshahr',
    'Chandauli',
    'Chitrakoot',
    'Deoria',
    'Etah',
    'Etawah',
    'Farrukhabad',
    'Fatehpur',
    'Firozabad',
    'Gautam Buddha Nagar',
    'Ghaziabad',
    'Ghazipur',
    'Gonda',
    'Gorakhpur',
    'Hamirpur',
    'Hapur',
    'Hardoi',
    'Hathras',
    'Jalaun',
    'Jaunpur',
    'Jhansi',
    'Kannauj',
    'Kanpur Dehat',
    'Kanpur Nagar',
    'Kasganj',
    'Kaushambi',
    'Kheri',
    'Kushinagar',
    'Lalitpur',
    'Lucknow',
    'Maharajganj',
    'Mahoba',
    'Mainpuri',
    'Mathura',
    'Mau',
    'Meerut',
    'Mirzapur',
    'Moradabad',
    'Muzaffarnagar',
    'Pilibhit',
    'Pratapgarh',
    'Prayagraj',
    'Raebareli',
    'Rampur',
    'Saharanpur',
    'Sambhal',
    'Sant Kabir Nagar',
    'Shahjahanpur',
    'Shamli',
    'Shravasti',
    'Siddharthnagar',
    'Sitapur',
    'Sonbhadra',
    'Sultanpur',
    'Unnao',
    'Varanasi',
  ],
  'Delhi': [
    'Central Delhi',
    'East Delhi',
    'New Delhi',
    'North Delhi',
    'North East Delhi',
    'North West Delhi',
    'Shahdara',
    'South Delhi',
    'South East Delhi',
    'South West Delhi',
    'West Delhi',
  ],
  'Telangana': [
    'Adilabad',
    'Bhadradri Kothagudem',
    'Hyderabad',
    'Jagtial',
    'Jangaon',
    'Jayashankar',
    'Jogulamba',
    'Kamareddy',
    'Karimnagar',
    'Khammam',
    'Kumuram Bheem',
    'Mahabubabad',
    'Mahbubnagar',
    'Mancherial',
    'Medak',
    'Medchal',
    'Mulugu',
    'Nagarkurnool',
    'Nalgonda',
    'Narayanpet',
    'Nirmal',
    'Nizamabad',
    'Peddapalli',
    'Rajanna Sircilla',
    'Ranga Reddy',
    'Sangareddy',
    'Siddipet',
    'Suryapet',
    'Vikarabad',
    'Wanaparthy',
    'Warangal Rural',
    'Warangal Urban',
    'Yadadri Bhuvanagiri',
  ],
};

// District -> Cities mapping (Major cities for key districts)
export const DISTRICT_CITIES: Record<string, string[]> = {
  // Gujarat
  'Ahmedabad': ['Ahmedabad', 'Daskroi', 'Sanand', 'Dholka', 'Viramgam'],
  'Gandhinagar': ['Gandhinagar', 'Mansa', 'Kalol'],
  'Surat': ['Surat', 'Bardoli', 'Olpad', 'Mandvi', 'Kamrej'],
  'Vadodara': ['Vadodara', 'Dabhoi', 'Karjan', 'Padra', 'Savli'],
  'Rajkot': ['Rajkot', 'Gondal', 'Jetpur', 'Morbi', 'Upleta'],
  'Bhavnagar': ['Bhavnagar', 'Mahuva', 'Palitana', 'Sihor', 'Talaja'],
  'Jamnagar': ['Jamnagar', 'Dwarka', 'Okha', 'Jodiya'],
  'Junagadh': ['Junagadh', 'Keshod', 'Mangrol', 'Veraval'],
  'Amreli': ['Amreli', 'Babra', 'Dhari', 'Jafrabad'],
  'Anand': ['Anand', 'Khambhat', 'Petlad', 'Borsad'],

  // Maharashtra
  'Mumbai City': ['Mumbai', 'South Mumbai', 'Fort'],
  'Mumbai Suburban': ['Bandra', 'Andheri', 'Borivali', 'Goregaon', 'Mulund'],
  'Pune': ['Pune', 'Pimpri-Chinchwad', 'Khadki', 'Lonavala'],
  'Nagpur': ['Nagpur', 'Kamptee', 'Katol', 'Ramtek'],
  'Thane': ['Thane', 'Kalyan', 'Dombivli', 'Bhiwandi', 'Ulhasnagar'],
  'Nashik': ['Nashik', 'Malegaon', 'Sinnar', 'Igatpuri'],
  'Aurangabad': ['Aurangabad', 'Gangapur', 'Khuldabad', 'Paithan'],
  'Solapur': ['Solapur', 'Pandharpur', 'Barshi', 'Akkalkot'],

  // Karnataka
  'Bengaluru Urban': ['Bangalore', 'Bengaluru', 'Anekal', 'Byatarayanapura'],
  'Mysuru': ['Mysuru', 'Mysore', 'Nanjangud', 'Hunsur', 'Chamarajanagar'],
  'Mangaluru': ['Mangaluru', 'Mangalore', 'Bantwal', 'Puttur'],
  'Belagavi': ['Belagavi', 'Belgaum', 'Bailhongal', 'Gokak'],

  // Tamil Nadu
  'Chennai': ['Chennai', 'Ambattur', 'Avadi', 'Tambaram'],
  'Coimbatore': ['Coimbatore', 'Pollachi', 'Mettupalayam', 'Valparai'],
  'Madurai': ['Madurai', 'Melur', 'Usilampatti', 'Vadipatti'],
  'Tiruchirappalli': ['Tiruchirappalli', 'Trichy', 'Srirangam', 'Lalgudi'],
  'Salem': ['Salem', 'Attur', 'Mettur', 'Edappadi'],

  // Rajasthan
  'Jaipur': ['Jaipur', 'Amber', 'Chaksu', 'Jamwa Ramgarh'],
  'Jodhpur': ['Jodhpur', 'Bilara', 'Osian', 'Phalodi'],
  'Udaipur': ['Udaipur', 'Mavli', 'Kherwara', 'Gogunda'],
  'Ajmer': ['Ajmer', 'Pushkar', 'Kekri', 'Beawar'],

  // Delhi
  'Central Delhi': ['Connaught Place', 'Karol Bagh', 'Paharganj'],
  'South Delhi': ['Hauz Khas', 'Saket', 'Greater Kailash', 'Defence Colony'],
  'New Delhi': ['Chanakyapuri', 'Diplomatic Enclave', 'Barakhamba Road'],

  // Telangana
  'Hyderabad': ['Hyderabad', 'Secunderabad', 'Kukatpally', 'LB Nagar'],
  'Ranga Reddy': ['Shamshabad', 'Chevella', 'Vikarabad', 'Maheshwaram'],
};

/**
 * Get districts for a given state
 */
export function getDistrictsByState(state: string): string[] {
  return STATE_DISTRICTS[state] || [];
}

/**
 * Get cities for a given district
 */
export function getCitiesByDistrict(district: string): string[] {
  return DISTRICT_CITIES[district] || [];
}

/**
 * Get cities for a given state (all cities across all districts)
 */
export function getCitiesByState(state: string): string[] {
  const districts = getDistrictsByState(state);
  const cities = new Set<string>();

  districts.forEach(district => {
    const districtCities = getCitiesByDistrict(district);
    districtCities.forEach(city => cities.add(city));
  });

  return Array.from(cities).sort();
}

/**
 * Get all unique cities from all states
 */
export function getAllCities(): string[] {
  const cities = new Set<string>();

  Object.values(DISTRICT_CITIES).forEach(districtCities => {
    districtCities.forEach(city => cities.add(city));
  });

  return Array.from(cities).sort();
}
