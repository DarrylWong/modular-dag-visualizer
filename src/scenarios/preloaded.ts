import { Scenario, Step, Stage, ResourceAccess } from '../types';

// Helper functions to build steps matching real roachtest operations
function step(description: string, accesses: ResourceAccess[] = [], releases: ResourceAccess[] = [], isDynamic = false): Step {
  return { description, resources: { accesses, releases }, isDynamic };
}

function clusterSettingLock(name: string): ResourceAccess {
  return { action: 'cluster_setting', path: { type: 'cluster_setting', name }, lock: true };
}

function schemaChangeLock(database: string, table: string): ResourceAccess {
  return { action: 'schema_change', path: { type: 'database', database, table }, lock: true };
}

function restoreLock(database: string, table?: string): ResourceAccess {
  return { action: 'restore', path: { type: 'database', database, table }, lock: true };
}

function nodeAvailabilityLock(): ResourceAccess {
  return { action: 'node_availability', path: { type: 'node_availability' }, lock: true };
}

// ---------------------------------------------------------------------------
// Realistic scenario modeled on the actual modular roachtest examples from
// pkg/cmd/roachtest/tests/modular.go (runDynamicResourceExample and
// runMergeOperationExample). This represents a mixed-version upgrade test
// on a 4-node CockroachDB cluster running TPCC.
//
// The key feature demonstrated is dynamic resource discovery. Dynamic
// operations like AddRandomIndexDynamic and BackupRestoreDatabaseDynamic
// don't know which tables/databases they'll operate on at build time.
// During PrePlan, they query the live database to discover available
// resources, then declare locks based on what they find.
//
// The scenario simulates what happens when PrePlan runs:
//   - The cluster has TPCC tables: warehouse, district, customer, history,
//     new_order, order, order_line, item, stock
//   - AddRandomIndexDynamic #1 calls h.SearchTable() → picks tpcc.customer
//   - AddRandomIndexDynamic #2 calls h.SearchTable() → also picks tpcc.customer
//     (same table! this creates a conflict that wouldn't be visible statically)
//   - AddRandomIndexDynamic #3 calls h.SearchTable() → picks tpcc.stock
//   - BackupRestoreDatabaseDynamic calls findDatabaseToBackup() → picks "tpcc"
//   - ChangeClusterSettingDynamic picks "kv.snapshot_rebalance.max_rate"
//   - NodeRestart dynamic picks node 2
//
// After PrePlan resolves, conflict detection finds:
//   - AddRandomIndex #1 and #2 both lock SchemaChange(tpcc.customer) → merge
//   - BackupRestore(tpcc) and BackupRestore(tpcc.order_line) → hierarchical
//     conflict on RestoreAccess → merge
//   - Rolling node restarts + dynamic NodeRestart all lock NodeAvailability → merge
//   - Everything else (TPCC workload, AddRandomIndex #3 on different table,
//     cluster setting, replication cycle) stays independent
// ---------------------------------------------------------------------------

// The available tables that dynamic steps can discover at PrePlan time.
// In real execution, h.SearchTable() queries the live database.
// This is what the cluster schema looks like when PrePlan runs.
export const availableTables = [
  { database: 'tpcc', table: 'warehouse' },
  { database: 'tpcc', table: 'district' },
  { database: 'tpcc', table: 'customer' },
  { database: 'tpcc', table: 'history' },
  { database: 'tpcc', table: 'new_order' },
  { database: 'tpcc', table: 'order' },
  { database: 'tpcc', table: 'order_line' },
  { database: 'tpcc', table: 'item' },
  { database: 'tpcc', table: 'stock' },
];

export const availableDatabases = ['tpcc'];

// Dynamic step metadata: what each dynamic operation discovers during PrePlan.
// This lets the UI show the before/after of resource resolution.
export interface DynamicResolution {
  chainIndex: number;  // which chain in the upgrade stage
  stageIndex: number;  // which stage
  stepDescription: string;  // name BEFORE PrePlan (e.g. "add index")
  prePlanAction: string;  // human-readable description of what PrePlan does
  discoveredResource: string;  // what it found
  resolvedDescription: string;  // step name AFTER PrePlan
  // The resolved steps to replace the chain with after PrePlan.
  // Each entry is [description, accesses, releases].
  // If not provided, only the first step's description is updated.
  resolvedSteps?: { description: string; accesses: ResourceAccess[]; releases: ResourceAccess[] }[];
}

export const dynamicResolutions: DynamicResolution[] = [
  {
    chainIndex: 5,
    stageIndex: 2,
    stepDescription: 'restart random node',
    prePlanAction: 'Selects random available node from cluster. Calls h.RandomAvailableNode() which queries node liveness.',
    discoveredResource: 'node 2',
    resolvedDescription: 'restart node 2',
    resolvedSteps: [
      { description: 'restart node 2', accesses: [nodeAvailabilityLock()], releases: [nodeAvailabilityLock()] },
    ],
  },
  {
    chainIndex: 6,
    stageIndex: 2,
    stepDescription: 'add index',
    prePlanAction: 'Calls h.SearchTable() to find a table with >= 2 columns. Queries SHOW DATABASES, then iterates tables checking column count. Picks tpcc.customer.',
    discoveredResource: 'tpcc.customer (column: c_last)',
    resolvedDescription: 'add random index to tpcc.customer',
    resolvedSteps: [
      { description: 'add random index to tpcc.customer', accesses: [schemaChangeLock('tpcc', 'customer')], releases: [schemaChangeLock('tpcc', 'customer')] },
    ],
  },
  {
    chainIndex: 7,
    stageIndex: 2,
    stepDescription: 'add index',
    prePlanAction: 'Same as above — calls h.SearchTable(). With this seed, also picks tpcc.customer. This creates a conflict with chain 6 that was invisible at build time!',
    discoveredResource: 'tpcc.customer (column: c_balance)',
    resolvedDescription: 'add random index to tpcc.customer',
    resolvedSteps: [
      { description: 'add random index to tpcc.customer', accesses: [schemaChangeLock('tpcc', 'customer')], releases: [schemaChangeLock('tpcc', 'customer')] },
    ],
  },
  {
    chainIndex: 8,
    stageIndex: 2,
    stepDescription: 'add index',
    prePlanAction: 'Calls h.SearchTable() — picks a different table this time.',
    discoveredResource: 'tpcc.stock (column: s_w_id)',
    resolvedDescription: 'add random index to tpcc.stock',
    resolvedSteps: [
      { description: 'add random index to tpcc.stock', accesses: [schemaChangeLock('tpcc', 'stock')], releases: [schemaChangeLock('tpcc', 'stock')] },
    ],
  },
  {
    chainIndex: 9,
    stageIndex: 2,
    stepDescription: 'backup database',
    prePlanAction: 'Calls findDatabaseToBackup() with whitelist ["tpcc", "cct_tpcc", "bank"]. Queries SHOW DATABASES and matches against whitelist. Finds "tpcc".',
    discoveredResource: 'database: tpcc',
    resolvedDescription: 'backup database tpcc (full)',
    resolvedSteps: [
      { description: 'backup database tpcc (full)', accesses: [restoreLock('tpcc')], releases: [] },
      { description: 'backup database tpcc (incremental)', accesses: [], releases: [] },
      { description: 'restore database tpcc', accesses: [], releases: [restoreLock('tpcc')] },
    ],
  },
  {
    chainIndex: 11,
    stageIndex: 2,
    stepDescription: 'change cluster setting',
    prePlanAction: 'Selects random setting from safe settings list. Picks value from allowed values for that setting.',
    discoveredResource: 'kv.snapshot_rebalance.max_rate → "2 GiB"',
    resolvedDescription: 'change kv.snapshot_rebalance.max_rate',
    resolvedSteps: [
      { description: 'change kv.snapshot_rebalance.max_rate', accesses: [clusterSettingLock('kv.snapshot_rebalance.max_rate')], releases: [] },
      { description: 'revert kv.snapshot_rebalance.max_rate', accesses: [], releases: [clusterSettingLock('kv.snapshot_rebalance.max_rate')] },
    ],
  },
];

const mixedVersionUpgrade: Scenario = {
  name: 'mixed_version_upgrade',
  description: `Mixed-version upgrade test on a 4-node cluster with dynamic resource discovery. Dynamic operations (AddRandomIndex, BackupRestore, NodeRestart, ChangeClusterSetting) discover available resources at PrePlan time by querying the live database. The planner then detects conflicts and merges chains.`,
  seed: 12345,
  stages: [
    // -----------------------------------------------------------------------
    // Stage 0: Cluster Init — single chain, no locks, sequential setup.
    // -----------------------------------------------------------------------
    {
      name: 'cluster-init',
      chains: [
        [
          [step('install fixtures for v24.3')],
          [step('start cluster at v24.3')],
          [step('wait for cluster version ack')],
        ],
      ],
      maxStepConcurrency: 1,
    },

    // -----------------------------------------------------------------------
    // Stage 1: Startup — import datasets in parallel via step group.
    // -----------------------------------------------------------------------
    {
      name: 'startup',
      chains: [
        [
          [step('set preserve_downgrade_option to 24.3')],
          [step('enable tenant split/scatter features')],
          [step('import TPCC dataset (1000 warehouses)'), step('import bank dataset (32M rows)')],
        ],
      ],
      maxStepConcurrency: 2,
    },

    // -----------------------------------------------------------------------
    // Stage 2: Upgrade v24.3 → v25.1 — the complex stage.
    //
    // 13 chains with a mix of static and dynamic operations.
    // Dynamic steps initially show with "?" resources that get resolved
    // during PrePlan. After PrePlan, the conflict detection runs.
    //
    // Expected conflict groups after PrePlan:
    //   [1,2,3,4,5]  — all lock NodeAvailability
    //   [6,7]        — both lock SchemaChange on tpcc.customer (discovered at PrePlan!)
    //   [9,10]       — RestoreAccess tpcc (db) conflicts with tpcc.order_line (table)
    //   [0]          — TPCC workload, no locks
    //   [8]          — SchemaChange tpcc.stock (different table, no conflict)
    //   [11]         — unique cluster setting
    //   [12]         — replication cycle, no locks
    // -----------------------------------------------------------------------
    {
      name: 'upgrade v24.3 → v25.1',
      chains: [
        // Chain 0: TPCC workload (no locks — can run with anything)
        [
          [step('init tpcc workload')],
          [step('run tpcc workload (10 min)')],
          [step('check tpcc consistency')],
        ],

        // Chain 1–4: Rolling node restarts (static, each locks NodeAvailability)
        [
          [step('restart node 1 with v25.1',
            [nodeAvailabilityLock()],
            [nodeAvailabilityLock()])],
        ],
        [
          [step('restart node 2 with v25.1',
            [nodeAvailabilityLock()],
            [nodeAvailabilityLock()])],
        ],
        [
          [step('restart node 3 with v25.1',
            [nodeAvailabilityLock()],
            [nodeAvailabilityLock()])],
        ],
        [
          [step('restart node 4 with v25.1',
            [nodeAvailabilityLock()],
            [nodeAvailabilityLock()])],
        ],

        // Chain 5: NodeRestart dynamic — resources unknown until PrePlan
        [
          [step('restart random node', [], [], true)],
        ],

        // Chain 6: AddRandomIndex dynamic #1 — resources unknown until PrePlan
        [
          [step('add index', [], [], true)],
        ],

        // Chain 7: AddRandomIndex dynamic #2 — resources unknown until PrePlan
        [
          [step('add index', [], [], true)],
        ],

        // Chain 8: AddRandomIndex dynamic #3 — resources unknown until PrePlan
        [
          [step('add index', [], [], true)],
        ],

        // Chain 9: BackupRestoreDatabaseDynamic — resources unknown until PrePlan
        [
          [step('backup database', [], [], true)],
          [step('incremental backup', [], [], true)],
          [step('restore database', [], [], true)],
        ],

        // Chain 10: BackupRestore specific table tpcc.order_line (static)
        // Conflicts with chain 9: RestoreAccess(tpcc.order_line) is a child
        // of RestoreAccess(tpcc) → hierarchical conflict → must merge.
        [
          [step('full backup tpcc.order_line',
            [restoreLock('tpcc', 'order_line')])],
          [step('restore tpcc.order_line', [],
            [restoreLock('tpcc', 'order_line')])],
        ],

        // Chain 11: ChangeClusterSettingDynamic — resources unknown until PrePlan
        [
          [step('change cluster setting', [], [], true)],
          [step('revert cluster setting', [], [], true)],
        ],

        // Chain 12: ReplicationFactorCycle (no locks — independent)
        [
          [step('increase rebalance snapshot rate')],
          [step('increase replication factor to 5')],
          [step('wait for replication to 5')],
          [step('decrease replication factor to 3')],
          [step('wait for replication to 3')],
          [step('restore rebalance snapshot rate')],
        ],
      ],
      maxStepConcurrency: 4,
    },

    // -----------------------------------------------------------------------
    // Stage 3: Finalize — restart all nodes with v25.1, finalize version.
    // Step group: all restarts in same group (can be reordered, each locks
    // NodeAvailability so they serialize via concurrent grouping).
    // -----------------------------------------------------------------------
    {
      name: 'finalize',
      chains: [
        // Chain 0: TPCC workload during finalization
        [
          [step('run tpcc workload')],
        ],
        // Chain 1: restart all nodes + finalize version
        [
          [
            step('restart node 1 with v25.1', [nodeAvailabilityLock()], [nodeAvailabilityLock()]),
            step('restart node 2 with v25.1', [nodeAvailabilityLock()], [nodeAvailabilityLock()]),
            step('restart node 3 with v25.1', [nodeAvailabilityLock()], [nodeAvailabilityLock()]),
            step('restart node 4 with v25.1', [nodeAvailabilityLock()], [nodeAvailabilityLock()]),
            step('reset preserve_downgrade_option'),
          ],
          [step('wait for v25.1 cluster version ack')],
        ],
      ],
      maxStepConcurrency: 4,
    },

    // -----------------------------------------------------------------------
    // Stage 4: Validation
    // -----------------------------------------------------------------------
    {
      name: 'validation',
      chains: [
        [
          [step('check tpcc workload integrity')],
        ],
      ],
      maxStepConcurrency: 1,
    },
  ],
};

// Apply PrePlan resolutions to a stage, replacing dynamic step names and resources.
// `count` controls how many resolutions to apply (for progressive reveal).
export function applyResolutions(stage: Stage, stageIndex: number, count?: number): Stage {
  const resolutions = dynamicResolutions.filter(r => r.stageIndex === stageIndex);
  const toApply = resolutions.slice(0, count ?? resolutions.length);

  if (toApply.length === 0) return stage;

  // Deep clone chains
  const newChains = stage.chains.map(chain =>
    chain.map(group => group.map(s => ({
      ...s,
      resources: {
        accesses: [...s.resources.accesses],
        releases: [...s.resources.releases],
      },
    })))
  );

  for (const res of toApply) {
    const chain = newChains[res.chainIndex];
    if (!chain || !res.resolvedSteps) continue;

    // Replace steps in chain with resolved versions
    for (let depth = 0; depth < Math.min(chain.length, res.resolvedSteps.length); depth++) {
      const resolved = res.resolvedSteps[depth];
      if (chain[depth].length > 0) {
        chain[depth][0] = {
          description: resolved.description,
          resources: {
            accesses: [...resolved.accesses],
            releases: [...resolved.releases],
          },
          isDynamic: true,
        };
      }
    }
  }

  return { ...stage, chains: newChains };
}

export const preloadedScenarios: Scenario[] = [
  mixedVersionUpgrade,
];
