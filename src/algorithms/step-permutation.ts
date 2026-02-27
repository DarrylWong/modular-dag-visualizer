import { Stage, PositionedStep } from '../types';
import { SeededRNG } from '../utils/rng';

export interface SwapAttempt {
  firstIdx: number;
  secondIdx: number;
  firstStep: PositionedStep;
  secondStep: PositionedStep;
  validSwap: boolean;
  swapped: boolean;
  // snapshot of the full ordering after this swap (or non-swap)
  orderAfter: PositionedStep[];
}

export interface StepPermutationTrace {
  initialOrder: PositionedStep[];
  totalIterations: number;
  sampledSwaps: SwapAttempt[];
  finalOrder: PositionedStep[];
}

export function generateStagePlan(
  stage: Stage,
  rng: SeededRNG
): { steps: PositionedStep[]; trace: StepPermutationTrace } {
  const steps: PositionedStep[] = [];
  for (let chainId = 0; chainId < stage.chains.length; chainId++) {
    const chain = stage.chains[chainId];
    for (let depth = 0; depth < chain.length; depth++) {
      const stepGroup = chain[depth];
      for (const step of stepGroup) {
        steps.push({ step, position: { chainId, depth } });
      }
    }
  }

  const initialOrder = steps.map(s => ({ ...s }));
  const numSteps = steps.length;

  if (numSteps <= 1) {
    return {
      steps,
      trace: { initialOrder, totalIterations: 0, sampledSwaps: [], finalOrder: [...initialOrder] },
    };
  }

  const isValidSwap = (i: PositionedStep, j: PositionedStep): boolean => {
    if (i.position.chainId !== j.position.chainId) return true;
    return i.position.depth === j.position.depth;
  };

  const iterations = Math.ceil(
    Math.pow(numSteps, 3) * Math.log(numSteps)
  ) + rng.intn(2);

  const sampledSwaps: SwapAttempt[] = [];
  const sampleLimit = 40;

  for (let iter = 0; iter < iterations; iter++) {
    const first = rng.intn(numSteps - 1);
    const second = first + 1;
    const valid = isValidSwap(steps[first], steps[second]);
    const shouldSample = iter < sampleLimit;

    if (valid) {
      [steps[first], steps[second]] = [steps[second], steps[first]];
    }

    if (shouldSample) {
      sampledSwaps.push({
        firstIdx: first,
        secondIdx: second,
        firstStep: { ...steps[first] },
        secondStep: { ...steps[second] },
        validSwap: valid,
        swapped: valid,
        orderAfter: steps.map(s => ({ ...s })),
      });
    }
  }

  return {
    steps,
    trace: {
      initialOrder,
      totalIterations: iterations,
      sampledSwaps,
      finalOrder: steps.map(s => ({ ...s })),
    },
  };
}
