import { ArrowLeft, SpeakerHigh } from '@phosphor-icons/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function BigButton({ primary, className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <button type="button" {...p} className={`btn ${primary ? 'btn-primary' : ''} ${className}`} />;
}

/** Patient screen shell: one heading, a voice replay button, and a back link when there is somewhere to go. */
export function PatientScreen({ title, children, onBack, onHear }: { title: string; children: ReactNode; onBack?: () => void; onHear?: () => void }) {
  return (
    <main className="patient fade-in mx-auto flex min-h-[100dvh] max-w-2xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center gap-3">
        {onBack && (
          <BigButton onClick={onBack} aria-label="Go back" className="btn-quiet">
            <ArrowLeft size={32} aria-hidden />
          </BigButton>
        )}
        <h1 className="flex-1">{title}</h1>
        {onHear && (
          <BigButton onClick={onHear} aria-label="Hear this again" className="btn-quiet">
            <SpeakerHigh size={32} aria-hidden />
          </BigButton>
        )}
      </header>
      {children}
    </main>
  );
}

export function SimulatedRibbon({ text = 'Simulated data' }: { text?: string }) {
  return (
    <p role="note" className="rounded-input bg-surface px-3 py-2 text-base font-bold text-ink">
      {text}
    </p>
  );
}

export function StateNote({ kind, title, body, action }: { kind: 'loading' | 'empty' | 'error' | 'offline'; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card" role={kind === 'error' ? 'alert' : 'status'} data-state={kind}>
      <p className="text-xl font-bold">{title}</p>
      {body && <p className="mt-2 text-lg">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-input border border-line px-2 py-1 text-sm font-bold">{children}</span>;
}
