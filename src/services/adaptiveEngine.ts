import { GameSession } from '../types';

export interface AdaptiveResult {
  nextDifficulty: number;
  recommendationReason: string;
  trend: 'increased' | 'maintained' | 'decreased';
}

export const AdaptiveEngineService = {
  /**
   * Calculates next difficulty level (1-5) using recent activity performance
   */
  getNextDifficulty(
    accuracy: number,
    currentDifficulty: number,
    recentSessions: GameSession[] = []
  ): AdaptiveResult {
    let nextDifficulty = currentDifficulty;
    let trend: 'increased' | 'maintained' | 'decreased' = 'maintained';
    let recommendationReason = 'Performance is steady. Difficulty level maintained for comfortable practice.';

    // Evaluate accuracy threshold rules
    if (accuracy >= 80) {
      if (currentDifficulty < 5) {
        nextDifficulty = currentDifficulty + 1;
        trend = 'increased';
        recommendationReason = `High accuracy (${accuracy}%) achieved! Advanced to Level ${nextDifficulty} for gentle progression.`;
      } else {
        recommendationReason = `Mastery achieved at max Level 5 with ${accuracy}% accuracy!`;
      }
    } else if (accuracy < 60) {
      if (currentDifficulty > 1) {
        nextDifficulty = currentDifficulty - 1;
        trend = 'decreased';
        recommendationReason = `Adaptive AI reduced challenge to Level ${nextDifficulty} to foster positive encouragement and reduce stress.`;
      } else {
        recommendationReason = 'Level 1 active to support gentle practice.';
      }
    }

    return {
      nextDifficulty,
      recommendationReason,
      trend,
    };
  },
};
