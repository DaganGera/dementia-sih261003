import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AccessibilitySettings } from '../types';
import { StorageService } from '../services/storage';
import { SpeechService } from '../services/speech';

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  setTextSize: (size: 'small' | 'medium' | 'large') => void;
  toggleHighContrast: () => void;
  toggleVoiceGuidance: () => void;
  speak: (text: string, lang?: string) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    return StorageService.getAccessibility();
  });

  useEffect(() => {
    StorageService.saveAccessibility(settings);
    
    // Apply high contrast class to document html/body root
    if (settings.highContrast) {
      document.documentElement.classList.add('high-contrast-mode');
    } else {
      document.documentElement.classList.remove('high-contrast-mode');
    }

    // Apply text size root attribute
    document.documentElement.setAttribute('data-text-size', settings.textSize);
  }, [settings]);

  const setTextSize = (textSize: 'small' | 'medium' | 'large') => {
    setSettings(prev => ({ ...prev, textSize }));
  };

  const toggleHighContrast = () => {
    setSettings(prev => ({ ...prev, highContrast: !prev.highContrast }));
  };

  const toggleVoiceGuidance = () => {
    setSettings(prev => {
      const next = !prev.voiceGuidance;
      if (next) {
        SpeechService.speak('Voice guidance active.');
      } else {
        SpeechService.stop();
      }
      return { ...prev, voiceGuidance: next };
    });
  };

  const speak = (text: string, lang?: string) => {
    SpeechService.speak(text, settings.voiceGuidance, lang);
  };

  return (
    <AccessibilityContext.Provider
      value={{
        settings,
        setTextSize,
        toggleHighContrast,
        toggleVoiceGuidance,
        speak,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
};
