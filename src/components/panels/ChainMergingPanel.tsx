import { Stage, Step, Chain, ResourceAccess } from '../../types';
import { MaybeMergeChainsTrace, ChainMergeTrace, MergeAttempt } from '../../algorithms/chain-merge';
import { LockValidationTrace } from '../../algorithms/lock-validation';
import { getChainColor } from '../../utils/colors';
import { resourcePathString } from '../../algorithms/resources';
import DAGRenderer from '../dag/DAGRenderer';

interface Props {
  stage: Stage;
  mergedStage: Stage;
  trace: MaybeMergeChainsTrace;
  stepIndex: number;
}

const NODE_W = 200;
const NODE_H = 48;
const V_GAP = 24;

function flattenChain(chain: Chain): Step[] {
  const steps: Step[] = [];
  for (const group of chain) steps.push(...group);
  return steps;
}

// Substep types within a pairwise merge
type MergeSubStep =
  | { type: 'split'; traceIdx: number }
  | { type: 'animate-in'; traceIdx: number; attempt: MergeAttempt }
  | { type: 'validate'; traceIdx: number; attempt: MergeAttempt }
  | { type: 'animate-back'; traceIdx: number; attempt: MergeAttempt };

function resolveSubStep(stepIndex: number, mergeTraces: ChainMergeTrace[]): MergeSubStep | null {
  if (stepIndex === 0 || mergeTraces.length === 0) return null;

  let remaining = stepIndex - 1;

  for (let traceIdx = 0; traceIdx < mergeTraces.length; traceIdx++) {
    const t = mergeTraces[traceIdx];
    const failedAttempts = t.attempts.filter(a => !a.valid);
    const successAttempt = t.attempts.find(a => a.valid)!;

    // Step 0: split
    if (remaining === 0) return { type: 'split', traceIdx };
    remaining--;

    // For each failed attempt: animate-in, validate-fail, animate-back (3 steps each)
    for (const failed of failedAttempts) {
      if (remaining === 0) return { type: 'animate-in', traceIdx, attempt: failed };
      remaining--;
      if (remaining === 0) return { type: 'validate', traceIdx, attempt: failed };
      remaining--;
      if (remaining === 0) return { type: 'animate-back', traceIdx, attempt: failed };
      remaining--;
    }

    // Successful attempt: animate-in, validate-pass (2 steps)
    if (remaining === 0) return { type: 'animate-in', traceIdx, attempt: successAttempt };
    remaining--;
    if (remaining === 0) return { type: 'validate', traceIdx, attempt: successAttempt };
    remaining--;
  }

  return null;
}

export default function ChainMergingPanel({ stage, mergedStage, trace, stepIndex }: Props) {
  const { mergeTraces } = trace;
  const subStep = resolveSubStep(stepIndex, mergeTraces);

  // Final step: subStep is null but stepIndex > 0 and mergeTraces exist
  const isFinalDAG = subStep === null && stepIndex > 0 && mergeTraces.length > 0;

  const currentTraceIdx = subStep?.traceIdx ?? -1;
  const currentTrace = currentTraceIdx >= 0 ? mergeTraces[currentTraceIdx] : null;

  const showMerged = subStep?.type === 'animate-in' || subStep?.type === 'validate';
  const currentAttempt = (subStep && 'attempt' in subStep) ? subStep.attempt : null;
  const dagAttempt = currentAttempt ?? currentTrace?.attempts.find(a => a.valid) ?? null;

  // Final DAG view
  if (isFinalDAG) {
    return (
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div className="text-xs text-slate-400">
          Merged stage: {mergedStage.chains.length} chains (from {stage.chains.length})
        </div>
        <DAGRenderer stage={mergedStage} />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full">
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {/* Progress pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {mergeTraces.map((t, i) => {
            const isDone = i < currentTraceIdx;
            const isActive = i === currentTraceIdx;
            return (
              <div
                key={i}
                className={`text-xs px-2 py-1 rounded border font-mono ${
                  isActive
                    ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                    : isDone
                      ? 'border-green-500/30 bg-green-500/5 text-green-400'
                      : 'border-slate-700 bg-slate-800/30 text-slate-500'
                }`}
              >
                {t.label1} + {t.label2}
              </div>
            );
          })}
        </div>

        {currentTrace && dagAttempt && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono" style={{ color: getChainColor(0) }}>{currentTrace.label1}</span>
              <span className="text-lg text-slate-600">+</span>
              <span className="text-xs font-mono" style={{ color: getChainColor(1) }}>{currentTrace.label2}</span>
              {subStep?.type === 'validate' && currentAttempt && (
                <span className={`text-xs font-medium ${currentAttempt.valid ? 'text-green-400' : 'text-red-400'}`}>
                  attempt {currentAttempt.attemptNumber}: {currentAttempt.valid ? 'valid' : 'conflict!'}
                </span>
              )}
              {subStep?.type === 'animate-back' && (
                <span className="text-xs text-amber-400">rejecting, trying again...</span>
              )}
            </div>

            <MergeDAG
              trace={currentTrace}
              attempt={dagAttempt}
              merged={showMerged === true}
            />
          </div>
        )}

        {stepIndex === 0 && mergeTraces.length > 0 && (
          <div className="text-xs text-slate-500">
            {mergeTraces.length} pairwise merge{mergeTraces.length !== 1 ? 's' : ''}.
          </div>
        )}
        {mergeTraces.length === 0 && (
          <div className="text-xs text-slate-500">No chains need merging.</div>
        )}
      </div>

      {subStep?.type === 'validate' && currentAttempt && (
        <div className="w-full lg:w-[380px] flex-shrink-0 overflow-y-auto border-l border-slate-700 p-3 space-y-2">
          <div className={`text-xs font-medium ${currentAttempt.valid ? 'text-green-400' : 'text-red-400'}`}>
            Lock validation: {currentAttempt.valid ? 'passed' : 'failed'}
          </div>

          <div className="flex items-center gap-1 mb-2">
            <span className="text-[10px] text-slate-500">Order:</span>
            <div className="flex gap-0.5">
              {currentAttempt.order.map((c: number, i: number) => (
                <div
                  key={i}
                  className="w-5 h-5 rounded text-[10px] font-mono flex items-center justify-center"
                  style={{ backgroundColor: getChainColor(c) + '40', color: getChainColor(c) }}
                >
                  {c === 0 ? 'A' : 'B'}
                </div>
              ))}
            </div>
          </div>

          <LockValidationView trace={currentAttempt.lockTrace} />
        </div>
      )}
    </div>
  );
}

function LockValidationView({ trace }: { trace: LockValidationTrace }) {
  return (
    <div className="space-y-0.5">
      {trace.steps.map((ts, i) => (
        <div
          key={i}
          className={`text-xs rounded border p-2 ${
            !ts.valid ? 'border-red-500/50 bg-red-500/10' : 'border-slate-700 bg-slate-800/30'
          }`}
        >
          <div className="text-slate-300 truncate mb-0.5">{ts.stepDescription}</div>
          {ts.accessesProcessed.map((ap, j) => (
            <div key={`a${j}`} className="ml-2 flex items-center gap-1 text-[10px]">
              <span className={ap.accepted ? 'text-amber-400' : 'text-red-400'}>
                {ap.accepted ? '+' : 'X'}
              </span>
              <span className="font-mono text-slate-300">
                {ap.access.lock ? 'lock' : 'access'} {ap.access.action}({resourcePathString(ap.access.path)})
              </span>
              {!ap.accepted && ap.conflictWith && (
                <span className="text-red-300 ml-1">
                  conflicts with held {resourcePathString(ap.conflictWith.path)}
                </span>
              )}
            </div>
          ))}
          {ts.releasesProcessed.map((rp, j) => (
            <div key={`r${j}`} className="ml-2 flex items-center gap-1 text-[10px]">
              <span className="text-green-400">-</span>
              <span className="font-mono text-slate-300">
                {resourcePathString(rp.release.path)}
              </span>
            </div>
          ))}
          {ts.heldAfter.size > 0 && (
            <div className="ml-2 mt-0.5 text-[10px] text-slate-500">
              held: {Array.from(ts.heldAfter.values()).map((r, k) => (
                <span key={k} className="font-mono px-1 rounded bg-slate-700 text-slate-400 mr-0.5">
                  {resourcePathString(r.path)}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MergeDAG({
  trace,
  attempt,
  merged,
}: {
  trace: ChainMergeTrace;
  attempt: MergeAttempt;
  merged: boolean;
}) {
  const stepsA = flattenChain(trace.chain1);
  const stepsB = flattenChain(trace.chain2);

  const splitColAX = 20;
  const splitColBX = NODE_W + 60 + 20;
  const mergedColX = (splitColAX + splitColBX) / 2;

  interface NodePos {
    key: string; step: Step; fromChain: number;
    splitX: number; splitY: number;
    mergedX: number; mergedY: number;
  }

  const nodes: NodePos[] = [];
  let aIdx = 0, bIdx = 0;

  for (let i = 0; i < attempt.order.length; i++) {
    const group = attempt.result[i];
    for (let j = 0; j < group.length; j++) {
      const fromChain = attempt.order[i];
      const splitRow = fromChain === 0 ? aIdx : bIdx;
      nodes.push({
        key: `${fromChain}-${splitRow}`,
        step: group[j], fromChain,
        splitX: fromChain === 0 ? splitColAX : splitColBX,
        splitY: 16 + splitRow * (NODE_H + V_GAP),
        mergedX: mergedColX,
        mergedY: 16 + nodes.length * (NODE_H + V_GAP),
      });
      if (fromChain === 0) aIdx++; else bIdx++;
    }
  }

  const chainANodes = nodes.filter(n => n.fromChain === 0);
  const chainBNodes = nodes.filter(n => n.fromChain === 1);
  const splitH = Math.max(stepsA.length, stepsB.length) * (NODE_H + V_GAP) + 16;
  const mergedH = nodes.length * (NODE_H + V_GAP) + 16;
  const svgH = merged ? mergedH : splitH;
  const svgW = splitColBX + NODE_W + 40;
  const t = 'all 700ms cubic-bezier(0.4, 0, 0.2, 1)';

  function chainArrows(chainNodes: NodePos[], color: string) {
    return chainNodes.slice(1).map((to, i) => {
      const from = chainNodes[i];
      return (
        <line key={`${color}-${i}`}
          x1={merged ? from.mergedX + NODE_W/2 : from.splitX + NODE_W/2}
          y1={merged ? from.mergedY + NODE_H : from.splitY + NODE_H}
          x2={merged ? to.mergedX + NODE_W/2 : to.splitX + NODE_W/2}
          y2={merged ? to.mergedY : to.splitY}
          stroke={color} strokeWidth={1.5} opacity={merged ? 0 : 0.4}
          style={{ transition: t }}
        />
      );
    });
  }

  return (
    <div className="overflow-auto rounded border border-slate-700 bg-slate-900/30">
      <svg width={svgW} style={{ height: svgH, transition: 'height 700ms ease' }} className="block">
        {chainArrows(chainANodes, getChainColor(0))}
        {chainArrows(chainBNodes, getChainColor(1))}

        {nodes.slice(1).map((to, i) => {
          const from = nodes[i];
          return (
            <line key={`m-${i}`}
              x1={merged ? from.mergedX + NODE_W/2 : from.splitX + NODE_W/2}
              y1={merged ? from.mergedY + NODE_H : from.splitY + NODE_H}
              x2={merged ? to.mergedX + NODE_W/2 : to.splitX + NODE_W/2}
              y2={merged ? to.mergedY : to.splitY}
              stroke="#64748b" strokeWidth={1.5} opacity={merged ? 0.4 : 0}
              style={{ transition: t }}
            />
          );
        })}

        {nodes.map(n => {
          const x = merged ? n.mergedX : n.splitX;
          const y = merged ? n.mergedY : n.splitY;
          const color = getChainColor(n.fromChain);
          const hasLock = n.step.resources.accesses.some(a => a.lock);
          const hasRelease = n.step.resources.releases.length > 0;
          return (
            <g key={n.key} style={{ transition: t }}>
              <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={6} ry={6}
                fill="#1e293b" stroke={color + '60'} strokeWidth={1}
                strokeDasharray={n.step.isDynamic ? '4 2' : undefined}
                style={{ transition: t }} />
              <rect x={x} y={y} width={4} height={NODE_H} rx={2} fill={color} style={{ transition: t }} />
              <foreignObject x={x + 8} y={y + 4} width={NODE_W - 16} height={NODE_H - 8} style={{ transition: t }}>
                <div className="text-[11px] text-slate-200 leading-tight truncate">{n.step.description}</div>
                {(hasLock || hasRelease) && (
                  <div className="text-[9px] mt-0.5 truncate">
                    {hasLock && <span className="text-red-400 font-mono">+{n.step.resources.accesses.filter(a => a.lock).map(a => resourcePathString(a.path)).join(', ')}</span>}
                    {hasLock && hasRelease && ' '}
                    {hasRelease && <span className="text-green-400 font-mono">-{n.step.resources.releases.map(r => resourcePathString(r.path)).join(', ')}</span>}
                  </div>
                )}
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
