import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useToastStore } from '@/store/toastStore';
import { apiRequest, patchPreferences } from '@/services/api';
import { Avatar } from '../ui/Avatar';
import {
    HiXMark, HiPencil, HiPhoto, HiSun, HiMoon,
    HiArrowRightOnRectangle, HiUser, HiCheckCircle,
} from 'react-icons/hi2';
import { useRouter } from 'next/router';

interface ProfileCardProps {
    onClose: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function ProfileCard({ onClose }: ProfileCardProps) {
    const router = useRouter();
    const username = useAuthStore((s) => s.username);
    const clear = useAuthStore((s) => s.clear);
    const setTokens = useAuthStore((s) => s.setTokens);
    const { theme, toggleTheme } = useThemeStore();
    const showToast = useToastStore((s) => s.show);

    const [editingName, setEditingName] = useState(false);
    const [newName, setNewName] = useState(username || '');
    const [uploading, setUploading] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
    const [saving, setSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const onToggleTheme = async () => {
        const next = theme === 'dark' ? 'light' : theme === 'light' ? 'midnight' : 'dark';
        toggleTheme();
        await patchPreferences({ theme: next }).catch(() => null);
    };

    useEffect(() => {
        apiRequest<any>('/users/me', { auth: true })
            .then((me) => { if (me?.avatar) setAvatarUrl(me.avatar); })
            .catch(() => { });
    }, []);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const token = useAuthStore.getState().accessToken;
            const form = new FormData();
            form.append('file', file);
            form.append('roomId', 'profile');
            const res = await fetch(`${API_URL}/uploads`, {
                method: 'POST',
                headers: token ? { authorization: `Bearer ${token}` } : undefined,
                body: form,
            });
            if (!res.ok) throw new Error('Upload failed');
            const json = await res.json();
            const data = json?.data ?? json;
            setAvatarUrl(data.url);
            showToast('Avatar uploaded', 'success');
        } catch (err: any) {
            showToast(err.message || 'Upload failed', 'error');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleSaveName = async () => {
        if (!newName.trim() || newName === username) { setEditingName(false); return; }
        setSaving(true);
        try {
            await apiRequest('/users/me', { method: 'PATCH', auth: true, body: { username: newName.trim() } });
            const state = useAuthStore.getState();
            if (state.accessToken && state.refreshToken && state.userId) {
                state.setTokens(state.accessToken, state.refreshToken, state.userId, newName.trim());
            }
            showToast('Name updated', 'success');
            setEditingName(false);
        } catch (err: any) {
            showToast(err.message || 'Failed to update name', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-premium)] overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50">
            {/* Avatar + name header */}
            <div className="p-5 bg-gradient-to-b from-[var(--color-primary)]/10 to-transparent border-b border-[var(--color-border)]">
                <div className="flex items-center gap-4">
                    {/* Clickable avatar for upload */}
                    <label className="relative cursor-pointer group shrink-0">
                        <Avatar
                            name={username || 'Me'}
                            src={avatarUrl ? (avatarUrl.startsWith('/') ? `${API_URL}${avatarUrl}` : avatarUrl) : undefined}
                            size={56}
                            status="online"
                            className="ring-2 ring-[var(--color-primary)]/30 group-hover:ring-[var(--color-primary)] transition-all"
                        />
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {uploading
                                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <HiPhoto className="w-5 h-5 text-white" />
                            }
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    </label>

                    <div className="flex-1 min-w-0">
                        {editingName ? (
                            <div className="flex items-center gap-2">
                                <input
                                    autoFocus
                                    className="flex-1 bg-[var(--color-surface-2)] border border-[var(--color-primary)]/30 rounded-lg px-2 py-1 text-sm font-bold text-[var(--color-text)] outline-none"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                                />
                                <button onClick={handleSaveName} disabled={saving} className="text-[var(--color-primary)] hover:opacity-80">
                                    {saving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <HiCheckCircle className="w-5 h-5" />}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => { setEditingName(true); setNewName(username || ''); }}
                                className="flex items-center gap-1.5 group/name"
                            >
                                <span className="text-sm font-bold text-[var(--color-text)] truncate">{username || 'Me'}</span>
                                <HiPencil className="w-3.5 h-3.5 text-[var(--color-text-muted)] opacity-0 group-hover/name:opacity-100 transition-opacity" />
                            </button>
                        )}
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] inline-block" />
                            Online
                        </p>
                    </div>

                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-colors shrink-0 self-start">
                        <HiXMark className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Actions */}
            <div className="py-1">
                <button
                    onClick={onToggleTheme}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                    {theme === 'dark'
                        ? <HiSun className="w-4 h-4 text-[var(--color-warning)]" />
                        : <HiMoon className="w-4 h-4 text-[var(--color-primary)]" />}
                    <span>{theme === 'dark' ? 'Switch to Light mode' : theme === 'light' ? 'Switch to Midnight mode' : 'Switch to Dark mode'}</span>
                </button>

                <button
                    onClick={() => { onClose(); router.push('/settings'); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                    <HiUser className="w-4 h-4" />
                    <span>Settings</span>
                </button>

                <button
                    onClick={() => { clear(); router.replace('/'); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 transition-colors"
                >
                    <HiArrowRightOnRectangle className="w-4 h-4" />
                    <span>Sign out</span>
                </button>
            </div>
        </div>
    );
}
