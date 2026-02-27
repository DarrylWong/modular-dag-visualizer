import { Stage, Step } from '../../types';
import { MaybeMergeChainsTrace } from '../../algorithms/chain-merge';
import { resourcePathString } from '../../algorithms/resources';
import DAGRenderer from '../dag/DAGRenderer';
import { getChainColor } from '../../utils/colors';

interface Props {
  stage: Stage;
  trace: MaybeMergeChainsTrace;
  stepIndex: number;
  onStepClick?: (step: Step) => void;
}

export default function ConflictDetectionPanel({ stage, trace, stepIndex, onStepClick }: Props) {
  const { unionFindTrace, groups } = trace;
  const comparisons = unionFindTrace.comparisons;
  const currentComp = stepIndex > 0 ? comparisons[stepIndex - 1] : null;
  const highlightChains = currentComp ? [currentComp.i, currentComp.j] : undefined;
  const done = stepIndex >= comparisons.length;

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Left: DAG */}
      <div className="flex-1 overflow-auto p-4">
        <DAGRenderer
          stage={stage}
          highlightChains={highlightChains}
          onStepClick={onStepClick}
        />
      </div>

      {/* Right: comparison detail */}
      <div className="w-full lg:w-[420px] flex-shrink-0 overflow-y-auto border-l border-slate-700 p-3 space-y-3">
        {/* Current comparison */}
        {currentComp && (
          <div className={`rounded border p-3 ${
            currentComp.conflictFound
              ? 'border-red-500/40 bg-red-500/5'
              : 'border-green-500/40 bg-green-500/5'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-400">Comparing</span>
              <span className="text-xs font-mono" style={{ color: getChainColor(currentComp.i) }}>
                Chain {currentComp.i}
              </span>
              <span className="text-xs text-slate-500">vs</span>
              <span className="text-xs font-mono" style={{ color: getChainColor(currentComp.j) }}>
                Chain {currentComp.j}
              </span>
              <span className={`text-xs font-medium ml-auto ${
                currentComp.conflictFound ? 'text-red-400' : 'text-green-400'
              }`}>
                {currentComp.conflictFound ? 'CONFLICT' : 'no conflict'}
              </span>
            </div>

            {/* Show resources from each chain */}
            <div className="flex gap-3 mb-2">
              <div className="flex-1">
                <div className="text-[10px] text-slate-500 mb-1" style={{ color: getChainColor(currentComp.i) }}>
                  Chain {currentComp.i} resources:
                </div>
                {trace.chainResources[currentComp.i].length === 0 ? (
                  <div className="text-[10px] text-slate-600 italic">no locks</div>
                ) : (
                  <div className="space-y-0.5">
                    {trace.chainResources[currentComp.i].map((r, k) => {
                      const isConflicting = currentComp.conflictingResources &&
                        r === currentComp.conflictingResources.res1;
                      return (
                        <div key={k} className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                          isConflicting
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {r.lock ? 'lock' : 'access'} {r.action}({resourcePathString(r.path)})
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-slate-500 mb-1" style={{ color: getChainColor(currentComp.j) }}>
                  Chain {currentComp.j} resources:
                </div>
                {trace.chainResources[currentComp.j].length === 0 ? (
                  <div className="text-[10px] text-slate-600 italic">no locks</div>
                ) : (
                  <div className="space-y-0.5">
                    {trace.chainResources[currentComp.j].map((r, k) => {
                      const isConflicting = currentComp.conflictingResources &&
                        r === currentComp.conflictingResources.res2;
                      return (
                        <div key={k} className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                          isConflicting
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {r.lock ? 'lock' : 'access'} {r.action}({resourcePathString(r.path)})
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Explain the conflict */}
            {currentComp.conflictFound && currentComp.conflictingResources && (
              <div className="text-xs text-red-300 bg-red-500/10 rounded p-2 border border-red-500/20">
                <span className="font-mono">
                  {currentComp.conflictingResources.res1.action}({resourcePathString(currentComp.conflictingResources.res1.path)})
                </span>
                {' conflicts with '}
                <span className="font-mono">
                  {currentComp.conflictingResources.res2.action}({resourcePathString(currentComp.conflictingResources.res2.path)})
                </span>
                {currentComp.conflictingResources.res1.lock && currentComp.conflictingResources.res2.lock
                  ? ' — both hold exclusive locks on the same resource'
                  : ' — one holds an exclusive lock, blocking the other'}
              </div>
            )}

            {!currentComp.conflictFound && (
              <div className="text-[11px] text-green-400/70">
                {trace.chainResources[currentComp.i].length === 0 || trace.chainResources[currentComp.j].length === 0
                  ? 'At least one chain has no resource locks — no conflict possible.'
                  : 'Resources don\'t overlap — different actions or different paths.'}
              </div>
            )}
          </div>
        )}

        {!currentComp && !done && (
          <div className="text-xs text-slate-500 p-3 bg-slate-800/50 rounded border border-slate-700">
            Step through to compare each pair of chains for resource conflicts.
            The union-find algorithm groups chains that share conflicting resources.
          </div>
        )}

        {/* Union-Find groups */}
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Groups</div>
          <GroupsDisplay
            comparisons={comparisons}
            stepIndex={stepIndex}
            finalGroups={groups}
            parentArray={
              stepIndex > 0 && stepIndex <= comparisons.length
                ? comparisons[stepIndex - 1].parentAfter
                : unionFindTrace.initialParent
            }
          />
        </div>

        {/* Comparison log */}
        {stepIndex > 0 && (
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">
              History ({Math.min(stepIndex, comparisons.length)}/{comparisons.length})
            </div>
            <div className="space-y-0.5 max-h-40 overflow-y-auto">
              {comparisons.slice(0, stepIndex).reverse().slice(0, 15).map((comp, idx) => (
                <div key={idx} className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                  <span style={{ color: getChainColor(comp.i) }}>C{comp.i}</span>
                  <span className="text-slate-600">vs</span>
                  <span style={{ color: getChainColor(comp.j) }}>C{comp.j}</span>
                  <span className={comp.conflictFound ? 'text-red-400' : 'text-green-500'}>
                    {comp.conflictFound ? 'conflict' : 'ok'}
                  </span>
                  {comp.conflictFound && comp.conflictingResources && (
                    <span className="text-red-400/60 truncate">
                      ({resourcePathString(comp.conflictingResources.res1.path)})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupsDisplay({
  parentArray,
  finalGroups,
  stepIndex,
  comparisons,
}: {
  parentArray: number[];
  finalGroups: number[][];
  stepIndex: number;
  comparisons: { i: number; j: number; conflictFound: boolean }[];
}) {
  // Build groups from current parent array
  const groupMap = new Map<number, number[]>();
  for (let i = 0; i < parentArray.length; i++) {
    let root = i;
    const visited = new Set<number>();
    while (parentArray[root] !== root && !visited.has(root)) {
      visited.add(root);
      root = parentArray[root];
    }
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root)!.push(i);
  }
  const groups = Array.from(groupMap.values()).sort((a, b) => a[0] - b[0]);
  const done = stepIndex >= comparisons.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {groups.map((members, gIdx) => (
        <div
          key={gIdx}
          className={`flex items-center gap-1 px-2 py-1 rounded border ${
            members.length > 1
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-slate-700 bg-slate-800/30'
          }`}
        >
          {members.map(m => (
            <span
              key={m}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono"
              style={{
                backgroundColor: getChainColor(m) + '30',
                color: getChainColor(m),
              }}
            >
              {m}
            </span>
          ))}
          {done && members.length > 1 && (
            <span className="text-[9px] text-amber-300 ml-0.5">merge</span>
          )}
        </div>
      ))}
    </div>
  );
}
