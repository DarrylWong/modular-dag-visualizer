// Consistent color palette for chains and resources

const CHAIN_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#a855f7', // purple
  '#64748b', // slate
  '#84cc16', // lime
];

const RESOURCE_COLORS: Record<string, string> = {
  'cluster_setting': '#f59e0b',
  'schema_change': '#8b5cf6',
  'restore': '#3b82f6',
  'node_availability': '#ef4444',
  '*': '#94a3b8',
};

export function getChainColor(index: number): string {
  return CHAIN_COLORS[index % CHAIN_COLORS.length];
}

export function getChainColorLight(index: number): string {
  return CHAIN_COLORS[index % CHAIN_COLORS.length] + '33'; // 20% opacity
}

export function getResourceColor(action: string): string {
  return RESOURCE_COLORS[action] || '#94a3b8';
}

export function getResourceColorLight(action: string): string {
  return (RESOURCE_COLORS[action] || '#94a3b8') + '33';
}
