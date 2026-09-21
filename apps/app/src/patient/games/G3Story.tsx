import { useEffect, useMemo, useRef, useState } from 'react';
import { STORIES, type StoryQuestion } from '../../content/stories';
import { BigButton } from '../../ui/kit';
import type { RoundProps, TrialResult } from './engine';

type Phase = 'read' | 'rest' | 'ask';
const REST_SECONDS = [0, 6, 12];

/** Read or hear a short story, optionally rest, then answer questions. A miss shows the sentence again, never a cross. */
export function G3Story({ level, onDone, speak }: RoundProps) {
  const { sentences = 3, options = 3, delay = 0 } = level.design;
  const story = useMemo(() => STORIES[Math.floor(Math.random() * STORIES.length)]!, []);
  const lines = useMemo(() => story.sentences.slice(0, sentences), [story, sentences]);
  const questions = useMemo(() => story.questions.filter((q) => q.at < sentences).sort(() => Math.random() - 0.5).slice(0, 2), [story, sentences]);
  const [phase, setPhase] = useState<Phase>('read');
  const [qi, setQi] = useState(0);
  const q: StoryQuestion = questions[qi] ?? questions[0]!;
  const shown = useShuffled(q, options);
  const [revealed, setRevealed] = useState<string | null>(null);
  const results = useRef<TrialResult[]>([]);
  const askedAt = useRef(0);

  useEffect(() => {
    if (phase === 'read') speak(`${story.title}. ${lines.join(' ')}`);
  }, [phase, speak, story, lines]);

  useEffect(() => {
    if (phase !== 'rest') return;
    const t = window.setTimeout(() => setPhase('ask'), (REST_SECONDS[delay] ?? 0) * 1000);
    return () => window.clearTimeout(t);
  }, [phase, delay]);

  useEffect(() => {
    if (phase === 'ask') {
      askedAt.current = Date.now();
      speak(q.question);
    }
  }, [phase, q, speak]);

  if (phase === 'read') {
    return (
      <section aria-label="Story">
        <h2 className="mb-3">{story.title}</h2>
        <p className="card leading-relaxed">{lines.join(' ')}</p>
        <div className="mt-4 flex flex-col gap-3">
          <BigButton onClick={() => speak(`${story.title}. ${lines.join(' ')}`)}>Hear the story again</BigButton>
          <BigButton primary onClick={() => setPhase(delay > 0 ? 'rest' : 'ask')}>I am ready for the questions</BigButton>
        </div>
      </section>
    );
  }
  if (phase === 'rest') {
    return (
      <section aria-label="A short rest">
        <p className="card">Let us rest our eyes for a moment. The questions come next.</p>
        <div className="mt-4">
          <BigButton primary onClick={() => setPhase('ask')}>Ask me now</BigButton>
        </div>
      </section>
    );
  }

  const answer = (opt: string) => {
    if (revealed) return;
    setRevealed(opt);
    results.current.push({ correct: opt === q.options[0], rt_ms: Date.now() - askedAt.current, hint_used: false, chance: 1 / shown.length });
    window.setTimeout(() => {
      setRevealed(null);
      if (qi + 1 >= questions.length) onDone(results.current);
      else setQi(qi + 1);
    }, opt === q.options[0] ? 1200 : 3000);
  };

  return (
    <section aria-label="Question">
      <p className="mb-4 text-2xl font-bold">{q.question}</p>
      <ul className="flex flex-col gap-3">
        {shown.map((o) => (
          <li key={o}>
            <button type="button" className={`btn w-full ${revealed && o === q.options[0] ? 'btn-primary' : ''}`} disabled={revealed !== null && o !== q.options[0]} onClick={() => answer(o)}>
              {o}
            </button>
          </li>
        ))}
      </ul>
      {revealed && revealed !== q.options[0] && (
        <p className="card mt-4" role="status">
          The story said: {story.sentences[q.at]}
        </p>
      )}
    </section>
  );
}

function useShuffled(q: StoryQuestion, options: number): string[] {
  return useMemo(() => [q.options[0], ...q.options.slice(1, options)].sort(() => Math.random() - 0.5), [q, options]);
}
