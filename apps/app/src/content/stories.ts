export interface StoryQuestion {
  /** Index of the sentence that holds the answer. */
  at: number;
  question: string;
  /** The first option is the right answer. Options are shuffled when shown. */
  options: [string, string, string, string];
}

export interface Story {
  id: string;
  title: string;
  sentences: string[];
  questions: StoryQuestion[];
}

/** Original short stories written for this project. */
export const STORIES: Story[] = [
  {
    id: 'walk',
    title: 'The morning walk',
    sentences: [
      'Mira walked to the market early in the morning.',
      'She carried a blue cloth bag.',
      'At the market she bought three oranges.',
      'A neighbour named Dev waved hello.',
      'They talked about the rain that was coming.',
      'Mira went home and made a cup of tea.',
    ],
    questions: [
      { at: 0, question: 'Where did Mira walk?', options: ['To the market', 'To the river', 'To the temple', 'To the school'] },
      { at: 1, question: 'What colour was her bag?', options: ['Blue', 'Red', 'Green', 'Yellow'] },
      { at: 2, question: 'What did she buy?', options: ['Three oranges', 'Two apples', 'Some bread', 'A fish'] },
      { at: 3, question: 'Who waved hello?', options: ['Dev', 'Ravi', 'Anil', 'Sita'] },
      { at: 4, question: 'What did they talk about?', options: ['The rain', 'A wedding', 'The bus', 'The price of rice'] },
      { at: 5, question: 'What did Mira make at home?', options: ['A cup of tea', 'Some rice', 'A shawl', 'A cake'] },
    ],
  },
  {
    id: 'garden',
    title: 'The small garden',
    sentences: [
      'Hari has a small garden behind his house.',
      'On Sunday he planted four chilli seeds.',
      'His granddaughter Lata brought a red watering can.',
      'They watered the seeds together.',
      'A yellow butterfly sat on the fence.',
      'Hari said the plants would grow tall by the rainy season.',
    ],
    questions: [
      { at: 0, question: 'Where is Hari’s garden?', options: ['Behind his house', 'By the river', 'On the roof', 'Near the road'] },
      { at: 1, question: 'What did he plant?', options: ['Chilli seeds', 'Rice', 'Beans', 'Flowers'] },
      { at: 2, question: 'What did Lata bring?', options: ['A red watering can', 'A spade', 'A basket', 'A hat'] },
      { at: 3, question: 'What did they do together?', options: ['Watered the seeds', 'Cooked lunch', 'Painted the fence', 'Read a book'] },
      { at: 4, question: 'What sat on the fence?', options: ['A yellow butterfly', 'A crow', 'A cat', 'A squirrel'] },
      { at: 5, question: 'When would the plants be tall?', options: ['By the rainy season', 'By tomorrow', 'By winter', 'By next week'] },
    ],
  },
  {
    id: 'visit',
    title: 'A visit at four o’clock',
    sentences: [
      'Nabin’s sister came to visit at four o’clock.',
      'She brought a box of sweet rice cakes.',
      'They sat on the veranda and drank tea.',
      'Her son had a new job in the city.',
      'They looked at old photographs of the family.',
      'Before she left, she promised to come again on Friday.',
    ],
    questions: [
      { at: 0, question: 'What time did Nabin’s sister come?', options: ['Four o’clock', 'Noon', 'Seven o’clock', 'Nine o’clock'] },
      { at: 1, question: 'What did she bring?', options: ['Sweet rice cakes', 'Fruit', 'A radio', 'Flowers'] },
      { at: 2, question: 'Where did they sit?', options: ['On the veranda', 'In the kitchen', 'By the gate', 'Under a tree'] },
      { at: 3, question: 'What was new for her son?', options: ['A job in the city', 'A house', 'A bicycle', 'A dog'] },
      { at: 4, question: 'What did they look at?', options: ['Old photographs', 'A map', 'A newspaper', 'The stars'] },
      { at: 5, question: 'When will she come again?', options: ['On Friday', 'Tomorrow', 'In a month', 'On Sunday'] },
    ],
  },
];
