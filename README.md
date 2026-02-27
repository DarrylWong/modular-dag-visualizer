# Modular DAG Visualizer

Interactive visualizer for the CockroachDB modular test framework's DAG construction pipeline. Walks through how the planner takes a set of independent test operations, detects resource conflicts, merges chains, permutes steps, and groups them for concurrent execution.

## Running

```bash
npm install
npm run dev
```

Open http://localhost:5173 in a browser.

## Building

```bash
npm run build
npm run preview   # serve the production build locally
```

## Usage

The visualizer presents a realistic mixed-version upgrade scenario and steps through 7 pipeline phases:

1. **Initial State** -- the DAG of all chains before processing
2. **PrePlan** -- dynamic steps query the database to discover resources (tables, nodes, settings) and declare their locks
3. **Conflict Detection** -- union-find groups chains that have conflicting resource accesses
4. **Chain Merging** -- conflicting chains are merged via rejection-sampled interleaving with animated lock validation
5. **Step Permutation** -- steps are randomly reordered via adjacent swaps
6. **Concurrent Grouping** -- steps are grouped for parallel execution
7. **Test Plan** -- final executable plan as a tree

Navigate with the left/right arrow keys or the buttons at the bottom of the screen. Click any step node to see its resource lock details. Use the stage buttons at the top to switch between stages of the test.