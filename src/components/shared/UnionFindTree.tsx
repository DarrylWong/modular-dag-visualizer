import { UnionFindTrace } from '../../algorithms/union-find';
import { getChainColor } from '../../utils/colors';

interface Props {
  trace: UnionFindTrace;
  highlightStep: number;
}

export default function UnionFindTree({ trace, highlightStep }: Props) {
  const n = trace.initialParent.length;

  // Get the parent array at the current step
  const parentArray = highlightStep > 0 && highlightStep <= trace.comparisons.length
    ? trace.comparisons[highlightStep - 1].parentAfter
    : trace.initialParent;

  // Build groups from parent array
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    // Find root
    let root = i;
    const visited = new Set<number>();
    while (parentArray[root] !== root && !visited.has(root)) {
      visited.add(root);
      root = parentArray[root];
    }
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(i);
  }

  const currentComp = highlightStep > 0 ? trace.comparisons[highlightStep - 1] : null;

  return (
    <div className="space-y-4">
      {/* Parent array visualization */}
      <div>
        <div className="text-xs text-slate-400 mb-1 font-mono">parent[]</div>
        <div className="flex gap-1">
          {parentArray.map((parent, i) => (
            <div key={i} className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded flex items-center justify-center text-xs font-mono border"
                style={{
                  borderColor: getChainColor(i),
                  backgroundColor: getChainColor(i) + '20',
                  color: getChainColor(i),
                }}
              >
                {i}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {parent === i ? 'root' : `\u2192${parent}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Groups visualization */}
      <div>
        <div className="text-xs text-slate-400 mb-1">Groups</div>
        <div className="flex flex-wrap gap-2">
          {Array.from(groups.entries()).map(([root, members]) => (
            <div
              key={root}
              className="flex items-center gap-1 px-2 py-1 rounded border border-slate-600 bg-slate-800/50"
            >
              {members.map(m => (
                <span
                  key={m}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono ${
                    currentComp && (currentComp.i === m || currentComp.j === m)
                      ? 'ring-2 ring-white'
                      : ''
                  }`}
                  style={{
                    backgroundColor: getChainColor(m) + '40',
                    color: getChainColor(m),
                  }}
                >
                  {m}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Current comparison info */}
      {currentComp && (
        <div className={`text-xs p-2 rounded border ${
          currentComp.conflictFound
            ? 'border-red-500/40 bg-red-500/10 text-red-300'
            : 'border-green-500/40 bg-green-500/10 text-green-300'
        }`}>
          Comparing Chain {currentComp.i} vs Chain {currentComp.j}:
          {currentComp.conflictFound ? ' CONFLICT \u2192 union(' + currentComp.i + ',' + currentComp.j + ')' : ' no conflict'}
        </div>
      )}
    </div>
  );
}
