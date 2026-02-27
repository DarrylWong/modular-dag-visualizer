import { PositionedStep, StepSpan, Step } from '../types';
import { SeededRNG } from '../utils/rng';
import { resourceConflicts } from './resources';

// Trace types
export interface SpanAttempt {
  splitPoints: boolean[];
  spans: StepSpan[];
  valid: boolean;
  invalidReason?: string;
}

export interface ConcurrentGroupingTrace {
  attempts: SpanAttempt[];
  finalSpans: StepSpan[];
  finalGroups: ConcurrentGroupResult[];
}

export interface ConcurrentGroupResult {
  steps: PositionedStep[];
  isConcurrent: boolean;
}

// Port of planner.go:129-149 — hasConcurrentConflict
function hasConcurrentConflict(step1: Step, step2: Step): boolean {
  const allResources1 = [
    ...step1.resources.accesses,
    ...step1.resources.releases,
  ];
  const allResources2 = [
    ...step2.resources.accesses,
    ...step2.resources.releases,
  ];

  for (const res1 of allResources1) {
    for (const res2 of allResources2) {
      if (resourceConflicts(res1, res2)) {
        return true;
      }
    }
  }
  return false;
}

// Port of planner.go:497-526 — randomSpans
function randomSpans(
  rng: SeededRNG,
  numSteps: number,
  maxConcurrency: number
): { spans: StepSpan[]; valid: boolean; splitPoints: boolean[] } {
  const splitPoints: boolean[] = [];
  for (let i = 0; i < numSteps - 1; i++) {
    splitPoints.push(rng.intn(2) === 1);
  }

  const spans: StepSpan[] = [];
  let start = 0;
  for (let i = 0; i < numSteps - 1; i++) {
    if (splitPoints[i]) {
      const span: StepSpan = { start, end: i };
      if (span.end - span.start + 1 > maxConcurrency) {
        return { spans: [], valid: false, splitPoints };
      }
      spans.push(span);
      start = i + 1;
    }
  }
  const lastSpan: StepSpan = { start, end: numSteps - 1 };
  if (lastSpan.end - lastSpan.start + 1 > maxConcurrency) {
    return { spans: [], valid: false, splitPoints };
  }
  spans.push(lastSpan);
  return { spans, valid: true, splitPoints };
}

// Port of planner.go:528-566 — isValidConcurrentGroups
function isValidConcurrentGroups(
  steps: PositionedStep[],
  spans: StepSpan[]
): { valid: boolean; reason?: string } {
  for (const sp of spans) {
    const size = sp.end - sp.start + 1;
    if (size === 1) continue;

    const chains = new Map<number, number>();
    const groupSteps: PositionedStep[] = [];

    for (let idx = sp.start; idx <= sp.end; idx++) {
      const step = steps[idx];
      groupSteps.push(step);

      const existingDepth = chains.get(step.position.chainId);
      if (existingDepth !== undefined && existingDepth !== step.position.depth) {
        return {
          valid: false,
          reason: `Steps from chain ${step.position.chainId} at different depths (${existingDepth} and ${step.position.depth})`,
        };
      }
      chains.set(step.position.chainId, step.position.depth);
    }

    // Check pairwise conflicts
    for (let i = 0; i < groupSteps.length; i++) {
      for (let j = i + 1; j < groupSteps.length; j++) {
        if (hasConcurrentConflict(groupSteps[i].step, groupSteps[j].step)) {
          return {
            valid: false,
            reason: `Concurrent conflict between "${groupSteps[i].step.description}" and "${groupSteps[j].step.description}"`,
          };
        }
      }
    }
  }
  return { valid: true };
}

// Port of planner.go:470-488 — CreateConcurrentSteps
// forcedSplitPoints: if provided, use this after some random failed attempts
// to guarantee a valid grouping is found for the demo.
export function createConcurrentSteps(
  steps: PositionedStep[],
  maxConcurrency: number,
  rng: SeededRNG,
  forcedSplitPoints?: boolean[]
): { grouped: ConcurrentGroupResult[]; trace: ConcurrentGroupingTrace } {
  if (maxConcurrency <= 1 || steps.length <= 1) {
    const grouped = steps.map(s => ({ steps: [s], isConcurrent: false }));
    return {
      grouped,
      trace: {
        attempts: [],
        finalSpans: steps.map((_, i) => ({ start: i, end: i })),
        finalGroups: grouped,
      },
    };
  }

  const attempts: SpanAttempt[] = [];
  const maxTries = forcedSplitPoints ? 4 : 10000; // if forced, only try a few random first

  for (let attempt = 0; attempt < maxTries; attempt++) {
    const { spans, valid: spansValid, splitPoints } = randomSpans(rng, steps.length, maxConcurrency);

    if (!spansValid) {
      attempts.push({ splitPoints, spans, valid: false, invalidReason: 'Span exceeds max concurrency' });
      continue;
    }

    const { valid, reason } = isValidConcurrentGroups(steps, spans);
    attempts.push({ splitPoints, spans, valid, invalidReason: reason });

    if (valid) {
      const grouped = buildGroups(steps, spans);
      return { grouped, trace: { attempts, finalSpans: spans, finalGroups: grouped } };
    }
  }

  // Use forced split points if provided
  if (forcedSplitPoints && forcedSplitPoints.length === steps.length - 1) {
    const spans: StepSpan[] = [];
    let start = 0;
    for (let i = 0; i < forcedSplitPoints.length; i++) {
      if (forcedSplitPoints[i]) {
        spans.push({ start, end: i });
        start = i + 1;
      }
    }
    spans.push({ start, end: steps.length - 1 });

    const { valid, reason } = isValidConcurrentGroups(steps, spans);
    attempts.push({ splitPoints: forcedSplitPoints, spans, valid, invalidReason: reason });

    if (valid) {
      const grouped = buildGroups(steps, spans);
      return { grouped, trace: { attempts, finalSpans: spans, finalGroups: grouped } };
    }
  }

  // Fallback: all sequential
  const grouped = steps.map(s => ({ steps: [s], isConcurrent: false }));
  return {
    grouped,
    trace: {
      attempts,
      finalSpans: steps.map((_, i) => ({ start: i, end: i })),
      finalGroups: grouped,
    },
  };
}

function buildGroups(steps: PositionedStep[], spans: StepSpan[]): ConcurrentGroupResult[] {
  const grouped: ConcurrentGroupResult[] = [];
  for (const sp of spans) {
    const groupSteps = steps.slice(sp.start, sp.end + 1);
    grouped.push({ steps: groupSteps, isConcurrent: groupSteps.length > 1 });
  }
  return grouped;
}
