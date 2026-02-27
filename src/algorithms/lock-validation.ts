import { Step, Chain, ResourceAccess } from '../types';
import { resourceConflicts, resourceAccessString } from './resources';

// Trace types for step-through visualization
export interface LockValidationStepTrace {
  stepIndex: number;
  stepDescription: string;
  heldBefore: Map<string, ResourceAccess>;
  accessesProcessed: {
    access: ResourceAccess;
    conflictWith?: ResourceAccess;
    accepted: boolean;
  }[];
  releasesProcessed: {
    release: ResourceAccess;
    wasHeld: boolean;
    lockTypeMatch: boolean;
  }[];
  heldAfter: Map<string, ResourceAccess>;
  valid: boolean;
}

export interface LockValidationTrace {
  steps: LockValidationStepTrace[];
  valid: boolean;
}

// Port of planner.go:405-458 — hasValidLockSequence
export function hasValidLockSequence(steps: Step[]): { valid: boolean; trace: LockValidationTrace } {
  const heldResources = new Map<string, ResourceAccess>();
  const traceSteps: LockValidationStepTrace[] = [];
  let overallValid = true;

  for (let idx = 0; idx < steps.length; idx++) {
    const step = steps[idx];
    const heldBefore = new Map(heldResources);
    const accessesProcessed: LockValidationStepTrace['accessesProcessed'] = [];
    const releasesProcessed: LockValidationStepTrace['releasesProcessed'] = [];
    let stepValid = true;

    // Process accesses
    for (const access of step.resources.accesses) {
      let conflictWith: ResourceAccess | undefined;
      let accepted = true;

      // Check against all held resources for conflicts
      for (const [, heldResource] of heldResources) {
        if (resourceConflicts(access, heldResource)) {
          conflictWith = heldResource;
          accepted = false;
          stepValid = false;
          overallValid = false;
          break;
        }
      }

      if (accepted) {
        heldResources.set(resourceAccessString(access), access);
      }

      accessesProcessed.push({ access, conflictWith, accepted });
    }

    // Process releases
    for (const release of step.resources.releases) {
      const key = resourceAccessString(release);
      const heldResource = heldResources.get(key);

      if (!heldResource) {
        releasesProcessed.push({ release, wasHeld: false, lockTypeMatch: false });
        stepValid = false;
        overallValid = false;
      } else if (release.lock !== heldResource.lock) {
        releasesProcessed.push({ release, wasHeld: true, lockTypeMatch: false });
        stepValid = false;
        overallValid = false;
      } else {
        releasesProcessed.push({ release, wasHeld: true, lockTypeMatch: true });
        heldResources.delete(key);
      }
    }

    traceSteps.push({
      stepIndex: idx,
      stepDescription: step.description,
      heldBefore,
      accessesProcessed,
      releasesProcessed,
      heldAfter: new Map(heldResources),
      valid: stepValid,
    });

    if (!overallValid) break;
  }

  return {
    valid: overallValid,
    trace: { steps: traceSteps, valid: overallValid },
  };
}

// Port of hasValidLockSequenceForChain - flattens chain to steps
export function hasValidLockSequenceForChain(chain: Chain): { valid: boolean; trace: LockValidationTrace } {
  const steps: Step[] = [];
  for (const stepGroup of chain) {
    steps.push(...stepGroup);
  }
  return hasValidLockSequence(steps);
}
