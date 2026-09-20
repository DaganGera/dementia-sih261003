import { getLanguageProfileByCode } from '../i18n/languages';

let synth: SpeechSynthesis | null = null;
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  synth = window.speechSynthesis;
}

let cachedVoices: SpeechSynthesisVoice[] = [];

const loadVoices = () => {
  if (synth) {
    const list = synth.getVoices();
    if (list && list.length > 0) {
      cachedVoices = list;
    }
  }
};

if (typeof window !== 'undefined' && synth) {
  loadVoices();
  if ('onvoiceschanged' in synth) {
    synth.onvoiceschanged = loadVoices;
  }
}

export const TextToSpeechService = {
  isSupported(): boolean {
    return !!synth;
  },

  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!synth) return [];
    if (cachedVoices.length === 0) {
      cachedVoices = synth.getVoices();
    }
    return cachedVoices;
  },

  getBestVoice(languageCode: string): SpeechSynthesisVoice | null {
    const voices = this.getAvailableVoices();
    if (voices.length === 0) return null;

    const profile = getLanguageProfileByCode(languageCode);
    const targetTag = (profile.speechCode || 'en-IN').toLowerCase();
    const langPrefix = targetTag.slice(0, 2);

    // 1. Exact speech code match (avoid generic 'en' matching en-US for Khasi/Mizo/Nagamese/Nyishi)
    if (!['kha', 'lus', 'nag', 'ny'].includes(languageCode)) {
      let matched = voices.find(v => {
        const vLang = v.lang.toLowerCase();
        if (languageCode === 'mni') {
          return vLang === 'mni-in' || vLang === 'mni';
        }
        return vLang === targetTag || (targetTag.length >= 2 && vLang.startsWith(targetTag.slice(0, 2)));
      });
      if (matched) return matched;
    }

    // 2. Bengali voice for Assamese ('as'), Manipuri ('mni'), and Bengali ('bn')
    if (['as', 'bn', 'mni'].includes(languageCode)) {
      let matched = voices.find(v => v.lang.toLowerCase().startsWith('bn'));
      if (matched) return matched;
    }

    // 3. Indian English / Hindi voice for Khasi, Mizo, Nagamese, Nyishi, Nepali, Hindi
    if (['kha', 'lus', 'nag', 'ny', 'hi', 'as', 'bn', 'ne', 'mni'].includes(languageCode)) {
      let matched = voices.find(
        v => v.lang.toLowerCase().includes('in') || v.name.toLowerCase().includes('india') || v.lang.toLowerCase().startsWith('hi')
      );
      if (matched) return matched;
    }

    // 4. Any English voice
    let matched = voices.find(v => v.lang.toLowerCase().startsWith('en'));
    if (matched) return matched;

    // 5. Default first available voice
    return voices[0] || null;
  },

  speak(
    text: string,
    languageCode = 'as',
    speed = 0.88,
    enabled = true,
    onEnd?: () => void
  ): boolean {
    if (!enabled || !text) return false;

    // Ensure synth instance
    if (!synth && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synth = window.speechSynthesis;
    }
    if (!synth) return false;

    try {
      synth.cancel(); // Stop active speech

      // Sanitize Khasi / Mizo / regional diacritics for TTS engine compatibility (e.g. ï -> i, ṭ -> t, ê -> e)
      const cleanText = text
        .replace(/ï/g, 'i')
        .replace(/Ï/g, 'I')
        .replace(/ṭ/g, 't')
        .replace(/Ṭ/g, 'T')
        .replace(/ê/g, 'e')
        .replace(/Ê/g, 'E')
        .replace(/â/g, 'a')
        .replace(/Â/g, 'A')
        .replace(/î/g, 'i')
        .replace(/Î/g, 'I')
        .replace(/ô/g, 'o')
        .replace(/Ô/g, 'O')
        .replace(/û/g, 'u')
        .replace(/Û/g, 'U');

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = speed;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voice = this.getBestVoice(languageCode);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        // Fallback target language codes
        if (['as', 'bn', 'mni'].includes(languageCode)) {
          utterance.lang = 'bn-IN';
        } else if (['hi', 'ne', 'ny', 'nag', 'kha', 'lus'].includes(languageCode)) {
          utterance.lang = 'en-IN';
        } else {
          utterance.lang = 'en-IN';
        }
      }

      if (onEnd) {
        utterance.onend = onEnd;
        utterance.onerror = onEnd;
      }

      synth.speak(utterance);
      return true;
    } catch (e) {
      console.warn('Text-to-speech error:', e);
      return false;
    }
  },

  stop(): void {
    if (synth) {
      synth.cancel();
    }
  },
};
