import { getLanguageProfileByCode } from '../i18n/languages';

export interface SpeechRecognitionOptions {
  languageCode: string;
  onResult: (transcript: string) => void;
  onError: (errorMessage: string) => void;
  onEnd: () => void;
}

export const SpeechRecognitionService = {
  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  },

  getSpeechLanguage(languageCode: string): string {
    const profile = getLanguageProfileByCode(languageCode);
    return profile.speechCode || 'en-IN';
  },

  startListening(options: SpeechRecognitionOptions): { stop: () => void } | null {
    if (!this.isSupported()) {
      options.onError('Speech recognition is not supported on this browser/device.');
      return null;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.lang = this.getSpeechLanguage(options.languageCode);
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        if (event.results && event.results[0] && event.results[0][0]) {
          const transcript = event.results[0][0].transcript;
          options.onResult(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition event error:', event.error);
        if (event.error === 'no-speech') {
          options.onError('No speech detected. Please speak clearly or type below.');
        } else if (event.error === 'not-allowed') {
          options.onError('Microphone access denied. You can type your request below.');
        } else if (event.error === 'language-not-supported' && options.languageCode === 'as') {
          // Fallback to bn-IN or en-IN
          try {
            recognition.lang = 'bn-IN';
            recognition.start();
            return;
          } catch (e) {
            options.onError('Voice recognition fallback error. Please type below:');
          }
        } else {
          options.onError('Voice recognition encountered an issue. You can type instead:');
        }
      };

      recognition.onend = () => {
        options.onEnd();
      };

      recognition.start();

      return {
        stop: () => {
          try {
            recognition.stop();
          } catch (e) {
            // Ignore
          }
        },
      };
    } catch (e: any) {
      options.onError('Failed to initiate microphone speech recognition.');
      return null;
    }
  },
};
