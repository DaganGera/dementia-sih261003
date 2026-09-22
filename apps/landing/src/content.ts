/** All landing copy in one place, so it can be read and audited as a whole. No em dashes. */
export const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#activities', label: 'Activities' },
  { href: '#screening', label: 'Screening' },
  { href: '#offline', label: 'Offline and privacy' },
  { href: '#download', label: 'Get the app' },
  { href: '/limitations/', label: 'Limitations' },
] as const;

export const HERO = {
  lead: 'Memory care in ',
  em1: 'familiar voices,',
  mid: ' even ',
  em2: 'offline.',
  body: 'Memory activities and reminders for people living with dementia, with messages recorded by family, and no internet needed.',
  cta: 'See how it works',
};

export const NAV_CTA = 'Open demo app';

export const PROBLEM = {
  figure: '7.4%',
  headline: 'of Indians aged 60 and over live with dementia.',
  body: [
    'That is an estimated 8.8 million people.',
    'Around 45% of dementia cases worldwide could be prevented or delayed by addressing 14 risk factors.',
    'We do not quote figures for North East India until we have checked them.',
  ],
  sources: [
    { label: 'Prevalence of dementia in India, LASI-DAD (2023)', href: 'https://pubmed.ncbi.nlm.nih.gov/36637034/' },
    { label: 'Lancet Commission on dementia prevention (2024)', href: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(24)01296-0/fulltext' },
  ],
};

export const HOW = {
  headline: 'Built for the person, the family and the health worker.',
  blocks: [
    {
      title: 'For the person',
      body: 'Short, calm activities with one choice per screen. Bilingual by default, with voice support and a large-text mode.',
      image: 'patient-home',
      alt: 'The Siroi home screen greeting Meena Sharma, with streak, mind points and a Talk to Siroi voice assistant card.',
    },
    {
      title: 'For the family',
      body: 'A caregiver dashboard with the patient profile, care team, cognitive analysis and activity trends in one place.',
      image: 'dashboard',
      alt: 'The Siroi caregiver dashboard showing the patient profile and quick actions.',
    },
    {
      title: 'For the health worker',
      body: 'Daily reminders and medication checkpoints the caregiver sets, synced so the person sees them automatically.',
      image: 'reminders',
      alt: 'The Siroi reminders screen with a daily checkpoint and its scheduled time.',
    },
  ],
};

export const ACTIVITIES = {
  headline: 'Nine cognitive games that adjust to the day.',
  body: 'Games cover memory, attention, recognition and recall, each with its own scoring and a short session length. Games do not treat or reverse dementia.',
  items: [
    { key: 'memory-match', name: 'Memory Match', approach: 'Flip cards face down and locate all matching pairs.' },
    { key: 'sequence-recall', name: 'Remember the Sequence', approach: 'Observe colored sequence steps and reproduce the pattern.' },
    { key: 'who-is-this', name: 'Who Is This?', approach: 'Identify familiar family member photos and names.' },
    { key: 'familiar-places', name: 'Familiar Places', approach: 'Identify familiar locations and home surroundings.' },
    { key: 'number-memory', name: 'Number Memory', approach: 'Remember and reproduce a numeric digit sequence.' },
    { key: 'voice-recall', name: 'Voice Recall', approach: 'Verbal recall and speech interaction activity.' },
    { key: 'object-recall', name: 'What Did You See?', approach: 'Observe everyday objects, then recall them.' },
    { key: 'story-recall', name: 'Story Recall', approach: 'Listen to a short warm story and answer questions.' },
    { key: 'familiar-sounds', name: 'Familiar Sounds', approach: 'Listen to audio sounds and identify what you hear.' },
  ],
};

export const LANGUAGES = {
  headline: 'Voices first. Languages next.',
  body: 'Families record the important messages in their own voice. The screens are in English today. These are the languages we plan to add, each with a native speaker checking the words before it ships.',
  list: [
    { name: 'English', code: 'eng', status: 'Available' },
    { name: 'Assamese', code: 'asm', status: 'Planned' },
    { name: 'Bengali', code: 'ben', status: 'Planned' },
    { name: 'Nepali', code: 'npi', status: 'Planned' },
    { name: 'Meitei', code: 'mni', status: 'Planned' },
    { name: 'Bodo', code: 'brx', status: 'Planned' },
    { name: 'Mizo', code: 'lus', status: 'Planned' },
    { name: 'Khasi', code: 'kha', status: 'Planned' },
    { name: 'Garo', code: 'grt', status: 'Planned' },
    { name: 'Kokborok', code: 'trp', status: 'Planned' },
    { name: 'Nagamese', code: 'nag', status: 'Planned' },
    { name: 'Nyishi', code: 'njz', status: 'Planned' },
    { name: 'Karbi', code: 'mjw', status: 'Planned' },
    { name: 'Hindi', code: 'hin', status: 'Planned' },
  ],
};

export const SCREENING = {
  headline: 'Screening support, not a diagnosis.',
  body: 'Siroi estimates a range, shows how sure it is, and asks for a clinical check when it matters. It has only been tested on simulated people, never on real patients.',
  items: [
    { term: 'Choosing the next activity', tag: 'Implemented', note: 'Runs on real play. Compared with the old rule on simulated people.' },
    { term: 'Screening range', tag: 'Simulated', note: 'Trained on synthetic data only. The screen says so.' },
    { term: 'Trend and sudden-change alerts', tag: 'Simulated', note: 'A sudden change is sent to a same-day health check, not treated as decline.' },
    { term: 'Clinical validation', tag: 'Roadmap', note: 'Needs a pilot with a medical college and ethics approval.' },
  ],
  link: { href: '/limitations/', label: 'Read the limitations' },
  alt: 'The Siroi caregiver dashboard with the cognitive analysis card.',
};

export const OFFLINE = {
  headline: 'Keeps working when the signal drops.',
  facts: [
    'Activity is saved on the phone the moment it happens.',
    'When the connection returns, everything syncs automatically.',
    'A visible status shows Offline, Syncing or Synced at all times.',
    'You choose who sees what, and can change it at any time.',
  ],
  alt: 'The Siroi reminders screen with a daily checkpoint.',
};

export const CLOSING = {
  headline: 'See it on a real phone.',
  cta: 'Open demo app',
  note: 'Built for Smart India Hackathon 2026, problem statement 26003. A prototype, not a medical device.',
};
