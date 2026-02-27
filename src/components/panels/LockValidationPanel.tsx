import { Stage, Step } from '../../types';
import { hasValidLockSequence } from '../../algorithms/lock-validation';
import { resourcePathString } from '../../algorithms/resources';
import { getChainColor } from '../../utils/colors';

interface Props {
  stage: Stage;
  stepIndex: number;
}

export default function LockValidationPanel({ stage, stepIndex }: Props) {
  // Flatten all chains that have locks into a combined view
  const chainsWithLocks = stage.chains
    .map((chain, idx) => ({ chain, idx }))
    .filter(({ chain }) =>
      chain.some(g => g.some(s =>
        s.resources.accesses.length > 0 || s.resources.releases.length > 0
      ))
    );

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {chainsWithLocks.map(({ chain, idx: chainIdx }) => {
        const steps: Step[] = [];
        for (const group of chain) steps.push(...group);
        const { trace } = hasValidLockSequence(steps);
        const visibleSteps = trace.steps.slice(0, stepIndex || trace.steps.length);

        return (
          <div key={chainIdx} className="space-y-2">
            <div className="text-xs text-slate-400">
              Chain {chainIdx}
              <span className={`ml-2 font-medium ${trace.valid ? 'text-green-400' : 'text-red-400'}`}>
                {trace.valid ? 'valid' : 'invalid'}
              </span>
            </div>

            <div className="space-y-0.5">
              {visibleSteps.map((ts, i) => {
                const isActive = i === (stepIndex > 0 ? stepIndex - 1 : visibleSteps.length - 1);

                return (
                  <div
                    key={i}
                    className={`text-xs rounded border p-2 transition-all ${
                      !ts.valid
                        ? 'border-red-500/50 bg-red-500/10'
                        : isActive
                          ? 'border-blue-500/50 bg-blue-500/5'
                          : 'border-slate-700 bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-slate-500 w-4">{i}</span>
                      <span className="text-slate-300 truncate">{ts.stepDescription}</span>
                    </div>

                    {/* Acquires */}
                    {ts.accessesProcessed.map((ap, j) => (
                      <div key={`a${j}`} className="ml-6 flex items-center gap-1">
                        <span className={ap.accepted ? 'text-amber-400' : 'text-red-400'}>
                          {ap.accepted ? '+' : 'X'}
                        </span>
                        <span className="text-slate-400">
                          acquire {ap.access.lock ? 'lock' : 'access'}:
                        </span>
                        <span className="font-mono text-slate-300">
                          {ap.access.action}({resourcePathString(ap.access.path)})
                        </span>
                        {!ap.accepted && ap.conflictWith && (
                          <span className="text-red-300 ml-1">
                            conflicts with held {ap.conflictWith.action}({resourcePathString(ap.conflictWith.path)})
                          </span>
                        )}
                      </div>
                    ))}

                    {/* Releases */}
                    {ts.releasesProcessed.map((rp, j) => (
                      <div key={`r${j}`} className="ml-6 flex items-center gap-1">
                        <span className={rp.wasHeld && rp.lockTypeMatch ? 'text-green-400' : 'text-red-400'}>
                          {rp.wasHeld && rp.lockTypeMatch ? '-' : 'X'}
                        </span>
                        <span className="text-slate-400">release:</span>
                        <span className="font-mono text-slate-300">
                          {rp.release.action}({resourcePathString(rp.release.path)})
                        </span>
                        {!rp.wasHeld && <span className="text-red-300 ml-1">not held!</span>}
                      </div>
                    ))}

                    {/* Held resources after this step */}
                    {ts.heldAfter.size > 0 && (
                      <div className="ml-6 mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                        held:
                        {Array.from(ts.heldAfter.values()).map((res, k) => (
                          <span key={k} className="font-mono px-1 py-0.5 rounded bg-slate-700 text-slate-400">
                            {resourcePathString(res.path)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {chainsWithLocks.length === 0 && (
        <div className="text-xs text-slate-500">No chains have resource locks to validate.</div>
      )}
    </div>
  );
}
