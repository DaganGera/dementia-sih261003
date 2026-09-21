import { useEffect, useRef, useState } from 'react';
import { ACTIVITIES, CLOSING, HOW, LANGUAGES, OFFLINE, PROBLEM, SCREENING } from '../content';
import shots from '../shots.json';

const APP = __APP_URL__;
const REPO = __REPO_URL__;
const CONTACT = __CONTACT_EMAIL__;

const shot = (key: string) => `/media/app/${key}.webp`;
const dims = (key: string) => (shots as Record<string, { width: number; height: number }>)[key] ?? { width: 824, height: 1830 };

/** A real capture from the built app, with the caption underneath and never over the picture. */
function Capture({ name, alt, caption, className = '' }: { name: string; alt: string; caption?: string; className?: string }) {
  const d = dims(name);
  return (
    <figure className={className}>
      <img src={shot(name)} alt={alt} width={d.width} height={d.height} loading="lazy" decoding="async" className="h-auto w-full rounded-2xl border border-line" />
      {caption && <figcaption className="mt-3 text-sm text-muted">{caption}</figcaption>}
    </figure>
  );
}

const band = 'relative z-10 bg-background';
const wrap = 'mx-auto max-w-7xl px-6';

/** A transparent stretch where the fixed film shows between opaque sections. */
export function Gap() {
  return <div aria-hidden="true" className="h-[24dvh]" />;
}

export function Problem() {
  return (
    <section id="problem" className={`${band} py-32`}>
      <div className={wrap}>
        <p className="reveal font-display text-8xl tracking-tight text-ink md:text-9xl tnum">{PROBLEM.figure}</p>
        <h2 className="reveal mt-4 max-w-3xl font-display text-4xl text-ink md:text-6xl" style={{ ['--i' as string]: 1 }}>{PROBLEM.headline}</h2>
        <div className="mt-12 max-w-2xl space-y-4 text-lg leading-relaxed text-muted">
          {PROBLEM.body.map((b, i) => (
            <p key={b} className="reveal" style={{ ['--i' as string]: i + 2 }}>{b}</p>
          ))}
        </div>
        <ul className="mt-10 flex flex-col gap-2 text-sm">
          {PROBLEM.sources.map((s) => (
            <li key={s.href}>
              <a className="underline underline-offset-4" href={s.href} target="_blank" rel="noreferrer noopener">{s.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function How() {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLLIElement | null>>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: '-40% 0px -40% 0px' },
    );
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);
  return (
    <section id="how" className={`${band} py-32`}>
      <div className={wrap}>
        <h2 className="reveal max-w-3xl font-display text-4xl text-ink md:text-6xl">{HOW.headline}</h2>
        <div className="mt-16 grid gap-12 md:grid-cols-2 md:gap-24">
          <ol className="flex flex-col gap-24 md:gap-48">
            {HOW.blocks.map((b, i) => (
              <li key={b.title} ref={(el) => { refs.current[i] = el; }} data-i={i} className="reveal">
                <h3 className="font-display text-3xl text-ink">{b.title}</h3>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">{b.body}</p>
                <Capture name={b.image} alt={b.alt} className="mt-8 max-w-xs md:hidden" caption="Screen from the app." />
              </li>
            ))}
          </ol>
          <div className="relative hidden md:block">
            <div className="sticky top-28">
              <div className="relative mx-auto aspect-[824/1830] max-h-[80dvh]">
                {HOW.blocks.map((b, i) => (
                  <img
                    key={b.image}
                    src={shot(b.image)}
                    alt={b.alt}
                    width={dims(b.image).width}
                    height={dims(b.image).height}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full rounded-2xl border border-line object-contain"
                    style={{ opacity: active === i ? 1 : 0, transition: 'opacity var(--dur-2) var(--ease)' }}
                    aria-hidden={active !== i}
                  />
                ))}
              </div>
              <p className="mt-3 text-center text-sm text-muted">Screen from the app.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Activities() {
  return (
    <section id="activities" className={`${band} py-32`}>
      <div className={wrap}>
        <h2 className="reveal max-w-3xl font-display text-4xl text-ink md:text-6xl">{ACTIVITIES.headline}</h2>
        <p className="reveal mt-6 max-w-2xl text-lg leading-relaxed text-muted" style={{ ['--i' as string]: 1 }}>{ACTIVITIES.body}</p>
      </div>
      <ul
        className="mt-12 flex snap-x snap-mandatory items-start gap-6 overflow-x-auto px-6 pb-8 lg:px-24"
        tabIndex={0}
        aria-label="Activities, scroll sideways"
      >
        {ACTIVITIES.items.map((g) => (
          <li key={g.key} className="w-64 shrink-0 snap-start md:w-72">
            <Capture name={g.key} alt={g.alt} />
            <p className="mt-4 font-display text-2xl text-ink">{g.name}</p>
            <p className="text-sm text-muted">{g.approach}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Languages() {
  return (
    <section id="languages" className={`${band} py-32`}>
      <div className={wrap}>
        <h2 className="reveal max-w-3xl font-display text-4xl text-ink md:text-6xl">{LANGUAGES.headline}</h2>
        <p className="reveal mt-6 max-w-2xl text-lg leading-relaxed text-ink" style={{ ['--i' as string]: 1 }}>{LANGUAGES.body}</p>
        <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
          {LANGUAGES.list.map((l) => (
            <div key={l.code} className="reveal">
              <dt className="font-display text-3xl text-ink">{l.name}</dt>
              <dd className="mt-1 text-sm text-ink">
                <span className="tnum">{l.code}</span>. {l.status}
              </dd>
            </div>
          ))}
        </dl>
        {CONTACT && (
          <p className="mt-12 text-base text-ink">
            Speak one of these languages and want to help? <a className="underline underline-offset-4" href={`mailto:${CONTACT}`}>Write to us</a>.
          </p>
        )}
      </div>
    </section>
  );
}

export function Screening() {
  return (
    <section id="screening" className={`${band} py-32`}>
      <div className={`${wrap} grid gap-16 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-start`}>
        <div>
          <h2 className="reveal font-display text-4xl text-ink md:text-6xl">{SCREENING.headline}</h2>
          <p className="reveal mt-6 max-w-2xl text-lg leading-relaxed text-muted" style={{ ['--i' as string]: 1 }}>{SCREENING.body}</p>
          <dl className="mt-12 max-w-2xl divide-y divide-line">
            {SCREENING.items.map((it, i) => (
              <div key={it.term} className="reveal py-5" style={{ ['--i' as string]: i }}>
                <dt className="flex flex-wrap items-baseline gap-x-3 text-xl text-ink">
                  {it.term}
                  <span className="rounded-full border border-line px-3 py-0.5 text-sm text-ink">{it.tag}</span>
                </dt>
                <dd className="mt-1 text-base text-muted">{it.note}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8">
            <a className="underline underline-offset-4" href={SCREENING.link.href}>{SCREENING.link.label}</a>
          </p>
        </div>
        <Capture name="screening" alt={SCREENING.alt} caption="Screen from the app. Simulated model." className="max-w-xs" />
      </div>
    </section>
  );
}

export function Offline() {
  return (
    <section id="offline" className={`${band} py-32`}>
      <div className={`${wrap} grid gap-16 md:grid-cols-2 md:items-center`}>
        <Capture name="sync" alt={OFFLINE.alt} caption="Screen from the app." className="max-w-xs md:order-first" />
        <div>
          <h2 className="reveal font-display text-4xl text-ink md:text-6xl">{OFFLINE.headline}</h2>
          <ul className="mt-10 space-y-5 text-lg leading-relaxed text-muted">
            {OFFLINE.facts.map((f, i) => (
              <li key={f} className="reveal" style={{ ['--i' as string]: i + 1 }}>{f}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <section id="try" className="relative z-10 flex min-h-[80dvh] flex-col items-center justify-center px-6 py-32 text-center">
      <h2 className="reveal max-w-3xl font-display text-5xl text-ink md:text-7xl">{CLOSING.headline}</h2>
      <a href={APP} className="reveal mt-12 inline-flex rounded-full bg-black px-14 py-5 text-base text-white transition-transform hover:scale-[1.03]" style={{ ['--i' as string]: 1 }}>
        {CLOSING.cta}
      </a>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={`${band} border-t border-line py-12`}>
      <div className={`${wrap} flex flex-col gap-6 text-sm text-muted`}>
        <p className="max-w-2xl">{CLOSING.note}</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3">
          <a className="inline-flex min-h-11 items-center underline underline-offset-4" href="/privacy/">Privacy</a>
          <a className="inline-flex min-h-11 items-center underline underline-offset-4" href="/limitations/">Limitations</a>
          <a className="inline-flex min-h-11 items-center underline underline-offset-4" href="/credits/">Credits</a>
          {REPO && <a className="inline-flex min-h-11 items-center underline underline-offset-4" href={REPO} target="_blank" rel="noreferrer noopener">Source code</a>}
        </nav>
      </div>
    </footer>
  );
}
