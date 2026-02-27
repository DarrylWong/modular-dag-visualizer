import { StepPermutationTrace } from '../../algorithms/step-permutation';
import { getChainColor } from '../../utils/colors';
import { PositionedStep } from '../../types';

interface Props {
  trace: StepPermutationTrace;
  stepIndex: number;
}

const NODE_W = 320;
const NODE_H = 36;
const V_GAP = 6;
const MARGIN = 16;
const ROW_H = NODE_H + V_GAP;

// Stable identity for a step that doesn't change when it moves position
function stepKey(ps: PositionedStep): string {
  return `c${ps.position.chainId}:d${ps.position.depth}:${ps.step.description}`;
}

export default function StepPermutationPanel({ trace, stepIndex }: Props) {
  const { initialOrder, sampledSwaps, totalIterations } = trace;

  const currentOrder: PositionedStep[] = stepIndex === 0
    ? initialOrder
    : sampledSwaps[stepIndex - 1].orderAfter;

  const currentSwap = stepIndex > 0 ? sampledSwaps[stepIndex - 1] : null;

  // Build a position map: stepKey -> current row index
  const positionMap = new Map<string, number>();
  currentOrder.forEach((ps, i) => positionMap.set(stepKey(ps), i));

  // Use initialOrder for stable iteration so React keys are stable
  // Each node renders at whatever row positionMap says
  const allSteps = initialOrder;

  const svgH = MARGIN + currentOrder.length * ROW_H;
  const svgW = MARGIN * 2 + NODE_W;

  // Which positions are involved in the current swap
  const swapFirstIdx = currentSwap?.firstIdx ?? -1;
  const swapSecondIdx = currentSwap?.secondIdx ?? -1;

  return (
    <div className="flex flex-col lg:flex-row h-full">
      <div className="flex-1 overflow-auto p-4">
        <svg width={svgW} height={svgH} className="block">
          {allSteps.map((ps) => {
            const key = stepKey(ps);
            const row = positionMap.get(key) ?? 0;
            const x = MARGIN;
            const y = MARGIN + row * ROW_H;
            const color = getChainColor(ps.position.chainId);

            const isSwapA = row === swapFirstIdx;
            const isSwapB = row === swapSecondIdx;
            const isInvolved = isSwapA || isSwapB;

            let strokeColor = color + '50';
            let fillColor = '#1e293b';
            if (isInvolved && currentSwap) {
              if (currentSwap.validSwap) {
                strokeColor = '#22c55e80';
                fillColor = '#22c55e0a';
              } else {
                strokeColor = '#ef444480';
                fillColor = '#ef44440a';
              }
            }

            return (
              <g
                key={key}
                transform={`translate(0, ${y})`}
                style={{
                  transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <rect
                  x={x} y={0}
                  width={NODE_W} height={NODE_H}
                  rx={5} ry={5}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isInvolved ? 2 : 1}
                />
                <rect x={x} y={0} width={4} height={NODE_H} rx={2} fill={color} />

                <text x={x + 10} y={NODE_H / 2 + 1} fontSize={10} fill="#64748b"
                  dominantBaseline="middle" fontFamily="monospace">
                  {row}
                </text>

                <foreignObject x={x + 24} y={2} width={NODE_W - 80} height={NODE_H - 4}>
                  <div className="text-[11px] text-slate-200 leading-tight truncate pt-2">
                    {ps.step.description}
                  </div>
                </foreignObject>

                {isSwapA && currentSwap!.validSwap && (
                  <text x={x + NODE_W - 8} y={NODE_H / 2 + 1} fontSize={14} fill="#22c55e"
                    dominantBaseline="middle" textAnchor="end">↓</text>
                )}
                {isSwapB && currentSwap!.validSwap && (
                  <text x={x + NODE_W - 8} y={NODE_H / 2 + 1} fontSize={14} fill="#22c55e"
                    dominantBaseline="middle" textAnchor="end">↑</text>
                )}
                {isSwapA && !currentSwap!.validSwap && (
                  <text x={x + NODE_W - 8} y={NODE_H / 2 + 1} fontSize={10} fill="#ef4444"
                    dominantBaseline="middle" textAnchor="end" fontFamily="monospace">blocked</text>
                )}
              </g>
            );
          })}

          {/* Arrows between consecutive positions */}
          {currentOrder.slice(0, -1).map((_, i) => {
            const y1 = MARGIN + i * ROW_H + NODE_H;
            const y2 = MARGIN + (i + 1) * ROW_H;
            return (
              <line
                key={`arrow-${i}`}
                x1={MARGIN + NODE_W / 2} y1={y1}
                x2={MARGIN + NODE_W / 2} y2={y2}
                stroke="#334155" strokeWidth={1}
              />
            );
          })}
        </svg>
      </div>

      <div className="w-full lg:w-64 flex-shrink-0 overflow-y-auto border-l border-slate-700 p-3 space-y-3">
        <div className="text-xs text-slate-400 space-y-1">
          <div>{totalIterations.toLocaleString()} iterations</div>
          <div>{sampledSwaps.length} sampled</div>
        </div>

        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${(stepIndex / Math.max(sampledSwaps.length, 1)) * 100}%` }}
          />
        </div>

        {currentSwap && (
          <div className={`p-2 rounded border text-xs ${
            currentSwap.validSwap
              ? 'border-green-500/30 bg-green-500/10'
              : 'border-red-500/30 bg-red-500/10'
          }`}>
            <div className="text-slate-400 mb-1">
              [{currentSwap.firstIdx}, {currentSwap.secondIdx}]
            </div>
            <div style={{ color: getChainColor(currentSwap.firstStep.position.chainId) }}>
              {currentSwap.firstStep.step.description}
            </div>
            <div style={{ color: getChainColor(currentSwap.secondStep.position.chainId) }}>
              {currentSwap.secondStep.step.description}
            </div>
            <div className={`mt-1 font-medium ${currentSwap.validSwap ? 'text-green-400' : 'text-red-400'}`}>
              {currentSwap.validSwap
                ? 'Swapped (different chains or same depth)'
                : 'Blocked (same chain, different depth)'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
