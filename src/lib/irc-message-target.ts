const SERVICES = /^(nickserv|chanserv|memoserv|operserv|hostserv|botserv|helpserv|statserv|infoserv|global|alis)$/i;

export function messageTarget(command: string, source: string, target: string, ownNick: string, openQueries: ReadonlySet<string>) {
  if (/^[#&]/.test(target)) return { label: target, kind: 'channel' as const };
  const explicitlyOpen = openQueries.has(source.toLowerCase());
  if (!explicitlyOpen && (command === 'NOTICE' || SERVICES.test(source) || source.includes('.') || target.toLowerCase() !== ownNick.toLowerCase())) {
    return { label: 'server', kind: 'server' as const };
  }
  return { label: source, kind: 'query' as const };
}