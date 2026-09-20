import { GameSession, GameType, CognitiveCategory, CategoryScores } from '../types';
import { MedicalContextService } from './medicalContext';
import { StorageService } from './storage';

export interface RecommendationResult {
  recommendedGameId: GameType;
  recommendedGameTitle: string;
  categoryScores: CategoryScores;
  recommendationReason: string;
  careContextNote?: string;
  allRecommendedList: Array<{ id: GameType; title: string; category: CognitiveCategory; reason: string }>;
}

export const RecommendationEngineService = {
  calculateCategoryScores(sessions: GameSession[]): CategoryScores {
    if (!sessions || sessions.length === 0) {
      return { memory: 0, attention: 0, recognition: 0, recall: 0, language: 0, familiarity: 0 };
    }

    const totals: Record<CognitiveCategory, { sum: number; count: number }> = {
      memory: { sum: 0, count: 0 },
      attention: { sum: 0, count: 0 },
      recognition: { sum: 0, count: 0 },
      recall: { sum: 0, count: 0 },
      language: { sum: 0, count: 0 },
      familiarity: { sum: 0, count: 0 },
    };

    sessions.forEach(s => {
      const cat = s.category || 'memory';
      if (totals[cat]) {
        const val = (s.score !== undefined && s.score !== null) ? s.score : s.accuracy;
        totals[cat].sum += val;
        totals[cat].count += 1;
      }
    });

    return {
      memory: totals.memory.count ? Math.round(totals.memory.sum / totals.memory.count) : 0,
      attention: totals.attention.count ? Math.round(totals.attention.sum / totals.attention.count) : 0,
      recognition: totals.recognition.count ? Math.round(totals.recognition.sum / totals.recognition.count) : 0,
      recall: totals.recall.count ? Math.round(totals.recall.sum / totals.recall.count) : 0,
      language: totals.language.count ? Math.round(totals.language.sum / totals.language.count) : 0,
      familiarity: totals.familiarity.count ? Math.round(totals.familiarity.sum / totals.familiarity.count) : 0,
    };
  },

  getRecommendations(sessions: GameSession[]): RecommendationResult {
    const scores = this.calculateCategoryScores(sessions);

    // Fetch care context (sensory considerations, mobility, caregiver notes)
    const patientProfile = StorageService.getPatientProfile();
    const careSummary = MedicalContextService.getPersonalizationSummary(patientProfile);

    // Identify lowest scoring category for practice suggestion
    const sortedCategories = (Object.keys(scores) as CognitiveCategory[]).sort(
      (a, b) => scores[a] - scores[b]
    );

    const lowestCategory = sortedCategories[0];

    let recommendedGameId: GameType = 'memory-match';
    let recommendedGameTitle = '🧩 Memory Match';

    if (lowestCategory === 'recall') {
      recommendedGameId = 'story-recall';
      recommendedGameTitle = '📖 Story Recall';
    } else if (lowestCategory === 'attention') {
      recommendedGameId = 'sequence-recall';
      recommendedGameTitle = '🧠 Remember the Sequence';
    } else if (lowestCategory === 'recognition') {
      recommendedGameId = 'name-face';
      recommendedGameTitle = '👤 Who Is This?';
    } else if (lowestCategory === 'language') {
      recommendedGameId = 'voice-recall';
      recommendedGameTitle = '🗣️ Voice Recall';
    } else if (lowestCategory === 'familiarity') {
      recommendedGameId = 'familiar-places';
      recommendedGameTitle = '🏠 Familiar Places';
    }

    // Non-clinical recommendation reason combining performance & care context
    const recommendationReason = `This activity matches recent ${lowestCategory.toUpperCase()} activity performance and is aligned with the user's current care preferences.`;
    const careContextNote = careSummary.activityModifiers.length > 0
      ? `Care considerations active: ${careSummary.activityModifiers.join('; ')}.`
      : 'Standard activity layout active.';

    const allRecommendedList = [
      {
        id: 'story-recall' as GameType,
        title: '📖 Story Recall',
        category: 'recall' as CognitiveCategory,
        reason: 'Recommended for warm narrative engagement.',
      },
      {
        id: 'sequence-recall' as GameType,
        title: '🧠 Remember the Sequence',
        category: 'attention' as CognitiveCategory,
        reason: 'Recommended for visual pattern practice.',
      },
      {
        id: 'voice-recall' as GameType,
        title: '🗣️ Voice Recall',
        category: 'language' as CognitiveCategory,
        reason: 'Recommended for verbal expression exercise.',
      },
    ];

    return {
      recommendedGameId,
      recommendedGameTitle,
      categoryScores: scores,
      recommendationReason,
      careContextNote,
      allRecommendedList,
    };
  },
};
