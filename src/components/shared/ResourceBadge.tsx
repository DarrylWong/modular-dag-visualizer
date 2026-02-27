import { ResourceAccess } from '../../types';
import { getResourceColor } from '../../utils/colors';
import { resourcePathString } from '../../algorithms/resources';

interface Props {
  access: ResourceAccess;
  isRelease?: boolean;
  compact?: boolean;
}

export default function ResourceBadge({ access, isRelease, compact }: Props) {
  const color = getResourceColor(access.action);
  const pathStr = resourcePathString(access.path);
  const lockIcon = access.lock ? '\u{1F512}' : '\u{1F441}';
  const releasePrefix = isRelease ? '\u{2934}\uFE0F ' : '';

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono whitespace-nowrap"
      style={{
        backgroundColor: color + '20',
        color,
        border: `1px solid ${color}40`,
      }}
      title={`${isRelease ? 'Release' : 'Acquire'} ${access.lock ? 'exclusive lock' : 'non-exclusive access'}: ${access.action} on ${pathStr}`}
    >
      {releasePrefix}{lockIcon}
      {!compact && (
        <>
          <span className="opacity-70">{access.action === '*' ? 'any' : access.action}</span>
          <span>{pathStr}</span>
        </>
      )}
      {compact && <span>{pathStr.length > 15 ? pathStr.slice(0, 15) + '...' : pathStr}</span>}
    </span>
  );
}
