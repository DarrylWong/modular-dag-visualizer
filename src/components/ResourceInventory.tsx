import { availableTables, availableDatabases } from '../scenarios/preloaded';

export default function ResourceInventory() {
  return (
    <div className="px-4 py-2 border-b border-slate-700 bg-slate-900/50 flex items-start gap-4 text-xs">
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-slate-500">Databases:</span>
        {availableDatabases.map((db, i) => (
          <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
            {db}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-slate-500">Tables:</span>
        {availableTables.map((t, i) => (
          <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
            {t.database}.{t.table}
          </span>
        ))}
      </div>
    </div>
  );
}
