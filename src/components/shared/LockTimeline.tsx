import { Step, Chain } from '../../types';
import { hasValidLockSequence, LockValidationTrace } from '../../algorithms/lock-validation';
import { getResourceColor } from '../../utils/colors';
import { resourcePathString, resourceAccessString } from '../../algorithms/resources';
import ResourceBadge from './ResourceBadge';

interface Props {
  chain: Chain;
  highlightStep: number;
}

export default function LockTimeline({ chain, highlightStep }: Props) {
  // Flatten chain to steps
  const steps: Step[] = [];
  for (const group of chain) {
    steps.push(...group);
  }

  const { trace } = hasValidLockSequence(steps);
  const visibleSteps = trace.steps.slice(0, highlightStep || trace.steps.length);

  return (
    <div className="space-y-2 overflow-x-auto">
      {/* Step cards */}
      <div className="flex gap-2 min-w-max pb-2">
        {visibleSteps.map((traceStep, idx) => (
          <div
            key={idx}
            className={`flex-shrink-0 w-48 rounded border p-2 transition-all duration-200 ${
              !traceStep.valid
                ? 'border-red-500 bg-red-500/10'
                : idx === highlightStep - 1
                  ? 'border-blue-400 bg-blue-400/10'
                  : 'border-slate-600 bg-slate-800/50'
            }`}
          >
            <div className="text-xs font-medium text-slate-300 truncate mb-1" title={traceStep.stepDescription}>
              {traceStep.stepDescription}
            </div>

            {/* Accesses */}
            {traceStep.accessesProcessed.length > 0 && (
              <div className="space-y-0.5 mb-1">
                <div className="text-[10px] text-slate-500">Acquire:</div>
                {traceStep.accessesProcessed.map((ap, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <ResourceBadge access={ap.access} compact />
                    {!ap.accepted && (
                      <span className="text-[10px] text-red-400">CONFLICT</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Releases */}
            {traceStep.releasesProcessed.length > 0 && (
              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-500">Release:</div>
                {traceStep.releasesProcessed.map((rp, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <ResourceBadge access={rp.release} isRelease compact />
                    {!rp.wasHeld && (
                      <span className="text-[10px] text-red-400">NOT HELD</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Held resources */}
            {traceStep.heldAfter.size > 0 && (
              <div className="mt-1 pt-1 border-t border-slate-700">
                <div className="text-[10px] text-slate-500">Held:</div>
                <div className="flex flex-wrap gap-0.5">
                  {Array.from(traceStep.heldAfter.values()).map((res, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getResourceColor(res.action) }}
                      title={resourceAccessString(res)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Overall status */}
      <div className={`text-xs p-2 rounded ${
        trace.valid ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'
      }`}>
        {trace.valid
          ? 'Valid lock sequence - no conflicts detected'
          : 'Invalid lock sequence - conflict or ordering error detected'}
      </div>
    </div>
  );
}
