import { useMemo } from 'react';
import { Stage, Step } from '../../types';
import DAGRenderer from '../dag/DAGRenderer';
import { dynamicResolutions, availableTables, availableDatabases, applyResolutions, DynamicResolution } from '../../scenarios/preloaded';
import { getChainColor } from '../../utils/colors';
import { resourcePathString } from '../../algorithms/resources';

interface Props {
  stage: Stage;  // raw stage with unresolved names
  stageIndex?: number;
  stepIndex: number;
  onStepClick?: (step: Step) => void;
}

export default function PrePlanPanel({ stage, stageIndex, stepIndex, onStepClick }: Props) {
  const si = stageIndex ?? 0;
  const resolutions = dynamicResolutions.filter(r => r.stageIndex === si);

  const revealedCount = stepIndex;
  const currentResolution = revealedCount > 0 ? resolutions[revealedCount - 1] : null;

  // Build partially resolved stage for the DAG
  const displayStage = useMemo(
    () => applyResolutions(stage, si, revealedCount),
    [stage, si, revealedCount]
  );

  const resolvedChains = new Set(resolutions.slice(0, revealedCount).map(r => r.chainIndex));
  const currentChain = currentResolution?.chainIndex;
  const dynamicChainIndices = new Set(resolutions.map(r => r.chainIndex));
  const highlightChains = currentChain !== undefined ? [currentChain] : undefined;
  const dimChains = Array.from(dynamicChainIndices).filter(
    c => !resolvedChains.has(c) && c !== currentChain
  );

  return (
    <div className="flex flex-col lg:flex-row h-full">
      <div className="flex-1 overflow-auto p-4">
        <DAGRenderer
          stage={displayStage}
          onStepClick={onStepClick}
          highlightChains={highlightChains}
          dimChains={revealedCount === 0 ? Array.from(dynamicChainIndices) : dimChains}
        />
      </div>

      {/* Right: step-by-step PrePlan simulation */}
      <div className="w-full lg:w-[440px] flex-shrink-0 overflow-y-auto border-l border-slate-700 p-3 space-y-2">
        {revealedCount === 0 && resolutions.length > 0 && (
          <div className="text-xs text-slate-500 p-3 bg-slate-800/50 rounded border border-slate-700">
            {resolutions.length} dynamic step{resolutions.length !== 1 ? 's' : ''} need PrePlan.
            Step through to see each one query the database and discover its resources.
          </div>
        )}

        {resolutions.map((r, i) => {
          if (i >= revealedCount) {
            // Not yet revealed — show as pending
            return (
              <div key={i} className="rounded border border-slate-700 bg-slate-800/30 px-3 py-2 flex items-center gap-2 opacity-40">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getChainColor(r.chainIndex) }} />
                <span className="text-xs text-slate-500 font-mono">{r.stepDescription}</span>
                <span className="text-[10px] text-slate-600 ml-auto">pending</span>
              </div>
            );
          }

          const isCurrent = i === revealedCount - 1;
          return (
            <PrePlanSimulation
              key={i}
              resolution={r}
              isCurrent={isCurrent}
            />
          );
        })}
      </div>
    </div>
  );
}

function PrePlanSimulation({
  resolution,
  isCurrent,
}: {
  resolution: DynamicResolution;
  isCurrent: boolean;
}) {
  const chainColor = getChainColor(resolution.chainIndex);
  const firstResolved = resolution.resolvedSteps?.[0];

  const isTableSearch = resolution.prePlanAction.includes('SearchTable');
  const isDbSearch = resolution.prePlanAction.includes('findDatabaseToBackup');
  const isNodeSearch = resolution.prePlanAction.includes('RandomAvailableNode') || resolution.prePlanAction.includes('node');
  const isSettingSearch = resolution.prePlanAction.includes('setting');

  return (
    <div className={`rounded border overflow-hidden text-xs transition-all ${
      isCurrent ? 'border-blue-500/50 bg-slate-800/80' : 'border-slate-700 bg-slate-800/30'
    }`}>
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-slate-700/50 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chainColor }} />
        <span className="text-slate-300">Chain {resolution.chainIndex}</span>
        <span className="text-slate-500 ml-auto font-mono">{resolution.stepDescription}</span>
      </div>

      {/* Simulated query */}
      <div className="p-2">
        <div className="font-mono text-[11px] bg-slate-900 rounded p-2 border border-slate-700 space-y-0.5">
          {isTableSearch && (
            <>
              <div className="text-blue-400">h.SearchTable(filter: columns &gt;= 2)</div>
              <div className="text-slate-500">-- scanning available tables:</div>
              {availableTables.map((t, i) => {
                const isMatch = resolution.discoveredResource.includes(`${t.database}.${t.table}`);
                return (
                  <div key={i} className={isMatch ? 'text-green-400' : 'text-slate-600'}>
                    {'  '}{t.database}.{t.table} {isMatch ? '<-- selected' : ''}
                  </div>
                );
              })}
            </>
          )}
          {isDbSearch && (
            <>
              <div className="text-blue-400">findDatabaseToBackup(whitelist: [&quot;tpcc&quot;, &quot;cct_tpcc&quot;, &quot;bank&quot;])</div>
              <div className="text-slate-500">-- SHOW DATABASES:</div>
              {availableDatabases.map((db, i) => {
                const isMatch = resolution.discoveredResource.includes(db);
                return (
                  <div key={i} className={isMatch ? 'text-green-400' : 'text-slate-600'}>
                    {'  '}{db} {isMatch ? '<-- selected' : ''}
                  </div>
                );
              })}
            </>
          )}
          {isNodeSearch && (
            <>
              <div className="text-blue-400">h.RandomAvailableNode()</div>
              <div className="text-slate-500">-- checking node liveness:</div>
              {[1, 2, 3, 4].map(n => {
                const isMatch = resolution.discoveredResource.includes(`${n}`);
                return (
                  <div key={n} className={isMatch ? 'text-green-400' : 'text-slate-600'}>
                    {'  '}node {n}: alive {isMatch ? '<-- selected' : ''}
                  </div>
                );
              })}
            </>
          )}
          {isSettingSearch && (
            <>
              <div className="text-blue-400">selectRandomSetting(safe_settings_list)</div>
              <div className="text-slate-500">-- picking from allowed settings:</div>
              <div className="text-green-400">
                {'  '}{resolution.discoveredResource}
              </div>
            </>
          )}
        </div>

        {/* Result */}
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="text-green-400">-&gt;</span>
          <span className="text-slate-300 font-mono">{resolution.resolvedDescription}</span>
          {firstResolved && firstResolved.accesses.length > 0 && (
            <span className={`font-mono ml-auto ${firstResolved.accesses[0].lock ? 'text-red-400' : 'text-blue-400'}`}>
              {firstResolved.accesses[0].lock ? 'lock' : 'access'}({resourcePathString(firstResolved.accesses[0].path)})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
