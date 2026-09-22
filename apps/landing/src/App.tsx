import { lazy, Suspense } from 'react';
import { Hero } from './components/Hero';
import { Nav } from './components/Nav';
import { Activities, Closing, Download, Footer, Gap, How, Languages, Offline, Problem, Screening } from './components/Sections';
import { useReveal } from './components/useReveal';

// The film code (and the motion library) loads after the first paint, so the poster and headline are never waiting on it.
const HeroJourney = lazy(() => import('./journey/HeroJourney').then((m) => ({ default: m.HeroJourney })));

export function App() {
  useReveal();
  return (
    <>
      <Suspense fallback={null}>
        <HeroJourney />
      </Suspense>
      <Nav />
      <main id="main" className="relative z-10">
        <Hero />
        <Problem />
        <Gap />
        <How />
        <Gap />
        <Activities />
        <Gap />
        <Languages />
        <Gap />
        <Screening />
        <Gap />
        <Offline />
        <Gap />
        <Download />
        <Closing />
      </main>
      <Footer />
    </>
  );
}
