import { Phase, PHASES } from '../hooks/usePipeline';

interface PhaseBarProps {
  phase: Phase;
  stageName: string;
  onPhaseSelect: (phase: Phase) => void;
}

export function PhaseBar({ phase, stageName, onPhaseSelect }: PhaseBarProps) {
  return (
    <div className="flex items-center gap-1 px-4 py-1.5 border-b border-slate-700 bg-slate-800/30">
      <span className="text-xs text-slate-500 font-mono mr-1">{stageName} /</span>
      {PHASES.map((p) => (
        <button
          key={p.key}
          onClick={() => onPhaseSelect(p.key)}
          className={`px-2.5 py-1 rounded text-xs transition-all ${
            phase === p.key
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-300'
          }`}
          title={p.description}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

interface NavBarProps {
  stepIndex: number;
  maxSteps: number;
  isFirst: boolean;
  isLast: boolean;
  onPrev: () => void;
  onNext: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onJumpToEnd: () => void;
  onJumpToStart: () => void;
}

export function NavBar({
  stepIndex, maxSteps, isFirst, isLast,
  onPrev, onNext,
  onStepForward, onStepBackward, onJumpToEnd, onJumpToStart,
}: NavBarProps) {
  const hasSteps = maxSteps > 0;

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700 bg-slate-800/30">
      {/* Big prev arrow */}
      <button
        onClick={onPrev}
        disabled={isFirst}
        className="w-16 h-12 rounded-lg text-2xl bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
      >
        &larr;
      </button>

      {/* Step controls in the middle */}
      {hasSteps ? (
        <div className="flex items-center gap-2">
          <button
            onClick={onJumpToStart}
            disabled={stepIndex === 0}
            className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            |&laquo;
          </button>
          <button
            onClick={onStepBackward}
            disabled={stepIndex === 0}
            className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            &laquo;
          </button>
          <div className="text-sm font-mono text-slate-400 min-w-[80px] text-center">
            {stepIndex} / {maxSteps}
          </div>
          <button
            onClick={onStepForward}
            disabled={stepIndex >= maxSteps}
            className="px-2 py-1.5 rounded text-xs bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            &raquo;
          </button>
          <button
            onClick={onJumpToEnd}
            disabled={stepIndex >= maxSteps}
            className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            &raquo;|
          </button>
        </div>
      ) : (
        <div className="text-xs text-slate-600">left/right arrow keys to navigate</div>
      )}

      {/* Big next arrow */}
      <button
        onClick={onNext}
        disabled={isLast}
        className="w-16 h-12 rounded-lg text-2xl bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
      >
        &rarr;
      </button>
    </div>
  );
}
