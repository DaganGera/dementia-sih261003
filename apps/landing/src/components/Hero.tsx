import { HERO } from '../content';

/**
 * Hero values follow the spec: paddingTop calc(8rem - 75px), pb-40, centred, headline 5xl / 7xl / 8xl,
 * line-height 0.95, letter-spacing -2.46px at md and up, #6F6F6F italic emphasis, fade-rise timings.
 */
export function Hero() {
  return (
    <section className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-start px-6 pb-40 text-center" style={{ paddingTop: 'calc(8rem - 75px)' }}>
      <h1 className="animate-fade-rise max-w-7xl font-display text-5xl font-normal text-ink hero-title sm:text-7xl md:text-8xl" style={{ lineHeight: 0.95 }}>
        {HERO.lead}
        <em className="italic text-muted">{HERO.em1}</em>
        {HERO.mid}
        <em className="italic text-muted">{HERO.em2}</em>
      </h1>
      <p className="animate-fade-rise-delay mt-8 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{HERO.body}</p>
      <a
        href="#how"
        className="animate-fade-rise-delay-2 mt-12 inline-flex rounded-full bg-black px-14 py-5 text-base text-white transition-transform hover:scale-[1.03]"
      >
        {HERO.cta}
      </a>
    </section>
  );
}
