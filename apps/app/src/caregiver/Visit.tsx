import { hasConsent } from '@hillpath/core';
import type { AppCore } from '../lib/core';
import { getSettings } from '../lib/care';
import { go } from '../lib/router';
import { useVersion } from '../lib/state';
import { ReportPanel } from '../report/Panel';
import { BigButton, StateNote } from '../ui/kit';
import { MonthlyCheck } from './Check';

/**
 * Home visit for a community health worker: check that the person agreed to a health worker seeing their information,
 * run the monthly check with a picture and a spoken line for each step, then make the report for the doctor.
 */
export function VisitMode({ core }: { core: AppCore }) {
  useVersion();
  const s = getSettings(core);
  if (!s) return <StateNote kind="empty" title="This phone has no family yet." body="Ask the family to pair this phone with theirs (Share, Pair a device), then open Visit again." />;
  const agreed = hasConsent(core.replica, s.patient_id, 'health_worker');
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="h-consent" className="card" data-testid="visit-consent">
        <h2 id="h-consent" className="text-2xl font-bold">Before you start</h2>
        <p className="mt-2">
          {agreed
            ? `${s.patient_name || 'The person'} or their family agreed that a community health worker may see this information.`
            : `${s.patient_name || 'The person'} has not agreed yet that a community health worker may see this information. Ask them, or their family, to switch it on in Privacy. Do not continue until they have.`}
        </p>
        {!agreed && <BigButton className="mt-3" onClick={() => go('caregiver', 'privacy')}>Open Privacy</BigButton>}
      </section>
      {agreed && (
        <>
          <MonthlyCheck core={core} visit />
          <ReportPanel core={core} />
        </>
      )}
    </div>
  );
}
