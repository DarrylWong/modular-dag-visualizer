import { ResourceAccess } from '../types';
import { resourceConflicts } from './resources';

// Trace types for step-through visualization
export interface UnionFindComparison {
  i: number;
  j: number;
  conflictFound: boolean;
  conflictingResources?: { res1: ResourceAccess; res2: ResourceAccess };
  parentAfter: number[];
}

export interface UnionFindTrace {
  initialParent: number[];
  comparisons: UnionFindComparison[];
  finalGroups: number[][];
}

// Port of planner.go:186-252 — findConflictingChains
export function findConflictingChains(
  chainResources: ResourceAccess[][]
): { groups: number[][]; trace: UnionFindTrace } {
  const n = chainResources.length;

  // Initialize: each chain starts in its own group
  const parent = Array.from({ length: n }, (_, i) => i);
  const initialParent = [...parent];

  // find(x) returns the root of x's group (with path compression)
  function find(x: number): number {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]);
    }
    return parent[x];
  }

  // union(x, y) merges the groups containing x and y
  function union(x: number, y: number): void {
    const px = find(x);
    const py = find(y);
    if (px !== py) {
      parent[px] = py;
    }
  }

  const comparisons: UnionFindComparison[] = [];

  // Find all conflicting pairs
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let conflictFound = false;
      let conflictingRes: { res1: ResourceAccess; res2: ResourceAccess } | undefined;

      for (const res1 of chainResources[i]) {
        for (const res2 of chainResources[j]) {
          if (resourceConflicts(res1, res2)) {
            conflictFound = true;
            conflictingRes = { res1, res2 };
            break;
          }
        }
        if (conflictFound) break;
      }

      if (conflictFound) {
        union(i, j);
      }

      comparisons.push({
        i,
        j,
        conflictFound,
        conflictingResources: conflictingRes,
        parentAfter: [...parent],
      });
    }
  }

  // Group chains by their root parent
  const groupMap = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groupMap.has(root)) {
      groupMap.set(root, []);
    }
    groupMap.get(root)!.push(i);
  }

  // Convert to sorted array
  const groups = Array.from(groupMap.values());
  groups.sort((a, b) => a[0] - b[0]);

  return {
    groups,
    trace: {
      initialParent,
      comparisons,
      finalGroups: groups,
    },
  };
}
