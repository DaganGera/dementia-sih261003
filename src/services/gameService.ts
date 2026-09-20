import { GameSession, GameType, CognitiveCategory } from '../types';
import { OfflineStorage } from '../offline/offlineStorage';
import { StorageService } from './storage';
import { AlertEngineService } from './alertEngine';
import { syncManager } from '../offline/syncManager';

export interface GameCompletionInput {
  gameId: GameType;
  gameTitle: string;
  category: CognitiveCategory;
  score: number;
  accuracy: number;
  timeSeconds: number;
  difficultyLevel: number;
  attempts?: number;
  patientId?: string;
}

export const GameService = {
  /**
   * Completes a game with local-first IndexedDB save, alerts check, and background sync
   */
  async completeGame(input: GameCompletionInput): Promise<GameSession> {
    const session: GameSession = {
      id: `gs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      gameId: input.gameId,
      gameTitle: input.gameTitle,
      category: input.category,
      score: input.score,
      accuracy: input.accuracy,
      timeSeconds: input.timeSeconds,
      difficultyLevel: input.difficultyLevel,
      attempts: input.attempts || 1,
      timestamp: new Date().toISOString(),
    };

    const patientId = input.patientId || StorageService.getActivePatientId();

    // 1. Save to IndexedDB immediately (Local-First)
    try {
      await OfflineStorage.saveGameAttempt({
        id: session.id,
        patient_id: patientId,
        game_type: session.gameId,
        difficulty_level: session.difficultyLevel,
        score: session.score,
        accuracy: session.accuracy,
        correct_answers: session.attempts || 1,
        total_questions: session.attempts || 1,
        duration_seconds: session.timeSeconds,
        timestamp: session.timestamp,
        created_at: session.timestamp,
      });
    } catch (e) {
      console.warn('OfflineStorage game attempt save warning', e);
    }

    // 2. Keep StorageService in sync for synchronous React component reads
    StorageService.saveGameSession({
      gameId: session.gameId,
      gameTitle: session.gameTitle,
      category: session.category,
      score: session.score,
      accuracy: session.accuracy,
      timeSeconds: session.timeSeconds,
      difficultyLevel: session.difficultyLevel,
      attempts: session.attempts,
    });

    // 3. Immediately evaluate accuracy alerts after game completion
    try {
      AlertEngineService.checkAccuracyAlert(patientId);
    } catch (e) {
      console.warn('Alert evaluation warning', e);
    }

    // 4. Trigger background synchronization if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncManager.startSync().catch(() => {});
    }

    return session;
  },

  async getRecentSessions(patientId?: string): Promise<GameSession[]> {
    try {
      const attempts = await OfflineStorage.getGameAttempts(patientId);
      if (attempts.length > 0) {
        return attempts.map((a) => ({
          id: a.id,
          gameId: a.game_type as GameType,
          gameTitle: a.game_type,
          category: 'memory' as CognitiveCategory,
          score: a.score,
          accuracy: a.accuracy,
          timeSeconds: a.duration_seconds,
          difficultyLevel: a.difficulty_level,
          timestamp: a.timestamp,
          attempts: a.total_questions,
        }));
      }
    } catch {
      // Fallback
    }
    return StorageService.getGameSessions();
  },
};
