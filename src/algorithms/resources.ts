import { ResourceAccess, ResourcePath } from '../types';

// Port of resources.go — conflict detection logic

export function resourcePathString(path: ResourcePath): string {
  switch (path.type) {
    case 'database':
      let res = `db:${path.database}`;
      if (path.table) res += `->table:${path.table}`;
      return res;
    case 'cluster_setting':
      return path.name;
    case 'node_availability':
      return `n${path.nodeId ?? 0}`;
  }
}

export function resourceAccessString(access: ResourceAccess): string {
  return `${access.action}->${resourcePathString(access.path)}`;
}

// Port of DatabaseResource.ConflictsWith, ClusterSettingResource.ConflictsWith,
// NodeAvailabilityResource.ConflictsWith
export function pathConflicts(a: ResourcePath, b: ResourcePath): boolean {
  if (a.type !== b.type) return false;

  switch (a.type) {
    case 'database': {
      const bDb = b as { type: 'database'; database: string; table?: string };
      if (a.database !== bDb.database) return false;
      if (!a.table || !bDb.table) return true; // database-level = conflicts with everything in that db
      return a.table === bDb.table;
    }
    case 'cluster_setting': {
      const bCs = b as { type: 'cluster_setting'; name: string };
      return a.name === bCs.name;
    }
    case 'node_availability': {
      // All node unavailability is treated as incompatible
      return b.type === 'node_availability';
    }
  }
}

// Port of ResourceAccess.ConflictsWith (resources.go:117-135)
export function resourceConflicts(a: ResourceAccess, b: ResourceAccess): boolean {
  // If neither has locks, no conflict (both are non-exclusive accesses)
  if (!a.lock && !b.lock) return false;

  // Check if actions match
  const actionsMatch = a.action === b.action ||
    a.action === '*' || b.action === '*';

  if (!actionsMatch) return false;

  return pathConflicts(a.path, b.path);
}
