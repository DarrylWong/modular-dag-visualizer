import { ConcurrentGroupingTrace, SpanAttempt } from '../../algorithms/concurrent-grouping';
import { PositionedStep, StepSpan } from '../../types';
import { getChainColor } from '../../utils/colors';

interface Props {
  trace: ConcurrentGroupingTrace;
  steps: PositionedStep[];
  stepIndex: number;
}

function spansFromSplitPoints(splitPoints: boolean[], numSteps: number): StepSpan[] {
  const spans: StepSpan[] = [];
  let start = 0;
  for (let i = 0; i < splitPoints.length; i++) {
    if (splitPoints[i]) {
      spans.push({ start, end: i });
      start = i + 1;
    }
  }
  spans.push({ start, end: numSteps - 1 });
  return spans;
}

export default function ConcurrentGroupingPanel({ trace, steps, stepIndex }: Props) {
  const { attempts } = trace;
  const currentAttempt = stepIndex > 0 ? attempts[stepIndex - 1] : null;

  const displaySpans: StepSpan[] = currentAttempt
    ? (currentAttempt.spans.length > 0
        ? currentAttempt.spans
        : spansFromSplitPoints(currentAttempt.splitPoints, steps.length))
    : [];

  const maxConcurrency = 4;

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Main: grouped step list (same layout for valid and invalid) */}
      <div className="flex-1 overflow-auto p-4">
        {currentAttempt && (
          <div className="space-y-1">
            {displaySpans.map((span, gIdx) => {
              const groupSteps = steps.slice(span.start, span.end + 1);
              const size = span.end - span.start + 1;
              const tooLarge = size > maxConcurrency;

              // Check for same-chain-different-depth within this group
              let depthConflict = false;
              if (size > 1) {
                const chains = new Map<number, number>();
                for (let idx = span.start; idx <= span.end; idx++) {
                  const s = steps[idx];
                  const existing = chains.get(s.position.chainId);
                  if (existing !== undefined && existing !== s.position.depth) {
                    depthConflict = true;
                    break;
                  }
                  chains.set(s.position.chainId, s.position.depth);
                }
              }

              const groupInvalid = tooLarge || (depthConflict && !currentAttempt.valid);
              const isValid = currentAttempt.valid;

              let borderClass = 'border-slate-700 bg-slate-800/30';
              if (size > 1) {
                if (isValid) {
                  borderClass = 'border-green-500/30 bg-green-500/5';
                } else if (groupInvalid) {
                  borderClass = 'border-red-500/40 bg-red-500/5';
                } else {
                  borderClass = 'border-slate-600 bg-slate-800/20';
                }
              }

              return (
                <div key={gIdx} className={`rounded border p-2 ${borderClass}`}>
                  {size > 1 && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        isValid
                          ? 'bg-green-500/20 text-green-300'
                          : groupInvalid
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-slate-700 text-slate-400'
                      }`}>
                        {size} steps
                      </span>
                      {tooLarge && (
                        <span className="text-[10px] text-red-400">exceeds max concurrency {maxConcurrency}</span>
                      )}
                      {depthConflict && !tooLarge && !isValid && (
                        <span className="text-[10px] text-red-400">same chain, different depths</span>
                      )}
                    </div>
                  )}

                  <div className="space-y-0.5">
                    {groupSteps.map((ps, sIdx) => (
                      <div
                        key={sIdx}
                        className="text-xs px-2 py-1 rounded border text-slate-300 truncate"
                        style={{
                          borderColor: getChainColor(ps.position.chainId) + '30',
                          borderLeft: `3px solid ${getChainColor(ps.position.chainId)}`,
                          backgroundColor: getChainColor(ps.position.chainId) + '08',
                        }}
                      >
                        {ps.step.description}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {stepIndex === 0 && (
          <div className="text-xs text-slate-500 p-4">Step through to see grouping attempts.</div>
        )}
      </div>

      {/* Right sidebar */}
      <div className="w-full lg:w-72 flex-shrink-0 overflow-y-auto border-l border-slate-700 p-3 space-y-3">
        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${(stepIndex / Math.max(attempts.length, 1)) * 100}%` }}
          />
        </div>

        {currentAttempt && (
          <div className={`p-2 rounded border text-xs ${
            currentAttempt.valid
              ? 'border-green-500/30 bg-green-500/10'
              : 'border-red-500/30 bg-red-500/10'
          }`}>
            <div className="mb-1.5">
              Attempt {stepIndex}/{attempts.length}
              <span className={`ml-2 font-medium ${currentAttempt.valid ? 'text-green-400' : 'text-red-400'}`}>
                {currentAttempt.valid ? 'valid' : 'invalid'}
              </span>
            </div>

            <div className="text-[10px] text-slate-500 mb-1">Split points:</div>
            <div className="flex gap-0.5 flex-wrap mb-1.5">
              {currentAttempt.splitPoints.map((isSplit, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded text-[9px] flex items-center justify-center ${
                    isSplit ? 'bg-amber-500/30 text-amber-300' : 'bg-slate-700 text-slate-600'
                  }`}
                >
                  {isSplit ? '|' : '\u00B7'}
                </div>
              ))}
            </div>

            <div className="text-[10px] text-slate-500 mb-1">Group sizes:</div>
            <div className="flex gap-1 flex-wrap">
              {displaySpans.map((span, i) => {
                const size = span.end - span.start + 1;
                const tooLarge = size > maxConcurrency;
                return (
                  <span
                    key={i}
                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                      tooLarge
                        ? 'bg-red-500/20 text-red-300'
                        : size > 1
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {size}
                  </span>
                );
              })}
            </div>

            {!currentAttempt.valid && currentAttempt.invalidReason && (
              <div className="text-[10px] text-red-300 mt-1.5">{currentAttempt.invalidReason}</div>
            )}
          </div>
        )}

        {stepIndex > 0 && (
          <div>
            <div className="text-[10px] text-slate-500 mb-1">History:</div>
            <div className="space-y-0.5 max-h-40 overflow-y-auto">
              {attempts.slice(0, stepIndex).reverse().slice(0, 12).map((a, i) => (
                <div key={i} className="text-[10px] font-mono text-slate-500">
                  #{stepIndex - i}
                  <span className={a.valid ? ' text-green-500' : ' text-red-500'}>
                    {a.valid
                      ? ` valid (${a.spans.length} groups)`
                      : ` ${a.invalidReason?.includes('exceeds') ? 'too large' : 'conflict'}`
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
