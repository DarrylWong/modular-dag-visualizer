import { UnionFindTrace } from '../../algorithms/union-find';
import { getChainColor } from '../../utils/colors';
import { resourcePathString } from '../../algorithms/resources';

interface Props {
  trace: UnionFindTrace;
  highlightStep: number; // how many comparisons to show
}

export default function ConflictMatrix({ trace, highlightStep }: Props) {
  const n = trace.initialParent.length;
  const comparisons = trace.comparisons.slice(0, highlightStep);

  // Build a lookup: [i][j] -> comparison result
  const matrix = new Map<string, { conflict: boolean; resourceInfo?: string }>();
  for (const comp of comparisons) {
    const key = `${Math.min(comp.i, comp.j)},${Math.max(comp.i, comp.j)}`;
    let resourceInfo: string | undefined;
    if (comp.conflictingResources) {
      const r1 = comp.conflictingResources.res1;
      const r2 = comp.conflictingResources.res2;
      resourceInfo = `${r1.action}:${resourcePathString(r1.path)} vs ${r2.action}:${resourcePathString(r2.path)}`;
    }
    matrix.set(key, { conflict: comp.conflictFound, resourceInfo });
  }

  // Current comparison being highlighted
  const currentComp = highlightStep > 0 ? trace.comparisons[highlightStep - 1] : null;

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-xs text-slate-400"></th>
            {Array.from({ length: n }, (_, i) => (
              <th key={i} className="p-2 text-xs font-mono" style={{ color: getChainColor(i) }}>
                C{i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: n }, (_, i) => (
            <tr key={i}>
              <td className="p-2 text-xs font-mono" style={{ color: getChainColor(i) }}>
                C{i}
              </td>
              {Array.from({ length: n }, (_, j) => {
                if (i === j) {
                  return (
                    <td key={j} className="w-10 h-10 text-center bg-slate-800/50 border border-slate-700">
                      <span className="text-slate-600">&mdash;</span>
                    </td>
                  );
                }

                const key = `${Math.min(i, j)},${Math.max(i, j)}`;
                const result = matrix.get(key);
                const isCurrent = currentComp &&
                  ((currentComp.i === i && currentComp.j === j) ||
                   (currentComp.i === j && currentComp.j === i));

                let bgColor = 'bg-slate-800/30'; // not yet compared
                let content = '';
                if (result !== undefined) {
                  bgColor = result.conflict ? 'bg-red-500/20' : 'bg-green-500/20';
                  content = result.conflict ? '\u2717' : '\u2713';
                }

                return (
                  <td
                    key={j}
                    className={`w-10 h-10 text-center border border-slate-700 transition-all duration-200 ${bgColor} ${isCurrent ? 'ring-2 ring-blue-400' : ''}`}
                    title={result?.resourceInfo || 'Not yet compared'}
                  >
                    <span className={result?.conflict ? 'text-red-400' : 'text-green-400'}>
                      {content}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
