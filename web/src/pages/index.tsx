import { useState } from 'react';
import { useRouter } from 'next/router';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { login, register } from '@/services/auth';
import { apiRequest, fetchUsersPresence } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useToastStore } from '@/store/toastStore';

export default function Home() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setRooms = useChatStore((s) => s.setRooms);
  const showToast = useToastStore((s) => s.show);

  const onLogin = async (email: string, password: string) => {
    setError('');
    try {
      const res = await login(email, password);
      setTokens(res.accessToken, res.refreshToken, res.userId, res.username);
      const rooms = await apiRequest<any[]>('/rooms', { auth: true });
      setRooms(rooms);
      const otherUserIds = new Set<string>();
      rooms.forEach((room) => {
        if (typeof room.unreadCount === 'number') {
          useChatStore.getState().setRoomUnread(room._id, room.unreadCount);
        }
        if (room.lastReadMessageId || room.lastReadAt) {
          useChatStore.getState().setRoomReadCursor(
            room._id,
            room.lastReadMessageId,
            room.lastReadAt ? new Date(room.lastReadAt).getTime() : undefined,
          );
        }
        if (room.type === 'direct' && Array.isArray(room.members)) {
          room.members.forEach((id: string) => {
            if (id !== useAuthStore.getState().userId) otherUserIds.add(id);
          });
        }
      });
      if (otherUserIds.size > 0) {
        const presence = await fetchUsersPresence(Array.from(otherUserIds));
        const map: Record<string, { status: 'online' | 'offline' | 'away'; lastSeenAt?: number }> = {};
        Object.entries(presence).forEach(([userId, data]) => {
          map[userId] = {
            status: data.status,
            lastSeenAt: data.lastSeenAt ? Number(data.lastSeenAt) : undefined,
          };
        });
        useChatStore.getState().bulkUpsertUserPresence(map);
      }
      if (rooms.length > 0) {
        router.push(`/rooms/${rooms[0]._id}`);
      } else {
        router.push('/rooms/new');
      }
    } catch (e: any) {
      setError(e.message || 'Login failed');
      showToast(e.message || 'Login failed', 'error');
    }
  };

  const onRegister = async (email: string, username: string, password: string) => {
    setError('');
    try {
      const res = await register(email, username, password);
      setTokens(res.accessToken, res.refreshToken, res.userId, res.username);
      router.push('/rooms/new');
    } catch (e: any) {
      setError(e.message || 'Register failed');
      showToast(e.message || 'Register failed', 'error');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="mb-2 text-xl font-bold">Chat App</h1>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          Sign in or create an account to continue.
        </p>
        {error ? <div className="mb-3 text-sm text-red-600">{error}</div> : null}
        {mode === 'login' ? (
          <LoginForm onSubmit={onLogin} />
        ) : (
          <RegisterForm onSubmit={onRegister} />
        )}
        <div className="mt-4 text-sm">
          {mode === 'login' ? 'No account?' : 'Already have an account?'}{' '}
          <Button
            variant="ghost"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Register' : 'Login'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
