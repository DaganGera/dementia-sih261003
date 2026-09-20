// Web Speech API text-to-speech helper for elderly voice guidance
import { TextToSpeechService } from './textToSpeech';

export const SpeechService = {
  speak(text: string, enabled = true, language?: string): void {
    if (!enabled || !text) return;
    const currentLang = language || localStorage.getItem('mindcare_language') || 'as';
    TextToSpeechService.speak(text, currentLang, 0.9, enabled);
  },

  stop(): void {
    TextToSpeechService.stop();
  }
};
