import { GamificationProfile, Badge, GameSession } from '../types';
import { notifySyncEvent } from './realtime';

const GAMIFICATION_KEY = 'mindcare_gamification_profile';

const DEFAULT_BADGES: Badge[] = [
  {
    id: 'first-activity',
    title: 'First Step',
    description: 'Completed your first cognitive brain exercise!',
    icon: '🌟',
    isUnlocked: true,
    unlockedAt: new Date().toISOString(),
  },
  {
    id: 'memory-master',
    title: 'Memory Master',
    description: 'Achieved 85%+ accuracy on visual memory match.',
    icon: '🧠',
    isUnlocked: true,
    unlockedAt: new Date().toISOString(),
  },
  {
    id: 'recognition-star',
    title: 'Family Star',
    description: 'Recognized familiar family member photos correctly.',
    icon: '❤️',
    isUnlocked: true,
    unlockedAt: new Date().toISOString(),
  },
  {
    id: 'streak-3',
    title: 'Streak Champ',
    description: 'Maintained 3 or more consecutive daily activity days.',
    icon: '🔥',
    isUnlocked: true,
    unlockedAt: new Date().toISOString(),
  },
  {
    id: 'audio-genius',
    title: 'Audio Explorer',
    description: 'Identified familiar household audio sounds.',
    icon: '🎵',
    isUnlocked: false,
  },
  {
    id: 'story-scholar',
    title: 'Story Scholar',
    description: 'Completed narrative story comprehension exercises.',
    icon: '📖',
    isUnlocked: false,
  },
];

const INITIAL_GAMIFICATION: GamificationProfile = {
  xp: 245,
  mindPoints: 180,
  userLevel: 4,
  currentStreak: 5,
  lastActiveDate: new Date().toISOString().split('T')[0],
  unlockedBadges: DEFAULT_BADGES,
};

export const GamificationService = {
  getProfile(): GamificationProfile {
    try {
      const saved = localStorage.getItem(GAMIFICATION_KEY);
      return saved ? JSON.parse(saved) : INITIAL_GAMIFICATION;
    } catch (e) {
      return INITIAL_GAMIFICATION;
    }
  },

  saveProfile(profile: GamificationProfile): void {
    try {
      localStorage.setItem(GAMIFICATION_KEY, JSON.stringify(profile));
      notifySyncEvent(GAMIFICATION_KEY, profile);
    } catch (e) {
      console.error('Failed to save gamification profile', e);
    }
  },

  /**
   * Processes rewards after completing a game session
   */
  rewardSession(session: Omit<GameSession, 'id' | 'timestamp'>): {
    xpEarned: number;
    mindPointsEarned: number;
    newLevel: number;
    unlockedNewBadge: Badge | null;
    updatedProfile: GamificationProfile;
  } {
    const profile = this.getProfile();

    // 1. Calculate XP and Mind Points base on accuracy & score
    const xpEarned = Math.round(20 + (session.accuracy * 0.3) + (session.difficultyLevel * 5));
    const mindPointsEarned = Math.round(10 + (session.score * 0.15));

    const totalXp = profile.xp + xpEarned;
    const totalPoints = profile.mindPoints + mindPointsEarned;

    // 2. Level calculation (every 100 XP increases user level)
    const newLevel = Math.max(1, Math.floor(totalXp / 100) + 1);

    // 3. Streak calculation
    const todayStr = new Date().toISOString().split('T')[0];
    let newStreak = profile.currentStreak;
    if (profile.lastActiveDate !== todayStr) {
      const lastDate = new Date(profile.lastActiveDate);
      const currentDate = new Date(todayStr);
      const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1) {
        newStreak = 1; // Reset streak if missed days
      }
    }

    // 4. Badge Unlock Checking
    let unlockedNewBadge: Badge | null = null;
    const updatedBadges = profile.unlockedBadges.map(b => {
      if (!b.isUnlocked) {
        let shouldUnlock = false;
        if (b.id === 'audio-genius' && session.gameId === 'familiar-sounds') shouldUnlock = true;
        if (b.id === 'story-scholar' && session.gameId === 'story-recall') shouldUnlock = true;
        if (b.id === 'memory-master' && session.accuracy >= 85) shouldUnlock = true;

        if (shouldUnlock) {
          unlockedNewBadge = { ...b, isUnlocked: true, unlockedAt: new Date().toISOString() };
          return unlockedNewBadge;
        }
      }
      return b;
    });

    const updatedProfile: GamificationProfile = {
      xp: totalXp,
      mindPoints: totalPoints,
      userLevel: newLevel,
      currentStreak: newStreak,
      lastActiveDate: todayStr,
      unlockedBadges: updatedBadges,
    };

    this.saveProfile(updatedProfile);

    return {
      xpEarned,
      mindPointsEarned,
      newLevel,
      unlockedNewBadge,
      updatedProfile,
    };
  },
};
