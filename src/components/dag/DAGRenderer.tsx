import { Stage, Step } from '../../types';
import StepNode, { NODE_WIDTH, NODE_HEIGHT, NODE_H_SPACING, NODE_V_SPACING } from './StepNode';
import { getChainColor } from '../../utils/colors';

interface Props {
  stage: Stage;
  highlightChains?: number[];
  dimChains?: number[];
  compact?: boolean;
  onStepClick?: (step: Step) => void;
}

export default function DAGRenderer({ stage, highlightChains, dimChains, compact, onStepClick }: Props) {
  const chains = stage.chains;
  if (chains.length === 0) return null;

  const nodeW = compact ? NODE_WIDTH * 0.8 : NODE_WIDTH;
  const nodeH = compact ? NODE_HEIGHT * 0.7 : NODE_HEIGHT;
  const hSpacing = compact ? NODE_H_SPACING * 0.6 : NODE_H_SPACING;
  const vSpacing = compact ? NODE_V_SPACING * 0.6 : NODE_V_SPACING;

  // Calculate max depth (longest chain)
  const maxDepth = Math.max(...chains.map(c => {
    let total = 0;
    for (const g of c) total += g.length; // count steps, not groups
    return c.length; // use stepGroup count for layout
  }));

  // For each chain, calculate its max group width (for parallel steps in a group)
  const chainWidths = chains.map(c => {
    const maxGroupSize = Math.max(...c.map(g => g.length));
    return maxGroupSize * (nodeW + hSpacing) - hSpacing;
  });

  const totalWidth = chainWidths.reduce((sum, w) => sum + w, 0) + (chains.length - 1) * hSpacing * 2;
  const totalHeight = maxDepth * (nodeH + vSpacing);

  // Calculate x offsets for each chain
  const chainXOffsets: number[] = [];
  let currentX = 0;
  for (let i = 0; i < chains.length; i++) {
    chainXOffsets.push(currentX);
    currentX += chainWidths[i] + hSpacing * 2;
  }

  const margin = 12;
  const labelH = 16; // space for "Chain N" labels above nodes
  const svgWidth = totalWidth + margin * 2;
  const svgHeight = totalHeight + margin * 2 + labelH;

  return (
    <div className="overflow-auto">
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="block"
      >

        {/* Draw chains */}
        {chains.map((chain, chainIdx) => {
          const isHighlighted = highlightChains?.includes(chainIdx) ?? false;
          const isDimmed = dimChains?.includes(chainIdx) ?? false;
          const chainX = margin + chainXOffsets[chainIdx];

          return (
            <g key={chainIdx}>
              {/* Chain label */}
              <text
                x={chainX + chainWidths[chainIdx] / 2}
                y={margin + labelH - 4}
                textAnchor="middle"
                fill={getChainColor(chainIdx)}
                fontSize={10}
                fontWeight="bold"
                opacity={isDimmed ? 0.3 : 1}
              >
                Chain {chainIdx}
              </text>

              {/* Steps */}
              {chain.map((stepGroup, depth) => {
                const groupWidth = stepGroup.length * (nodeW + hSpacing) - hSpacing;
                const groupX = chainX + (chainWidths[chainIdx] - groupWidth) / 2;
                const y = margin + labelH + depth * (nodeH + vSpacing);

                return (
                  <g key={depth}>
                    {/* Connection lines from previous depth */}
                    {depth > 0 && (
                      <line
                        x1={chainX + chainWidths[chainIdx] / 2}
                        y1={y - vSpacing + 2}
                        x2={chainX + chainWidths[chainIdx] / 2}
                        y2={y - 2}
                        stroke={getChainColor(chainIdx)}
                        strokeWidth={1.5}
                        opacity={isDimmed ? 0.15 : 0.4}
                        markerEnd="url(#arrowhead)"
                      />
                    )}

                    {/* Fan out lines if multiple steps */}
                    {stepGroup.length > 1 && depth > 0 && stepGroup.map((_, stepIdx) => {
                      const stepCenterX = groupX + stepIdx * (nodeW + hSpacing) + nodeW / 2;
                      return (
                        <line
                          key={stepIdx}
                          x1={chainX + chainWidths[chainIdx] / 2}
                          y1={y - vSpacing / 2}
                          x2={stepCenterX}
                          y2={y - 2}
                          stroke={getChainColor(chainIdx)}
                          strokeWidth={1}
                          opacity={isDimmed ? 0.1 : 0.3}
                        />
                      );
                    })}

                    {stepGroup.map((s, stepIdx) => (
                      <StepNode
                        key={stepIdx}
                        step={s}
                        chainIndex={chainIdx}
                        x={groupX + stepIdx * (nodeW + hSpacing)}
                        y={y}
                        width={nodeW}
                        height={nodeH}
                        highlighted={isHighlighted}
                        dimmed={isDimmed}
                        onClick={onStepClick}
                      />
                    ))}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
