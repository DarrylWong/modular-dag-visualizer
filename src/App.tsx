import { useState, useEffect, useCallback } from 'react';
import { usePipeline } from './hooks/usePipeline';
import { preloadedScenarios } from './scenarios/preloaded';
import ScenarioSelector from './components/ScenarioSelector';
import { PhaseBar, NavBar } from './components/PipelineController';
import ScenarioEditor from './components/ScenarioEditor';
import InitialStatePanel from './components/panels/InitialStatePanel';
import PrePlanPanel from './components/panels/PrePlanPanel';
import ConflictDetectionPanel from './components/panels/ConflictDetectionPanel';
import ChainMergingPanel from './components/panels/ChainMergingPanel';
import LockValidationPanel from './components/panels/LockValidationPanel';
import StepPermutationPanel from './components/panels/StepPermutationPanel';
import ConcurrentGroupingPanel from './components/panels/ConcurrentGroupingPanel';
import TestPlanPanel from './components/panels/TestPlanPanel';
import { Step } from './types';

function App() {
  const [showEditor, setShowEditor] = useState(false);
  const [selectedStep, setSelectedStep] = useState<Step | null>(null);

  const pipeline = usePipeline(preloadedScenarios[0]);

  // Keyboard navigation: left/right arrows
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't capture if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (pipeline.maxSteps > 0 && pipeline.stepIndex > 0) {
        pipeline.stepBackward();
      } else {
        pipeline.prev();
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (pipeline.maxSteps > 0 && pipeline.stepIndex < pipeline.maxSteps) {
        pipeline.stepForward();
      } else {
        pipeline.next();
      }
    }
  }, [pipeline]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const renderPhasePanel = () => {
    const { phase, results, stepIndex } = pipeline;

    switch (phase) {
      case 'initial':
        return <InitialStatePanel stage={results.rawStage} onStepClick={setSelectedStep} />;

      case 'prePlan':
        return <PrePlanPanel stage={results.rawStage} stageIndex={pipeline.stageIndex} stepIndex={stepIndex} onStepClick={setSelectedStep} />;

      case 'conflict':
        return results.mergeTrace ? (
          <ConflictDetectionPanel
            stage={results.resolvedStage}
            trace={results.mergeTrace}
            stepIndex={stepIndex}
            onStepClick={setSelectedStep}
          />
        ) : null;

      case 'merge':
        return results.mergeTrace && results.mergedStage ? (
          <ChainMergingPanel
            stage={results.resolvedStage}
            mergedStage={results.mergedStage}
            trace={results.mergeTrace}
            stepIndex={stepIndex}
          />
        ) : null;

      case 'permutation':
        return results.permutationTrace ? (
          <StepPermutationPanel
            trace={results.permutationTrace}
            stepIndex={stepIndex}
          />
        ) : null;

      case 'concurrent':
        return results.concurrentTrace && results.permutedSteps ? (
          <ConcurrentGroupingPanel
            trace={results.concurrentTrace}
            steps={results.permutedSteps}
            stepIndex={stepIndex}
          />
        ) : null;

      case 'plan':
        return results.concurrentGroups ? (
          <TestPlanPanel
            stageName={pipeline.scenario.stages[pipeline.stageIndex].name}
            seed={pipeline.seed}
            groups={results.concurrentGroups}
          />
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <ScenarioSelector
        current={pipeline.scenario}
        onSelect={pipeline.changeScenario}
        seed={pipeline.seed}
        onSeedChange={pipeline.changeSeed}
        onRandomize={pipeline.randomizeSeed}
        onEditClick={() => setShowEditor(true)}
        stageIndex={pipeline.stageIndex}
        onStageChange={pipeline.changeStageIndex}
      />

      <PhaseBar
        phase={pipeline.phase}
        stageName={pipeline.scenario.stages[pipeline.stageIndex].name}
        onPhaseSelect={pipeline.goToPhase}
      />

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-hidden">
          {renderPhasePanel()}
        </div>

        {selectedStep && (
          <StepDetailPanel step={selectedStep} onClose={() => setSelectedStep(null)} />
        )}
      </div>

      <NavBar
        stepIndex={pipeline.stepIndex}
        maxSteps={pipeline.maxSteps}
        isFirst={pipeline.isFirst}
        isLast={pipeline.isLast}
        onPrev={pipeline.prev}
        onNext={pipeline.next}
        onStepForward={pipeline.stepForward}
        onStepBackward={pipeline.stepBackward}
        onJumpToEnd={pipeline.jumpToEnd}
        onJumpToStart={pipeline.jumpToStart}
      />

      {showEditor && (
        <ScenarioEditor
          scenario={pipeline.scenario}
          onApply={(s) => {
            pipeline.changeScenario(s);
            setShowEditor(false);
          }}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}

function StepDetailPanel({ step, onClose }: { step: Step; onClose: () => void }) {
  const { accesses, releases } = step.resources;
  const hasResources = accesses.length > 0 || releases.length > 0;

  const formatAction = (action: string) => {
    switch (action) {
      case '*': return 'Any';
      case 'schema_change': return 'Schema Change';
      case 'restore': return 'Restore';
      case 'cluster_setting': return 'Cluster Setting';
      case 'node_availability': return 'Node Availability';
      default: return action;
    }
  };

  const formatPath = (path: Step['resources']['accesses'][0]['path']) => {
    switch (path.type) {
      case 'database':
        return path.table ? `${path.database}.${path.table}` : path.database;
      case 'cluster_setting':
        return path.name;
      case 'node_availability':
        return path.nodeId ? `node ${path.nodeId}` : 'all nodes';
    }
  };

  return (
    <div className="w-72 flex-shrink-0 border-l border-slate-700 bg-slate-800/80 overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
        <span className="text-xs text-slate-400">Step Detail</span>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm">&times;</button>
      </div>

      <div className="p-3 space-y-3">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Name</div>
          <div className="text-sm text-slate-200">{step.description}</div>
        </div>

        {step.isDynamic && (
          <div className="text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 inline-block">
            Dynamic Step
          </div>
        )}

        {hasResources ? (
          <>
            {accesses.length > 0 && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Acquires</div>
                <div className="space-y-1.5">
                  {accesses.map((a, i) => (
                    <div key={i} className="text-xs p-2 rounded bg-slate-900/50 border border-slate-700">
                      <div className={`font-medium ${a.lock ? 'text-red-400' : 'text-blue-400'}`}>
                        {a.lock ? 'Exclusive Lock' : 'Shared Access'}
                      </div>
                      <div className="text-slate-400 mt-1">
                        <span className="text-slate-500">Action:</span> {formatAction(a.action)}
                      </div>
                      <div className="text-slate-300 font-mono">
                        <span className="text-slate-500">Resource:</span> {formatPath(a.path)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {releases.length > 0 && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Releases</div>
                <div className="space-y-1.5">
                  {releases.map((r, i) => (
                    <div key={i} className="text-xs p-2 rounded bg-slate-900/50 border border-slate-700">
                      <div className="text-slate-400">
                        <span className="text-slate-500">Action:</span> {formatAction(r.action)}
                      </div>
                      <div className="text-slate-300 font-mono">
                        <span className="text-slate-500">Resource:</span> {formatPath(r.path)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-slate-500">No resource locks.</div>
        )}
      </div>
    </div>
  );
}

export default App;
