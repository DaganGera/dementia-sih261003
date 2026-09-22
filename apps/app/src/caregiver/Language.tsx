import { LANGUAGES } from '@hillpath/core';
import type { AppCore } from '../lib/core';
import { activeLang, effectiveTier, rollbackInstalledPack, setActiveLang, tierNotice, packState } from '../lib/i18n';
import { useVersion } from '../lib/state';
import { BigButton } from '../ui/kit';

/**
 * The interface language for this device. English is built in and fully checked. Every other language is Planned:
 * the tier and pack signing exist so a real translation can be added later, but none has been reviewed yet, so none
 * ships text. See implementation_plan.md 8.1 to 8.3.
 */
export function LanguagePicker({ core }: { core: AppCore }) {
  useVersion();
  const active = activeLang(core);

  return (
    <section aria-labelledby="h-lang" className="card flex flex-col gap-3">
      <h2 id="h-lang" className="text-2xl font-bold">Language on this device</h2>
      <ul className="flex flex-col gap-2" aria-label="Languages">
        {LANGUAGES.map((l) => {
          const tier = effectiveTier(core, l.code);
          const notice = tierNotice(tier);
          const canUse = tier !== 'T0';
          const isActive = active === l.code;
          const canRollback = packState(core, l.code).previous !== null;
          return (
            <li key={l.code} className="flex flex-wrap items-center justify-between gap-3">
              <span>
                <strong>{l.name}</strong>
                {notice && <><br /><span className="text-sm text-muted">{notice}</span></>}
              </span>
              <span className="flex gap-2">
                {canRollback && (
                  <BigButton className="btn-quiet text-lg" onClick={() => void rollbackInstalledPack(core, l.code)}>Undo last update</BigButton>
                )}
                <BigButton
                  aria-pressed={isActive}
                  primary={isActive}
                  disabled={!canUse && !isActive}
                  className="text-lg"
                  onClick={() => void setActiveLang(core, l.code)}
                >
                  {isActive ? 'In use' : canUse ? 'Use this language' : 'Planned'}
                </BigButton>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
