export function PresenceIndicator({ status }: { status: 'online' | 'offline' | 'away' }) {
  const color =
    status === 'online' ? 'bg-green-500' : status === 'away' ? 'bg-yellow-500' : 'bg-gray-400';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}
