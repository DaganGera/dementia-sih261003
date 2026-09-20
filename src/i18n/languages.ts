export interface LanguageProfile {
  state: string;
  languageCode: string;
  languageName: string;
  nativeName: string;
  flag: string;
  speechCode: string; // BCP-47 language tag
  voiceSupported: boolean;
}

export const NER_STATES_LANGUAGES: Record<string, LanguageProfile> = {
  arunachal: {
    state: 'Arunachal Pradesh',
    languageCode: 'ny',
    languageName: 'Nyishi',
    nativeName: 'Nyishi',
    flag: '🏔️',
    speechCode: 'en-IN',
    voiceSupported: true,
  },
  assam: {
    state: 'Assam',
    languageCode: 'as',
    languageName: 'Assamese',
    nativeName: 'অসমীয়া',
    flag: '🌿',
    speechCode: 'as-IN',
    voiceSupported: true,
  },
  manipur: {
    state: 'Manipur',
    languageCode: 'mni',
    languageName: 'Meitei (Manipuri)',
    nativeName: 'মৈতৈলোন্',
    flag: '🌺',
    speechCode: 'mni-IN',
    voiceSupported: true,
  },
  meghalaya: {
    state: 'Meghalaya',
    languageCode: 'kha',
    languageName: 'Khasi',
    nativeName: 'Ka Ktien Khasi',
    flag: '🌳',
    speechCode: 'en-IN',
    voiceSupported: true,
  },
  mizoram: {
    state: 'Mizoram',
    languageCode: 'lus',
    languageName: 'Mizo',
    nativeName: 'Mizo ṭawng',
    flag: '🌴',
    speechCode: 'en-IN',
    voiceSupported: true,
  },
  nagaland: {
    state: 'Nagaland',
    languageCode: 'nag',
    languageName: 'Nagamese',
    nativeName: 'Nagamese',
    flag: '🌄',
    speechCode: 'en-IN',
    voiceSupported: true,
  },
  tripura: {
    state: 'Tripura',
    languageCode: 'bn',
    languageName: 'Bengali',
    nativeName: 'বাংলা',
    flag: '🌸',
    speechCode: 'bn-IN',
    voiceSupported: true,
  },
  sikkim: {
    state: 'Sikkim',
    languageCode: 'ne',
    languageName: 'Nepali',
    nativeName: 'नेपाली',
    flag: '🏔️',
    speechCode: 'ne-NP',
    voiceSupported: true,
  },
  default: {
    state: 'All India',
    languageCode: 'en',
    languageName: 'English',
    nativeName: 'English',
    flag: '🇮🇳',
    speechCode: 'en-IN',
    voiceSupported: true,
  },
};

export const SUPPORTED_LANGUAGES_LIST: LanguageProfile[] = [
  NER_STATES_LANGUAGES.default,
  NER_STATES_LANGUAGES.assam,
  NER_STATES_LANGUAGES.arunachal,
  NER_STATES_LANGUAGES.manipur,
  NER_STATES_LANGUAGES.meghalaya,
  NER_STATES_LANGUAGES.mizoram,
  NER_STATES_LANGUAGES.nagaland,
  NER_STATES_LANGUAGES.tripura,
  NER_STATES_LANGUAGES.sikkim,
];

export function getLanguageProfileByCode(code: string): LanguageProfile {
  return (
    SUPPORTED_LANGUAGES_LIST.find(l => l.languageCode === code) ||
    NER_STATES_LANGUAGES.default
  );
}

export function getLanguageProfileByState(stateName: string): LanguageProfile {
  const match = Object.values(NER_STATES_LANGUAGES).find(
    l => l.state.toLowerCase() === stateName.toLowerCase()
  );
  return match || NER_STATES_LANGUAGES.default;
}
