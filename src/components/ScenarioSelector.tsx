import { Scenario } from '../types';
import { preloadedScenarios } from '../scenarios/preloaded';

interface Props {
  current: Scenario;
  onSelect: (scenario: Scenario) => void;
  seed: number;
  onSeedChange: (seed: number) => void;
  onRandomize: () => void;
  onEditClick: () => void;
  stageIndex: number;
  onStageChange: (index: number) => void;
}

export default function ScenarioSelector({
  current, onSelect, seed, onSeedChange, onRandomize, onEditClick,
  stageIndex, onStageChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-slate-700 bg-slate-800/50">
      {preloadedScenarios.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Scenario:</label>
          <select
            value={current.name}
            onChange={(e) => {
              const scenario = preloadedScenarios.find(s => s.name === e.target.value);
              if (scenario) onSelect(scenario);
            }}
            className="bg-slate-700 text-slate-200 text-sm rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500"
          >
            {preloadedScenarios.map(s => (
              <option key={s.name} value={s.name}>
                {s.name.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-1">
        {current.stages.map((stage, i) => (
          <button
            key={i}
            onClick={() => onStageChange(i)}
            className={`px-2.5 py-1 rounded text-xs transition-all ${
              stageIndex === i
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-300'
            }`}
          >
            {stage.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <label className="text-xs text-slate-500">Seed:</label>
        <input
          type="number"
          value={seed}
          onChange={(e) => onSeedChange(parseInt(e.target.value) || 0)}
          className="bg-slate-700 text-slate-200 text-sm rounded px-2 py-1 w-20 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
        />
        <button
          onClick={onRandomize}
          className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600 transition-colors"
        >
          Randomize
        </button>
        <button
          onClick={onEditClick}
          className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600 transition-colors"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
