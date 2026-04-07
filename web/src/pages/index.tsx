import { useState } from 'react';
import { useRouter } from 'next/router';
import { login, register } from '@/services/auth';
import { apiRequest, fetchUsersPresence } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useChatStore, Room } from '@/store/chatStore';
import { useToastStore } from '@/store/toastStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';

export default function LoginPage() {
  console.log('LoginPage rendering');
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setRooms = useChatStore((s) => s.setRooms);
  const showToast = useToastStore((s) => s.show);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);

  const onLogin = async (email: string, password: string) => {
    setError('');
    setIsLoading(true);
    try {
      const res = await login(email, password);
      setTokens(res.accessToken, res.refreshToken, res.userId, res.username);
      
      // Fetch rooms after successful login
      const rooms = await apiRequest<Room[]>('/rooms', { auth: true });
      setRooms(rooms);
      
      // Set up room data and presence
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
      
      // Fetch user presence data
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
      
      // Show success notification
      showToast('Login successful!', 'success');
      
      // Navigate to appropriate page
      if (rooms.length > 0) {
        router.push(`/rooms/${rooms[0]._id}`);
      } else {
        router.push('/rooms/new');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login failed';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const onRegister = async (email: string, username: string, password: string) => {
    setError('');
    setIsLoading(true);
    try {
      const res = await register(email, username, password);
      setTokens(res.accessToken, res.refreshToken, res.userId, res.username);
      
      // Show success notification
      showToast('Registration successful! Welcome to Chat App!', 'success');
      
      // Navigate to create room page since new users won't have rooms
      router.push('/rooms/new');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Register failed';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsLoading(false);
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
          <LoginForm onSubmit={onLogin} isLoading={isLoading} />
        ) : (
          <RegisterForm onSubmit={onRegister} isLoading={isLoading} />
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
