import { useState, useCallback, useMemo } from 'react';
import { Scenario, Stage, PositionedStep } from '../types';
import { SeededRNG } from '../utils/rng';
import { maybeMergeChains, MaybeMergeChainsTrace } from '../algorithms/chain-merge';
import { generateStagePlan, StepPermutationTrace } from '../algorithms/step-permutation';
import { createConcurrentSteps, ConcurrentGroupingTrace } from '../algorithms/concurrent-grouping';
import { dynamicResolutions, applyResolutions } from '../scenarios/preloaded';
import { resourceConflicts } from '../algorithms/resources';

export type Phase =
  | 'initial'
  | 'prePlan'
  | 'conflict'
  | 'merge'
  | 'permutation'
  | 'concurrent'
  | 'plan';

export const PHASES: { key: Phase; label: string; description: string }[] = [
  { key: 'initial', label: 'Initial State', description: 'The initial DAG showing all chains as independent parallel columns.' },
  { key: 'prePlan', label: 'PrePlan', description: 'Dynamic steps query the live database to discover resources and declare locks.' },
  { key: 'conflict', label: 'Conflict Detection', description: 'Union-find groups chains with conflicting resource accesses.' },
  { key: 'merge', label: 'Chain Merging', description: 'Chains merged via rejection-sampled interleaving with lock validation.' },
  { key: 'permutation', label: 'Step Permutation', description: 'Steps are randomly permuted via adjacent swaps respecting chain ordering.' },
  { key: 'concurrent', label: 'Concurrent Grouping', description: 'Steps are grouped for concurrent execution respecting resource constraints.' },
  { key: 'plan', label: 'Test Plan', description: 'Final executable test plan as a tree, matching the output of TestPlan.String().' },
];

export interface PipelineState {
  scenario: Scenario;
  phase: Phase;
  stageIndex: number;
  initialStage: Stage;
  mergeTrace?: MaybeMergeChainsTrace;
  mergedStage?: Stage;
  permutationTrace?: StepPermutationTrace;
  permutedSteps?: PositionedStep[];
  concurrentTrace?: ConcurrentGroupingTrace;
  stepIndex: number;
  maxSteps: number;
}

export function usePipeline(initialScenario: Scenario) {
  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [seed, setSeed] = useState<number>(initialScenario.seed);
  const [phase, setPhase] = useState<Phase>('initial');
  const [stageIndex, setStageIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const numStages = scenario.stages.length;

  const results = useMemo(() => {
    const rng = new SeededRNG(seed);
    // The raw stage from the scenario (dynamic steps have unresolved names)
    const rawStage = scenario.stages[stageIndex] || scenario.stages[0];
    // The fully resolved stage (all PrePlan applied) — used for merge/permutation/etc
    const resolvedStage = applyResolutions(rawStage, stageIndex);
    const { result: mergedStage, trace: mergeTrace } = maybeMergeChains(resolvedStage, rng);
    const { steps: permutedSteps, trace: permutationTrace } = generateStagePlan(mergedStage, rng);

    // Build a forced valid grouping with a realistic mix:
    // ~70% single steps, ~20% pairs, ~10% triples.
    // First find all boundaries where adjacent steps can be grouped,
    // then selectively unsplit a few to create a natural-looking result.
    let forcedSplitPoints: boolean[] | undefined;
    if (permutedSteps.length > 1) {
      const n = permutedSteps.length;
      const sp = new Array(n - 1).fill(true); // start with all split

      // Find groupable boundaries (different chain, no resource conflict)
      const canGroup: boolean[] = [];
      for (let i = 0; i < n - 1; i++) {
        const a = permutedSteps[i], b = permutedSteps[i + 1];
        if (a.position.chainId === b.position.chainId) { canGroup.push(false); continue; }
        const aRes = [...a.step.resources.accesses, ...a.step.resources.releases];
        const bRes = [...b.step.resources.accesses, ...b.step.resources.releases];
        let conflict = false;
        for (const r1 of aRes) {
          for (const r2 of bRes) {
            if (resourceConflicts(r1, r2)) { conflict = true; break; }
          }
          if (conflict) break;
        }
        canGroup.push(!conflict);
      }

      // Find valid pair positions (adjacent steps from different chains, no conflict)
      const validPairPositions: number[] = [];
      for (let i = 0; i < canGroup.length; i++) {
        if (canGroup[i]) validPairPositions.push(i);
      }

      // Find valid triple positions (3 adjacent steps, all from different chains)
      const validTriplePositions: number[] = [];
      for (let i = 0; i < n - 2; i++) {
        if (!canGroup[i] || !canGroup[i + 1]) continue;
        const a = permutedSteps[i], b = permutedSteps[i + 1], c = permutedSteps[i + 2];
        // All three must be from different chains
        if (a.position.chainId === b.position.chainId ||
            a.position.chainId === c.position.chainId ||
            b.position.chainId === c.position.chainId) continue;
        validTriplePositions.push(i);
      }

      // Place groups spread across the step list:
      // 1 triple near the middle, 2 pairs spread in the first and last thirds
      const used = new Set<number>();

      // Place triple near the middle
      if (validTriplePositions.length > 0) {
        const tripleIdx = validTriplePositions[Math.floor(validTriplePositions.length * 0.5)];
        sp[tripleIdx] = false;
        sp[tripleIdx + 1] = false;
        used.add(tripleIdx); used.add(tripleIdx + 1); used.add(tripleIdx + 2);
      }

      // Place 2 pairs spread out, avoiding overlap with the triple
      const pairTargets = [0.15, 0.75]; // positions in the list
      for (const frac of pairTargets) {
        // Find the closest valid pair position to this fraction
        const targetPos = Math.floor(n * frac);
        let bestIdx = -1;
        let bestDist = Infinity;
        for (const idx of validPairPositions) {
          if (used.has(idx) || used.has(idx + 1)) continue;
          const dist = Math.abs(idx - targetPos);
          if (dist < bestDist) { bestDist = dist; bestIdx = idx; }
        }
        if (bestIdx >= 0) {
          sp[bestIdx] = false;
          used.add(bestIdx); used.add(bestIdx + 1);
        }
      }

      forcedSplitPoints = sp;
    }

    const { grouped, trace: concurrentTrace } = createConcurrentSteps(
      permutedSteps, mergedStage.maxStepConcurrency, rng, forcedSplitPoints
    );
    return {
      rawStage,       // unresolved (for Initial State and PrePlan phases)
      resolvedStage,  // fully resolved (for conflict detection onward)
      mergeTrace,
      mergedStage,
      permutationTrace,
      permutedSteps,
      concurrentTrace,
      concurrentGroups: grouped,
    };
  }, [scenario, seed, stageIndex]);

  const maxSteps = useMemo(() => {
    switch (phase) {
      case 'prePlan':
        return dynamicResolutions.filter(r => r.stageIndex === stageIndex).length;
      case 'conflict':
        return results.mergeTrace?.unionFindTrace.comparisons.length ?? 0;
      case 'merge': {
        // For each pairwise merge: split view, then for each attempt show
        // Per merge: 1 (split) + per failed attempt: 3 (animate-in, validate-fail, animate-back)
        //           + successful: 2 (animate-in, validate-pass)
        // = 1 + failed*3 + 2 = 3 + failed*3
        const traces = results.mergeTrace?.mergeTraces ?? [];
        if (traces.length === 0) return 0;
        let total = 0;
        for (const t of traces) {
          const failedCount = t.attempts.filter(a => !a.valid).length;
          total += 3 + failedCount * 3;
        }
        return total + 1; // +1 for final merged DAG view
      }
      case 'permutation':
        return results.permutationTrace?.sampledSwaps.length ?? 0;
      case 'concurrent':
        return results.concurrentTrace?.attempts.length ?? 0;
      default:
        return 0;
    }
  }, [phase, results]);

  const goToPhase = useCallback((p: Phase) => {
    setPhase(p);
    setStepIndex(0);
  }, []);

  // Linear next: advance phase, or wrap to next stage
  const next = useCallback(() => {
    const phaseIdx = PHASES.findIndex(p => p.key === phase);
    if (phaseIdx < PHASES.length - 1) {
      goToPhase(PHASES[phaseIdx + 1].key);
    } else if (stageIndex < numStages - 1) {
      setStageIndex(prev => prev + 1);
      goToPhase(PHASES[0].key);
    }
  }, [phase, stageIndex, numStages, goToPhase]);

  // Linear prev: go back a phase, or wrap to previous stage's last phase
  const prev = useCallback(() => {
    const phaseIdx = PHASES.findIndex(p => p.key === phase);
    if (phaseIdx > 0) {
      goToPhase(PHASES[phaseIdx - 1].key);
    } else if (stageIndex > 0) {
      setStageIndex(prev => prev - 1);
      goToPhase(PHASES[PHASES.length - 1].key);
    }
  }, [phase, stageIndex, goToPhase]);

  const isFirst = stageIndex === 0 && PHASES.findIndex(p => p.key === phase) === 0;
  const isLast = stageIndex === numStages - 1 && PHASES.findIndex(p => p.key === phase) === PHASES.length - 1;

  const stepForward = useCallback(() => {
    setStepIndex(prev => Math.min(prev + 1, maxSteps));
  }, [maxSteps]);

  const stepBackward = useCallback(() => {
    setStepIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const jumpToEnd = useCallback(() => {
    setStepIndex(maxSteps);
  }, [maxSteps]);

  const jumpToStart = useCallback(() => {
    setStepIndex(0);
  }, []);

  const changeScenario = useCallback((s: Scenario) => {
    setScenario(s);
    setSeed(s.seed);
    setPhase('initial');
    setStepIndex(0);
    setStageIndex(0);
  }, []);

  const changeStageIndex = useCallback((idx: number) => {
    setStageIndex(idx);
    setPhase('initial');
    setStepIndex(0);
  }, []);

  const changeSeed = useCallback((newSeed: number) => {
    setSeed(newSeed);
    setStepIndex(0);
  }, []);

  const randomizeSeed = useCallback(() => {
    setSeed(Math.floor(Math.random() * 10000));
    setStepIndex(0);
  }, []);

  return {
    scenario,
    seed,
    phase,
    stageIndex,
    stepIndex,
    maxSteps,
    results,
    goToPhase,
    next,
    prev,
    isFirst,
    isLast,
    stepForward,
    stepBackward,
    jumpToEnd,
    jumpToStart,
    changeScenario,
    changeStageIndex,
    changeSeed,
    randomizeSeed,
  };
}
