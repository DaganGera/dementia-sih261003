import { isScored, type ScoredGameId } from '@hillpath/contracts';
import { useState } from 'react';
import { Dashboard } from './caregiver/Dashboard';
import { MonthlyCheck } from './caregiver/Check';
import { ContentSetup } from './caregiver/Content';
import { FamilySetup } from './caregiver/Family';
import { PrivacyPanel } from './caregiver/Privacy';
import { ReminderManager } from './caregiver/Reminders';
import { VisitMode } from './caregiver/Visit';
import { ReportPanel } from './report/Panel';
import { ReportViewer } from './report/Viewer';
import { TimeMachine } from './caregiver/TimeMachine';
import { go, useRoute } from './lib/router';
import { useCore, useVersion } from './lib/state';
import { PatientDay } from './patient/Day';
import { GameRunner } from './patient/games/engine';
import { LifeStory, SongCircle } from './patient/games/Unscored';
import { PatientHome } from './patient/Home';
import { CoPlayRound, PatientPostcards } from './patient/Social';
import { SocialSetup } from './caregiver/Social';
import { BigButton, PatientScreen } from './ui/kit';
import { SyncPanel } from './ui/Sync';

export function App() {
  const core = useCore();
  useVersion();
  const route = useRoute();
  if (route[0] === 'demo') return <TimeMachine />;
  if (route[0] === 'report') return <ReportViewer />;
  if (!core.role) return <RoleChooser />;
  if (core.role === 'patient') return <PatientApp route={route} />;
  // Family members can try the activities exactly as the person sees them.
  if (route[0] === 'patient') return <PatientApp route={route} preview />;
  return <CaregiverApp route={route} />;
}

function RoleChooser() {
  const core = useCore();
  return (
    <main className="patient mx-auto flex min-h-[100dvh] max-w-2xl flex-col gap-4 px-4 py-8">
      <h1>Welcome to Hillpath</h1>
      <p>Who will use this device?</p>
      <BigButton primary onClick={() => void core.setRole('patient').then(() => go('patient'))} className="w-full">The person who will play</BigButton>
      <BigButton onClick={() => void core.setRole('caregiver').then(() => go('caregiver', 'home'))} className="w-full">A family member</BigButton>
      <BigButton onClick={() => void core.setRole('health_worker').then(() => go('caregiver', 'visit'))} className="w-full">A community health worker</BigButton>
      <p className="text-base text-muted">Hillpath is a prototype for memory activities and family support. It is not a medical device and does not diagnose. Everything works without internet.</p>
    </main>
  );
}

function PatientApp({ route, preview = false }: { route: string[]; preview?: boolean }) {
  const core = useCore();
  if (route[1] === 'play' && route[2] && isScored(route[2])) return <GameRunner key={route[2]} core={core} gameId={route[2] as ScoredGameId} />;
  if (route[1] === 'play' && route[2] === 'G9') return <LifeStory core={core} />;
  if (route[1] === 'play' && route[2] === 'G10') return <SongCircle core={core} />;
  if (route[1] === 'postcards') return <PatientPostcards core={core} />;
  if (route[1] === 'together' && route[2]) return <CoPlayRound key={route[2]} core={core} seed={Number(route[2])} coplayId={route[3]} />;
  if (route[1] === 'day') return <PatientDay core={core} />;
  if (route[1] === 'family') return <FamilyGate />;
  return (
    <>
      <PatientHome core={core} />
      <p className="mx-auto max-w-2xl px-4 pb-8 text-center">
        {preview ? (
          <a className="text-base underline" href="#/caregiver/home">Back to the family view</a>
        ) : (
          <a className="text-base underline" href="#/patient/family">For family</a>
        )}
      </p>
    </>
  );
}

function FamilyGate() {
  const core = useCore();
  return (
    <PatientScreen title="For family" onBack={() => go('patient')}>
      <SyncPanel core={core} />
    </PatientScreen>
  );
}

const TABS: Array<[string, string]> = [
  ['home', 'Home'],
  ['reminders', 'Reminders'],
  ['family', 'Family'],
  ['check', 'Monthly check'],
  ['share', 'Share'],
  ['privacy', 'Privacy'],
];

function CaregiverApp({ route }: { route: string[] }) {
  const core = useCore();
  const TABS_ALL: Array<[string, string]> = core.role === 'health_worker' ? [['visit', 'Visit'], ...TABS] : TABS;
  const tab = TABS_ALL.some(([k]) => k === route[1]) ? route[1]! : core.role === 'health_worker' ? 'visit' : 'home';
  const [open, setOpen] = useState(false);
  void open;
  void setOpen;
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold">Hillpath</h1>
        <nav aria-label="Sections" className="mt-3 flex flex-wrap gap-2">
          {TABS_ALL.map(([k, label]) => (
            <a key={k} href={`#/caregiver/${k}`} aria-current={tab === k ? 'page' : undefined} className={`btn ${tab === k ? 'btn-primary' : 'btn-quiet'} text-lg`} style={{ minHeight: 48 }}>
              {label}
            </a>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'visit' && <VisitMode core={core} />}
        {tab === 'home' && (
          <div className="flex flex-col gap-6">
            <Dashboard core={core} />
            <ReportPanel core={core} />
          </div>
        )}
        {tab === 'reminders' && <ReminderManager core={core} />}
        {tab === 'family' && (
          <div className="flex flex-col gap-8">
            <FamilySetup core={core} />
            <ContentSetup core={core} />
            <SocialSetup core={core} />
          </div>
        )}
        {tab === 'check' && <MonthlyCheck core={core} />}
        {tab === 'share' && <SyncPanel core={core} />}
        {tab === 'privacy' && <PrivacyPanel core={core} />}
      </main>
      <footer className="mt-8 text-sm text-muted">
        <p>Hillpath is a prototype. It is not a medical device and does not diagnose. <a className="underline" href="#/patient">Try the activities as the person sees them</a>. <a className="underline" href="#/demo">Open the simulation</a>.</p>
      </footer>
    </div>
  );
}
