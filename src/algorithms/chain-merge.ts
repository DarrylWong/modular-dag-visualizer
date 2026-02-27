import { Chain, Stage, ResourceAccess, Step } from '../types';
import { SeededRNG } from '../utils/rng';
import { resourceConflicts } from './resources';
import { hasValidLockSequenceForChain, LockValidationTrace } from './lock-validation';
import { findConflictingChains, UnionFindTrace } from './union-find';

// Trace types for step-through visualization
export interface MergeAttempt {
  order: number[];
  result: Chain;
  valid: boolean;
  attemptNumber: number;
  lockTrace: LockValidationTrace;
}

export interface ChainMergeTrace {
  chain1: Chain;
  chain2: Chain;
  // Labels for the two inputs (e.g. "C1" and "C2", or "C1+C2" and "C3")
  label1: string;
  label2: string;
  attempts: MergeAttempt[];
  finalResult: Chain;
}

export interface MaybeMergeChainsTrace {
  chainResources: ResourceAccess[][];
  unionFindTrace: UnionFindTrace;
  groups: number[][];
  mergeTraces: ChainMergeTrace[];
  resultStage: Stage;
}

// Port of planner.go:330-391 — mergeTwoChains
export function mergeTwoChains(
  c1: Chain,
  c2: Chain,
  rng: SeededRNG,
  maxAttempts = 1000,
  forcedFirstOrder?: number[]
): { merged: Chain; attempts: MergeAttempt[] } {
  const attempts: MergeAttempt[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Create order slice: len(c1) entries of 0, len(c2) entries of 1
    const order: number[] = [
      ...Array(c1.length).fill(0),
      ...Array(c2.length).fill(1),
    ];

    if (attempt === 0 && forcedFirstOrder) {
      // Use the forced order for the first attempt (to demonstrate failure)
      order.splice(0, order.length, ...forcedFirstOrder);
    } else {
      // Shuffle the order
      rng.shuffle(order);
    }

    // Pull stepGroups from each chain according to the order
    const result: Chain = [];
    let c1Ptr = 0;
    let c2Ptr = 0;

    for (const chainIdx of order) {
      if (chainIdx === 0) {
        result.push(c1[c1Ptr]);
        c1Ptr++;
      } else {
        result.push(c2[c2Ptr]);
        c2Ptr++;
      }
    }

    // Validate the lock sequence
    const { valid, trace: lockTrace } = hasValidLockSequenceForChain(result);

    attempts.push({
      order: [...order],
      result: result,
      valid,
      attemptNumber: attempt + 1,
      lockTrace,
    });

    if (valid) {
      return { merged: result, attempts };
    }
  }

  // Failed to find valid merge
  throw new Error(
    `Failed to find valid interleaving after ${maxAttempts} attempts ` +
    `when merging chains with ${c1.length} and ${c2.length} stepGroups`
  );
}

// Port of planner.go:317-327 — mergeChains (pairwise merge)
export function mergeChains(
  chains: Chain[],
  chainIndices: number[],
  rng: SeededRNG,
  forcedFirstOrders?: Map<number, number[]>
): { merged: Chain; traces: ChainMergeTrace[] } {
  const traces: ChainMergeTrace[] = [];
  let result = chains[0];
  let resultLabel = `C${chainIndices[0]}`;
  let pairwiseIdx = 0;

  for (let i = 1; i < chains.length; i++) {
    const nextLabel = `C${chainIndices[i]}`;
    const forced = forcedFirstOrders?.get(pairwiseIdx);
    const { merged, attempts } = mergeTwoChains(result, chains[i], rng, 1000, forced);
    pairwiseIdx++;
    traces.push({
      chain1: result,
      chain2: chains[i],
      label1: resultLabel,
      label2: nextLabel,
      attempts,
      finalResult: merged,
    });
    resultLabel = `${resultLabel}+${nextLabel}`;
    result = merged;
  }

  return { merged: result, traces };
}

// Collect all resource accesses from a chain
function collectChainResources(chain: Chain): ResourceAccess[] {
  const resources: ResourceAccess[] = [];
  for (const stepGroup of chain) {
    for (const step of stepGroup) {
      resources.push(...step.resources.accesses);
      resources.push(...step.resources.releases);
    }
  }
  return resources;
}

// Port of planner.go:256-312 — maybeMergeChains
export function maybeMergeChains(
  stage: Stage,
  rng: SeededRNG
): { result: Stage; trace: MaybeMergeChainsTrace } {
  if (stage.chains.length <= 1) {
    return {
      result: stage,
      trace: {
        chainResources: stage.chains.map(collectChainResources),
        unionFindTrace: {
          initialParent: stage.chains.length === 1 ? [0] : [],
          comparisons: [],
          finalGroups: stage.chains.length === 1 ? [[0]] : [],
        },
        groups: stage.chains.length === 1 ? [[0]] : [],
        mergeTraces: [],
        resultStage: stage,
      },
    };
  }

  // Collect resource accesses for each chain
  const chainResources = stage.chains.map(collectChainResources);

  // Find conflicting chains using union-find
  const { groups, trace: unionFindTrace } = findConflictingChains(chainResources);

  // Merge each group
  const newChains: Chain[] = [];
  const mergeTraces: ChainMergeTrace[] = [];

  for (const group of groups) {
    if (group.length === 1) {
      newChains.push(stage.chains[group[0]]);
    } else {
      // For the backup/restore group (contains chains 9 and 10),
      // force a bad first interleaving to demonstrate lock validation failure.
      let forcedFirstOrders: Map<number, number[]> | undefined;
      if (group.includes(9) && group.includes(10)) {
        // C9 has 3 step groups, C10 has 2.
        // Order [0, 1, 0, 0, 1] puts C10's lock right after C9's lock → conflict
        forcedFirstOrders = new Map([[0, [0, 1, 0, 0, 1]]]);
      }

      const chainsToMerge = group.map(idx => stage.chains[idx]);
      const { merged, traces } = mergeChains(chainsToMerge, group, rng, forcedFirstOrders);
      newChains.push(merged);
      mergeTraces.push(...traces);
    }
  }

  const resultStage: Stage = {
    name: stage.name,
    chains: newChains,
    maxStepConcurrency: stage.maxStepConcurrency,
  };

  return {
    result: resultStage,
    trace: {
      chainResources,
      unionFindTrace,
      groups,
      mergeTraces,
      resultStage,
    },
  };
}
