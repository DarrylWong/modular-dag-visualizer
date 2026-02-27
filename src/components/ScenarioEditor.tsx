import { useState } from 'react';
import { Scenario, Stage, Chain, StepGroup, Step, ResourceAccess, ResourceAction, ResourcePath } from '../types';

interface Props {
  scenario: Scenario;
  onApply: (scenario: Scenario) => void;
  onClose: () => void;
}

const ACTION_OPTIONS: { value: ResourceAction; label: string }[] = [
  { value: '*', label: 'Any (*)' },
  { value: 'schema_change', label: 'Schema Change' },
  { value: 'restore', label: 'Restore' },
  { value: 'cluster_setting', label: 'Cluster Setting' },
  { value: 'node_availability', label: 'Node Availability' },
];

function defaultResource(): ResourceAccess {
  return {
    action: 'cluster_setting',
    path: { type: 'cluster_setting', name: 'example.setting' },
    lock: true,
  };
}

function defaultStep(): Step {
  return {
    description: 'new step',
    resources: { accesses: [], releases: [] },
  };
}

export default function ScenarioEditor({ scenario, onApply, onClose }: Props) {
  const [editScenario, setEditScenario] = useState<Scenario>(JSON.parse(JSON.stringify(scenario)));
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState('');

  const stage = editScenario.stages[0];

  const updateStage = (fn: (stage: Stage) => Stage) => {
    setEditScenario(prev => ({
      ...prev,
      stages: [fn(prev.stages[0]), ...prev.stages.slice(1)],
    }));
  };

  const updateChain = (chainIdx: number, fn: (chain: Chain) => Chain) => {
    updateStage(stage => ({
      ...stage,
      chains: stage.chains.map((c, i) => i === chainIdx ? fn(c) : c),
    }));
  };

  const updateStep = (chainIdx: number, groupIdx: number, stepIdx: number, fn: (step: Step) => Step) => {
    updateChain(chainIdx, chain =>
      chain.map((group, gi) =>
        gi === groupIdx
          ? group.map((step, si) => si === stepIdx ? fn(step) : step)
          : group
      )
    );
  };

  const addChain = () => {
    updateStage(stage => ({
      ...stage,
      chains: [...stage.chains, [[defaultStep()]]],
    }));
  };

  const removeChain = (idx: number) => {
    updateStage(stage => ({
      ...stage,
      chains: stage.chains.filter((_, i) => i !== idx),
    }));
  };

  const addStepGroup = (chainIdx: number) => {
    updateChain(chainIdx, chain => [...chain, [defaultStep()]]);
  };

  const addStepToGroup = (chainIdx: number, groupIdx: number) => {
    updateChain(chainIdx, chain =>
      chain.map((group, i) => i === groupIdx ? [...group, defaultStep()] : group)
    );
  };

  const removeStepGroup = (chainIdx: number, groupIdx: number) => {
    updateChain(chainIdx, chain => chain.filter((_, i) => i !== groupIdx));
  };

  const addResource = (chainIdx: number, groupIdx: number, stepIdx: number, type: 'accesses' | 'releases') => {
    updateStep(chainIdx, groupIdx, stepIdx, step => ({
      ...step,
      resources: {
        ...step.resources,
        [type]: [...step.resources[type], defaultResource()],
      },
    }));
  };

  const updateResource = (
    chainIdx: number, groupIdx: number, stepIdx: number,
    type: 'accesses' | 'releases', resIdx: number,
    fn: (r: ResourceAccess) => ResourceAccess
  ) => {
    updateStep(chainIdx, groupIdx, stepIdx, step => ({
      ...step,
      resources: {
        ...step.resources,
        [type]: step.resources[type].map((r, i) => i === resIdx ? fn(r) : r),
      },
    }));
  };

  const removeResource = (
    chainIdx: number, groupIdx: number, stepIdx: number,
    type: 'accesses' | 'releases', resIdx: number
  ) => {
    updateStep(chainIdx, groupIdx, stepIdx, step => ({
      ...step,
      resources: {
        ...step.resources,
        [type]: step.resources[type].filter((_, i) => i !== resIdx),
      },
    }));
  };

  const handleExport = () => {
    setJsonText(JSON.stringify(editScenario, null, 2));
    setJsonMode(true);
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setEditScenario(parsed);
      setJsonMode(false);
    } catch {
      alert('Invalid JSON');
    }
  };

  const renderResourceEditor = (
    access: ResourceAccess,
    onChange: (fn: (r: ResourceAccess) => ResourceAccess) => void,
    onRemove: () => void,
  ) => {
    const updatePath = (newPath: Partial<ResourcePath>) => {
      onChange(r => ({ ...r, path: { ...r.path, ...newPath } as ResourcePath }));
    };

    return (
      <div className="flex flex-wrap items-center gap-1 bg-slate-800 rounded px-2 py-1 text-xs">
        <select
          value={access.action}
          onChange={e => onChange(r => ({ ...r, action: e.target.value as ResourceAction }))}
          className="bg-slate-700 text-slate-200 rounded px-1 py-0.5 text-xs border border-slate-600"
        >
          {ACTION_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={access.path.type}
          onChange={e => {
            const type = e.target.value as ResourcePath['type'];
            if (type === 'database') onChange(r => ({ ...r, path: { type: 'database', database: '' } }));
            else if (type === 'cluster_setting') onChange(r => ({ ...r, path: { type: 'cluster_setting', name: '' } }));
            else onChange(r => ({ ...r, path: { type: 'node_availability' } }));
          }}
          className="bg-slate-700 text-slate-200 rounded px-1 py-0.5 text-xs border border-slate-600"
        >
          <option value="database">Database</option>
          <option value="cluster_setting">Cluster Setting</option>
          <option value="node_availability">Node Availability</option>
        </select>

        {access.path.type === 'database' && (
          <>
            <input
              value={access.path.database}
              onChange={e => updatePath({ database: e.target.value })}
              placeholder="database"
              className="bg-slate-700 text-slate-200 rounded px-1 py-0.5 w-20 text-xs border border-slate-600"
            />
            <input
              value={access.path.table || ''}
              onChange={e => updatePath({ table: e.target.value || undefined })}
              placeholder="table (optional)"
              className="bg-slate-700 text-slate-200 rounded px-1 py-0.5 w-24 text-xs border border-slate-600"
            />
          </>
        )}

        {access.path.type === 'cluster_setting' && (
          <input
            value={access.path.name}
            onChange={e => updatePath({ name: e.target.value })}
            placeholder="setting name"
            className="bg-slate-700 text-slate-200 rounded px-1 py-0.5 w-40 text-xs border border-slate-600"
          />
        )}

        <label className="flex items-center gap-1 text-slate-400">
          <input
            type="checkbox"
            checked={access.lock}
            onChange={e => onChange(r => ({ ...r, lock: e.target.checked }))}
            className="rounded"
          />
          Lock
        </label>

        <button onClick={onRemove} className="text-red-400 hover:text-red-300 text-xs px-1">
          &times;
        </button>
      </div>
    );
  };

  if (jsonMode) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-600 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h2 className="text-sm font-medium text-slate-300">JSON Editor</h2>
            <button onClick={() => setJsonMode(false)} className="text-slate-400 hover:text-slate-300">&times;</button>
          </div>
          <textarea
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            className="flex-1 bg-slate-900 text-slate-200 p-4 font-mono text-xs resize-none border-0 focus:outline-none"
            spellCheck={false}
          />
          <div className="flex gap-2 px-4 py-3 border-t border-slate-700">
            <button onClick={handleImport} className="px-3 py-1.5 rounded text-xs bg-blue-600 text-white hover:bg-blue-500">
              Import JSON
            </button>
            <button onClick={() => setJsonMode(false)} className="px-3 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-600 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-sm font-medium text-slate-300">Edit Scenario</h2>
          <div className="flex gap-2">
            <button onClick={handleExport} className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600">
              Export JSON
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-300 text-lg px-1">&times;</button>
          </div>
        </div>

        {/* Scenario name */}
        <div className="px-4 py-2 border-b border-slate-700/50 flex gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Name:</label>
            <input
              value={editScenario.name}
              onChange={e => setEditScenario(prev => ({ ...prev, name: e.target.value }))}
              className="bg-slate-700 text-slate-200 text-sm rounded px-2 py-1 w-48 border border-slate-600"
            />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-slate-400">Description:</label>
            <input
              value={editScenario.description}
              onChange={e => setEditScenario(prev => ({ ...prev, description: e.target.value }))}
              className="bg-slate-700 text-slate-200 text-sm rounded px-2 py-1 flex-1 border border-slate-600"
            />
          </div>
        </div>

        {/* Chains */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {stage.chains.map((chain, chainIdx) => (
            <div key={chainIdx} className="border border-slate-600 rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">Chain {chainIdx}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => addStepGroup(chainIdx)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                  >
                    + Step Group
                  </button>
                  <button
                    onClick={() => removeChain(chainIdx)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"
                  >
                    Remove Chain
                  </button>
                </div>
              </div>

              {chain.map((group, groupIdx) => (
                <div key={groupIdx} className="ml-4 border-l-2 border-slate-600 pl-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">Group {groupIdx}</span>
                    <button
                      onClick={() => addStepToGroup(chainIdx, groupIdx)}
                      className="text-[10px] px-1 py-0.5 rounded bg-slate-700 text-slate-400 hover:bg-slate-600"
                    >
                      + Step
                    </button>
                    <button
                      onClick={() => removeStepGroup(chainIdx, groupIdx)}
                      className="text-[10px] px-1 py-0.5 rounded text-red-400 hover:text-red-300"
                    >
                      &times;
                    </button>
                  </div>

                  {group.map((step, stepIdx) => (
                    <div key={stepIdx} className="bg-slate-800/50 rounded p-2 space-y-1">
                      <input
                        value={step.description}
                        onChange={e => updateStep(chainIdx, groupIdx, stepIdx, s => ({ ...s, description: e.target.value }))}
                        className="bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 w-full border border-slate-600"
                      />

                      {/* Accesses */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">Accesses:</span>
                          <button
                            onClick={() => addResource(chainIdx, groupIdx, stepIdx, 'accesses')}
                            className="text-[10px] text-blue-400 hover:text-blue-300"
                          >
                            +
                          </button>
                        </div>
                        {step.resources.accesses.map((access, resIdx) => (
                          <div key={resIdx}>
                            {renderResourceEditor(
                              access,
                              fn => updateResource(chainIdx, groupIdx, stepIdx, 'accesses', resIdx, fn),
                              () => removeResource(chainIdx, groupIdx, stepIdx, 'accesses', resIdx),
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Releases */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">Releases:</span>
                          <button
                            onClick={() => addResource(chainIdx, groupIdx, stepIdx, 'releases')}
                            className="text-[10px] text-blue-400 hover:text-blue-300"
                          >
                            +
                          </button>
                        </div>
                        {step.resources.releases.map((release, resIdx) => (
                          <div key={resIdx}>
                            {renderResourceEditor(
                              release,
                              fn => updateResource(chainIdx, groupIdx, stepIdx, 'releases', resIdx, fn),
                              () => removeResource(chainIdx, groupIdx, stepIdx, 'releases', resIdx),
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}

          <button
            onClick={addChain}
            className="w-full py-2 rounded border border-dashed border-slate-600 text-xs text-slate-400 hover:text-slate-300 hover:border-slate-500"
          >
            + Add Chain
          </button>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-slate-700">
          <button
            onClick={() => onApply(editScenario)}
            className="px-4 py-1.5 rounded text-xs bg-blue-600 text-white hover:bg-blue-500 font-medium"
          >
            Apply &amp; Visualize
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
