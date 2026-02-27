import { Stage, Step } from '../../types';
import DAGRenderer from '../dag/DAGRenderer';

interface Props {
  stage: Stage;
  onStepClick?: (step: Step) => void;
}

export default function InitialStatePanel({ stage, onStepClick }: Props) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <DAGRenderer stage={stage} onStepClick={onStepClick} />
    </div>
  );
}
