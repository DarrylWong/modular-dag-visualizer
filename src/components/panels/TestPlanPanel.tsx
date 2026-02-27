import { ConcurrentGroupResult } from '../../algorithms/concurrent-grouping';
import { getChainColor } from '../../utils/colors';

interface Props {
  stageName: string;
  seed: number;
  groups: ConcurrentGroupResult[];
}

// Mirrors the output of TestPlan.String() / prettyPrintStep from planner.go
export default function TestPlanPanel({ stageName, seed, groups }: Props) {
  // Assign step IDs sequentially
  let stepId = 1;

  const lines: { text: string; color?: string; indent: number; isConcurrent?: boolean }[] = [];

  // Header
  lines.push({ text: `Seed:               ${seed}`, indent: 0 });
  lines.push({ text: 'Plan:', indent: 0 });

  // Stage line
  const isLastStage = true; // we render one stage at a time
  const stagePrefix = isLastStage ? '\u2514\u2500\u2500' : '\u251C\u2500\u2500';
  lines.push({ text: `${stagePrefix} ${stageName}`, indent: 0 });

  const stageNest = isLastStage ? '    ' : '\u2502   ';

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const isLast = i === groups.length - 1;
    const branch = isLast ? '\u2514\u2500\u2500' : '\u251C\u2500\u2500';
    const nest = isLast ? '    ' : '\u2502   ';

    if (group.isConcurrent && group.steps.length > 1) {
      // Concurrent step: print label, then nested children
      const stepNames = group.steps.map(s => s.step.description);
      const label = stepNames.join(' + ');
      lines.push({
        text: `${stageNest}${branch} ${label}`,
        indent: 0,
        isConcurrent: true,
      });

      for (let j = 0; j < group.steps.length; j++) {
        const ps = group.steps[j];
        const subIsLast = j === group.steps.length - 1;
        const subBranch = subIsLast ? '\u2514\u2500\u2500' : '\u251C\u2500\u2500';
        lines.push({
          text: `${stageNest}${nest}${subBranch} ${ps.step.description} (${stepId})`,
          indent: 0,
          color: getChainColor(ps.position.chainId),
        });
        stepId++;
      }
    } else {
      // Single step
      const ps = group.steps[0];
      lines.push({
        text: `${stageNest}${branch} ${ps.step.description} (${stepId})`,
        indent: 0,
        color: getChainColor(ps.position.chainId),
      });
      stepId++;
    }
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <pre className="font-mono text-xs leading-relaxed">
        {lines.map((line, i) => (
          <div key={i}>
            <span
              className={line.isConcurrent ? 'text-blue-400' : ''}
              style={line.color ? { color: line.color } : undefined}
            >
              {line.text}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
}
