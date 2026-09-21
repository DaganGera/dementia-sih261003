import { List, X } from '@phosphor-icons/react';
import { useRef } from 'react';
import { NAV, NAV_CTA } from '../content';

const APP = __APP_URL__;

export function Nav() {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 lg:px-8">
        <a href="/" className="font-display text-3xl tracking-tight text-ink">Hillpath</a>
        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {NAV.map((n, i) => (
            <a key={n.href} href={n.href} className={`text-sm transition-colors hover:text-ink ${i === 0 ? 'text-ink' : 'text-muted'}`}>
              {n.label}
            </a>
          ))}
        </nav>
        <a href={APP} className="hidden rounded-full bg-black px-6 py-2.5 text-sm text-white transition-transform hover:scale-[1.03] lg:inline-flex">
          {NAV_CTA}
        </a>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line lg:hidden"
          aria-label="Open the menu"
          aria-haspopup="dialog"
          onClick={() => dialog.current?.showModal()}
        >
          <List size={24} aria-hidden />
        </button>
      </div>
      <dialog ref={dialog} aria-label="Menu" className="m-0 h-[100dvh] w-full max-w-none bg-white p-6 text-ink backdrop:bg-black/20" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className="flex justify-end">
          <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line" aria-label="Close the menu" onClick={() => dialog.current?.close()}>
            <X size={24} aria-hidden />
          </button>
        </div>
        <nav aria-label="Menu" className="mt-6 flex flex-col">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="flex min-h-14 items-center font-display text-4xl" onClick={() => dialog.current?.close()}>
              {n.label}
            </a>
          ))}
          <a href={APP} className="mt-8 inline-flex min-h-14 items-center justify-center rounded-full bg-black px-8 text-base text-white">{NAV_CTA}</a>
        </nav>
      </dialog>
    </header>
  );
}
