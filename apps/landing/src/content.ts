/** All landing copy in one place, so it can be read and audited as a whole. No em dashes. */
export const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#activities', label: 'Activities' },
  { href: '#screening', label: 'Screening' },
  { href: '#offline', label: 'Offline and privacy' },
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
      body: 'Short, calm activities with one choice per screen. No timers, no red crosses, and a voice they know.',
      image: 'patient-home',
      alt: 'The Hillpath home screen with a large Play button, a My day button and an I need help button.',
    },
    {
      title: 'For the family',
      body: 'Reminders you can record in your own voice, and a weekly view of activity with plain explanations.',
      image: 'dashboard',
      alt: 'The family view showing this week, how activities are going and a screening range.',
    },
    {
      title: 'For the health worker',
      body: 'A monthly check with pictures and simple questions, ending in a summary a doctor can read.',
      image: 'check',
      alt: 'The monthly check screen with a question about family and friends.',
    },
  ],
};

export const ACTIVITIES = {
  headline: 'Activities that adjust to the day.',
  body: 'Each round aims for about eight successes in ten. On a harder day the next round gets easier, without comment. These activities do not treat or reverse dementia.',
  items: [
    { key: 'game-pairs', name: 'Pairs at Home', approach: 'Cognitive stimulation', alt: 'A board of hidden cards for matching pairs of household pictures.' },
    { key: 'game-faces', name: 'Faces and Names', approach: 'Errorless learning and spaced retrieval', alt: 'A family member shown with three names to choose from.' },
    { key: 'game-story', name: 'Story Time', approach: 'Reminiscence and cognitive stimulation', alt: 'A short story with a button to hear it again.' },
    { key: 'game-routine', name: 'Routine Steps', approach: 'Montessori-based activity', alt: 'The steps of making tea, with a question about what comes next.' },
    { key: 'game-find', name: 'Find It', approach: 'Attention and recognition', alt: 'A grid of pictures with a prompt to find the umbrella.' },
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
  body: 'Hillpath estimates a range, shows how sure it is, and asks for a clinical check when it matters. It has only been tested on simulated people, never on real patients.',
  items: [
    { term: 'Choosing the next activity', tag: 'Implemented', note: 'Runs on real play. Compared with the old rule on simulated people.' },
    { term: 'Screening range', tag: 'Simulated', note: 'Trained on synthetic data only. The screen says so.' },
    { term: 'Trend and sudden-change alerts', tag: 'Simulated', note: 'A sudden change is sent to a same-day health check, not treated as decline.' },
    { term: 'Clinical validation', tag: 'Roadmap', note: 'Needs a pilot with a medical college and ethics approval.' },
  ],
  link: { href: '/limitations/', label: 'Read the limitations' },
  alt: 'The screening range card with a note that it is a simulated model and not a diagnosis.',
};

export const OFFLINE = {
  headline: 'Works in airplane mode.',
  facts: [
    'Records stay on the phone.',
    'Anything that leaves is encrypted with keys only your family devices hold.',
    'No signal? Share by scanning a moving code on the screen.',
    'You choose who sees what, and can change it at any time.',
  ],
  alt: 'A moving code on the Send records screen, used to share encrypted records without internet.',
};

export const CLOSING = {
  headline: 'See it on a real phone.',
  cta: 'Open demo app',
  note: 'Built for Smart India Hackathon 2026, problem statement 26003. A prototype, not a medical device.',
};
