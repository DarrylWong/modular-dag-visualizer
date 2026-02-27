import { Step } from '../../types';
import { getChainColor } from '../../utils/colors';

interface Props {
  step: Step;
  chainIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  highlighted?: boolean;
  dimmed?: boolean;
  onClick?: (step: Step) => void;
}

export const NODE_WIDTH = 140;
export const NODE_HEIGHT = 44;
export const NODE_H_SPACING = 12;
export const NODE_V_SPACING = 20;

export default function StepNode({
  step, chainIndex, x, y, width, height, highlighted, dimmed, onClick
}: Props) {
  const color = getChainColor(chainIndex);
  const hasResources = step.resources.accesses.length > 0 || step.resources.releases.length > 0;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={() => onClick?.(step)}
      className={onClick ? 'cursor-pointer' : ''}
      opacity={dimmed ? 0.3 : 1}
    >
      <rect
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill={highlighted ? color + '30' : '#1e293b'}
        stroke={highlighted ? color : color + '60'}
        strokeWidth={highlighted ? 2 : 1}
        strokeDasharray={step.isDynamic ? '4 2' : undefined}
      />

      {/* Chain color bar */}
      <rect x={0} y={0} width={4} height={height} rx={2} fill={color} />

      {/* Description */}
      <foreignObject x={10} y={6} width={width - 20} height={height - 12}>
        <div
          className="text-xs text-slate-200 leading-tight overflow-hidden"
          style={{ fontSize: '11px' }}
          title={step.description}
        >
          {step.description}
        </div>
      </foreignObject>

      {/* Lock indicator dot */}
      {hasResources && (
        <circle
          cx={width - 10}
          cy={10}
          r={4}
          fill={step.resources.accesses.some(a => a.lock) ? '#ef4444' : '#3b82f6'}
          opacity={0.7}
        />
      )}
    </g>
  );
}
