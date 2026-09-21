import {
  Bell, Bed, Carrot, Check, Cloud, CloudRain, CookingPot, Coffee, Drop, Egg, Fire, Flower, ForkKnife, Hand, Heart, House, Key,
  Lamp, Leaf, Moon, Plant, Smiley, Sparkle, Sun, Timer, TShirt, Tree, Umbrella, BowlFood,
  type Icon,
} from '@phosphor-icons/react';

/**
 * Neutral household and nature icons (Phosphor, MIT). No cultural assets ship in this build:
 * see content/cultural-register.json. Cultural items need a source or a community review first.
 */
export type Group = 'kitchen' | 'nature' | 'home';

export interface Item {
  id: string;
  label: string;
  group: Group;
  Icon: Icon;
}

export const ITEMS: Item[] = [
  { id: 'coffee', label: 'cup of tea', group: 'kitchen', Icon: Coffee },
  { id: 'pot', label: 'cooking pot', group: 'kitchen', Icon: CookingPot },
  { id: 'bowl', label: 'bowl of food', group: 'kitchen', Icon: BowlFood },
  { id: 'fork', label: 'fork and knife', group: 'kitchen', Icon: ForkKnife },
  { id: 'egg', label: 'egg', group: 'kitchen', Icon: Egg },
  { id: 'carrot', label: 'carrot', group: 'kitchen', Icon: Carrot },
  { id: 'flower', label: 'flower', group: 'nature', Icon: Flower },
  { id: 'leaf', label: 'leaf', group: 'nature', Icon: Leaf },
  { id: 'tree', label: 'tree', group: 'nature', Icon: Tree },
  { id: 'plant', label: 'plant', group: 'nature', Icon: Plant },
  { id: 'cloud', label: 'cloud', group: 'nature', Icon: Cloud },
  { id: 'rain', label: 'rain cloud', group: 'nature', Icon: CloudRain },
  { id: 'sun', label: 'sun', group: 'nature', Icon: Sun },
  { id: 'moon', label: 'moon', group: 'nature', Icon: Moon },
  { id: 'key', label: 'key', group: 'home', Icon: Key },
  { id: 'umbrella', label: 'umbrella', group: 'home', Icon: Umbrella },
  { id: 'lamp', label: 'lamp', group: 'home', Icon: Lamp },
  { id: 'bell', label: 'bell', group: 'home', Icon: Bell },
  { id: 'house', label: 'house', group: 'home', Icon: House },
];

export const byId = (id: string): Item => ITEMS.find((i) => i.id === id)!;

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Pick `n` items. similarity 0: from different groups. 1: about half from one group. 2: all from one group.
 */
export function pickItems(n: number, similarity: number, rand: () => number): Item[] {
  const pool = (g: Group) => shuffle(ITEMS.filter((i) => i.group === g), rand);
  if (similarity >= 2) {
    const nature = pool('nature');
    const extra = shuffle([...pool('kitchen'), ...pool('home')], rand);
    return [...nature, ...extra].slice(0, n);
  }
  const home = pool('home');
  const kitchen = pool('kitchen');
  const nature = pool('nature');
  if (similarity === 1) {
    const same = nature.slice(0, Math.ceil(n / 2));
    const rest = shuffle([...home, ...kitchen], rand).slice(0, n - same.length);
    return shuffle([...same, ...rest], rand);
  }
  const mixed: Item[] = [];
  const lists = [home, kitchen, nature];
  for (let k = 0; mixed.length < n; k++) {
    const next = lists[k % 3]!.shift();
    if (next) mixed.push(next);
    else if (lists.every((l) => l.length === 0)) break;
  }
  return shuffle(mixed, rand);
}

export interface RoutineStep {
  label: string;
  Icon: Icon;
}

export const ROUTINES: Array<{ id: string; title: string; steps: RoutineStep[] }> = [
  {
    id: 'tea',
    title: 'Making tea',
    steps: [
      { label: 'Fill the kettle with water', Icon: Drop },
      { label: 'Heat the water', Icon: Fire },
      { label: 'Put tea leaves in a cup', Icon: Leaf },
      { label: 'Pour in the hot water', Icon: Coffee },
      { label: 'Wait a few minutes', Icon: Timer },
      { label: 'Sit and enjoy it', Icon: Smiley },
    ],
  },
  {
    id: 'hands',
    title: 'Washing hands',
    steps: [
      { label: 'Wet your hands', Icon: Drop },
      { label: 'Add soap', Icon: Sparkle },
      { label: 'Rub your hands together', Icon: Hand },
      { label: 'Rinse with water', Icon: Drop },
      { label: 'Dry your hands', Icon: Check },
    ],
  },
  {
    id: 'morning',
    title: 'Getting ready in the morning',
    steps: [
      { label: 'Get out of bed', Icon: Bed },
      { label: 'Wash your face', Icon: Drop },
      { label: 'Put on your clothes', Icon: TShirt },
      { label: 'Have breakfast', Icon: ForkKnife },
      { label: 'Step outside for fresh air', Icon: Sun },
    ],
  },
];

export const CARE_ICON = Heart;
