import { ArrowLeft, ShareFat, SpeakerHigh, X } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
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

const IOS_HINT_KEY = 'hillpath-ios-install-hint-dismissed';

function isIosSafariBrowserTab() {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  return isIos && !standalone;
}

/** iOS Safari has no automatic install prompt, unlike Android. This tells people how to add Hillpath to their home screen. */
export function IosInstallHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (isIosSafariBrowserTab() && localStorage.getItem(IOS_HINT_KEY) !== '1') setShow(true);
  }, []);
  if (!show) return null;
  const dismiss = () => {
    localStorage.setItem(IOS_HINT_KEY, '1');
    setShow(false);
  };
  return (
    <div role="note" className="card mx-auto mt-4 flex max-w-2xl items-start gap-3">
      <ShareFat size={28} aria-hidden />
      <p className="flex-1 text-base">To add Hillpath to your home screen, tap Share, then Add to Home Screen.</p>
      <BigButton onClick={dismiss} aria-label="Close this tip" className="btn-quiet">
        <X size={24} aria-hidden />
      </BigButton>
    </div>
  );
}
