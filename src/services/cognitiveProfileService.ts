import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { OfflineStorage } from '../offline/offlineStorage';
import { LocalCognitiveProfile } from '../offline/db';

export const CognitiveProfileService = {
  /**
   * Recalculates aggregate cognitive scores for a patient based on game history
   * and synchronizes with IndexedDB and Supabase.
   */
  async syncPatientCognitiveProfile(patientId: string): Promise<LocalCognitiveProfile | null> {
    if (!patientId) return null;

    try {
      // 1. Fetch all game attempts for this patient from IndexedDB or Supabase
      let attempts = await OfflineStorage.getGameAttempts(patientId);

      // If local is empty, try querying cloud if online
      if (attempts.length === 0 && isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
        const { data: cloudAttempts } = await supabase
          .from('game_attempts')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false });

        if (cloudAttempts && cloudAttempts.length > 0) {
          attempts = cloudAttempts.map((a: any) => ({
            id: a.id,
            patient_id: a.patient_id,
            game_type: a.game_type,
            difficulty_level: a.difficulty_level || 1,
            score: a.score || 0,
            accuracy: a.accuracy || 0,
            correct_answers: a.correct_answers || 0,
            total_questions: a.total_questions || 0,
            duration_seconds: a.duration_seconds || 0,
            timestamp: a.created_at || new Date().toISOString(),
            created_at: a.created_at || new Date().toISOString(),
            sync_status: 'synced',
          }));
        }
      }

      // Existing profile or baseline ID
      const existing = await OfflineStorage.getCognitiveProfile(patientId);
      const profileId =
        existing?.id ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `cp-${Date.now()}`);

      let avgAcc = 70;
      let recentAcc = 70;
      let memoryScore = 70;
      let attentionScore = 70;
      let recallScore = 70;
      let consistencyScore = 75;
      let currentLevel = 1;

      if (attempts.length > 0) {
        const accuracies = attempts.map((a) => Number(a.accuracy) || 0);
        avgAcc = Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length);
        const recent = accuracies.slice(0, 5);
        recentAcc = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);

        const memoryGames = attempts.filter((a) =>
          ['memory-match', 'pattern-recall', 'word-pairs', 'object-recall', 'face-name'].includes(a.game_type)
        );
        if (memoryGames.length > 0) {
          memoryScore = Math.round(
            memoryGames.reduce((s, g) => s + (Number(g.accuracy) || 0), 0) / memoryGames.length
          );
        } else {
          memoryScore = avgAcc;
        }

        const attentionGames = attempts.filter((a) =>
          ['remember-sequence', 'focus-shapes', 'stroop', 'sequence', 'word-association'].includes(a.game_type)
        );
        if (attentionGames.length > 0) {
          attentionScore = Math.round(
            attentionGames.reduce((s, g) => s + (Number(g.accuracy) || 0), 0) / attentionGames.length
          );
        } else {
          attentionScore = avgAcc;
        }

        const recallGames = attempts.filter((a) =>
          ['who-am-i', 'story-recall', 'spatial-recall', 'spatial-puzzle'].includes(a.game_type)
        );
        if (recallGames.length > 0) {
          recallScore = Math.round(
            recallGames.reduce((s, g) => s + (Number(g.accuracy) || 0), 0) / recallGames.length
          );
        } else {
          recallScore = avgAcc;
        }

        currentLevel = Math.max(...attempts.map((a) => Number(a.difficulty_level) || 1), 1);

        if (accuracies.length > 1) {
          const mean = avgAcc;
          const variance =
            accuracies.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / accuracies.length;
          const stdDev = Math.sqrt(variance);
          consistencyScore = Math.max(10, Math.min(100, Math.round(100 - stdDev * 1.5)));
        } else {
          consistencyScore = avgAcc;
        }
      }

      const updatedProfile: LocalCognitiveProfile = {
        id: profileId,
        patient_id: patientId,
        average_accuracy: avgAcc,
        recent_accuracy: recentAcc,
        games_completed: attempts.length,
        current_level: currentLevel,
        memory_score: memoryScore,
        attention_score: attentionScore,
        recall_score: recallScore,
        consistency_score: consistencyScore,
        updated_at: new Date().toISOString(),
      };

      // 2. Save locally (which queues offline sync)
      await OfflineStorage.saveCognitiveProfile(updatedProfile);

      // 3. If online, sync directly to Supabase immediately
      if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const { data: remoteExisting } = await supabase
            .from('cognitive_profiles')
            .select('id')
            .eq('patient_id', patientId)
            .maybeSingle();

          if (remoteExisting?.id) {
            await supabase
              .from('cognitive_profiles')
              .update({
                average_accuracy: updatedProfile.average_accuracy,
                recent_accuracy: updatedProfile.recent_accuracy,
                games_completed: updatedProfile.games_completed,
                current_level: updatedProfile.current_level,
                memory_score: updatedProfile.memory_score,
                attention_score: updatedProfile.attention_score,
                recall_score: updatedProfile.recall_score,
                consistency_score: updatedProfile.consistency_score,
                updated_at: updatedProfile.updated_at,
              })
              .eq('id', remoteExisting.id);
          } else {
            await supabase.from('cognitive_profiles').insert({
              id: updatedProfile.id,
              patient_id: updatedProfile.patient_id,
              average_accuracy: updatedProfile.average_accuracy,
              recent_accuracy: updatedProfile.recent_accuracy,
              games_completed: updatedProfile.games_completed,
              current_level: updatedProfile.current_level,
              memory_score: updatedProfile.memory_score,
              attention_score: updatedProfile.attention_score,
              recall_score: updatedProfile.recall_score,
              consistency_score: updatedProfile.consistency_score,
              updated_at: updatedProfile.updated_at,
            });
          }
        } catch (cloudErr) {
          console.warn('Direct Supabase cognitive profile sync error:', cloudErr);
        }
      }

      return updatedProfile;
    } catch (err) {
      console.warn('CognitiveProfileService sync warning:', err);
      return null;
    }
  },

  /**
   * Initializes a baseline cognitive profile for a newly registered patient.
   */
  async initializeProfile(patientId: string): Promise<void> {
    await this.syncPatientCognitiveProfile(patientId);
  },
};
