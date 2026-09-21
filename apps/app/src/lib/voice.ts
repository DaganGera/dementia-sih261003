import type { AppCore } from './core';

/**
 * Prompts are spoken by a family recording when one exists for the key, otherwise by the device's own
 * English voice. Only English is supported in this build; other languages are Planned.
 */
let current: HTMLAudioElement | null = null;

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
  if (current) {
    current.pause();
    current = null;
  }
}

export function speak(text: string): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-IN';
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

export const recordingId = (key: string) => `voice:${key}`;

/** Play the family recording for `key` if there is one, else speak `text`. */
export async function say(core: AppCore, key: string, text: string): Promise<void> {
  stopSpeaking();
  try {
    const blob = await core.loadMedia(recordingId(key));
    if (blob) {
      const a = new Audio(URL.createObjectURL(blob));
      current = a;
      await a.play();
      return;
    }
  } catch {
    // Fall through to the device voice.
  }
  speak(text);
}

export interface Recorder {
  stop: () => Promise<Blob>;
}

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  rec.start();
  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
        };
        rec.stop();
      }),
  };
}

/** Prompts a caregiver can record in their own voice. */
export const CORE_PROMPTS: Array<{ key: string; text: string }> = [
  { key: 'greeting', text: 'Hello. It is good to see you. Would you like to play a little?' },
  { key: 'well-done', text: 'That was lovely. That is enough for now. Thank you for playing.' },
  { key: 'reminder-medicine', text: 'It is time for your medicine.' },
  { key: 'reminder-water', text: 'It is time for a drink.' },
  { key: 'reminder-activity', text: 'It is time for your activity.' },
  { key: 'help-sent', text: 'I have told your family. They will come soon.' },
];
