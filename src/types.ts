// Resource action types - mirrors Go's ResourceAction constants
export type ResourceAction = '*' | 'schema_change' | 'restore' | 'cluster_setting' | 'node_availability';

// Resource path types - mirrors Go's ResourcePath interface implementations
export type ResourcePath =
  | { type: 'database'; database: string; table?: string }
  | { type: 'cluster_setting'; name: string }
  | { type: 'node_availability'; nodeId?: number };

// ResourceAccess - mirrors Go's ResourceAccess struct
export interface ResourceAccess {
  action: ResourceAction;
  path: ResourcePath;
  lock: boolean; // true = exclusive lock, false = non-exclusive access
}

// Step represents a single operation in a chain
export interface Step {
  description: string;
  resources: {
    accesses: ResourceAccess[];
    releases: ResourceAccess[];
  };
  isDynamic?: boolean;
}

// A step group is a set of steps at the same depth that can be interchanged
export type StepGroup = Step[];

// A chain is an ordered sequence of step groups
export type Chain = StepGroup[];

// A stage contains multiple chains that converge at start and end
export interface Stage {
  name: string;
  chains: Chain[];
  maxStepConcurrency: number;
}

// A scenario is a complete test configuration
export interface Scenario {
  name: string;
  description: string;
  seed: number;
  stages: Stage[];
}

// Position of a step in the DAG
export interface StepPosition {
  chainId: number;
  depth: number;
}

// A positioned step is a step with its position in the DAG
export interface PositionedStep {
  step: Step;
  position: StepPosition;
}

// Concurrent group of steps that can run in parallel
export interface ConcurrentGroup {
  steps: PositionedStep[];
}

// Final plan after all pipeline phases
export interface FinalPlan {
  steps: (PositionedStep | ConcurrentGroup)[];
}

// Step span for concurrent grouping
export interface StepSpan {
  start: number;
  end: number;
}
