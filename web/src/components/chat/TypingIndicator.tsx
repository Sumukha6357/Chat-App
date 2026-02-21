export function TypingIndicator({ users }: { users: string[] }) {
  if (!users.length) return null;
  return (
    <div className="px-4 pb-2 text-xs text-[var(--color-text-secondary)] pulse">
      {users.length === 1 ? 'Someone is typing...' : 'Multiple users are typing...'}
    </div>
  );
}
