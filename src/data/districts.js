// Nepal's 77 districts by province, in English and Nepali, for the
// professional's application (permanent district, district that issued
// their ID). The three valley districts come first because most of our
// professionals are from or work in the valley.

const PROVINCES = [
  ['Koshi', 'कोशी', [
    ['Taplejung', 'ताप्लेजुङ'], ['Panchthar', 'पाँचथर'], ['Ilam', 'इलाम'], ['Jhapa', 'झापा'],
    ['Morang', 'मोरङ'], ['Sunsari', 'सुनसरी'], ['Dhankuta', 'धनकुटा'], ['Terhathum', 'तेह्रथुम'],
    ['Sankhuwasabha', 'संखुवासभा'], ['Bhojpur', 'भोजपुर'], ['Solukhumbu', 'सोलुखुम्बु'],
    ['Okhaldhunga', 'ओखलढुंगा'], ['Khotang', 'खोटाङ'], ['Udayapur', 'उदयपुर'],
  ]],
  ['Madhesh', 'मधेश', [
    ['Saptari', 'सप्तरी'], ['Siraha', 'सिराहा'], ['Dhanusha', 'धनुषा'], ['Mahottari', 'महोत्तरी'],
    ['Sarlahi', 'सर्लाही'], ['Rautahat', 'रौतहट'], ['Bara', 'बारा'], ['Parsa', 'पर्सा'],
  ]],
  ['Bagmati', 'बागमती', [
    ['Kathmandu', 'काठमाडौं'], ['Lalitpur', 'ललितपुर'], ['Bhaktapur', 'भक्तपुर'],
    ['Dolakha', 'दोलखा'], ['Sindhupalchok', 'सिन्धुपाल्चोक'], ['Rasuwa', 'रसुवा'], ['Dhading', 'धादिङ'],
    ['Nuwakot', 'नुवाकोट'], ['Kavrepalanchok', 'काभ्रेपलाञ्चोक'], ['Ramechhap', 'रामेछाप'],
    ['Sindhuli', 'सिन्धुली'], ['Makwanpur', 'मकवानपुर'], ['Chitwan', 'चितवन'],
  ]],
  ['Gandaki', 'गण्डकी', [
    ['Gorkha', 'गोरखा'], ['Manang', 'मनाङ'], ['Mustang', 'मुस्ताङ'], ['Myagdi', 'म्याग्दी'],
    ['Kaski', 'कास्की'], ['Lamjung', 'लमजुङ'], ['Tanahun', 'तनहुँ'], ['Nawalpur', 'नवलपुर'],
    ['Syangja', 'स्याङ्जा'], ['Parbat', 'पर्वत'], ['Baglung', 'बागलुङ'],
  ]],
  ['Lumbini', 'लुम्बिनी', [
    ['Rukum East', 'रुकुम (पूर्व)'], ['Rolpa', 'रोल्पा'], ['Pyuthan', 'प्युठान'], ['Gulmi', 'गुल्मी'],
    ['Arghakhanchi', 'अर्घाखाँची'], ['Palpa', 'पाल्पा'], ['Parasi', 'परासी'], ['Rupandehi', 'रुपन्देही'],
    ['Kapilvastu', 'कपिलवस्तु'], ['Dang', 'दाङ'], ['Banke', 'बाँके'], ['Bardiya', 'बर्दिया'],
  ]],
  ['Karnali', 'कर्णाली', [
    ['Dolpa', 'डोल्पा'], ['Mugu', 'मुगु'], ['Humla', 'हुम्ला'], ['Jumla', 'जुम्ला'], ['Kalikot', 'कालिकोट'],
    ['Dailekh', 'दैलेख'], ['Jajarkot', 'जाजरकोट'], ['Rukum West', 'रुकुम (पश्चिम)'], ['Salyan', 'सल्यान'],
    ['Surkhet', 'सुर्खेत'],
  ]],
  ['Sudurpashchim', 'सुदूरपश्चिम', [
    ['Bajura', 'बाजुरा'], ['Bajhang', 'बझाङ'], ['Darchula', 'दार्चुला'], ['Baitadi', 'बैतडी'],
    ['Dadeldhura', 'डडेल्धुरा'], ['Doti', 'डोटी'], ['Achham', 'अछाम'], ['Kailali', 'कैलाली'],
    ['Kanchanpur', 'कञ्चनपुर'],
  ]],
];

// Other spellings and the main towns, so searching "Pokhara" finds Kaski.
const ALIASES = {
  Kavrepalanchok: 'kabhre kavre dhulikhel banepa',
  Sindhupalchok: 'sindhupalchowk chautara',
  Makwanpur: 'makawanpur hetauda',
  Dhanusha: 'dhanusa janakpur',
  Kaski: 'pokhara',
  Rupandehi: 'butwal bhairahawa siddharthanagar',
  Chitwan: 'bharatpur narayangarh',
  Morang: 'biratnagar',
  Sunsari: 'dharan itahari inaruwa',
  Jhapa: 'birtamod damak bhadrapur',
  Parsa: 'birgunj',
  Banke: 'nepalgunj',
  Kailali: 'dhangadhi',
  Kanchanpur: 'mahendranagar',
  Surkhet: 'birendranagar',
  Dang: 'ghorahi tulsipur',
  Lalitpur: 'patan',
  Tanahun: 'tanahu damauli',
  Kapilvastu: 'kapilbastu',
  Bardiya: 'bardia',
  Ilam: 'illam',
  Nawalpur: 'nawalparasi kawasoti',
  Parasi: 'nawalparasi',
  'Rukum East': 'rukum',
  'Rukum West': 'rukum',
  Solukhumbu: 'solu salleri',
  Udayapur: 'gaighat triyuga',
};

export const PROVINCE_DISTRICTS = PROVINCES.map(([name, nameNe, list]) => ({
  name,
  nameNe,
  districts: list.map(([districtName, districtNe]) => ({
    name: districtName,
    nameNe: districtNe,
    aliases: ALIASES[districtName],
  })),
}));

export const DISTRICTS = PROVINCE_DISTRICTS.flatMap((province) => province.districts);

export const districtLabel = (name, lang) => {
  const district = DISTRICTS.find((item) => item.name === name);
  if (!district) return name ?? '';
  return lang === 'ne' ? district.nameNe : district.name;
};
