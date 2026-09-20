// Centralized Voice Navigation Engine for MindCare AI
// Offline-first, multilingual intent matching, safe route resolution, & localized responses

export type NavigationIntent =
  | 'GO_HOME'
  | 'OPEN_GAMES'
  | 'OPEN_MEMORY_GAME'
  | 'OPEN_SEQUENCE_GAME'
  | 'OPEN_FACE_NAME_GAME'
  | 'OPEN_OBJECT_GAME'
  | 'OPEN_NUMBER_MEMORY_GAME'
  | 'OPEN_STORY_GAME'
  | 'OPEN_WORD_GAME'
  | 'OPEN_FAMILIAR_PLACES_GAME'
  | 'OPEN_FAMILIAR_SOUNDS_GAME'
  | 'OPEN_MEMORY_ASSISTANT'
  | 'OPEN_PROGRESS'
  | 'OPEN_ROUTINE'
  | 'OPEN_HELP'
  | 'OPEN_SETTINGS'
  | 'TRIGGER_SOS'
  | 'AMBIGUOUS_GAME_PROMPT'
  | 'UNKNOWN';

export interface RouteTarget {
  tab: string;
  gameId?: string;
}

// 1. Safe Predefined Application Route Targets (Prevents arbitrary URL injection)
export const NAVIGATION_ROUTES: Record<Exclude<NavigationIntent, 'UNKNOWN' | 'AMBIGUOUS_GAME_PROMPT'>, RouteTarget> = {
  GO_HOME: { tab: 'home' },
  OPEN_GAMES: { tab: 'games' },
  OPEN_MEMORY_GAME: { tab: 'games', gameId: 'memory-match' },
  OPEN_SEQUENCE_GAME: { tab: 'games', gameId: 'sequence-recall' },
  OPEN_FACE_NAME_GAME: { tab: 'games', gameId: 'name-face' },
  OPEN_OBJECT_GAME: { tab: 'games', gameId: 'object-recall' },
  OPEN_NUMBER_MEMORY_GAME: { tab: 'games', gameId: 'number-memory' },
  OPEN_STORY_GAME: { tab: 'games', gameId: 'story-recall' },
  OPEN_WORD_GAME: { tab: 'games', gameId: 'voice-recall' },
  OPEN_FAMILIAR_PLACES_GAME: { tab: 'games', gameId: 'familiar-places' },
  OPEN_FAMILIAR_SOUNDS_GAME: { tab: 'games', gameId: 'familiar-sounds' },
  OPEN_MEMORY_ASSISTANT: { tab: 'assistant' },
  OPEN_PROGRESS: { tab: 'history' },
  OPEN_ROUTINE: { tab: 'reminders' },
  OPEN_HELP: { tab: 'assistant' },
  OPEN_SETTINGS: { tab: 'settings' },
  TRIGGER_SOS: { tab: 'home' },
};

// 2. Multilingual Browser BCP-47 Speech Recognition Locales
export const SPEECH_LOCALES: Record<string, string> = {
  en: 'en-IN',
  as: 'as-IN',
  bn: 'bn-IN',
  ne: 'ne-NP',
  hi: 'hi-IN',
  mni: 'mni-IN',
  kha: 'en-IN',
  lus: 'en-IN',
  nag: 'en-IN',
  ny: 'en-IN',
};

// 3. Centralized Multilingual Command Patterns
const VOICE_COMMANDS: Record<string, Record<Exclude<NavigationIntent, 'UNKNOWN' | 'AMBIGUOUS_GAME_PROMPT'>, string[]>> = {
  en: {
    GO_HOME: ['go home', 'open home', 'take me home', 'dashboard', 'home page', 'back to home', 'main page'],
    OPEN_GAMES: ['open games', 'show games', 'go to games', 'take me to games', 'games center', 'all games'],
    OPEN_MEMORY_GAME: ['open memory game', 'go to memory game', 'take me to memory game', 'play memory game', 'i want to play memory game', 'can i play memory game', 'show memory game', 'card game', 'memory match'],
    OPEN_SEQUENCE_GAME: ['open sequence game', 'remember sequence', 'sequence game', 'sequence recall', 'pattern game', 'color sequence'],
    OPEN_FACE_NAME_GAME: ['who is this', 'face name game', 'family photo game', 'family game', 'name face game', 'people game', 'recognize family'],
    OPEN_OBJECT_GAME: ['object game', 'object recall', 'photo recall', 'remember objects', 'picture game'],
    OPEN_NUMBER_MEMORY_GAME: ['number memory', 'number game', 'digit game', 'remember numbers'],
    OPEN_STORY_GAME: ['story game', 'story recall', 'read story', 'listen to story'],
    OPEN_WORD_GAME: ['word game', 'voice recall', 'word recall', 'speak words'],
    OPEN_FAMILIAR_PLACES_GAME: ['familiar places', 'places game', 'location game', 'my home places'],
    OPEN_FAMILIAR_SOUNDS_GAME: ['familiar sounds', 'sounds game', 'music game', 'audio game'],
    OPEN_MEMORY_ASSISTANT: ['open memories', 'open memory assistant', 'show my memories', 'talk to ai', 'talk to assistant', 'memory assistant', 'ask assistant'],
    OPEN_PROGRESS: ['open progress', 'show my progress', 'show progress', 'how am i doing', 'analytics', 'history', 'my score', 'activity history'],
    OPEN_ROUTINE: ['open routine', 'show today\'s routine', 'what do i have today', 'show my routine', 'reminders', 'schedule', 'today schedule'],
    OPEN_HELP: ['open help', 'i need help', 'show help', 'emergency help', 'sos help'],
    OPEN_SETTINGS: ['open settings', 'show settings', 'preferences', 'configuration'],
    TRIGGER_SOS: ['send sos', 'send sos signal', 'sos', 'trigger sos', 'emergency', 'send emergency alert', 'emergency signal', 'call emergency', 'sos signal', 'send help', 'i need urgent help', 'help me emergency'],
  },

  as: {
    GO_HOME: ['ঘৰলৈ যাওক', 'মুখ্য পৃষ্ঠা', 'হোম', 'ঘৰ', 'ডেশ্ববৰ্ড'],
    OPEN_GAMES: ['সকলো খেল', 'খেলসমূহ খোলক', 'মই খেল খেলিব বিচাৰোঁ', 'খেল খোলক', 'খেলৰ কেন্দ্ৰ'],
    OPEN_MEMORY_GAME: ['মেম\'ৰী খেল', 'স্মৃতি খেল', 'মেম\'ৰী খেল খোলক', 'মেমৰী গেম', 'কাৰ্ড খেল', 'যোৰ মিলাওক'],
    OPEN_SEQUENCE_GAME: ['ক্ৰম খেল', 'ৰং খেল', 'চিকুৱেন্স খেল', 'ক্ৰম মনত ৰাখক'],
    OPEN_FACE_NAME_GAME: ['ইয়াতে কোন আছে', 'অনিতা কোন', 'পৰিয়ালৰ ছবি', 'মুখ খেল', 'চিনাকি মানুহ'],
    OPEN_OBJECT_GAME: ['বস্তু খেল', 'ছবি খেল', 'বস্তু মনত ৰাখক'],
    OPEN_NUMBER_MEMORY_GAME: ['সংখ্যা খেল', 'নম্বৰ খেল', 'সংখ্যা মনত ৰাখক'],
    OPEN_STORY_GAME: ['সাধুকথা খেল', 'গল্প খেল', 'সাধু খেল'],
    OPEN_WORD_GAME: ['শব্দ খেল', 'ভইচ খেল', 'শব্দ মনত ৰাখক'],
    OPEN_FAMILIAR_PLACES_GAME: ['চিনাকি ঠাই খেল', 'ঘৰৰ ঠাই', 'ঠাই খেল'],
    OPEN_FAMILIAR_SOUNDS_GAME: ['শব্দ খেল', 'সংগীত খেল', 'শব্দ শুনা খেল'],
    OPEN_MEMORY_ASSISTANT: ['স্মৃতি সহায়কলৈ যাওক', 'স্মৃতি সহায়কেৰে কথা পাতক', 'স্মৃতি সহায় কৰক'],
    OPEN_PROGRESS: ['মোৰ উন্নতি চাওক', 'মোৰ নম্বৰ', 'ইতিহাস', 'কাৰ্যকলাপৰ ইতিহাস'],
    OPEN_ROUTINE: ['আজিৰ ৰুটিন', 'সোঁৱৰণী চাওক', 'মোৰ ৰুটিন', 'দৈনিক সূচী'],
    OPEN_HELP: ['মোক সহায় লাগে', 'সহায়', 'জৰুৰী সহায়'],
    OPEN_SETTINGS: ['ছেটিংছ', 'পছন্দসমূহ'],
    TRIGGER_SOS: ['এছঅ\'এছ পঠিয়াওক', 'জৰুৰী সংকেত', 'জৰুৰী সংকেত পঠিয়াওক', 'বিপদৰ সংকেত', 'এছ অ এছ', 'জৰুৰী বিপদ', 'এছঅ\'এছ'],
  },

  bn: {
    GO_HOME: ['হোম পেজ', 'বাড়ি যান', 'ড্যাশবোর্ড', 'হোম'],
    OPEN_GAMES: ['সব গেম', 'গেম খুলুন', 'আমি গেম খেলতে চাই', 'খেলার কেন্দ্র'],
    OPEN_MEMORY_GAME: ['মেমরি গেম', 'স্মৃতি গেম', 'মেমরি গেম খুলুন', 'কার্ড গেম', 'জোড়া মেলান'],
    OPEN_SEQUENCE_GAME: ['ক্রম গেম', 'রং গেম', 'সিকোয়েন্স গেম'],
    OPEN_FACE_NAME_GAME: ['ইনি কে', 'পরিবারের ছবি', 'মুখের গেম'],
    OPEN_OBJECT_GAME: ['জিনিস গেম', 'ছবি গেম'],
    OPEN_NUMBER_MEMORY_GAME: ['সংখ্যা গেম', 'নম্বর গেম'],
    OPEN_STORY_GAME: ['গল্পের গেম', 'গল্প শুনুন'],
    OPEN_WORD_GAME: ['শব্দ গেম', 'ভয়েস গেম'],
    OPEN_FAMILIAR_PLACES_GAME: ['পরিচিত জায়গা', 'ঘরের জায়গা'],
    OPEN_FAMILIAR_SOUNDS_GAME: ['শব্দ গেম', 'সঙ্গীত গেম'],
    OPEN_MEMORY_ASSISTANT: ['মেমরি অ্যাসিস্ট্যান্ট', 'কথা বলুন', 'স্মৃতি সহকারী'],
    OPEN_PROGRESS: ['আমার অগ্রগতি দেখুন', 'ইতিহাস', 'আমার স্কোর'],
    OPEN_ROUTINE: ['আজকের রুটিন', 'অনুস্মারক', 'রুটিন দেখুন'],
    OPEN_HELP: ['আমার সাহায্য দরকার', 'সাহায্য'],
    OPEN_SETTINGS: ['সেটিংস'],
    TRIGGER_SOS: ['এসওএস পাঠান', 'জরুরি সংকেত', 'জরুরি সংকেত পাঠান', 'এস ও এস', 'বিপদ সংকেত', 'জরুরি সাহায্য পাঠান', 'এসওএস'],
  },

  hi: {
    GO_HOME: ['होम जाओ', 'मुख्य पृष्ठ', 'डैशबोर्ड', 'घर चलो'],
    OPEN_GAMES: ['सारे खेल खोलो', 'गेम्स सेंटर', 'मुझे खेल खेलना है', 'खेल दिखाओ'],
    OPEN_MEMORY_GAME: ['मेमोरी गेम खोलो', 'यादाश्त गेम', 'कार्ड गेम', 'मेमोरी मैच', 'जोड़ी मिलाओ'],
    OPEN_SEQUENCE_GAME: ['अनुक्रम गेम', 'रंगों का क्रम', 'सीक्वेंस गेम'],
    OPEN_FACE_NAME_GAME: ['यह कौन है', 'परिवार का फोटो', 'चेहरा पहचानो'],
    OPEN_OBJECT_GAME: ['वस्तु गेम', 'चीजें याद रखो'],
    OPEN_NUMBER_MEMORY_GAME: ['संख्या गेम', 'नंबर याद रखो'],
    OPEN_STORY_GAME: ['कहानी गेम', 'कहानी सुनो'],
    OPEN_WORD_GAME: ['शब्द गेम', 'आवाज गेम'],
    OPEN_FAMILIAR_PLACES_GAME: ['जाने-पहचाने स्थान', 'घर की जगह'],
    OPEN_FAMILIAR_SOUNDS_GAME: ['आवाज गेम', 'संगीत गेम'],
    OPEN_MEMORY_ASSISTANT: ['मेमोरी असिस्टेंट', 'बात करो', 'स्मृति सहायक'],
    OPEN_PROGRESS: ['मेरी प्रगति दिखाओ', 'स्कोर दिखाओ', 'इतिहास'],
    OPEN_ROUTINE: ['मेरी दिनचर्या दिखाओ', 'आज का रूटीन', 'याद दिलाओ'],
    OPEN_HELP: ['मुझे मदद चाहिए', 'सहायता'],
    OPEN_SETTINGS: ['सेटिंग्स'],
    TRIGGER_SOS: ['एसओएस भेजो', 'आपातकालीन संकेत भेजो', 'आपातकालीन संकेत', 'इमरजेंसी भेजो', 'एस ओ एस', 'मदद भेजो आपातकाल', 'एसओएस'],
  },

  ne: {
    GO_HOME: ['गृह पृष्ठ', 'घर जानुहोस्', 'ड्यासबोर्ड'],
    OPEN_GAMES: ['सबै खेलहरू', 'खेल खोल्नुहोस्', 'खेल खेल्न चाहन्छु'],
    OPEN_MEMORY_GAME: ['मेमोरी खेल खोल्नुहोस्', 'सम्झना खेल', 'कार्ड खेल'],
    OPEN_SEQUENCE_GAME: ['क्रम खेल', 'रङ खेल'],
    OPEN_FACE_NAME_GAME: ['यो को हो', 'परिवारको फोटो'],
    OPEN_OBJECT_GAME: ['सामान खेल'],
    OPEN_NUMBER_MEMORY_GAME: ['अङ्क खेल', 'नम्बर सम्झनुहोस्'],
    OPEN_STORY_GAME: ['कथा खेल'],
    OPEN_WORD_GAME: ['शब्द खेल'],
    OPEN_FAMILIAR_PLACES_GAME: ['चिनिएका ठाउँहरू'],
    OPEN_FAMILIAR_SOUNDS_GAME: ['आवाज खेल'],
    OPEN_MEMORY_ASSISTANT: ['स्मृति सहायक', 'कुरा गर्नुहोस्'],
    OPEN_PROGRESS: ['मेरो प्रगति', 'इतिहास'],
    OPEN_ROUTINE: ['आजको दिनचर्या', 'सम्झनाहरू'],
    OPEN_HELP: ['मलाई मद्दत चाहिन्छ'],
    OPEN_SETTINGS: ['सेटिङहरू'],
    TRIGGER_SOS: ['एसओएस पठाउनुहोस्', 'आपतकालीन संकेत', 'आपतकालीन मद्दत', 'एस ओ एस', 'एसओएस'],
  },

  mni: {
    GO_HOME: ['যুমদা চৎউ', 'ড্যাশবোর্ড'],
    OPEN_GAMES: ['শান্নপোৎ হাংদোকউ', 'শান্নপোৎ শান্নগে'],
    OPEN_MEMORY_GAME: ['মেমোরি গেম হাংদোকউ', 'ৱাখল শান্নপোৎ'],
    OPEN_SEQUENCE_GAME: ['পরিংশান্নপোৎ'],
    OPEN_FACE_NAME_GAME: ['কনাগীনো ইমুং'],
    OPEN_OBJECT_GAME: ['পোৎলম শান্নপোৎ'],
    OPEN_NUMBER_MEMORY_GAME: ['মশীং শান্নপোৎ'],
    OPEN_STORY_GAME: ['ৱারী শান্নপোৎ'],
    OPEN_WORD_GAME: ['ৱাহৈ শান্নপোৎ'],
    OPEN_FAMILIAR_PLACES_GAME: ['মফম শান্নপোৎ'],
    OPEN_FAMILIAR_SOUNDS_GAME: ['খোন্থোক শান্নপোৎ'],
    OPEN_MEMORY_ASSISTANT: ['নীংশিংবা তেংবাংবা'],
    OPEN_PROGRESS: ['ঐগী খোঙথাং'],
    OPEN_ROUTINE: ['ঙসিগী থবক'],
    OPEN_HELP: ['তেংবাংবীয়ু'],
    OPEN_SETTINGS: ['সেটিংস'],
    TRIGGER_SOS: ['এস ও এস থাবা', 'তেংবাং থাবা', 'জরুরি তেংবাং', 'এসওএস'],
  },

  kha: {
    GO_HOME: ['wan sha ing', 'go home', 'dashboard', 'leit sha ing'],
    OPEN_GAMES: ['plie ki jingialehkai', 'ialehkai', 'games'],
    OPEN_MEMORY_GAME: ['plie memory game', 'ale sha memory game', 'play memory game', 'pyniahap kot', 'pynïahap kot', 'jingialehkai pyniahap kot', 'memory match'],
    OPEN_SEQUENCE_GAME: ['sequence game', 'kynmaw ryntih rong', 'ryntih rong', 'remember the sequence'],
    OPEN_FACE_NAME_GAME: ['face game', 'family photo', 'dur bahaiing', 'une dei uei', 'uei kane', 'nga dei uei', 'who am i', 'who is this'],
    OPEN_OBJECT_GAME: ['object game', 'kiei kiba phi iohi', 'kiei kiba phi ïohi', 'what did you see'],
    OPEN_NUMBER_MEMORY_GAME: ['number game', 'kynmaw namba', 'number memory'],
    OPEN_STORY_GAME: ['story game', 'kynmaw puriskam', 'story recall'],
    OPEN_WORD_GAME: ['word game', 'kren kynmaw', 'voice recall'],
    OPEN_FAMILIAR_PLACES_GAME: ['places game', 'ki jaka ba tipmit', 'familiar places'],
    OPEN_FAMILIAR_SOUNDS_GAME: ['sounds game', 'ki sur ba tipmit', 'familiar sounds'],
    OPEN_MEMORY_ASSISTANT: ['memory assistant'],
    OPEN_PROGRESS: ['show progress', 'history', 'jingiaid shaphrang'],
    OPEN_ROUTINE: ['show routine', 'rukom trei sngi'],
    OPEN_HELP: ['help me', 'iarap nga'],
    OPEN_SETTINGS: ['settings', 'jingpynbeit'],
    TRIGGER_SOS: ['phah sos', 'sos signal', 'iarap emergency', 'sos'],
  },

  lus: {
    GO_HOME: ['haw tawh rawh', 'home', 'dashboard', 'in lamah'],
    OPEN_GAMES: ['games hawng rawh', 'khelduh', 'infiamna'],
    OPEN_MEMORY_GAME: ['memory game hawng rawh', 'memory khelh', 'card inmil zawng', 'inmil zawng', 'memory match'],
    OPEN_SEQUENCE_GAME: ['sequence game', 'rawng inrem vawng', 'rawng inrem', 'remember the sequence'],
    OPEN_FACE_NAME_GAME: ['chhungte thlalak', 'tunge he mi hi', 'tunge ka nih', 'who am i', 'who is this'],
    OPEN_OBJECT_GAME: ['object game', 'eng nge i hmuh', 'what did you see'],
    OPEN_NUMBER_MEMORY_GAME: ['number game', 'nambar hriatrengna', 'number memory'],
    OPEN_STORY_GAME: ['thawnthu game', 'thawnthu hriatrengna', 'story recall'],
    OPEN_WORD_GAME: ['tawng game', 'tawng hriatrengna', 'voice recall'],
    OPEN_FAMILIAR_PLACES_GAME: ['hmun game', 'hmun hriat lar', 'familiar places'],
    OPEN_FAMILIAR_SOUNDS_GAME: ['ri game', 'ri hriat ngai', 'familiar sounds'],
    OPEN_MEMORY_ASSISTANT: ['memory assistant'],
    OPEN_PROGRESS: ['hmasawnna lang rawh', 'hmasawnna'],
    OPEN_ROUTINE: ['vawiin thiltum', 'thiltum'],
    OPEN_HELP: ['puih ka mamawh', 'min pui rawh'],
    OPEN_SETTINGS: ['settings'],
    TRIGGER_SOS: ['sos thawn rawh', 'emergency thawn rawh', 'sos'],
  },

  nag: {
    GO_HOME: ['ghar te jabi', 'home', 'dashboard', 'ghar jabi'],
    OPEN_GAMES: ['sob khel khulibi', 'khel khuli', 'games', 'khel'],
    OPEN_MEMORY_GAME: ['memory game khulibi', 'card khel', 'card jura milabi', 'jura milabi', 'memory match'],
    OPEN_SEQUENCE_GAME: ['sequence game', 'rong sequence', 'rong laga sequence', 'remember the sequence'],
    OPEN_FACE_NAME_GAME: ['manu photo', 'eitu kun ase', 'moi kun ase', 'who am i', 'who is this'],
    OPEN_OBJECT_GAME: ['object game', 'ki dekhise', 'ki dekhishe', 'what did you see'],
    OPEN_NUMBER_MEMORY_GAME: ['number game', 'number yaad kori', 'number memory'],
    OPEN_STORY_GAME: ['kahani game', 'kahani yaad kori', 'story recall'],
    OPEN_WORD_GAME: ['word game', 'mukhe kua yaad kori', 'voice recall'],
    OPEN_FAMILIAR_PLACES_GAME: ['jagah game', 'sini powa jagakhan', 'familiar places'],
    OPEN_FAMILIAR_SOUNDS_GAME: ['sound game', 'sini powa awaz', 'familiar sounds'],
    OPEN_MEMORY_ASSISTANT: ['memory assistant'],
    OPEN_PROGRESS: ['my score', 'history', 'progress'],
    OPEN_ROUTINE: ['today routine', 'routine'],
    OPEN_HELP: ['help me', 'madat'],
    OPEN_SETTINGS: ['settings'],
    TRIGGER_SOS: ['sos pathabi', 'emergency madat pathabi', 'sos'],
  },

  ny: {
    GO_HOME: ['nam lw', 'home', 'dashboard'],
    OPEN_GAMES: ['gwnam agka', 'gwnam hapkan'],
    OPEN_MEMORY_GAME: ['memory game hapkan', 'gwnam memory'],
    OPEN_SEQUENCE_GAME: ['sequence game'],
    OPEN_FACE_NAME_GAME: ['family photo'],
    OPEN_OBJECT_GAME: ['object game'],
    OPEN_NUMBER_MEMORY_GAME: ['number game'],
    OPEN_STORY_GAME: ['story game'],
    OPEN_WORD_GAME: ['word game'],
    OPEN_FAMILIAR_PLACES_GAME: ['nam places'],
    OPEN_FAMILIAR_SOUNDS_GAME: ['sound game'],
    OPEN_MEMORY_ASSISTANT: ['memory assistant'],
    OPEN_PROGRESS: ['my progress', 'history'],
    OPEN_ROUTINE: ['routine hapkan'],
    OPEN_HELP: ['help me'],
    OPEN_SETTINGS: ['settings'],
    TRIGGER_SOS: ['sos thapika', 'emergency madat', 'sos'],
  },
};

// 4. Localized Voice Spoken Confirmation Responses
export const VOICE_RESPONSES: Record<string, Record<NavigationIntent, string>> = {
  en: {
    GO_HOME: 'Going to Home Dashboard.',
    OPEN_GAMES: 'Opening Cognitive Games Center.',
    OPEN_MEMORY_GAME: 'Opening Memory Match Game.',
    OPEN_SEQUENCE_GAME: 'Opening Remember the Sequence Game.',
    OPEN_FACE_NAME_GAME: 'Opening Who Is This Family Photo Game.',
    OPEN_OBJECT_GAME: 'Opening Object Recognition Game.',
    OPEN_NUMBER_MEMORY_GAME: 'Opening Number Memory Game.',
    OPEN_STORY_GAME: 'Opening Story Recall Game.',
    OPEN_WORD_GAME: 'Opening Word Recall Game.',
    OPEN_FAMILIAR_PLACES_GAME: 'Opening Familiar Places Game.',
    OPEN_FAMILIAR_SOUNDS_GAME: 'Opening Familiar Sounds Game.',
    OPEN_MEMORY_ASSISTANT: 'Opening Memory Assistant.',
    OPEN_PROGRESS: 'Opening your progress and activity history.',
    OPEN_ROUTINE: 'Opening your daily routine schedule.',
    OPEN_HELP: 'Opening Memory Assistant for help.',
    OPEN_SETTINGS: 'Opening Settings.',
    TRIGGER_SOS: 'Emergency SOS signal sent to your caregiver and emergency contacts. Help is on the way. Please stay calm and safe.',
    AMBIGUOUS_GAME_PROMPT: 'Which game would you like to play? Memory Match, Sequence, or Family Photos?',
    UNKNOWN: 'I did not understand that command. Please try again or tap the screen.',
  },

  as: {
    GO_HOME: 'মুখ্য পৃষ্ঠালৈ যোৱা হৈছে।',
    OPEN_GAMES: 'মনস্তাত্বিক খেলৰ কেন্দ্ৰ খোলা হৈছে।',
    OPEN_MEMORY_GAME: 'মেম\'ৰী মেছ খেল খোলা হৈছে।',
    OPEN_SEQUENCE_GAME: 'ক্ৰম মনত ৰখা খেল খোলা হৈছে।',
    OPEN_FACE_NAME_GAME: 'পৰিয়ালৰ চিনাকি ছবি খেল খোলা হৈছে।',
    OPEN_OBJECT_GAME: 'বস্তু চিনাক্তকৰণ খেল খোলা হৈছে।',
    OPEN_NUMBER_MEMORY_GAME: 'সংখ্যা মনত ৰখা খেল খোলা হৈছে।',
    OPEN_STORY_GAME: 'সাধুকথা মনত ৰখা খেল খোলা হৈছে।',
    OPEN_WORD_GAME: 'শব্দ মনত ৰখা খেল খোলা হৈছে।',
    OPEN_FAMILIAR_PLACES_GAME: 'চিনাকি ঠাইৰ খেল খোলা হৈছে।',
    OPEN_FAMILIAR_SOUNDS_GAME: 'চিনাকি শব্দৰ খেল খোলা হৈছে।',
    OPEN_MEMORY_ASSISTANT: 'স্মৃতি সহায়কলৈ যোৱা হৈছে।',
    OPEN_PROGRESS: 'আপোনাৰ কাৰ্যকলাপৰ ইতিহাস খোলা হৈছে।',
    OPEN_ROUTINE: 'আপোনাৰ দৈনিক ৰুটিন খোলা হৈছে।',
    OPEN_HELP: 'সহায়ৰ বাবে স্মৃতি সহায়কলৈ যোৱা হৈছে।',
    OPEN_SETTINGS: 'ছেটিংছ খোলা হৈছে।',
    TRIGGER_SOS: 'আপোনাৰ কেয়াৰগিভাৰ আৰু জৰুৰী যোগাযোগলৈ এছঅ\'এছ বিপদ সংকেত প্ৰেৰণ কৰা হৈছে। সহায় শীঘ্ৰেই আহি আছে। শান্ত হৈ থাকক।',
    AMBIGUOUS_GAME_PROMPT: 'আপুনি কোনটো খেল খেলিব বিচাৰে? মেম\'ৰী মেছ, ক্ৰম খেল, নে পৰিয়ালৰ ছবি খেল?',
    UNKNOWN: 'বুজি পাবলৈ অসুবিধা হ\'ল। অনুগ্ৰহ কৰি আকৌ কওক।',
  },

  bn: {
    GO_HOME: 'হোম পেজে যাওয়া হচ্ছে।',
    OPEN_GAMES: 'কগনিটিভ গেম সেন্টার খোলা হচ্ছে।',
    OPEN_MEMORY_GAME: 'মেমরি ম্যাচ গেম খোলা হচ্ছে।',
    OPEN_SEQUENCE_GAME: 'সিকোয়েন্স রিকল গেম খোলা হচ্ছে।',
    OPEN_FACE_NAME_GAME: 'পরিবারের ছবি গেম খোলা হচ্ছে।',
    OPEN_OBJECT_GAME: 'অবজেক্ট রিকল গেম খোলা হচ্ছে।',
    OPEN_NUMBER_MEMORY_GAME: 'সংখ্যা মেমরি গেম খোলা হচ্ছে।',
    OPEN_STORY_GAME: 'গল্পের গেম খোলা হচ্ছে।',
    OPEN_WORD_GAME: 'শব্দ গেম খোলা হচ্ছে।',
    OPEN_FAMILIAR_PLACES_GAME: 'পরিচিত জায়গার গেম খোলা হচ্ছে।',
    OPEN_FAMILIAR_SOUNDS_GAME: 'পরিচিত শব্দের গেম খোলা হচ্ছে।',
    OPEN_MEMORY_ASSISTANT: 'মেমরি অ্যাসিস্ট্যান্ট খোলা হচ্ছে।',
    OPEN_PROGRESS: 'আপনার অগ্রগতি দেখা হচ্ছে।',
    OPEN_ROUTINE: 'আপনার রুটিন খোলা হচ্ছে।',
    OPEN_HELP: 'সহায়তার জন্য মেমরি অ্যাসিস্ট্যান্ট খোলা হচ্ছে।',
    OPEN_SETTINGS: 'সেটিংস খোলা হচ্ছে।',
    TRIGGER_SOS: 'আপনার কেয়ারগিভার এবং জরুরি পরিচিতিদের কাছে জরুরি এসওএস সংকেত পাঠানো হয়েছে। সাহায্য আসছে। দয়া করে শান্ত থাকুন।',
    AMBIGUOUS_GAME_PROMPT: 'আপনি কোন গেমটি খেলতে চান? মেমরি ম্যাচ, সিকোয়েন্স, নাকি পরিবারের ছবি?',
    UNKNOWN: 'বুঝতে পারিনি। অনুগ্রহ করে আবার বলুন।',
  },

  hi: {
    GO_HOME: 'मुख्य पृष्ठ पर जा रहे हैं।',
    OPEN_GAMES: 'गेम्स सेंटर खोला जा रहा है।',
    OPEN_MEMORY_GAME: 'मेमोरी मैच गेम खोला जा रहा है।',
    OPEN_SEQUENCE_GAME: 'सीक्वेंस गेम खोला जा रहा है।',
    OPEN_FACE_NAME_GAME: 'परिवार फोटो पहचान गेम खोला जा रहा है।',
    OPEN_OBJECT_GAME: 'वस्तु पहचान गेम खोला जा रहा है।',
    OPEN_NUMBER_MEMORY_GAME: 'नंबर मेमोरी गेम खोला जा रहा है।',
    OPEN_STORY_GAME: 'कहानी गेम खोला जा रहा है।',
    OPEN_WORD_GAME: 'शब्द गेम खोला जा रहा है।',
    OPEN_FAMILIAR_PLACES_GAME: 'जाने-पहचाने स्थान गेम खोला जा रहा है।',
    OPEN_FAMILIAR_SOUNDS_GAME: 'आवाज गेम खोला जा रहा है।',
    OPEN_MEMORY_ASSISTANT: 'मेमोरी असिस्टेंट खोला जा रहा है।',
    OPEN_PROGRESS: 'आपकी प्रगति दिखाई जा रही है।',
    OPEN_ROUTINE: 'आपकी दिनचर्या खोली जा रही है।',
    OPEN_HELP: 'सहायता के लिए मेमोरी असिस्टेंट खोला जा रहा है।',
    OPEN_SETTINGS: 'सेटिंग्स खोली जा रही हैं।',
    TRIGGER_SOS: 'आपके देखभालकर्ता और आपातकालीन संपर्कों को आपातकालीन एसओएस संकेत भेज दिया गया है। मदद आ रही है। कृपया शांत रहें।',
    AMBIGUOUS_GAME_PROMPT: 'आप कौन सा खेल खेलना चाहते हैं? मेमोरी मैच, सीक्वेंस, या परिवार फोटो?',
    UNKNOWN: 'समझ नहीं आया। कृपया दोबारा बोलें।',
  },

  ne: {
    GO_HOME: 'गृह पृष्ठमा जाँदैछ।',
    OPEN_GAMES: 'खेल केन्द्र खोलिँदैछ।',
    OPEN_MEMORY_GAME: 'मेमोरी म्याच खेल खोलिँदैछ।',
    OPEN_SEQUENCE_GAME: 'क्रम खेल खोलिँदैछ।',
    OPEN_FACE_NAME_GAME: 'परिवारको फोटो खेल खोलिँदैछ।',
    OPEN_OBJECT_GAME: 'वस्तु खेल खोलिँदैछ।',
    OPEN_NUMBER_MEMORY_GAME: 'अङ्क खेल खोलिँदैछ।',
    OPEN_STORY_GAME: 'कथा खेल खोलिँदैछ।',
    OPEN_WORD_GAME: 'शब्द खेल खोलिँदैछ।',
    OPEN_FAMILIAR_PLACES_GAME: 'चिनिएका ठाउँ खेल खोलिँदैछ।',
    OPEN_FAMILIAR_SOUNDS_GAME: 'आवाज खेल खोलिँदैछ।',
    OPEN_MEMORY_ASSISTANT: 'स्मृति सहायक खोलिँदैछ।',
    OPEN_PROGRESS: 'तपाईंको प्रगति देखाइँदैछ।',
    OPEN_ROUTINE: 'तपाईंको दिनचर्या खोलिँदैछ।',
    OPEN_HELP: 'स्मृति सहायकमा जाँदैछ।',
    OPEN_SETTINGS: 'सेटिङहरू खोलिँदैछ।',
    TRIGGER_SOS: 'तपाईंको हेरचाहकर्ता र आपतकालीन सम्पर्कहरूलाई आपतकालीन एसओएस संकेत पठाइएको छ। मद्दत आउँदैछ। कृपया शान्त रहनुहोस्।',
    AMBIGUOUS_GAME_PROMPT: 'तपाईं कुन खेल खेल्न चाहनुहुन्छ? मेमोरी म्याच, क्रम, वा परिवार फोटो?',
    UNKNOWN: 'बुझ्न सकिएन। कृपया फेरि भन्नुहोस्।',
  },

  mni: {
    GO_HOME: 'যুমদা চৎলে।',
    OPEN_GAMES: 'শান্নপোৎ হাংদোকলে।',
    OPEN_MEMORY_GAME: 'মেমোরি গেম হাংদোকলে।',
    OPEN_SEQUENCE_GAME: 'পরিংশান্নপোৎ হাংদোকলে।',
    OPEN_FACE_NAME_GAME: 'ইমুং ফটো শান্নপোৎ হাংদোকলে।',
    OPEN_OBJECT_GAME: 'পোৎলম শান্নপোৎ হাংদোকলে।',
    OPEN_NUMBER_MEMORY_GAME: 'মশীং শান্নপোৎ হাংদোকলে।',
    OPEN_STORY_GAME: 'ৱারী শান্নপোৎ হাংদোকলে।',
    OPEN_WORD_GAME: 'ৱাহৈ শান্নপোৎ হাংদোকলে।',
    OPEN_FAMILIAR_PLACES_GAME: 'মফম শান্নপোৎ হাংদোকলে।',
    OPEN_FAMILIAR_SOUNDS_GAME: 'খোন্থোক শান্নপোৎ হাংদোকলে।',
    OPEN_MEMORY_ASSISTANT: 'নীংশিংবা তেংবাংবা হাংদোকলে।',
    OPEN_PROGRESS: 'ঐগী খোঙথাং উৎলে।',
    OPEN_ROUTINE: 'ঙসিগী থবক উৎলে।',
    OPEN_HELP: 'তেংবাংবা হাংদোকলে।',
    OPEN_SETTINGS: 'সেটিংস হাংদোকলে।',
    TRIGGER_SOS: 'অদোমগী কেয়ারগিভারদা জরুরি এস ও এস তেংবাংগী পাউজেল থাখ্রে। তেংবাং লাক্কনি। নুংঙাইনা লৈবীয়ু।',
    AMBIGUOUS_GAME_PROMPT: 'অদোম করম্বা শান্নপোৎ শান্নগে? মেমোরি গেম, পরিংশান্নপোৎ, নত্রগা ফটো?',
    UNKNOWN: 'খঙবা ঙমদ্রে। অমুক হন্না হায়বীয়ু।',
  },

  kha: {
    GO_HOME: 'Leh lam sha Home.',
    OPEN_GAMES: 'Plie ia ki Jingialehkai.',
    OPEN_MEMORY_GAME: 'Plie ia ka Jingïalehkai Pynïahap Kot.',
    OPEN_SEQUENCE_GAME: 'Plie ia ka Jingïalehkai Kynmaw Ryntih Rong.',
    OPEN_FACE_NAME_GAME: 'Plie ia ka Jingïalehkai Dur Baha-ïing.',
    OPEN_OBJECT_GAME: 'Plie ia ka Jingïalehkai Kiei Kiba Phi Ïohi.',
    OPEN_NUMBER_MEMORY_GAME: 'Plie ia ka Jingïalehkai Kynmaw Namba.',
    OPEN_STORY_GAME: 'Plie ia ka Jingïalehkai Kynmaw Puriskam.',
    OPEN_WORD_GAME: 'Plie ia ka Jingïalehkai Kren Kynmaw.',
    OPEN_FAMILIAR_PLACES_GAME: 'Plie ia ka Jingïalehkai Ki Jaka ba Tipmit.',
    OPEN_FAMILIAR_SOUNDS_GAME: 'Plie ia ka Jingïalehkai Ki Sur ba Tipmit.',
    OPEN_MEMORY_ASSISTANT: 'Plie ia u Memory Assistant.',
    OPEN_PROGRESS: 'Plie ia ka jingïaid shaphrang jong phi.',
    OPEN_ROUTINE: 'Plie ia ka rukom trei sngi jong phi.',
    OPEN_HELP: 'Plie ia ka Jingïarap.',
    OPEN_SETTINGS: 'Plie ia ka Jingpynbeit Settings.',
    TRIGGER_SOS: 'La phah ia ka SOS sha ka nongsumar bad ki ba ha-iing. Kan wan iarap kloi. Shongsuk.',
    AMBIGUOUS_GAME_PROMPT: 'Kaino ka jingïalehkai kaba phi kwah? Pynïahap Kot lane Kynmaw Ryntih Rong?',
    UNKNOWN: 'Wym sngewthuh. Sngewbha ong biang.',
  },

  lus: {
    GO_HOME: 'Home-ah a kal e.',
    OPEN_GAMES: 'Infiamna hmun hawng mek e.',
    OPEN_MEMORY_GAME: 'Card Inmil Zawng infiamna hawng mek e.',
    OPEN_SEQUENCE_GAME: 'Rawng Inrem Vawng infiamna hawng mek e.',
    OPEN_FACE_NAME_GAME: 'Chhungte Thlalak Hriatna hawng mek e.',
    OPEN_OBJECT_GAME: 'Eng Nge I Hmuh infiamna hawng mek e.',
    OPEN_NUMBER_MEMORY_GAME: 'Nambar Hriatrengna hawng mek e.',
    OPEN_STORY_GAME: 'Thawnthu Hriatrengna hawng mek e.',
    OPEN_WORD_GAME: 'Tawng Hriatrengna hawng mek e.',
    OPEN_FAMILIAR_PLACES_GAME: 'Hmun Hriat Lar hawng mek e.',
    OPEN_FAMILIAR_SOUNDS_GAME: 'Ri Hriat Ngai hawng mek e.',
    OPEN_MEMORY_ASSISTANT: 'Memory Assistant hawng mek e.',
    OPEN_PROGRESS: 'I hmasawnna hawng mek e.',
    OPEN_ROUTINE: 'I vawiin thiltum hawng mek e.',
    OPEN_HELP: 'Puih dilna hawng mek e.',
    OPEN_SETTINGS: 'Settings hawng mek e.',
    TRIGGER_SOS: 'I enkawltu leh chhungte hnenah SOS thawn a ni tawh e. Puihna a rawn thleng tep e. Thlamuang takin awm rawh.',
    AMBIGUOUS_GAME_PROMPT: 'Khawi infiamna nge i khelh duh? Card Inmil Zawng nge Rawng Inrem Vawng?',
    UNKNOWN: 'Ka hrethiam lo. Khawngaihin sawi nawn leh rawh.',
  },

  nag: {
    GO_HOME: 'Ghar te ja ase.',
    OPEN_GAMES: 'Khel jaga khuli ase.',
    OPEN_MEMORY_GAME: 'Card Jura Milabi khel khuli ase.',
    OPEN_SEQUENCE_GAME: 'Rong Laga Sequence khel khuli ase.',
    OPEN_FACE_NAME_GAME: 'Ghar Laga Manu Photo khel khuli ase.',
    OPEN_OBJECT_GAME: 'Ki Dekhishe khel khuli ase.',
    OPEN_NUMBER_MEMORY_GAME: 'Number Yaad Kori khel khuli ase.',
    OPEN_STORY_GAME: 'Kahani Yaad Kori khel khuli ase.',
    OPEN_WORD_GAME: 'Mukhe Kua Yaad Kori khel khuli ase.',
    OPEN_FAMILIAR_PLACES_GAME: 'Sini Powa Jagakhan khel khuli ase.',
    OPEN_FAMILIAR_SOUNDS_GAME: 'Sini Powa Awaz khel khuli ase.',
    OPEN_MEMORY_ASSISTANT: 'Memory assistant khuli ase.',
    OPEN_PROGRESS: 'Apuni laga progress khuli ase.',
    OPEN_ROUTINE: 'Apuni laga routine khuli ase.',
    OPEN_HELP: 'Madat jaga khuli ase.',
    OPEN_SETTINGS: 'Settings khuli ase.',
    TRIGGER_SOS: 'Apuni laga caregiver ke SOS emergency signal pathai dise. Madat ahibo, bhal pora thakibi.',
    AMBIGUOUS_GAME_PROMPT: 'Apuni kunia khel khelibole mon ase? Card Jura Milabi ki Rong Sequence?',
    UNKNOWN: 'Bujhibole parise nai. Akou kobi.',
  },

  ny: {
    GO_HOME: 'Nam lw hapkan.',
    OPEN_GAMES: 'Minyi centre hapkan.',
    OPEN_MEMORY_GAME: 'Card jura khenam game hapkan.',
    OPEN_SEQUENCE_GAME: 'Rong line sequence game hapkan.',
    OPEN_FACE_NAME_GAME: 'Nam laga nyishi photo game hapkan.',
    OPEN_OBJECT_GAME: 'Object game hapkan.',
    OPEN_NUMBER_MEMORY_GAME: 'Number game hapkan.',
    OPEN_STORY_GAME: 'Kahani game hapkan.',
    OPEN_WORD_GAME: 'Agam game hapkan.',
    OPEN_FAMILIAR_PLACES_GAME: 'Places game hapkan.',
    OPEN_FAMILIAR_SOUNDS_GAME: 'Awaaz game hapkan.',
    OPEN_MEMORY_ASSISTANT: 'Memory assistant hapkan.',
    OPEN_PROGRESS: 'Progress hapkan.',
    OPEN_ROUTINE: 'Routine hapkan.',
    OPEN_HELP: 'Help hapkan.',
    OPEN_SETTINGS: 'Settings hapkan.',
    TRIGGER_SOS: 'No laga caregiver lw SOS emergency signal thapika dwnam. Madat ahe, bhal dwnam.',
    AMBIGUOUS_GAME_PROMPT: 'Hiki minyi gwnam no agka? Card jura ki Rong line sequence?',
    UNKNOWN: 'Khedapnam gwnam. Akou hisab.',
  },
};

// Normalize input text by stripping punctuation and lowercasing
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?'"¿]/g, '')
    .replace(/\s+/g, ' ');
}

// 5. Main Multilingual Navigation Intent Recognizer
export function recognizeNavigationIntent(
  transcript: string,
  language: string,
  pendingAmbiguousState: boolean = false
): NavigationIntent {
  const norm = normalizeText(transcript);
  if (!norm) return 'UNKNOWN';

  // Ambiguous state resolution: User was asked "Which game would you like to play?" and responds
  if (pendingAmbiguousState) {
    if (norm.includes('memory') || norm.includes('match') || norm.includes('স্মৃতি') || norm.includes('মেম\'ৰী') || norm.includes('कार्ड')) {
      return 'OPEN_MEMORY_GAME';
    }
    if (norm.includes('sequence') || norm.includes('pattern') || norm.includes('ক্রম') || norm.includes('চিকুৱেন্স')) {
      return 'OPEN_SEQUENCE_GAME';
    }
    if (norm.includes('face') || norm.includes('photo') || norm.includes('family') || norm.includes('ছবি') || norm.includes('পৰিয়াল')) {
      return 'OPEN_FACE_NAME_GAME';
    }
    if (norm.includes('place') || norm.includes('location') || norm.includes('ঠাই')) {
      return 'OPEN_FAMILIAR_PLACES_GAME';
    }
    if (norm.includes('number') || norm.includes('digit') || norm.includes('সংখ্যা')) {
      return 'OPEN_NUMBER_MEMORY_GAME';
    }
    if (norm.includes('story') || norm.includes('গল্প') || norm.includes('সাধু')) {
      return 'OPEN_STORY_GAME';
    }
    if (norm.includes('object') || norm.includes('বস্তু')) {
      return 'OPEN_OBJECT_GAME';
    }
    if (norm.includes('sound') || norm.includes('music') || norm.includes('শব্দ')) {
      return 'OPEN_FAMILIAR_SOUNDS_GAME';
    }
    if (norm.includes('word') || norm.includes('voice') || norm.includes('কথা')) {
      return 'OPEN_WORD_GAME';
    }
  }

  // Get active language dictionary or fallback to English
  const dict = VOICE_COMMANDS[language] || VOICE_COMMANDS.en;
  const englishDict = VOICE_COMMANDS.en;

  // Search through all intents
  const intents = Object.keys(dict) as Array<Exclude<NavigationIntent, 'UNKNOWN' | 'AMBIGUOUS_GAME_PROMPT'>>;

  for (const intent of intents) {
    const patterns = dict[intent] || [];
    const engPatterns = englishDict[intent] || [];
    const allPatterns = [...patterns, ...engPatterns];

    for (const pattern of allPatterns) {
      const normPattern = normalizeText(pattern);
      if (norm.includes(normPattern) || normPattern.includes(norm)) {
        return intent;
      }
    }
  }

  // Ambiguous Command Detection: User says general "open game" or "play game" without specifying which game
  const ambiguousGameKeywords = [
    'open game', 'play game', 'take me to game', 'i want to play game',
    'খেল খোলক', 'খেল খেলিম', 'গেম খেলব', 'खेल खोलो', 'खेल खेलना है',
    'gwnam agka', 'khel khulibi'
  ];

  for (const kw of ambiguousGameKeywords) {
    if (norm.includes(kw)) {
      return 'AMBIGUOUS_GAME_PROMPT';
    }
  }

  return 'UNKNOWN';
}

// 6. Get Spoken Response for Intent in Active Language
export function getNavigationResponse(intent: NavigationIntent, language: string): string {
  const langCatalog = VOICE_RESPONSES[language] || VOICE_RESPONSES.en;
  return langCatalog[intent] || VOICE_RESPONSES.en[intent] || 'Opening requested page.';
}

// 7. Get Safe Predefined Target Route for Valid Intent
export function getRouteForIntent(intent: NavigationIntent): RouteTarget | null {
  if (intent === 'UNKNOWN' || intent === 'AMBIGUOUS_GAME_PROMPT') return null;
  return NAVIGATION_ROUTES[intent] || null;
}
